
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  nickname: string;
  role: string;
  avatar_url: string | null;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type Player = {
  id: string;
  nickname: string | null;
  role: string;
  avatar_url: string | null;
};

const roleLabels: Record<string, string> = {
  admin: "Адміністратор",
  leader: "Лідер",
  moderator: "Модератор",
  senior: "Старший учасник",
  local: "Учасник",
  junior: "Молодший учасник"
};

const roleColors: Record<string, string> = {
  admin: "#ff9d42",
  leader: "#ff78b7",
  moderator: "#55d9ee",
  senior: "#bb8aff",
  local: "#65a8ff",
  junior: "#b9c0cc"
};

const stickerGroups = [
  {
    title: "Емоції",
    items: ["😀", "😃", "😄", "😁", "😆", "😂", "🤣", "🥹", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😭", "😡", "🤔", "😴", "🤗"]
  },
  {
    title: "Реакції",
    items: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "🫶", "👌", "✌️", "🤌", "🫡"]
  },
  {
    title: "Символи",
    items: ["❤️", "💜", "💙", "💚", "💛", "🖤", "🤍", "💔", "🔥", "✨", "⭐", "💯", "🎉", "🎊", "💫", "🌈"]
  },
  {
    title: "Тварини",
    items: ["🐱", "🐶", "🐼", "🐸", "🐻", "🐰", "🦊", "🐵", "🐧", "🐥", "🦋", "🐢"]
  }
];

function parseMessage(content: string) {
  try {
    const value = JSON.parse(content);

    if (
      value &&
      typeof value === "object" &&
      ["image", "audio", "sticker"].includes(value.type)
    ) {
      return value as {
        type: "image" | "audio" | "sticker";
        url?: string;
        name?: string;
        emoji?: string;
      };
    }
  } catch {
    // Звичайне текстове повідомлення.
  }

  return null;
}

export default function ChatRoom({ initialRecipientId = null }: { initialRecipientId?: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const [content, setContent] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [directLoading, setDirectLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stickerSearch, setStickerSearch] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const resolveMediaContent = useCallback(async (content: string) => {
    const media = parseMessage(content);
    if (!media?.url || typeof media.url !== "string") return content;

    let objectPath = media.url;
    const publicPrefix = "/storage/v1/object/public/chat-media/";
    const prefixIndex = objectPath.indexOf(publicPrefix);

    if (prefixIndex >= 0) {
      objectPath = objectPath.slice(prefixIndex + publicPrefix.length);
      try {
        objectPath = decodeURIComponent(objectPath);
      } catch {
        return content;
      }
    }

    const { data, error } = await supabase.storage
      .from("chat-media")
      .createSignedUrl(objectPath, 3600);

    if (error || !data?.signedUrl) {
      console.error("Chat media signing error:", error?.message);
      return content;
    }

    return JSON.stringify({ ...media, url: data.signedUrl });
  }, [supabase]);

  const loadMessages = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? "";

    setUserId(currentUserId);

    if (!currentUserId) {
      setLoading(false);
      setError("Потрібно увійти в акаунт.");
      return;
    }

    const { data: messageData, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, user_id, content, created_at")
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesError) {
      setError("Не вдалося завантажити повідомлення.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nickname, role, avatar_url")
      .order("nickname", { ascending: true });

    if (profilesError) {
      setError("Не вдалося завантажити список учасників.");
      setLoading(false);
      return;
    }

    const profileList = (profileData ?? []) as Player[];
    setPlayers(profileList);

    const profileMap = new Map(
      profileList.map((profile) => [profile.id, profile])
    );

    setMessages(
      await Promise.all(
        (messageData ?? []).map(async (item) => {
          const profile = profileMap.get(item.user_id);

          return {
            ...item,
            content: await resolveMediaContent(item.content),
            nickname: profile?.nickname || "Учасник",
            role: profile?.role || "junior",
            avatar_url: profile?.avatar_url ?? null
          };
        })
      )
    );

    setError("");
    setLoading(false);
  }, [supabase, resolveMediaContent]);

  // Завантаження приватної переписки та позначення отриманих повідомлень прочитаними.
  const loadDirectMessages = useCallback(async () => {
    if (!selectedPlayer) {
      setDirectMessages([]);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id;

    if (!currentUserId) return;

    setDirectLoading(true);

    const { data, error: directError } = await supabase
      .from("direct_messages")
      .select("id, sender_id, recipient_id, content, created_at, is_read")
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${selectedPlayer.id}),and(sender_id.eq.${selectedPlayer.id},recipient_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    if (directError) {
      setError("Не вдалося завантажити особисті повідомлення.");
      setDirectLoading(false);
      return;
    }

    const unreadIds = (data ?? [])
      .filter(
        (message) =>
          message.recipient_id === currentUserId &&
          message.is_read === false
      )
      .map((message) => message.id);

    if (unreadIds.length > 0) {
      const { error: readError } = await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .in("id", unreadIds);

      if (readError) {
        setError("Не вдалося позначити повідомлення прочитаними.");
      }
    }

    setDirectMessages(
      await Promise.all(
        (data ?? []).map(async (message) => ({
          ...message,
          content: await resolveMediaContent(message.content),
          is_read:
            message.recipient_id === currentUserId
              ? true
              : message.is_read
        }))
      ) as DirectMessage[]
    );

    setError("");
    setDirectLoading(false);
  }, [supabase, selectedPlayer, resolveMediaContent]);

  useEffect(() => {
    void loadMessages();

    const channel = supabase
      .channel("verceti-chat")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages"
        },
        () => {
          void loadMessages();
        }
      )
      .subscribe();

    const directChannel = supabase
      .channel("verceti-direct-chat")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages"
        },
        () => {
          void loadDirectMessages();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(directChannel);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [loadMessages, loadDirectMessages, supabase]);

  useEffect(() => {
    void loadDirectMessages();
  }, [loadDirectMessages]);

  async function saveMessage(messageContent: string) {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      throw new Error("Потрібно увійти в акаунт.");
    }

    if (selectedPlayer) {
      const { error: insertError } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: authData.user.id,
          recipient_id: selectedPlayer.id,
          content: messageContent
        });

      if (insertError) {
        throw new Error("Не вдалося надіслати особисте повідомлення.");
      }

      await loadDirectMessages();
    } else {
      const { error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: authData.user.id,
          content: messageContent
        });

      if (insertError) {
        throw new Error("Не вдалося надіслати повідомлення.");
      }

      await loadMessages();
    }
  }

  async function uploadFile(file: File, type: "image" | "audio") {
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      throw new Error("Потрібно увійти в акаунт.");
    }

    const extension = file.name.includes(".")
      ? file.name.split(".").pop()
      : type === "image" ? "jpg" : "webm";

    const filePath = `${authData.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error("Не вдалося завантажити файл.");
    }

    await saveMessage(
      JSON.stringify({
        type,
        url: filePath,
        name: file.name
      })
    );
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = content.trim();

    if (!message || sending) return;

    if (message.length > 2000) {
      setError("Повідомлення не може бути довшим за 2000 символів.");
      return;
    }

    setSending(true);
    setError("");

    try {
      await saveMessage(message);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка надсилання.");
    } finally {
      setSending(false);
    }
  }

  function insertSticker(emoji: string) {
    setContent((current) => {
      const separator =
        current.length > 0 && !current.endsWith(" ") ? " " : "";

      return current + separator + emoji + " ";
    });

    setShowStickers(false);

    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  }

  async function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Можна додавати лише зображення.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("Максимальний розмір фото — 15 МБ.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      await uploadFile(file, "image");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка завантаження фото.");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Запис голосу не підтримується цим браузером.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      streamRef.current = stream;

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4"
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (blob.size === 0) {
          setError("Запис порожній. Спробуй ще раз.");
          return;
        }

        if (blob.size > 15 * 1024 * 1024) {
          setError("Голосове повідомлення завелике.");
          return;
        }

        setUploading(true);
        setError("");

        const extension = blob.type.includes("ogg")
          ? "ogg"
          : blob.type.includes("mp4")
            ? "mp4"
            : "webm";

        const file = new File(
          [blob],
          `voice-${Date.now()}.${extension}`,
          { type: blob.type }
        );

        try {
          await uploadFile(file, "audio");
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Не вдалося надіслати голосове."
          );
        } finally {
          setUploading(false);
        }
      };

      recorder.start();
      setRecording(true);
      setError("");
    } catch {
      setError("Немає доступу до мікрофона. Дозволь його в браузері.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }

    setRecording(false);
  }

  async function deleteMessage(id: string) {
    const confirmed = window.confirm("Точно видалити це повідомлення?");
    if (!confirmed) return;

    if (selectedPlayer) {
      const { error: deleteError } = await supabase
        .from("direct_messages")
        .delete()
        .eq("id", id)
        .eq("sender_id", userId);

      if (deleteError) {
        setError("Не вдалося видалити повідомлення.");
      } else {
        await loadDirectMessages();
      }
    } else {
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) {
        setError("Не вдалося видалити повідомлення.");
      } else {
        await loadMessages();
      }
    }
  }

  function openPrivateChat(player: Player) {
    if (player.id === userId) return;

    setSelectedPlayer(player);
    setContent("");
    setError("");
    setShowStickers(false);
    setDirectMessages([]);
  }

  useEffect(() => {
    if (!initialRecipientId || selectedPlayer) return;
    const recipient = players.find((player) => player.id === initialRecipientId);
    if (!recipient || recipient.id === userId) return;
    setSelectedPlayer(recipient);
    setContent("");
    setError("");
    setShowStickers(false);
    setDirectMessages([]);
  }, [initialRecipientId, players, selectedPlayer, userId]);

  function openGeneralChat() {
    setSelectedPlayer(null);
    setContent("");
    setError("");
    setShowStickers(false);
  }

  const filteredStickerGroups = stickerGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((sticker) =>
        stickerSearch.trim()
          ? sticker.includes(stickerSearch.trim())
          : true
      )
    }))
    .filter((group) => group.items.length > 0);

  const selectedMessages = directMessages;

  return (
    <div
      className="chat-room-layout"
      style={{
        display: "grid",
        width: "100%",
        minWidth: 0,
        gap: 16,
        marginTop: 24,
        alignItems: "stretch"
      }}
    >
      <aside
        className="chat-room-participants"
        style={{
          position: "sticky",
          top: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}
      >
        <div className="panel">
          <button
            type="button"
            onClick={openGeneralChat}
            className="btn"
            style={{
              width: "100%",
              textAlign: "left",
              background: !selectedPlayer ? "rgba(155,92,255,0.2)" : undefined,
              borderColor: !selectedPlayer ? "#9b5cff" : undefined
            }}
          >
            📌 Загальний чат
          </button>

          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            Основна кімната спільноти
          </p>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Учасники</h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 480,
              overflowY: "auto"
            }}
          >
            {players.length === 0 ? (
              <p className="muted">Учасників поки немає.</p>
            ) : (
              players
                .filter((player) => player.id !== userId)
                .map((player) => {
                  const isSelected = selectedPlayer?.id === player.id;

                  return (
                    <button
                      type="button"
                      key={player.id}
                      onClick={() => openPrivateChat(player)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minWidth: 0,
                        width: "100%",
                        padding: 9,
                        textAlign: "left",
                        borderRadius: 9,
                        cursor: "pointer",
                        color: "inherit",
                        background: isSelected
                          ? "rgba(155,92,255,0.2)"
                          : "rgba(255,255,255,0.035)",
                        border: isSelected
                          ? "1px solid #9b5cff"
                          : "1px solid rgba(255,255,255,0.07)"
                      }}
                    >
                      {player.avatar_url ? <img src={player.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} /> : <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(187,138,255,.16)", flexShrink: 0, fontSize: 12 }}>{(player.nickname || "У").slice(0, 1).toUpperCase()}</span>}

                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: "#85818e",
                          flexShrink: 0
                        }}
                      />

                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            overflowWrap: "anywhere"
                          }}
                        >
                          {player.nickname || "Без нікнейму"}
                        </span>

                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: roleColors[player.role] ?? "#b9c0cc"
                          }}
                        >
                          {roleLabels[player.role] ?? player.role}
                        </span>
                      </span>

                      <span style={{ fontSize: 12, color: "#bb8aff" }}>
                        ✉
                      </span>
                    </button>
                  );
                })
            )}
          </div>

          <p className="page-note">
            Натисни на учасника, щоб написати йому особисто.
          </p>
        </div>
      </aside>

      <section className="panel chat-room-panel" style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 5 }}>
              {selectedPlayer
                ? `Особистий чат: ${selectedPlayer.nickname || "Учасник"}`
                : "Загальний чат"}
            </h2>

            <p className="muted" style={{ margin: 0 }}>
              {selectedPlayer
                ? "Приватна переписка між двома учасниками."
                : "Повідомлення доступні всім авторизованим учасникам VERCETI."}
            </p>
          </div>

          {selectedPlayer && (
            <button
              type="button"
              className="btn"
              onClick={openGeneralChat}
            >
              ← До загального чату
            </button>
          )}
        </div>

        <div
          style={{
            minHeight: 300,
            maxHeight: 520,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 12,
            marginTop: 16,
            borderRadius: 12,
            background: "rgba(0,0,0,0.18)"
          }}
        >
          {!selectedPlayer && (
            <>
              {loading ? (
                <p className="muted">Завантаження повідомлень...</p>
              ) : messages.length === 0 ? (
                <p className="muted">
                  Повідомлень поки немає. Напиши першим!
                </p>
              ) : (
                messages.map((message) => {
                  const attachment = parseMessage(message.content);

                  return (
                    <div
                      key={message.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.045)",
                        border: "1px solid rgba(255,255,255,0.07)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          flexWrap: "wrap",
                          marginBottom: 6
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {message.avatar_url ? <img src={message.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(187,138,255,.16)", fontSize: 11 }}>{message.nickname.slice(0, 1).toUpperCase()}</span>}
                          <strong>{message.nickname}</strong>
                          <span
                            style={{
                              marginLeft: 8,
                              color: roleColors[message.role] ?? "#b9c0cc",
                              fontSize: 12
                            }}
                          >
                            {roleLabels[message.role] ?? message.role}
                          </span>
                        </div>

                        <span className="notice-time">
                          {new Date(message.created_at).toLocaleString("uk-UA")}
                        </span>
                      </div>

                      {attachment?.type === "image" && attachment.url ? (
                        <a href={attachment.url} target="_blank" rel="noreferrer">
                          <img
                            src={attachment.url}
                            alt="Фото з чату"
                            style={{
                              display: "block",
                              maxWidth: "100%",
                              maxHeight: 360,
                              borderRadius: 10,
                              objectFit: "contain"
                            }}
                          />
                        </a>
                      ) : attachment?.type === "audio" && attachment.url ? (
                        <div style={{ width: "100%", maxWidth: 360 }}>
                          <div style={{ marginBottom: 6 }}>
                            🎤 Голосове повідомлення
                          </div>
                          <audio
                            controls
                            preload="metadata"
                            src={attachment.url}
                            style={{ width: "100%" }}
                          />
                        </div>
                      ) : attachment?.type === "sticker" ? (
                        <p style={{ fontSize: 22, margin: 0 }}>
                          {attachment.emoji}
                        </p>
                      ) : (
                        <p
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            margin: 0
                          }}
                        >
                          {message.content}
                        </p>
                      )}

                      {message.user_id === userId && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void deleteMessage(message.id)}
                          style={{
                            marginTop: 8,
                            padding: "5px 10px",
                            fontSize: 12
                          }}
                        >
                          Видалити своє повідомлення
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {selectedPlayer && (
            <>
              {directLoading ? (
                <p className="muted">Завантаження особистої переписки...</p>
              ) : selectedMessages.length === 0 ? (
                <p className="muted">
                  Особистих повідомлень ще немає. Напиши першим!
                </p>
              ) : (
                selectedMessages.map((message) => {
                  const isMine = message.sender_id === userId;
                  const attachment = parseMessage(message.content);

                  return (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: isMine ? "flex-end" : "flex-start",
                        width: "fit-content",
                        maxWidth: "85%",
                        minWidth: 100,
                        padding: 12,
                        borderRadius: 12,
                        background: isMine
                          ? "rgba(155,92,255,0.17)"
                          : "rgba(255,255,255,0.055)",
                        border: "1px solid rgba(187,138,255,0.17)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 6,
                          flexWrap: "wrap"
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {isMine ? "Ти" : <>{selectedPlayer.avatar_url ? <img src={selectedPlayer.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} /> : null}{selectedPlayer.nickname || "Учасник"}</>}
                        </span>

                        <span className="notice-time">
                          {new Date(message.created_at).toLocaleString("uk-UA")}
                        </span>
                      </div>

                      {attachment?.type === "image" && attachment.url ? (
                        <a href={attachment.url} target="_blank" rel="noreferrer">
                          <img
                            src={attachment.url}
                            alt="Фото в особистому чаті"
                            style={{
                              display: "block",
                              maxWidth: "100%",
                              maxHeight: 360,
                              borderRadius: 10,
                              objectFit: "contain"
                            }}
                          />
                        </a>
                      ) : attachment?.type === "audio" && attachment.url ? (
                        <div style={{ width: "100%", maxWidth: 360 }}>
                          <div style={{ marginBottom: 6 }}>
                            🎤 Голосове повідомлення
                          </div>
                          <audio
                            controls
                            preload="metadata"
                            src={attachment.url}
                            style={{ width: "100%" }}
                          />
                        </div>
                      ) : attachment?.type === "sticker" ? (
                        <p style={{ fontSize: 22, margin: 0 }}>
                          {attachment.emoji}
                        </p>
                      ) : (
                        <p
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            margin: 0
                          }}
                        >
                          {message.content}
                        </p>
                      )}

                      {isMine && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void deleteMessage(message.id)}
                          style={{
                            marginTop: 8,
                            padding: "5px 10px",
                            fontSize: 12
                          }}
                        >
                          Видалити своє повідомлення
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {error && (
          <p style={{ color: "#ff8585", marginTop: 12 }}>
            {error}
          </p>
        )}

        {showStickers && (
          <div
            className="panel"
            style={{
              marginTop: 14,
              padding: 12,
              background: "rgba(20,16,38,0.96)",
              border: "1px solid rgba(187,138,255,0.25)"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10
              }}
            >
              <strong>Стікери та емодзі</strong>
              <button
                type="button"
                onClick={() => setShowStickers(false)}
                className="btn"
                style={{ padding: "4px 9px" }}
              >
                ✕
              </button>
            </div>

            <input
              value={stickerSearch}
              onChange={(event) => setStickerSearch(event.target.value)}
              placeholder="Пошук стікера..."
              style={{
                width: "100%",
                marginBottom: 12,
                boxSizing: "border-box"
              }}
            />

            <div style={{ maxHeight: 230, overflowY: "auto" }}>
              {filteredStickerGroups.length === 0 ? (
                <p className="muted">Нічого не знайдено.</p>
              ) : (
                filteredStickerGroups.map((group) => (
                  <div key={group.title} style={{ marginBottom: 12 }}>
                    <div
                      className="muted"
                      style={{
                        fontSize: 12,
                        marginBottom: 7,
                        fontWeight: 700
                      }}
                    >
                      {group.title}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
                        gap: 4
                      }}
                    >
                      {group.items.map((sticker) => (
                        <button
                          type="button"
                          key={sticker}
                          onClick={() => insertSticker(sticker)}
                          disabled={sending || uploading}
                          title={`Вставити ${sticker}`}
                          style={{
                            border: "1px solid transparent",
                            background: "transparent",
                            borderRadius: 7,
                            padding: 5,
                            fontSize: 23,
                            cursor: "pointer"
                          }}
                        >
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <form
          className="chat-room-composer"
          onSubmit={sendMessage}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 16,
            alignItems: "stretch"
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImage}
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="btn"
            title="Додати фото"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
          >
            📷 Фото
          </button>

          <button
            type="button"
            className="btn"
            title="Стікери"
            onClick={() => setShowStickers((value) => !value)}
            disabled={sending || uploading}
          >
            😊 Стікери
          </button>

          <button
            type="button"
            className="btn"
            title="Записати голос"
            onClick={() => {
              if (recording) {
                stopRecording();
              } else {
                void startRecording();
              }
            }}
            disabled={uploading || sending}
            style={{
              background: recording ? "#8f303f" : undefined,
              borderColor: recording ? "#b94b5c" : undefined
            }}
          >
            {recording ? "⏹ Зупинити запис" : "🎤 Голос"}
          </button>

          <input
            ref={messageInputRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              selectedPlayer
                ? `Повідомлення для ${selectedPlayer.nickname || "учасника"}...`
                : "Напиши повідомлення..."
            }
            maxLength={2000}
            className="chat-room-composer-input"
            style={{ flex: 1, minWidth: 0 }}
          />

          <button
            className="btn chat-room-send-button"
            type="submit"
            disabled={sending || uploading || !content.trim()}
          >
            {sending ? "Надсилання..." : "Надіслати"}
          </button>
        </form>

        {uploading && (
          <p className="muted" style={{ marginTop: 10 }}>
            Завантаження вкладення...
          </p>
        )}

        {recording && (
          <p style={{ color: "#ff8585", marginTop: 10 }}>
            <span>● </span>Йде запис голосу. Натисни «Зупинити запис», щоб надіслати.
          </p>
        )}

        <p className="page-note">
          {selectedPlayer
            ? "Це особиста переписка. Повідомлення доступні тільки тобі та обраному учаснику."
            : "Показано до 100 останніх повідомлень. Можна надсилати текст, фото, голосові повідомлення та стікери."}
        </p>
      </section>
    </div>
  );
}
