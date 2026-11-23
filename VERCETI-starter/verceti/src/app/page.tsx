
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notices } from "@/lib/demo-data";
import MenuBadges from "./MenuBadges";
import NewsBell from "./NewsBell";
import PinnedNewsCarousel from "./PinnedNewsCarousel";
import MembersOnlinePanel from "./MembersOnlinePanel";
import TopMembersPanel from "./TopMembersPanel";
import { logout } from "./logout/actions";

const roleLabels: Record<string, string> = {
  leader: "ЗАСНОВНИК",
  admin: "АДМІНІСТРАТОР",
  moderator: "МОДЕРАТОР",
  senior: "СТАРШИЙ УЧАСНИК",
  local: "УЧАСНИК",
  junior: "МОЛОДШИЙ УЧАСНИК"
};

const roleColors: Record<string, string> = {
  leader: "orange",
  admin: "orange",
  moderator: "purple",
  senior: "blue",
  local: "green",
  junior: "muted"
};

const noticeIcons: Record<string, string> = {
  success: "✓",
  warning: "!",
  danger: "!",
  info: "i",
  purple: "✦"
};

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

  // Перевірка ролі адміністратора
  const { data: adminRole, error: adminRoleError } =
    await supabase.rpc("current_verceti_role");

  const showAdminButton =
    !adminRoleError && adminRole === "admin";

  const now = new Date().toISOString();

  const { data: pinnedNews } = await supabase
    .from("news")
    .select("id, title, content, category")
    .eq("is_pinned", true)
    .or(`show_from.is.null,show_from.lte.${now}`)
    .or(`show_until.is.null,show_until.gt.${now}`)
    .order("created_at", { ascending: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, role, is_banned")
    .order("created_at", { ascending: true });

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("nickname, role")
    .eq("id", user.id)
    .maybeSingle();

  const nickname =
    currentProfile?.nickname ||
    user.email?.split("@")[0] ||
    "Учасник";

  const currentRole = currentProfile?.role ?? "local";

  const roleLabel =
    roleLabels[currentRole] ?? currentRole.toUpperCase();

  const roleColor = roleColors[currentRole] ?? "muted";

  const activeMembers = (profiles ?? []).filter(
    (member) => !member.is_banned
  );

  const { count: pendingApplications } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          VERCETTI
          <small>PRIVATE COMMUNITY</small>
        </Link>

        <MenuBadges userId={user.id} />

        <div className="sidebar-foot">
          <strong style={{ color: "#d8baff" }}>
            ЗАКРИТА СПІЛЬНОТА
          </strong>
          <br />
          Доступ лише за запрошенням.
          <br />
          VERCETTI · PRIVATE COMMUNITY
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-heading">
            <div className="eyebrow">
              Панель спільноти
            </div>
            <h1>Головна</h1>
          </div>

          <nav
            aria-label="Швидка навігація"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap"
            }}
          >
            <div className="topbar-action">
              <NewsBell userId={user.id} />
            </div>

            <Link
              href="/preview/news"
              className="btn secondary"
              style={{
                minHeight: 42,
                whiteSpace: "nowrap"
              }}
            >
              📰 Новини
            </Link>
          </nav>

          <div
            className="topbar-user"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12
            }}
          >
            <div className="user-pill">
              <div className="avatar">
                {nickname.slice(0, 1).toUpperCase()}
              </div>

              <div>
                <strong>{nickname}</strong>
                <div className={`role ${roleColor}`}>
                  {roleLabel}
                </div>
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
          <div className="eyebrow">
            Ласкаво просимо до VERCETI
          </div>

          {pinnedNews && pinnedNews.length > 0 ? (
            <PinnedNewsCarousel news={pinnedNews} />
          ) : (
            <>
              <h1>ТВОЯ СПІЛЬНОТА. ТВОЇ ПРАВИЛА.</h1>
              <p>
                Розвивайся. Спілкуйся. Будь частиною VERCETI.
                Тут з&apos;являтимуться важливі новини,
                оголошення та події спільноти.
              </p>
            </>
          )}

          <div className="welcome-actions">
            <Link
              className="btn"
              href="/preview/members"
            >
              Переглянути учасників →
            </Link>

            <Link
              className="btn secondary"
              href="/preview/forms"
            >
              Перейти до анкет
            </Link>
          </div>
        </section>

        {/* PREMIUM STATISTICS */}

        <section className="grid stats-grid vercetti-stats">
          <div className="stat-card vercetti-stat-card stat-members">
            <div className="stat-card-top">
              <div className="stat-label">
                УЧАСНИКИ СПІЛЬНОТИ
              </div>

              <div className="stat-icon">♟</div>
            </div>

            <div className="stat-value">
              {activeMembers.length}
            </div>

            <div className="stat-note">
              <span className="stat-indicator" />
              Зареєстровані учасники VERCETI
            </div>

            <div className="stat-decoration">01</div>
          </div>

          <div className="stat-card vercetti-stat-card stat-applications">
            <div className="stat-card-top">
              <div className="stat-label">
                АНКЕТИ НА ПЕРЕВІРЦІ
              </div>

              <div className="stat-icon">✦</div>
            </div>

            <div className="stat-value">
              {pendingApplications ?? 0}
            </div>

            <div className="stat-note">
              <span className="stat-indicator pending" />
              Очікують розгляду адміністрацією
            </div>

            <div className="stat-decoration">02</div>
          </div>
        </section>

        {/* TOP MEMBERS AND ONLINE */}

        <section className="grid content-grid">
          <TopMembersPanel />
          <MembersOnlinePanel members={profiles ?? []} />
        </section>

        {/* PREMIUM NOTIFICATIONS */}

        <section className="panel premium-notices-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                COMMUNITY ACTIVITY
              </div>

              <h2>ОСТАННІ СПОВІЩЕННЯ</h2>

              <div className="panel-sub">
                Важливі події та оновлення VERCETI
              </div>
            </div>

            <Link
              href="/preview/notifications"
              className="tag premium-notices-link"
            >
              УСІ СПОВІЩЕННЯ →
            </Link>
          </div>

          {notices.length > 0 ? (
            <div className="premium-notices-list">
              {notices.map((n, index) => (
                <div
                  className={`premium-notice notice-type-${n.kind}`}
                  key={`${n.title}-${index}`}
                >
                  <div className="premium-notice-icon">
                    {noticeIcons[n.kind] ?? "✦"}
                  </div>

                  <div className="premium-notice-content">
                    <div className="premium-notice-title">
                      {n.title}
                    </div>

                    <div className="premium-notice-detail">
                      {n.detail}
                    </div>

                    <div className="premium-notice-time">
                      <span className="premium-notice-time-icon">
                        ◷
                      </span>
                      {n.time}
                    </div>
                  </div>

                  <div className="premium-notice-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="premium-notices-empty">
              <span>✦</span>
              <p>Нових сповіщень поки немає</p>
            </div>
          )}

          <div className="premium-notices-footer">
            <span>VERCETI PRIVATE COMMUNITY</span>
            <span>БУДЬ У КУРСІ ПОДІЙ</span>
          </div>
        </section>
      </main>

      {/* Плаваюча кнопка адміністратора */}
      {showAdminButton && (
        <Link
          href="/admin"
          className="admin-floating-button"
          aria-label="Відкрити панель адміністратора"
        >
          <span className="admin-floating-icon">⚙</span>
          <span>АДМІН-ПАНЕЛЬ</span>
          <span className="admin-floating-arrow">↗</span>
        </Link>
      )}
    </div>
  );
}
