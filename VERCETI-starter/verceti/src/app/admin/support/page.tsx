import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ChatRefresh from "../../support/ChatRefresh";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.rpc("current_verceti_role");
  if (role !== "admin") redirect("/");
  const admin = createAdminClient();
  const { data: requests, error } = await admin.from("support_requests").select("id, sender_name, sender_email, subject, message, created_at, status").order("created_at", { ascending: false }).limit(200);
  return <main className="login-wrap"><section className="login-card" style={{ width: "100%", maxWidth: 760 }}>
    <Link href="/admin" className="btn secondary">← До адмін-панелі</Link>
    <h1 style={{ marginTop: 24 }}>Чат адміністрації</h1>
    <p className="muted">Усі звернення користувачів, включно із заблокованими та неавторизованими. Відкрий діалог, щоб відповісти.</p><ChatRefresh />
    {error ? <div className="panel">Не вдалося завантажити повідомлення. Перевір support.sql у Supabase.</div> : !requests?.length ? <div className="panel">Повідомлень поки немає.</div> : requests.map((item) => <Link href={"/admin/support/" + item.id} key={item.id} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <article className="panel" style={{ marginTop: 14 }}>
        <div className="eyebrow">{new Date(item.created_at).toLocaleString("uk-UA")} · {item.status === "new" ? "НОВЕ" : item.status}</div>
        <h2>{item.subject}</h2><p className="muted">Від: {item.sender_name} · {item.sender_email}</p>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.message.length > 180 ? item.message.slice(0, 180) + "…" : item.message}</p>
        <span className="btn secondary">Відкрити чат →</span>
      </article>
    </Link>)}
  </section></main>;
}
