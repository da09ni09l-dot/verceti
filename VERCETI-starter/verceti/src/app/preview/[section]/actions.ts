
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function checkStaff() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: isStaff, error } = await supabase.rpc(
    "is_verceti_staff"
  );

  if (error || isStaff !== true) {
    redirect("/preview/news?status=forbidden");
  }

  return { supabase, user };
}

export async function createNews(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const eventDate = String(formData.get("event_date") ?? "").trim();

  if (!title || !content) {
    redirect("/preview/news?status=empty");
  }

  if (
    title.length > 150 ||
    content.length > 10000 ||
    !["announcement", "event", "important"].includes(category)
  ) {
    redirect("/preview/news?status=invalid");
  }

  const { supabase, user } = await checkStaff();

  const { error } = await supabase.from("news").insert({
    title,
    content,
    category,
    event_date: eventDate || null,
    created_by: user.id,
  });

  if (error) {
    console.error("VERCETI news creation error:", error.message);
    redirect("/preview/news?status=error");
  }

  revalidatePath("/preview/news");
  redirect("/preview/news?status=created");
}

export async function deleteNews(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    redirect("/preview/news?status=invalid");
  }

  const { supabase } = await checkStaff();

  const { error } = await supabase
    .from("news")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("VERCETI news deletion error:", error.message);
    redirect("/preview/news?status=delete-error");
  }

  revalidatePath("/preview/news");
  redirect("/preview/news?status=deleted");
}

export async function createDisciplinaryAction(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const actionType = String(formData.get("action_type") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(memberId)) {
    redirect("/preview/stats?status=disciplinary-invalid-member");
  }

  if (!["warning", "decision"].includes(actionType)) {
    redirect("/preview/stats?status=disciplinary-invalid-type");
  }

  if (!reason || reason.length > 2000) {
    redirect("/preview/stats?status=disciplinary-invalid-reason");
  }

  const { supabase, user } = await checkStaff();

  const { data: member, error: memberError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    console.error(
      "VERCETI disciplinary member validation error:",
      memberError?.message
    );
    redirect("/preview/stats?status=disciplinary-invalid-member");
  }

  const { error } = await supabase
    .from("disciplinary_actions")
    .insert({
      member_id: memberId,
      issued_by: user.id,
      action_type: actionType,
      reason
    });

  if (error) {
    console.error(
      "VERCETI disciplinary action creation error:",
      error.message
    );
    redirect("/preview/stats?status=disciplinary-error");
  }

  revalidatePath("/preview/stats");
  redirect("/preview/stats?status=disciplinary-created");
}
