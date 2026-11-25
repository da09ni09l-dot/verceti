import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="brand" style={{ padding: 0 }}>
          VERCETI
          <small>PRIVATE COMMUNITY</small>
        </div>

        <h1 style={{ fontSize: 27, marginTop: 28 }}>
          Спільнота VERCETI
        </h1>

        <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
          Увійди або створи акаунт за нікнеймом і паролем. Email не потрібен.
        </p>

        <LoginForm />
        <p className="muted" style={{ fontSize: 11, lineHeight: 1.6, marginTop: 16 }}>
          Забув пароль? <Link href="/support" style={{ textDecoration: "underline" }}>Звернися до адміністрації через підтримку</Link>, щоб безпечно відновити доступ.
        </p>
      </section>
    </main>
  );
}
