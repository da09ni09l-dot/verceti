
import Link from "next/link";

const demoMembers = [
  { name: "Джулі Велман", role: "АДМІНІСТРАТОР", color: "orange", status: "Онлайн" },
  { name: "VERCETI Member", role: "МОДЕРАТОР", color: "purple", status: "Онлайн" },
  { name: "New Member", role: "УЧАСНИК", color: "green", status: "Офлайн" }
];

const notices = [
  { title: "Оновлення VERCETI", detail: "Оновлено інтерфейс спільноти та навігацію.", time: "Щойно", kind: "success" },
  { title: "Нові можливості", detail: "Слідкуйте за новинами та оголошеннями.", time: "Нещодавно", kind: "purple" },
  { title: "Ласкаво просимо!", detail: "Раді бачити вас у нашій спільноті.", time: "Сьогодні", kind: "info" }
];

export default function DesignPreview() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/design-preview" className="brand">
          VERCETTI
          <small>PRIVATE COMMUNITY</small>
        </Link>

        <nav className="menu">
          <div className="menu-group">
            <div className="menu-group-title">ГОЛОВНЕ</div>
            <Link href="/design-preview" className="menu-link active">⌂　Головна</Link>
            <Link href="/design-preview" className="menu-link">♟　Учасники</Link>
            <Link href="/design-preview" className="menu-link">▤　Новини</Link>
            <Link href="/design-preview" className="menu-link">✉　Сповіщення</Link>
          </div>

          <div className="menu-group">
            <div className="menu-group-title">СПІЛЬНОТА</div>
            <Link href="/design-preview" className="menu-link">✦　Рейтинг</Link>
            <Link href="/design-preview" className="menu-link">◷　Активність</Link>
          </div>

          <div className="menu-group">
            <div className="menu-group-title">ІНФОРМАЦІЯ</div>
            <Link href="/design-preview" className="menu-link">◇　Про VERCETI</Link>
          </div>
        </nav>

        <div className="sidebar-foot">
          <strong style={{ color: "#d8baff" }}>ЗАКРИТА СПІЛЬНОТА</strong>
          <br />
          Доступ лише за запрошенням.
          <br />
          VERCETI · PRIVATE COMMUNITY
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-heading">
            <div className="eyebrow">Панель спільноти · DEMO</div>
            <h1>Головна</h1>
          </div>

          <nav className="topbar-action">
            <Link href="/design-preview" className="btn secondary">📰 Новини</Link>
          </nav>

          <div className="topbar-user">
            <div className="user-pill">
              <div className="avatar">V</div>
              <div>
                <strong>VERCETI Guest</strong>
                <div className="role muted">ГОСТЬ</div>
              </div>
            </div>
          </div>
        </header>

        <section className="panel welcome">
          <div className="eyebrow">Ласкаво просимо до VERCETI</div>
          <h1>ТВОЯ СПІЛЬНОТА. ТВОЇ ПРАВИЛА.</h1>
          <p>
            Розвивайся. Спілкуйся. Будь частиною VERCETI.
            Тут з&apos;являються важливі новини, оголошення
            та події спільноти.
          </p>
          <div className="welcome-actions">
            <Link className="btn" href="/design-preview">Переглянути учасників →</Link>
            <Link className="btn secondary" href="/design-preview">Дізнатися більше</Link>
          </div>
        </section>

        <section className="grid stats-grid vercetti-stats">
          <div className="stat-card vercetti-stat-card stat-members">
            <div className="stat-card-top">
              <div className="stat-label">УЧАСНИКИ СПІЛЬНОТИ</div>
              <div className="stat-icon">♟</div>
            </div>
            <div className="stat-value">128</div>
            <div className="stat-note">
              <span className="stat-indicator" />
              Учасники VERCETI
            </div>
            <div className="stat-decoration">01</div>
          </div>

          <div className="stat-card vercetti-stat-card stat-applications">
            <div className="stat-card-top">
              <div className="stat-label">АНКЕТИ НА ПЕРЕВІРЦІ</div>
              <div className="stat-icon">✦</div>
            </div>
            <div className="stat-value">7</div>
            <div className="stat-note">
              <span className="stat-indicator pending" />
              Очікують розгляду
            </div>
            <div className="stat-decoration">02</div>
          </div>
        </section>

        <section className="grid content-grid">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">COMMUNITY RANKING</div>
                <h2>ТОП УЧАСНИКІВ</h2>
                <div className="panel-sub">Найактивніші учасники спільноти</div>
              </div>
            </div>
            {demoMembers.map((member, index) => (
              <div className={`ranking-member ranking-place-${index + 1}`} key={member.name}>
                <div className="ranking-position">{index + 1}</div>
                <div className="avatar">{member.name.slice(0, 1)}</div>
                <div>
                  <div className="member-name">{member.name}</div>
                  <div className={`role ${member.color}`}>{member.role}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">LIVE COMMUNITY</div>
                <h2>УЧАСНИКИ ОНЛАЙН</h2>
                <div className="panel-sub">Активність спільноти</div>
              </div>
              <span className="tag">2 ONLINE</span>
            </div>
            <div className="online-members-list">
              {demoMembers.map((member) => (
                <div className="online-member" key={member.name}>
                  <div className="avatar">{member.name.slice(0, 1)}</div>
                  <div>
                    <div className="online-member-name">{member.name}</div>
                    <div className={`role ${member.color}`}>{member.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="panel premium-notices-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">COMMUNITY ACTIVITY</div>
              <h2>ОСТАННІ СПОВІЩЕННЯ</h2>
              <div className="panel-sub">Важливі події та оновлення VERCETI</div>
            </div>
            <span className="tag">УСІ СПОВІЩЕННЯ →</span>
          </div>

          <div className="premium-notices-list">
            {notices.map((notice, index) => (
              <div className={`premium-notice notice-type-${notice.kind}`} key={notice.title}>
                <div className="premium-notice-icon">✦</div>
                <div className="premium-notice-content">
                  <div className="premium-notice-title">{notice.title}</div>
                  <div className="premium-notice-detail">{notice.detail}</div>
                  <div className="premium-notice-time">◷ {notice.time}</div>
                </div>
                <div className="premium-notice-number">
                  {String(index + 1).padStart(2, "0")}
                </div>
              </div>
            ))}
          </div>

          <div className="premium-notices-footer">
            <span>VERCETI PRIVATE COMMUNITY</span>
            <span>БУДЬ У КУРСІ ПОДІЙ</span>
          </div>
        </section>

        <div className="eyebrow" style={{ textAlign: "center", padding: 24 }}>
          DEMO PREVIEW · ДАНІ ДЕМОНСТРАЦІЙНІ
        </div>
      </main>
    </div>
  );
}
