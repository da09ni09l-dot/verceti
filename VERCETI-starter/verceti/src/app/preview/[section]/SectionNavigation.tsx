
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewsBell from "../../NewsBell";

export default async function SectionNavigation() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canSeeMainMenu = false;
  let pendingApplications = 0;
  let isStaff = false;

  if (user) {
    const { data: staffStatus } = await supabase.rpc(
      "is_verceti_staff"
    );

    if (staffStatus === true) {
      canSeeMainMenu = true;
      isStaff = true;
      const { count } = await supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingApplications = count ?? 0;
    } else {
      const { data: applications } = await supabase
        .from("applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      canSeeMainMenu =
        applications?.[0]?.status === "approved";
    }
  }

  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "1px solid rgba(187, 138, 255, 0.2)",
      }}
    >
      {canSeeMainMenu ? (
        <Link className="btn" href="/">
          ⌂ Головне меню
        </Link>
      ) : (
        <Link className="btn" href="/preview/forms">
          📋 Моя анкета
        </Link>
      )}
      {isStaff && (
        <Link className="btn" href="/preview/forms?view=pending">
          📋 Анкети на підтвердження{pendingApplications > 0 ? ` (${pendingApplications})` : ""}
        </Link>
      )}
      {user && <NewsBell userId={user.id} />}
    </nav>
  );
}
