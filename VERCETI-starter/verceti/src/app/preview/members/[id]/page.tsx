
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CallActions from "./CallActions";

const roleLabels: Record<string, string> = {
  founder: "ЗАСНОВНИК",
  leader: "ЛІДЕР",
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

  // Keep onboarding answers visible to staff only; they may contain private information.
  let applicationQuestions: { id: string; question: string; position: number }[] = [];
  let applicationAnswers: Record<string, unknown> = {};
  if (isStaff) {
    const [{ data: approvedApplication }, { data: questionRows }] = await Promise.all([
      supabase.from("applications").select("answers").eq("user_id", member.id).eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("application_questions").select("id, question, position").order("position", { ascending: true }),
    ]);
    applicationQuestions = questionRows ?? [];
    applicationAnswers = approvedApplication?.answers && typeof approvedApplication.answers === "object" && !Array.isArray(approvedApplication.answers) ? approvedApplication.answers as Record<string, unknown> : {};
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

        {isStaff && (
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>Відповіді в анкеті вступу</h2>
            <p className="muted" style={{ marginTop: 6 }}>Цей розділ бачить лише керівництво спільноти.</p>
            {applicationQuestions.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>Запитання анкети не знайдено.</p>
            ) : (
              <div className="member-list" style={{ marginTop: 12 }}>
                {applicationQuestions.map((question) => {
                  const raw = applicationAnswers[question.id];
                  const answer = typeof raw === "string" || typeof raw === "number" ? String(raw) : Array.isArray(raw) ? raw.map(String).join(", ") : "";
                  return <div className="member-row" key={question.id} style={{ display: "block" }}><strong>{question.question}</strong><p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{answer.trim() || "Відповідь не збережена"}</p></div>;
                })}
              </div>
            )}
          </section>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {member.id !== user.id && <><Link href={`/preview/chat?recipient=${member.id}`} className="btn">✉ Надіслати повідомлення</Link><CallActions targetId={member.id} currentUserId={user.id} /></>}
          <Link href="/preview/members" className="tag">
            ← До списку учасників
          </Link>
        </div>
      </div>
    </main>
  );
}
