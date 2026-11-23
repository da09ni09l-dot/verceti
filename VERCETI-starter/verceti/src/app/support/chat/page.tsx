import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import ChatRefresh from "../ChatRefresh";

async function sendVisitorMessage(formData: FormData) {
  "use server";
  const id = String(formData.get("ticket") ?? "");
  const key = String(formData.get("key") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(key) || message.length < 2) redirect("/support");
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("support_requests").select("id").eq("id", id).eq("access_token", key).maybeSingle();
  if (!ticket) redirect("/support");
  const { error } = await admin.from("support_messages").insert({ request_id: id, sender_type: "visitor", message });
  if (error) redirect("/support/chat?ticket=" + id + "&key=" + key + "&error=1");
  await admin.from("support_requests").update({ status: "new" }).eq("id", id);
  redirect("/support/chat?ticket=" + id + "&key=" + key);
}

export default async function SupportChatPage({ searchParams }: { searchParams: Promise<{ ticket?: string; key?: string; error?: string }> }) {
  const p = await searchParams;
  if (!p.ticket || !p.key) notFound();
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("support_requests").select("id, sender_name, sender_email, subject, message, created_at, access_token").eq("id", p.ticket).eq("access_token", p.key).maybeSingle();
  if (!ticket) notFound();
  const { data: replies } = await admin.from("support_messages").select("id, sender_type, message, created_at").eq("request_id", ticket.id).order("created_at", { ascending: true });
  return (
    <main className="login-wrap"><section className="login-card" style={{ width: "100%", maxWidth: 680 }}>
      <div className="eyebrow">VERCETI · ПІДТРИМКА</div><h1>Чат з адміністрацією</h1>
      <p className="muted">Тема: {ticket.subject} · {ticket.sender_name}</p>
      <ChatRefresh />
      <div className="panel" style={{ marginTop: 14, maxHeight: "55vh", overflowY: "auto" }}>
        <article style={{ padding: 10 }}><strong>Ви · {new Date(ticket.created_at).toLocaleString("uk-UA")}</strong><p style={{ whiteSpace: "pre-wrap" }}>{ticket.message}</p></article>
        {replies?.map((item) => <article key={item.id} style={{ padding: 10, marginTop: 10, borderTop: "1px solid rgba(255,255,255,.1)" }}><strong>{item.sender_type === "admin" ? "Адміністрація" : "Ви"} · {new Date(item.created_at).toLocaleString("uk-UA")}</strong><p style={{ whiteSpace: "pre-wrap" }}>{item.message}</p></article>)}
      </div>
      {p.error && <p style={{ color: "#ff8f9f" }}>Не вдалося надіслати повідомлення.</p>}
      <form action={sendVisitorMessage} style={{ marginTop: 16 }}>
        <input type="hidden" name="ticket" value={ticket.id} /><input type="hidden" name="key" value={ticket.access_token} />
        <label htmlFor="chat-message">Ваше повідомлення</label><textarea id="chat-message" name="message" required minLength={2} maxLength={4000} rows={4} />
        <button className="btn" style={{ width: "100%", marginTop: 12 }}>Надіслати</button>
      </form>
      <p className="page-note"><Link href="/support">Створити інше звернення</Link></p>
    </section></main>
  );
}
