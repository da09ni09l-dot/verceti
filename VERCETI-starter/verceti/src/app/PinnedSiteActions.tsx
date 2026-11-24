import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PinnedSiteActions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: role } = await supabase.rpc("current_verceti_role");
    isAdmin = role === "admin";
  }
  return <nav aria-label="Швидкий доступ VERCETI" style={{ position: "fixed", right: 16, bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
    {isAdmin && <><Link href="/admin/support" className="btn secondary" style={{ minHeight: 58, padding: "14px 18px", lineHeight: 1.4, boxSizing: "border-box", boxShadow: "0 8px 28px rgba(0,0,0,.35)", textDecoration: "none" }}>💬 Чат адміністрації</Link><Link href="/admin" className="btn" style={{ minHeight: 58, padding: "14px 18px", lineHeight: 1.4, boxSizing: "border-box", boxShadow: "0 8px 28px rgba(0,0,0,.35)", textDecoration: "none" }}>⚙ Адмін-панель</Link></>}
    <Link href="/support" className="btn secondary" style={{ minHeight: 58, padding: "14px 18px", lineHeight: 1.4, boxSizing: "border-box", boxShadow: "0 8px 28px rgba(0,0,0,.35)", textDecoration: "none" }}>✉ Зв’язок з адміністрацією</Link>
  </nav>;
}
