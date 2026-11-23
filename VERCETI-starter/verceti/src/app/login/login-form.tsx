"use client";

import { useState } from "react";
import { loginWithNickname } from "./actions";

export default function LoginForm() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("nickname", nickname);
      formData.set("password", password);

      const result = await loginWithNickname(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.success) {
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Authentication form error:", err);
      setError("Не вдалося виконати вхід. Спробуй ще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11, color: "#b8b0c7" }}>
          Нікнейм
        </label>
        <input
          type="text"
          required
          maxLength={50}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Твій нікнейм"
          autoComplete="username"
        />

        <label style={{ fontSize: 11, color: "#b8b0c7" }}>
          Пароль
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Твій пароль"
          autoComplete="current-password"
        />

        {error && (
          <p role="alert" style={{ color: "#ff8f9f", fontSize: 11 }}>
            {error}
          </p>
        )}

        <button
          className="btn"
          type="submit"
          style={{ width: "100%", marginTop: 12 }}
          disabled={loading}
        >
          {loading ? "Зачекай..." : "Увійти"}
        </button>

        <p
          className="muted"
          style={{ fontSize: 11, lineHeight: 1.6, marginTop: 14 }}
        >
          VERCETI — закрита спільнота. Облікові записи створює адміністрація
          за запрошенням.
        </p>
      </form>
    </div>
  );
}
