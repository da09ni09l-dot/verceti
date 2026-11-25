"use client";

import { useState } from "react";
import { loginWithNickname, registerWithNickname } from "./actions";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      formData.set("confirmPassword", confirmPassword);

      const result =
        mode === "register"
          ? await registerWithNickname(formData)
          : await loginWithNickname(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.success) {
        window.location.href = registering ? "/preview/forms" : "/";
      }
    } catch (err) {
      console.error("Authentication form error:", err);
      setError("Не вдалося виконати операцію. Спробуй ще раз.");
    } finally {
      setLoading(false);
    }
  }

  const registering = mode === "register";

  const visibilityButtonStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    color: "#b8b0c7",
    cursor: "pointer",
    fontSize: 11,
    padding: "8px 10px",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ marginTop: 24 }}>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11, color: "#b8b0c7" }}>
          Нікнейм
        </label>
        <input
          type="text"
          required
          minLength={registering ? 3 : 1}
          maxLength={registering ? 32 : 50}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Твій нікнейм"
          autoComplete="username"
        />

        <label style={{ fontSize: 11, color: "#b8b0c7" }}>
          Пароль
        </label>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={registering ? 8 : 6}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Твій пароль"
            autoComplete={registering ? "new-password" : "current-password"}
            style={{ paddingRight: 76 }}
          />
          <button
            type="button"
            style={{ ...visibilityButtonStyle, position: "absolute", right: 4 }}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Приховати пароль" : "Показати пароль"}
            aria-pressed={showPassword}
          >
            {showPassword ? "Сховати" : "Показати"}
          </button>
        </div>

        {registering && (
          <>
            <label style={{ fontSize: 11, color: "#b8b0c7" }}>
              Повтори пароль
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повтори пароль"
                autoComplete="new-password"
                style={{ paddingRight: 76 }}
              />
              <button
                type="button"
                style={{ ...visibilityButtonStyle, position: "absolute", right: 4 }}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? "Приховати повторений пароль" : "Показати повторений пароль"}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? "Сховати" : "Показати"}
              </button>
            </div>
          </>
        )}

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
          {loading
            ? "Зачекай..."
            : registering
              ? "Створити акаунт"
              : "Увійти"}
        </button>

        <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 14 }}>
          {registering
            ? "Реєстрація без email. Після створення акаунта заповни анкету — доступ відкриється після схвалення адміністрацією."
            : "Увійди за нікнеймом і паролем або створи новий акаунт."}
        </p>
      </form>

      <button
        type="button"
        className="btn secondary"
        style={{ width: "100%", marginTop: 10 }}
        onClick={() => {
          setMode(registering ? "login" : "register");
          setError("");
          setPassword("");
          setConfirmPassword("");
          setShowPassword(false);
          setShowConfirmPassword(false);
        }}
      >
        {registering ? "Уже є акаунт? Увійти" : "Створити новий акаунт"}
      </button>
    </div>
  );
}
