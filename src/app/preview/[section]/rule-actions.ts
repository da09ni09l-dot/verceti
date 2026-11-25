
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function checkStaff() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("is_verceti_staff");

  if (error || data !== true) {
    throw new Error("У тебе немає прав для цієї дії.");
  }

  return supabase;
}

export async function createRule(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const position = Number(formData.get("position") ?? 0);

  if (!title || !content || !Number.isInteger(position) || position < 0) {
    redirect("/preview/rules?status=invalid");
  }

  const supabase = await checkStaff();

  const { error } = await supabase
    .from("community_rules")
    .insert({
      title,
      content,
      position,
    });

  if (error) {
    console.error("Create rule error:", error.message);
    redirect("/preview/rules?status=error");
  }

  revalidatePath("/preview/rules");
  redirect("/preview/rules?status=created");
}

export async function updateRule(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const position = Number(formData.get("position") ?? 0);

  if (!id || !title || !content || !Number.isInteger(position) || position < 0) {
    redirect("/preview/rules?status=invalid");
  }

  const supabase = await checkStaff();

  const { error } = await supabase
    .from("community_rules")
    .update({
      title,
      content,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Update rule error:", error.message);
    redirect("/preview/rules?status=error");
  }

  revalidatePath("/preview/rules");
  redirect("/preview/rules?status=updated");
}

export async function deleteRule(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/preview/rules?status=invalid");
  }

  const supabase = await checkStaff();

  const { error } = await supabase
    .from("community_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete rule error:", error.message);
    redirect("/preview/rules?status=error");
  }

  revalidatePath("/preview/rules");
  redirect("/preview/rules?status=deleted");
}
