"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function requestPasswordChange() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("password_change_requests")
    .select("id,status")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .limit(1);

  if (lookupError) {
    console.error("Password request lookup:", lookupError.message);
    redirect("/preview/settings?status=password_request_error");
  }
  if (existing?.length) {
    redirect("/preview/settings?status=password_request_exists");
  }

  const { error } = await admin.from("password_change_requests").insert({
    user_id: user.id,
    status: "pending",
  });
  if (error) {
    console.error("Password request create:", error.message);
    redirect("/preview/settings?status=password_request_error");
  }

  revalidatePath("/admin");
  redirect("/preview/settings?status=password_request_sent");
}

export async function reviewPasswordChangeRequest(formData: FormData) {
  const id = String(formData.get("request_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved", "rejected"].includes(decision)) {
    redirect("/admin?tab=overview&error=password_request");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: role, error: roleError } = await supabase.rpc("current_verceti_role");
  if (roleError || role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { error } = await admin.from("password_change_requests").update({
    status: decision,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    review_note: String(formData.get("note") ?? "").trim().slice(0, 500) || null,
  }).eq("id", id).eq("status", "pending");

  if (error) {
    console.error("Password request review:", error.message);
    redirect("/admin?tab=overview&error=password_request");
  }
  revalidatePath("/admin");
  redirect("/admin?tab=overview&password_request_reviewed=1");
}

export async function completeApprovedPasswordChange(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");
  if (password.length < 8 || password.length > 72 || password !== confirmation) {
    redirect("/preview/settings?status=password_error");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin
    .from("password_change_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError || !request) {
    redirect("/preview/settings?status=password_not_approved");
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) {
    console.error("Approved password change:", passwordError.message);
    redirect("/preview/settings?status=password_save_error");
  }

  const { error: completionError } = await admin.from("password_change_requests")
    .update({ status: "completed" })
    .eq("id", request.id)
    .eq("user_id", user.id)
    .eq("status", "approved");

  if (completionError) {
    console.error("Mark password request completed:", completionError.message);
  }

  redirect("/preview/settings?status=password_saved");
}
