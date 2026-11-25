"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createVacationRequest(formData: FormData) {
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    startDate > endDate ||
    reason.length < 3 ||
    reason.length > 2000
  ) {
    redirect("/preview/vacation?status=invalid");
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: overlaps, error: overlapError } = await supabase
    .from("vacation_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);

  if (overlapError) {
    console.error("VERCETI vacation overlap check error:", overlapError.message);
    redirect("/preview/vacation?status=error");
  }
  if (overlaps?.length) redirect("/preview/vacation?status=overlap");

  const { error } = await supabase.from("vacation_requests").insert({
    user_id: user.id, start_date: startDate, end_date: endDate, reason, status: "pending"
  });
  if (error) {
    console.error("VERCETI vacation request creation error:", error.message);
    redirect("/preview/vacation?status=error");
  }
  revalidatePath("/preview/vacation");
  redirect("/preview/vacation?status=created");
}

export async function reviewVacationRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (!UUID_PATTERN.test(id) || !["approved", "rejected"].includes(decision)) {
    redirect("/preview/vacation?status=invalid");
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");
  const { data: isStaff, error: staffError } = await supabase.rpc("is_verceti_staff");
  if (staffError || isStaff !== true) redirect("/preview/vacation?status=forbidden");

  const { error } = await supabase.from("vacation_requests").update({
    status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString()
  }).eq("id", id).eq("status", "pending");
  if (error) {
    console.error("VERCETI vacation review error:", error.message);
    redirect("/preview/vacation?status=error");
  }
  revalidatePath("/preview/vacation");
  redirect("/preview/vacation?status=reviewed");
}
