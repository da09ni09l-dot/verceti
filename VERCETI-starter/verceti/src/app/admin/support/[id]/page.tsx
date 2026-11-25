import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ChatRefresh from "../../../support/ChatRefresh";

async function updateSupportStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("ticket") ?? "");
  const status = String(formData.get("status") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.rpc("current_verceti_role");
  if (role !== "admin") redirect("/");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["closed", "in_progress"].includes(status)) redirect("/admin/support");
  const admin = createAdminClient();
  const { error } = await admin.from("support_requests").update({ status }).eq("id", id);
  if (error) redirect("/admin/support/" + id + "?error=status");
  redirect("/admin/support/" + id);
}

async function sendAdminReply(formData: FormData) {
  "use server";
  const id = String(formData.get("ticket") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.rpc("current_verceti_role");
  if (role !== "admin") redirect("/");
  if (!/^[0-9a-f-]{36}$/i.test(id) || message.length < 2) redirect("/admin/support");
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("support_requests").select("status").eq("id", id).maybeSingle();
  if (!ticket || ticket.status === "closed") redirect("/admin/support/" + id + "?error=closed");
  const { error } = await admin.from("support_messages").insert({ request_id: id, sender_type: "admin", sender_id: user.id, message });
  if (error) redirect("/admin/support/" + id + "?error=1");
  await admin.from("support_requests").update({ status: "in_progress" }).eq("id", id);
  redirect("/admin/support/" + id);
}

export default async function AdminSupportConversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const p = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role } = await supabase.rpc("current_verceti_role");
  if (role !== "admin") redirect("/");
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("support_requests").select("*").eq("id", id).maybeSingle();
  if (!ticket) notFound();
  const { data: replies } = await admin.from("support_messages").select("id, sender_type, message, created_at").eq("request_id", id).order("created_at", { ascending: true });
  return <main className="login-wrap"><section className="login-card" style={{ width: "100%", maxWidth: 700 }}>
    <Link href="/admin/support" className="btn secondary">← Усі звернення</Link>
    <h1 style={{ marginTop: 22 }}>{ticket.subject}</h1><p className="muted">{ticket.sender_name} · Статус: {ticket.status}</p>
    <form action={updateSupportStatus} style={{ marginTop: 12 }}>
      <input type="hidden" name="ticket" value={ticket.id} />
      <input type="hidden" name="status" value={ticket.status === "closed" ? "in_progress" : "closed"} />
      <button className="btn secondary" type="submit">{ticket.status === "closed" ? "Відкрити звернення знову" : "Закрити звернення"}</button>
    </form>
    <ChatRefresh />
    <div className="panel" style={{ marginTop: 14, maxHeight: "55vh", overflowY: "auto" }}>
      <article style={{ padding: 10 }}><strong>Початкове звернення · {new Date(ticket.created_at).toLocaleString("uk-UA")}</strong><p style={{ whiteSpace: "pre-wrap" }}>{ticket.message}</p></article>
      {replies?.map((item) => <article key={item.id} style={{ padding: 10, marginTop: 10, borderTop: "1px solid rgba(255,255,255,.1)" }}><strong>{item.sender_type === "admin" ? "Адміністрація" : "Користувач"} · {new Date(item.created_at).toLocaleString("uk-UA")}</strong><p style={{ whiteSpace: "pre-wrap" }}>{item.message}</p></article>)}
    </div>
    {p.error && <p style={{ color: "#ff8f9f" }}>Не вдалося виконати дію. {p.error === "closed" ? "Спочатку відкрий звернення знову." : ""}</p>}
    {ticket.status !== "closed" && <form action={sendAdminReply} style={{ marginTop: 16 }}><input type="hidden" name="ticket" value={ticket.id} /><label htmlFor="admin-reply">Відповідь користувачу</label><textarea id="admin-reply" name="message" required minLength={2} maxLength={4000} rows={4} /><button className="btn" style={{ width: "100%", marginTop: 12 }}>Надіслати відповідь</button></form>}
  </section></main>;
}
