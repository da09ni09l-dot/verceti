
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { members, notices } from "@/lib/demo-data";
import MenuBadges from "./MenuBadges";
import NewsBell from "./NewsBell";
import { logout } from "./logout/actions";

function Stat({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: staffStatus, error: staffError } =
    await supabase.rpc("is_verceti_staff");

  const isStaff = !staffError && staffStatus === true;

  if (!isStaff) {
    const { data: applications, error: applicationError } =
      await supabase
        .from("applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

    const isApproved =
      !applicationError &&
      applications?.[0]?.status === "approved";

    if (!isApproved) {
      redirect("/preview/forms");
    }
  }

  const now = new Date().toISOString();

  const { data: pinnedNews } = await supabase
    .from("news")
    .select("id, title, content, category, show_from, show_until")
    .eq("is_pinned", true)
    .or(`show_from.is.null,show_from.lte.${now}`)
    .or(`show_until.is.null,show_until.gt.${now}`)
    .order("created_at", { ascending: false });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10
          }}
        >
          <div className="brand">
            VERCETI
            <small>PRIVATE COMMUNITY</small>
          </div>

          <NewsBell userId={user.id} />
        </div>

        <MenuBadges userId={user.id} />

        <div className="sidebar-foot">
          <strong style={{ color: "#d8baff" }}>
            ЗАКРИТА СПІЛЬНОТА
          </strong>
          <br />
          Доступ лише за запрошенням.
          <br />
          Демо-макет · версія 0.1
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Панель спільноти</div>
            <h1>Головна</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="user-pill">
              <div className="avatar">A</div>
              <div>
                <strong>Засновник</strong>
                <div className="role orange">АДМІН</div>
              </div>
            </div>

            <form action={logout}>
              <button className="btn secondary" type="submit">
                Вийти
              </button>
            </form>
          </div>
        </header>

        <section className="panel welcome">
          <div className="eyebrow">Ласкаво просимо до VERCETI</div>

          {pinnedNews && pinnedNews.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              <div className="eyebrow">ЗАКРІПЛЕНІ НОВИНИ</div>

              {pinnedNews.map((news) => (
                <article
                  key={news.id}
                  style={{
                    padding: "18px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  <h1>{news.title}</h1>
                  <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {news.content}
                  </p>
                </article>
              ))}

              <div className="welcome-actions">
                <Link className="btn" href="/news">
                  Усі новини
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1>Твоя спільнота. Твої правила.</h1>
              <p>
                Тут з'являтимуться важливі новини, оголошення та події
                спільноти VERCETI.
              </p>
            </>
          )}

          <div className="welcome-actions">
            <Link className="btn secondary" href="/preview/members">
              Переглянути учасників
            </Link>
            <Link className="btn secondary" href="/preview/forms">
              Перейти до анкет
            </Link>
          </div>
        </section>

        <section className="grid stats-grid">
          <Stat label="Учасники" value="128" note="Демонстраційне значення" />
          <Stat label="Зараз онлайн" value="24" note="Не є реальним лічильником" />
          <Stat label="Анкети на перевірці" value="7" note="Приклад для макета" />
          <Stat label="Попередження" value="12" note="Демонстраційна статистика" />
        </section>

        <section className="grid content-grid">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Учасники спільноти</h2>
                <div className="panel-sub">
                  Приклад списку та кольорів ролей
                </div>
              </div>
              <span className="tag">КОМАНДА</span>
            </div>

            <div className="member-list">
              {members.map((m) => (
                <div className="member-row" key={m.name}>
                  <div className="member-left">
                    <div className="member-avatar">
                      {m.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="member-name">{m.name}</div>
                      <div className="member-meta">
                        {m.status === "online" ? (
                          <>
                            <span className="status-dot" />
                            Онлайн
                          </>
                        ) : m.status === "away" ? (
                          "Неактивний"
                        ) : (
                          "Офлайн"
                        )}
                        {" · "}
                        {m.hours}
                      </div>
                    </div>
                  </div>
                  <span className={`role ${m.color}`}>{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Останні сповіщення</h2>
                <div className="panel-sub">
                  Приклад центру сповіщень
                </div>
              </div>
              <span className="tag">3 НОВІ</span>
            </div>

            <div className="notice-list">
              {notices.map((n) => (
                <div className="notice" key={n.title}>
                  <span className={`notice-mark ${n.kind}`} />
                  <div>
                    <div className="notice-title">{n.title}</div>
                    <div className="notice-detail">{n.detail}</div>
                    <div className="notice-time">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="page-note">
          Увага: імена, цифри, онлайн-статуси та сповіщення на цій сторінці
          вигадані для демонстрації. Реальні дані з'являться після
          підключення відповідних функцій.
        </p>
      </main>
    </div>
  );
}
