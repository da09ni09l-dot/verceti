import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function sendSupportRequest(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().slice(0, 160);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 120);
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);
  const website = String(formData.get("website") ?? "").trim();

  if (website) redirect("/support?sent=1");
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 3 || message.length < 10) {
    redirect("/support?error=1");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("support_requests").insert({
    sender_name: name,
    sender_email: email,
    subject,
    message,
    user_id: user?.id ?? null
  });
  if (error) redirect("/support?error=1");
  redirect("/support?sent=1");
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-wrap">
      <section className="login-card" style={{ width: "100%", maxWidth: 620 }}>
        <div className="eyebrow">VERCETI · ПІДТРИМКА</div>
        <h1>Зв’язок з адміністрацією</h1>
        <p className="muted" style={{ lineHeight: 1.7 }}>Можеш написати адміністрації навіть якщо акаунт заблоковано або ти не можеш увійти на сайт. Вкажи email, за яким адміністрація зможе відповісти.</p>
        {params.sent === "1" && <div className="panel" style={{ marginTop: 16 }}>Звернення надіслано. Адміністрація зможе переглянути його в адмін-панелі.</div>}
        {params.error === "1" && <div className="panel" style={{ marginTop: 16 }}>Не вдалося надіслати звернення. Перевір поля та спробуй ще раз.</div>}
        <form action={sendSupportRequest} className="member-list" style={{ marginTop: 22, gap: 10 }}>
          <label htmlFor="support-name">Ім’я або нікнейм</label>
          <input id="support-name" name="name" required minLength={2} maxLength={80} />
          <label htmlFor="support-email">Email для відповіді</label>
          <input id="support-email" name="email" type="email" required maxLength={160} />
          <label htmlFor="support-subject">Тема звернення</label>
          <input id="support-subject" name="subject" required minLength={3} maxLength={120} />
          <label htmlFor="support-message">Повідомлення</label>
          <textarea id="support-message" name="message" required minLength={10} maxLength={4000} rows={6} />
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
            <label htmlFor="support-website">Website</label>
            <input id="support-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <button className="btn" type="submit">Надіслати адміністрації</button>
        </form>
        <p className="page-note"><Link href="/login">Повернутися до входу</Link></p>
      </section>
    </main>
  );
}
