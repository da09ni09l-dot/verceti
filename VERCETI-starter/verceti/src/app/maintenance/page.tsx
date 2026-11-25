export default function MaintenancePage() {
  return (
    <main className="login-wrap workspace-wrap">
      <section className="login-card workspace-card" style={{ maxWidth: 620, textAlign: "center" }}>
        <div className="brand" style={{ padding: 0 }}>
          VERCETI
          <small>ТЕХНІЧНЕ ОБСЛУГОВУВАННЯ</small>
        </div>
        <div style={{ fontSize: 42, marginTop: 34 }} aria-hidden="true">⚙</div>
        <h1 style={{ fontSize: 28, marginTop: 18 }}>Сайт оновлюється</h1>
        <p className="muted" style={{ lineHeight: 1.8, marginTop: 12 }}>
          Ми проводимо технічні роботи, тому сайт тимчасово недоступний.
          Будь ласка, зайдіть трохи пізніше.
        </p>
        <p className="muted" style={{ fontSize: 12, marginTop: 28 }}>
          VERCETI · PRIVATE COMMUNITY
        </p>
      </section>
    </main>
  );
}
