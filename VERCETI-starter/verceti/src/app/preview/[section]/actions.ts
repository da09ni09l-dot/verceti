
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createNews(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const eventDate = String(formData.get("event_date") ?? "").trim();

  if (!title || !content) {
    redirect("/preview/news?status=empty");
  }

  if (!["announcement", "event", "important"].includes(category)) {
    redirect("/preview/news?status=invalid");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: isStaff, error: roleError } = await supabase.rpc(
    "is_verceti_staff"
  );

  if (roleError || isStaff !== true) {
    redirect("/preview/news?status=forbidden");
  }

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
