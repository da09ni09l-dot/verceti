
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const roleLabels: Record<string, string> = {
  leader: "ЗАСНОВНИК",
  admin: "АДМІНІСТРАТОР",
  moderator: "МОДЕРАТОР",
  senior: "СТАРШИЙ УЧАСНИК",
  local: "УЧАСНИК",
  junior: "МОЛОДШИЙ УЧАСНИК"
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MemberProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfile?.is_banned) {
    await supabase.auth.signOut();
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

    if (!isApproved) redirect("/preview/forms");
  }

  const { data: member, error } = await supabase
    .from("profiles")
    .select("id, nickname, game_id, role, created_at, is_banned, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (error || !member || member.is_banned) {
    notFound();
  }

  const nickname = member.nickname || "Без нікнейму";
  const role = String(member.role);
  const roleLabel = roleLabels[role] ?? role.toUpperCase();

  const createdAt = new Date(member.created_at).toLocaleDateString(
    "uk-UA",
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );

  return (
    <main className="page">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h1>ПРОФІЛЬ УЧАСНИКА</h1>
            <div className="panel-sub">
              Інформація про учасника VERCETI
            </div>
          </div>

          <span className="tag">{roleLabel}</span>
        </div>

        <div className="member-list">
          <div className="member-row">
            <div className="member-left">
              {member.avatar_url ? <img src={member.avatar_url} alt={`Аватарка ${nickname}`} className="member-avatar" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} /> : <div className="member-avatar">👤</div>}

              <div>
                <div className="member-name">{nickname}</div>
                <div className="member-meta">{roleLabel}</div>
              </div>
            </div>
          </div>

          <div className="member-row">
            <span className="member-meta">ІГРОВИЙ ID</span>
            <strong>{member.game_id || "Не вказано"}</strong>
          </div>

          <div className="member-row">
            <span className="member-meta">ДАТА РЕЄСТРАЦІЇ</span>
            <strong>{createdAt}</strong>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {member.id !== user.id && <Link href={`/preview/chat?recipient=${member.id}`} className="btn">✉ Надіслати повідомлення</Link>}
          <Link href="/preview/members" className="tag">
            ← До списку учасників
          </Link>
        </div>
      </div>
    </main>
  );
}
