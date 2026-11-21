
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  nickname: string;
  role: string;
};

type Player = {
  id: string;
  nickname: string | null;
  role: string;
};

const roleLabels: Record<string, string> = {
  admin: "Адміністратор",
  leader: "Лідер",
  moderator: "Модератор",
  senior: "Старший місцевий",
  local: "Місцевий",
  junior: "Молодший місцевий"
};

const roleColors: Record<string, string> = {
  admin: "#ff9d42",
  leader: "#ff78b7",
  moderator: "#55d9ee",
  senior: "#bb8aff",
  local: "#65a8ff",
  junior: "#b9c0cc"
};

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadMessages = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? "";
    setUserId(currentUserId);

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
      .select("id, nickname, role")
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
      (messageData ?? []).map((item) => {
        const profile = profileMap.get(item.user_id);

        return {
          ...item,
          nickname: profile?.nickname || "Учасник",
          role: profile?.role || "junior"
        };
      })
    );

    setError("");
    setLoading(false);
  }, [supabase]);

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

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMessages, supabase]);

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

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Потрібно увійти в акаунт.");
      setSending(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        user_id: authData.user.id,
        content: message
      });

    if (insertError) {
      setError("Не вдалося надіслати повідомлення.");
    } else {
      setContent("");
      await loadMessages();
    }

    setSending(false);
  }

  async function deleteMessage(id: string) {
    const confirmed = window.confirm("Точно видалити це повідомлення?");
    if (!confirmed) return;

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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 230px) minmax(0, 1fr)",
        gap: 16,
        marginTop: 24,
        alignItems: "start"
      }}
    >
      <aside
        style={{
          position: "sticky",
          top: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}
      >
        <div className="panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#d5b5ff",
              fontWeight: 700
            }}
          >
            <span>📌</span>
            <span>Загальний чат</span>
          </div>
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
              gap: 10,
              maxHeight: 420,
              overflowY: "auto"
            }}
          >
            {players.length === 0 ? (
              <p className="muted">Учасників поки немає.</p>
            ) : (
              players.map((player) => (
                <div
                  key={player.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: "#85818e",
                      flexShrink: 0
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        overflowWrap: "anywhere"
                      }}
                    >
                      {player.nickname || "Без нікнейму"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: roleColors[player.role] ?? "#b9c0cc"
                      }}
                    >
                      {roleLabels[player.role] ?? player.role}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="page-note">
            Статус онлайн поки не підключений.
          </p>
        </div>
      </aside>

      <section className="panel" style={{ minWidth: 0 }}>
        <h2 style={{ marginTop: 0 }}>Загальний чат</h2>
        <p className="muted">
          Повідомлення доступні всім авторизованим учасникам VERCETI.
        </p>

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
          {loading ? (
            <p className="muted">Завантаження повідомлень...</p>
          ) : messages.length === 0 ? (
            <p className="muted">
              Повідомлень поки немає. Напиши першим!
            </p>
          ) : (
            messages.map((message) => (
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
                  <div>
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

                <p
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: 0
                  }}
                >
                  {message.content}
                </p>

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
            ))
          )}
        </div>

        {error && (
          <p style={{ color: "#ff8585", marginTop: 12 }}>
            {error}
          </p>
        )}

        <form
          onSubmit={sendMessage}
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            alignItems: "stretch"
          }}
        >
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Напиши повідомлення..."
            maxLength={2000}
            required
            style={{ flex: 1, minWidth: 0 }}
          />

          <button
            className="btn"
            type="submit"
            disabled={sending || !content.trim()}
          >
            {sending ? "Надсилання..." : "Надіслати"}
          </button>
        </form>

        <p className="page-note">
          Показано до 100 останніх повідомлень. Учасник може видаляти лише власні повідомлення.
        </p>
      </section>
    </div>
  );
}
