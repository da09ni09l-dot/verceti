"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string; initialUrl: string | null };

export default function AvatarUploader({ userId, initialUrl }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Дозволені JPG, PNG, WEBP або GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Максимальний розмір аватарки — 5 МБ.");
      return;
    }

    setBusy(true);
    setError("");
    const supabase = createClient();
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600"
    });

    if (uploadError) {
      setError("Не вдалося завантажити фото. Спробуй ще раз.");
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const nextUrl = data.publicUrl;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: nextUrl }).eq("id", userId);
    if (updateError) {
      setError("Фото завантажено, але не вдалося зберегти його в профілі.");
      setBusy(false);
      return;
    }

    setAvatarUrl(nextUrl);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeAvatar() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    if (updateError) {
      setError("Не вдалося видалити аватарку.");
      setBusy(false);
      return;
    }
    setAvatarUrl(null);
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="Аватарка профілю" width={88} height={88} style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(187,138,255,.55)" }} />
      ) : (
        <div aria-label="Немає аватарки" style={{ width: 88, height: 88, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(187,138,255,.14)", border: "1px solid rgba(187,138,255,.35)", fontSize: 30 }}>👤</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <strong>Аватарка профілю</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Зачекай..." : avatarUrl ? "Змінити фото" : "Завантажити фото"}</button>
          {avatarUrl && <button className="btn secondary" type="button" disabled={busy} onClick={removeAvatar}>Видалити</button>}
        </div>
        <span className="page-note">JPG, PNG, WEBP або GIF · до 5 МБ</span>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
        {error && <span role="alert" style={{ color: "#ff9b9b", fontSize: 12 }}>{error}</span>}
      </div>
    </div>
  );
}
