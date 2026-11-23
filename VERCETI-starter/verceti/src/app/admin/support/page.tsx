import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.rpc("current_verceti_role");
  if (role !== "admin") redirect("/");

  const { data: requests, error } = await supabase
    .from("support_requests")
    .select("id, sender_name, sender_email, subject, message, created_at, status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="login-wrap">
      <section className="login-card" style={{ width: "100%", maxWidth: 760 }}>
        <Link href="/admin" className="btn secondary">← До адмін-панелі</Link>
        <h1 style={{ marginTop: 24 }}>Звернення до адміністрації</h1>
        <p className="muted">Повідомлення від учасників, зокрема заблокованих і тих, хто не може увійти.</p>
        {error ? <div className="panel">Не вдалося завантажити звернення. Перевір, чи виконаний support.sql у Supabase.</div> : !requests?.length ? <div className="panel">Нових звернень поки немає.</div> : requests.map((item) => (
          <article className="panel" key={item.id} style={{ marginTop: 14 }}>
            <div className="eyebrow">{new Date(item.created_at).toLocaleString("uk-UA")} · {item.status}</div>
            <h2>{item.subject}</h2>
            <p className="muted">Від: {item.sender_name} · {item.sender_email}</p>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{item.message}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
