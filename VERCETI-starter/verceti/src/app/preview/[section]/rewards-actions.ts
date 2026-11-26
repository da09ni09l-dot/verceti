"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function requireRewardsManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role, error } = await supabase.rpc("current_verceti_role");
  if (error || !["founder", "leader", "moderator"].includes(String(role ?? ""))) redirect("/preview/rewards?status=forbidden");
  return { supabase, user, role };
}
export async function createRewardPrize(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const weight = Number(formData.get("weight") ?? 1);
  if (!title || title.length > 100 || description.length > 500 || !Number.isInteger(weight) || weight < 1 || weight > 10000) redirect("/preview/rewards?status=invalid");
  const { supabase, user } = await requireRewardsManager();
  const { error } = await supabase.from("rewards_prizes").insert({ title, description, weight, created_by: user.id, is_active: true });
  if (error) { console.error("Create rewards prize:", error.message); redirect("/preview/rewards?status=error"); }
  redirect("/preview/rewards?status=created");
}
export async function deleteRewardPrize(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/preview/rewards?status=invalid");
  const { supabase, user, role } = await requireRewardsManager();
  let archive = supabase.from("rewards_prizes").update({ is_active: false }).eq("id", id);
  if (role !== "founder") archive = archive.eq("created_by", user.id);
  const { data, error } = await archive.select("id").maybeSingle();
  if (error || !data) {
    console.error("Archive rewards prize:", error?.message ?? "Prize not found or not permitted");
    redirect("/preview/rewards?status=error");
  }
  redirect("/preview/rewards?status=archived");
}

export async function restoreRewardPrize(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/preview/rewards?status=invalid");
  const { supabase, user, role } = await requireRewardsManager();
  let restore = supabase.from("rewards_prizes").update({ is_active: true }).eq("id", id);
  if (role !== "founder") restore = restore.eq("created_by", user.id);
  const { data, error } = await restore.select("id").maybeSingle();
  if (error || !data) {
    console.error("Restore rewards prize:", error?.message ?? "Prize not found or not permitted");
    redirect("/preview/rewards?status=error");
  }
  redirect("/preview/rewards?status=restored");
}

export async function spinRewards(): Promise<
  | { ok: true; prize: { id: string; title: string; description: string } }
  | { ok: false; error: "used" | "empty" | "unauthorized" | "failed" }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase.rpc("spin_verceti_rewards");
  if (error) {
    if (error.message.includes("daily_spin_used")) return { ok: false, error: "used" };
    if (error.message.includes("no_active_prizes")) return { ok: false, error: "empty" };
    console.error("Spin rewards:", error.message);
    return { ok: false, error: "failed" };
  }

  const prize = data as { id?: string; title?: string; description?: string } | null;
  if (!prize?.id || !prize.title) return { ok: false, error: "failed" };
  return {
    ok: true,
    prize: {
      id: prize.id,
      title: prize.title,
      description: prize.description ?? "",
    },
  };
}
