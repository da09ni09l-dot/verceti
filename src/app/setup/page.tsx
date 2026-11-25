import Link from "next/link";
export default function SetupPage() {
  return <main className="login-wrap"><section className="login-card">
    <div className="eyebrow">ПОТРІБНЕ НАЛАШТУВАННЯ</div><h1>Підключення VERCETI</h1>
    <p className="muted" style={{lineHeight:1.8,fontSize:13}}>Щоб увімкнути приватний вхід, додайте адресу проєкту Supabase та публічний anon key у файл <code>.env.local</code>. Інструкція є в README.</p>
    <Link className="btn" href="/">До локального макета</Link>
  </section></main>;
}
