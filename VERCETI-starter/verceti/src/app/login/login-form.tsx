
"use client";

import { useState } from "react";
import {
  loginWithNickname,
  registerWithNickname,
} from "./actions";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("Паролі не збігаються.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("nickname", nickname);
      formData.set("password", password);

      const result =
        mode === "login"
          ? await loginWithNickname(formData)
          : await registerWithNickname(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.success) {
        window.location.href =
          mode === "register" ? "/preview/forms" : "/";
      }
    } catch (err) {
      console.error("Authentication form error:", err);
      setError("Не вдалося виконати операцію. Спробуй ще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <button
          type="button"
          className="btn"
          style={{
            flex: 1,
            opacity: mode === "login" ? 1 : 0.5,
          }}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Вхід
        </button>

        <button
          type="button"
          className="btn"
          style={{
            flex: 1,
            opacity: mode === "register" ? 1 : 0.5,
          }}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Реєстрація
        </button>
      </div>

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
          autoComplete={
            mode === "login" ? "current-password" : "new-password"
          }
        />

        {mode === "register" && (
          <>
            <label style={{ fontSize: 11, color: "#b8b0c7" }}>
              Повтори пароль
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повтори пароль"
              autoComplete="new-password"
            />
          </>
        )}

        {error && (
          <p style={{ color: "#ff8f9f", fontSize: 11 }}>
            {error}
          </p>
        )}

        <button
          className="btn"
          type="submit"
          style={{ width: "100%", marginTop: 12 }}
          disabled={loading}
        >
          {loading
            ? "Зачекай..."
            : mode === "login"
              ? "Увійти"
              : "Створити акаунт"}
        </button>

        {mode === "register" && (
          <p
            className="muted"
            style={{ fontSize: 11, lineHeight: 1.6, marginTop: 14 }}
          >
            Після реєстрації потрібно буде заповнити анкету.
            Доступ до закритих розділів відкривається після її схвалення.
          </p>
        )}
      </form>
    </div>
  );
}
