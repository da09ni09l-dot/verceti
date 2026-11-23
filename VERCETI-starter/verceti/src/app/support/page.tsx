import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function sendSupportRequest(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().slice(0, 160);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 120);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const website = String(formData.get("website") ?? "").trim();
  if (website) redirect("/support?sent=1");
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 3 || message.length < 10) redirect("/support?error=1");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const accessToken = crypto.randomUUID();
  const { data: ticket, error } = await admin.from("support_requests").insert({
    sender_name: name, sender_email: email, subject, message, user_id: user?.id ?? null, access_token: accessToken
  }).select("id").single();
  if (error || !ticket) redirect("/support?error=1");
  redirect("/support/chat?ticket=" + ticket.id + "&key=" + accessToken);
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;
  return <main className="login-wrap"><section className="login-card" style={{ width: "100%", maxWidth: 620 }}>
    <div className="eyebrow">VERCETI · ПІДТРИМКА</div><h1>Зв’язок з адміністрацією</h1>
    <p className="muted" style={{ lineHeight: 1.7 }}>Напиши адміністрації навіть якщо акаунт заблоковано або ти не можеш увійти. Після відправлення відкриється приватний чат для подальшого листування.</p>
    {params.error === "1" && <div className="panel" style={{ marginTop: 16 }}>Не вдалося створити чат. Перевір поля та спробуй ще раз.</div>}
    <form action={sendSupportRequest} className="member-list" style={{ marginTop: 22, gap: 10 }}>
      <label htmlFor="support-name">Ім’я або нікнейм</label><input id="support-name" name="name" required minLength={2} maxLength={80} />
      <label htmlFor="support-email">Email для відповіді</label><input id="support-email" name="email" type="email" required maxLength={160} />
      <label htmlFor="support-subject">Тема звернення</label><input id="support-subject" name="subject" required minLength={3} maxLength={120} />
      <label htmlFor="support-message">Повідомлення</label><textarea id="support-message" name="message" required minLength={10} maxLength={4000} rows={6} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}><label htmlFor="support-website">Website</label><input id="support-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <button className="btn" type="submit">Відкрити чат з адміністрацією</button>
    </form>
    <p className="page-note"><Link href="/login">Повернутися до входу</Link></p>
  </section></main>;
}
