import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: { user } }, { data: role }] = await Promise.all([
    supabase.from("site_settings").select("maintenance_message").eq("id", true).maybeSingle(),
    supabase.auth.getUser(),
    supabase.rpc("current_verceti_role"),
  ]);
  const isFounder = !!user && (role === "founder" || role === "admin");

  return (
    <main className="login-wrap workspace-wrap">
      <section className="login-card workspace-card" style={{ maxWidth: 620, textAlign: "center" }}>
        <div className="brand" style={{ padding: 0 }}>
          VERCETI
          <small>ТЕХНІЧНЕ ОБСЛУГОВУВАННЯ</small>
        </div>
        <div style={{ fontSize: 42, marginTop: 34 }} aria-hidden="true">⚙</div>
        <h1 style={{ fontSize: 28, marginTop: 18 }}>Сайт оновлюється</h1>
        <p className="muted" style={{ lineHeight: 1.8, marginTop: 12 }}>
          {settings?.maintenance_message ?? "Ми проводимо технічні роботи. Будь ласка, зайдіть трохи пізніше."}
        </p>
        {isFounder && (
          <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
            <Link href="/" className="btn" style={{ width: "100%" }}>Повернутися на сайт</Link>
            <Link href="/admin" className="btn secondary" style={{ width: "100%" }}>Відкрити адмін-панель</Link>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 28 }}>
          VERCETI · PRIVATE COMMUNITY
        </p>
      </section>
    </main>
  );
}
