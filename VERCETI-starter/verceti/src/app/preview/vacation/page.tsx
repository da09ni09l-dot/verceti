import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuBadges from "../../MenuBadges";
import NewsBell from "../../NewsBell";
import { createVacationRequest, reviewVacationRequest, deleteVacationRequest } from "./actions";

type VacationRequest = {
  id: string; user_id: string; start_date: string; end_date: string; reason: string;
  status: "pending" | "approved" | "rejected"; created_at: string;
};
const statusLabels = { pending: "Очікує розгляду", approved: "Схвалено", rejected: "Відхилено" };
function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function VacationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membershipStatus, error: membershipError } = await supabase.rpc("is_verceti_member");
  if (membershipError || membershipStatus !== true) redirect("/preview/forms");
  const { data: isStaff, error: staffError } = await supabase.rpc("is_verceti_staff");
  const canReview = !staffError && isStaff === true;
  const { data: role } = await supabase.rpc("current_verceti_role");
  const canDelete = ["admin", "leader"].includes(String(role ?? ""));

  let query = supabase.from("vacation_requests")
    .select("id, user_id, start_date, end_date, reason, status, created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (!canReview) query = query.eq("user_id", user.id);
  const { data, error } = await query;
  const requests = (data ?? []) as VacationRequest[];
  const profileIds = [...new Set(requests.map((request) => request.user_id))];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, nickname").in("id", profileIds)
    : { data: [] as { id: string; nickname: string }[] };
  const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));

  return (
    <div className="app-shell">
      <aside id="verceti-sidebar" className="sidebar">
        <Link href="/" className="brand">VERCETTI<small>PRIVATE COMMUNITY</small></Link>
        <MenuBadges userId={user.id} />
        <div className="sidebar-foot"><strong style={{ color: "#d8baff" }}>ЗАКРИТА СПІЛЬНОТА</strong><br />Доступ лише за запрошенням.<br />VERCETTI · PRIVATE COMMUNITY</div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-heading"><div className="eyebrow">ПАНЕЛЬ СПІЛЬНОТИ</div><h1>Відпустка</h1></div>
          <nav aria-label="Швидка навігація" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" className="btn secondary">← На головну</Link><NewsBell userId={user.id} />
          </nav>
        </header>
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="eyebrow">ЗАЯВКА НА ВІДПУСТКУ</div><h2 style={{ marginTop: 8 }}>Запланувати відсутність</h2>
          <p className="muted" style={{ marginTop: 8 }}>Вкажи перший і останній день відпустки та коротко поясни причину. Заявка буде збережена в системі й доступна адміністрації.</p>
          {status === "created" && <p className="page-note">Заявку на відпустку надіслано.</p>}
          {status === "invalid" && <p className="page-note">Перевір дати та причину. Дата завершення має бути не раніше дати початку.</p>}
          {status === "overlap" && <p className="page-note">У тебе вже є заявка, яка перетинається з цими датами та очікує розгляду або схвалена.</p>}
          {status === "error" && <p className="page-note">Не вдалося зберегти заявку. Спробуй ще раз трохи пізніше.</p>}
          {status === "reviewed" && <p className="page-note">Рішення щодо заявки збережено.</p>}{status === "deleted" && <p className="page-note">Заявку видалено.</p>}
          {status === "forbidden" && <p className="page-note">Недостатньо прав для цієї дії.</p>}
          <form action={createVacationRequest} className="member-list" style={{ marginTop: 18, gap: 10, maxWidth: 620 }}>
            <label htmlFor="vacation-start">З якого числа</label><input id="vacation-start" name="start_date" type="date" required />
            <label htmlFor="vacation-end">По яке число</label><input id="vacation-end" name="end_date" type="date" required />
            <label htmlFor="vacation-reason">Причина відпустки</label>
            <textarea id="vacation-reason" name="reason" required minLength={3} maxLength={2000} rows={4} placeholder="Напиши причину або короткий коментар..." />
            <button className="btn" type="submit">Надіслати заявку</button>
          </form>
        </section>
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="eyebrow">{canReview ? "КЕРУВАННЯ ЗАЯВКАМИ" : "ТВОЇ ЗАЯВКИ"}</div>
          <h2 style={{ marginTop: 8 }}>{canReview ? "Заявки учасників" : "Історія відпусток"}</h2>
          {error ? <p className="muted" style={{ marginTop: 14 }}>Не вдалося завантажити заявки. Переконайся, що міграцію бази даних застосовано.</p> : requests.length === 0 ? <p className="muted" style={{ marginTop: 14 }}>Заявок поки немає.</p> : (
            <div className="member-list" style={{ marginTop: 14 }}>
              {requests.map((request) => (
                <article className="member-row" key={request.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <strong>{canReview ? nicknameById.get(request.user_id) ?? "Учасник" : "Твоя відпустка"}</strong>
                    <p className="muted" style={{ marginTop: 6 }}>{formatDate(request.start_date)} — {formatDate(request.end_date)}</p>
                    <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{request.reason}</p>
                    <p className="notice-time" style={{ marginTop: 8 }}>Статус: {statusLabels[request.status]}</p>
                  </div>
                  {(canReview && request.status === "pending" || canDelete) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{canReview && request.status === "pending" && <>
                    <form action={reviewVacationRequest}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="decision" value="approved" /><button className="btn" type="submit">Схвалити</button></form>
                    <form action={reviewVacationRequest}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="decision" value="rejected" /><button className="btn secondary" type="submit">Відхилити</button></form>
                  </>}{canDelete && <form action={deleteVacationRequest} onSubmit={(event) => { if (!window.confirm("Видалити цю заявку на відпустку?")) event.preventDefault(); }}><input type="hidden" name="id" value={request.id} /><button className="btn secondary" type="submit">Видалити</button></form>}</div>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
