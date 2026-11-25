
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuBadges from "./MenuBadges";
import PinnedNewsCarousel from "./PinnedNewsCarousel";
import MembersOnlinePanel from "./MembersOnlinePanel";
import TopMembersPanel from "./TopMembersPanel";
import { logout } from "./logout/actions";
import NewsBell from "./NewsBell";
import MobileMenuToggle from "./MobileMenuToggle";

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

  const { data: membershipStatus, error: membershipError } =
    await supabase.rpc("is_verceti_member");
  if (membershipError || membershipStatus !== true) {
    redirect("/preview/forms");
  }

  const { data: adminRole, error: adminRoleError } =
    await supabase.rpc("current_verceti_role");


  const now = new Date().toISOString();

  const { data: pinnedNews } = await supabase
    .from("news")
    .select("id, title, content, category, created_by")
    .eq("is_pinned", true)
    .or(`show_from.is.null,show_from.lte.${now}`)
    .or(`show_until.is.null,show_until.gt.${now}`)
    .order("created_at", { ascending: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, role, is_banned, avatar_url, nickname_color, nickname_font")
    .order("created_at", { ascending: true });

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const pinnedNewsWithAuthors = (pinnedNews ?? []).map((item) => ({
    ...item,
    authorProfile: item.created_by ? profileById.get(item.created_by) ?? null : null
  }));

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("nickname, role, avatar_url, nickname_color, nickname_font")
    .eq("id", user.id)
    .maybeSingle();

  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("id, title, message, type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

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
      <MobileMenuToggle />
      <aside id="verceti-sidebar" className="sidebar">
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
            <NewsBell userId={user.id} />
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
              {currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" className="avatar" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} /> : <div className="avatar">{nickname.slice(0, 1).toUpperCase()}</div>}

              <div>
                <strong style={{ color: currentProfile?.nickname_color ?? undefined, fontFamily: currentProfile?.nickname_font === "orbitron" ? "Orbitron, Arial, sans-serif" : currentProfile?.nickname_font === "rajdhani" ? "Rajdhani, Arial, sans-serif" : currentProfile?.nickname_font === "nunito" ? "Nunito Sans, Arial, sans-serif" : currentProfile?.nickname_font === "georgia" ? "Georgia, serif" : currentProfile?.nickname_font === "mono" ? "monospace" : undefined }}>{nickname}</strong>
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
            Ласкаво просимо до VERCETTI
          </div>

          {pinnedNews && pinnedNews.length > 0 ? (
            <PinnedNewsCarousel news={pinnedNewsWithAuthors} />
          ) : (
            <>
              <h1>ТВОЯ СПІЛЬНОТА. ТВОЇ ПРАВИЛА.</h1>
              <p>
                Розвивайся. Спілкуйся. Будь частиною VERCETTI.
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
              Зареєстровані учасники VERCETTI
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

        <section className="grid content-grid">
          <TopMembersPanel />
          <MembersOnlinePanel members={profiles ?? []} />
        </section>

        <section className="panel premium-notices-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                COMMUNITY ACTIVITY
              </div>

              <h2>ОСТАННІ СПОВІЩЕННЯ</h2>

              <div className="panel-sub">
                Важливі події та оновлення VERCETTI
              </div>
            </div>

            <Link
              href="/preview/notifications"
              className="tag premium-notices-link"
            >
              УСІ СПОВІЩЕННЯ →
            </Link>
          </div>

          {recentNotifications && recentNotifications.length > 0 ? (
            <div className="premium-notices-list">
              {recentNotifications.map((n, index) => {
                const kind =
                  n.type === "warning" || n.type === "danger"
                    ? "warning"
                    : n.type === "success"
                      ? "success"
                      : "info";
                const time = new Date(n.created_at).toLocaleString("uk-UA");
                return (
                  <div
                    className={`premium-notice notice-type-${kind}`}
                    key={n.id}
                  >
                    <div className="premium-notice-icon">
                      {noticeIcons[kind] ?? "✦"}
                    </div>

                    <div className="premium-notice-content">
                      <div className="premium-notice-title">{n.title}</div>
                      <div className="premium-notice-detail">{n.message}</div>
                      <div className="premium-notice-time">
                        <span className="premium-notice-time-icon">◷</span>
                        {time}
                      </div>
                    </div>

                    <div className="premium-notice-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="premium-notices-empty">
              <span>✦</span>
              <p>Нових сповіщень поки немає</p>
            </div>
          )}

          <div className="premium-notices-footer">
            <span>VERCETTI PRIVATE COMMUNITY</span>
            <span>БУДЬ У КУРСІ ПОДІЙ</span>
          </div>
        </section>
      </main>

    </div>
  );
}
