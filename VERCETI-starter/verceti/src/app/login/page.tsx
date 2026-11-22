
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
          Увійди до свого облікового запису або створи новий.
        </p>

        <LoginForm />
      </section>
    </main>
  );
}
