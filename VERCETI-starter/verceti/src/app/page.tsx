
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
            Ласкаво просимо до VERCETTI
          </div>

          {pinnedNews && pinnedNews.length > 0 ? (
            <PinnedNewsCarousel news={pinnedNews} />
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

        <section className="grid stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Учасники
            </div>
            <div className="stat-value">
              {activeMembers.length}
            </div>
            <div className="stat-note">
              Зареєстровані учасники VERCETTI
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Анкети на перевірці
            </div>
            <div className="stat-value">
              {pendingApplications ?? 0}
            </div>
            <div className="stat-note">
              Очікують розгляду
            </div>
          </div>
        </section>

        <section className="grid content-grid">
          <TopMembersPanel />

          <MembersOnlinePanel members={profiles ?? []} />
        </section>

        <section
          className="panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-head">
            <div>
              <h2>Останні сповіщення</h2>
              <div className="panel-sub">
                Останні події спільноти VERCETTI
              </div>
            </div>

            <span className="tag">
              СПОВІЩЕННЯ
            </span>
          </div>

          <div className="notice-list">
            {notices.map((n) => (
              <div className="notice" key={n.title}>
                <span className={`notice-mark ${n.kind}`} />

                <div>
                  <div className="notice-title">
                    {n.title}
                  </div>

                  <div className="notice-detail">
                    {n.detail}
                  </div>

                  <div className="notice-time">
                    {n.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
