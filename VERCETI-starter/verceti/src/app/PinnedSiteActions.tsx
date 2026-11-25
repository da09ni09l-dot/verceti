import { createClient } from "@/lib/supabase/server";
import PinnedSiteActionsMenu from "./PinnedSiteActionsMenu";

export default async function PinnedSiteActions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: role } = await supabase.rpc("current_verceti_role");
    isAdmin = role === "admin";
  }
  return <PinnedSiteActionsMenu isAdmin={isAdmin} />;
}
