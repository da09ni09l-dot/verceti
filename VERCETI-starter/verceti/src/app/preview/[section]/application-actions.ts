
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const formsPath = "/preview/forms";

async function getUserAndClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function checkStaff() {
  const { supabase, user } = await getUserAndClient();

  const { data, error } = await supabase.rpc("is_verceti_staff");

  if (error || data !== true) {
    redirect(`${formsPath}?status=forbidden`);
  }

  return { supabase, user };
}

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Створення запитання
export async function createApplicationQuestion(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("question_type") ?? "text");
  const optionsText = String(formData.get("options") ?? "");
  const required = formData.get("is_required") === "on";
  const position = Number(formData.get("position") ?? 0);

  if (
    !question ||
    question.length > 1000 ||
    description.length > 2000 ||
    !["text", "textarea", "select"].includes(type) ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    redirect(`${formsPath}?status=question-invalid`);
  }

  const options = optionsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (type === "select" && options.length < 2) {
    redirect(`${formsPath}?status=question-options`);
  }

  const { supabase, user } = await checkStaff();

  const { error } = await supabase
    .from("application_questions")
    .insert({
      question,
      description: description || null,
      question_type: type,
      options: type === "select" ? options : [],
      is_required: required,
      position,
      created_by: user.id,
      is_active: true,
    });

  if (error) {
    console.error("Create application question:", error.message);
    redirect(`${formsPath}?status=question-error`);
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=question-created`);
}

// Редагування запитання
export async function updateApplicationQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("question_type") ?? "text");
  const optionsText = String(formData.get("options") ?? "");
  const required = formData.get("is_required") === "on";
  const position = Number(formData.get("position") ?? 0);

  if (
    !validId(id) ||
    !question ||
    question.length > 1000 ||
    description.length > 2000 ||
    !["text", "textarea", "select"].includes(type) ||
    !Number.isInteger(position) ||
    position < 0
  ) {
    redirect(`${formsPath}?status=question-invalid`);
  }

  const options = optionsText
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (type === "select" && options.length < 2) {
    redirect(`${formsPath}?status=question-options`);
  }

  const { supabase } = await checkStaff();

  const { error } = await supabase
    .from("application_questions")
    .update({
      question,
      description: description || null,
      question_type: type,
      options: type === "select" ? options : [],
      is_required: required,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Update application question:", error.message);
    redirect(`${formsPath}?status=question-error`);
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=question-updated`);
}

// Видалення запитання анкети
export async function deleteApplicationQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!validId(id)) {
    redirect(`${formsPath}?status=question-invalid`);
  }

  const { supabase } = await checkStaff();

  const { error } = await supabase
    .from("application_questions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete application question:", error.message);
    redirect(`${formsPath}?status=question-error`);
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=question-deleted`);
}

// Подання анкети гравцем
export async function submitApplication(formData: FormData) {
  const { supabase, user } = await getUserAndClient();

  const { data: questions, error: questionsError } = await supabase
    .from("application_questions")
    .select("id, question_type, options, is_required, is_active")
    .eq("is_active", true);

  if (questionsError || !questions || questions.length === 0) {
    redirect(`${formsPath}?status=no-questions`);
  }

  const birthDay = Number(formData.get("birth_day") ?? 0);
  const birthMonth = Number(formData.get("birth_month") ?? 0);
  if (
    !Number.isInteger(birthDay) ||
    !Number.isInteger(birthMonth) ||
    birthMonth < 1 || birthMonth > 12 ||
    birthDay < 1 || birthDay > new Date(Date.UTC(2000, birthMonth, 0)).getUTCDate()
  ) {
    redirect(`${formsPath}?status=birthday-required`);
  }

  const { data: currentProfile, error: birthdayReadError } = await supabase
    .from("profiles").select("birth_day, birth_month").eq("id", user.id).single();
  if (birthdayReadError) redirect(`${formsPath}?status=application-error`);
  if (currentProfile.birth_day == null || currentProfile.birth_month == null) {
    const { error: birthdayError } = await supabase.rpc("set_my_birthday_once", {
      p_birth_day: birthDay, p_birth_month: birthMonth,
    });
    if (birthdayError) {
      console.error("Save member birthday:", birthdayError.message);
      redirect(`${formsPath}?status=birthday-required`);
    }
  }

  const answers: Record<string, string> = {};

  for (const question of questions) {
    const value = String(
      formData.get(`answer_${question.id}`) ?? ""
    ).trim();

    if (question.is_required && !value) {
      redirect(`${formsPath}?status=answers-required`);
    }

    if (value.length > 10000) {
      redirect(`${formsPath}?status=answer-too-long`);
    }

    if (
      value &&
      question.question_type === "select" &&
      (!Array.isArray(question.options) ||
        !question.options.includes(value))
    ) {
      redirect(`${formsPath}?status=invalid-answer`);
    }

    answers[question.id] = value;
  }

  const { data: existing, error: existingError } = await supabase
    .from("applications")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "needs_changes"])
    .limit(1);

  if (existingError) {
    console.error("Find existing application:", existingError.message);
    redirect(`${formsPath}?status=application-error`);
  }

  if (existing && existing.length > 0) {
    const application = existing[0];

    if (application.status === "pending") {
      redirect(`${formsPath}?status=already-pending`);
    }

    const { error } = await supabase.rpc("resubmit_application", {
      p_application_id: application.id,
      p_answers: answers,
    });

    if (error) {
      console.error("Resubmit application:", error.message);
      redirect(`${formsPath}?status=application-error`);
    }
  } else {
    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      answers,
    });

    if (error) {
      console.error("Submit application:", error.message);
      redirect(`${formsPath}?status=application-error`);
    }
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=submitted`);
}

// Редагування відповідей гравця керівництвом
export async function editApplicationAnswers(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const rawAnswers = String(formData.get("answers") ?? "");

  if (!validId(id)) {
    redirect(`${formsPath}?status=application-invalid`);
  }

  let answers: unknown;

  try {
    answers = JSON.parse(rawAnswers);
  } catch {
    redirect(`${formsPath}?status=application-invalid`);
  }

  if (
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    redirect(`${formsPath}?status=application-invalid`);
  }

  const { supabase } = await checkStaff();

  const { error } = await supabase.rpc("staff_update_application", {
    p_application_id: id,
    p_answers: answers,
  });

  if (error) {
    console.error("Edit application answers:", error.message);
    redirect(`${formsPath}?status=application-error`);
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=answers-updated`);
}

// Підтвердження, відхилення або повернення анкети
export async function reviewApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const role = String(formData.get("assigned_role") ?? "");

  if (
    !validId(id) ||
    !["approved", "rejected", "needs_changes"].includes(status) ||
    note.length > 2000
  ) {
    redirect(`${formsPath}?status=application-invalid`);
  }

  const allowedRoles = [
    "",
    "junior",
    "local",
    "senior",
    "moderator",
    "leader",
  ];

  if (!allowedRoles.includes(role)) {
    redirect(`${formsPath}?status=application-invalid`);
  }

  const { supabase } = await checkStaff();

  const { error } = await supabase.rpc("review_application", {
    p_application_id: id,
    p_status: status,
    p_note: note || null,
    p_assigned_role: role || null,
  });

  if (error) {
    console.error("Review application:", error.message);
    redirect(`${formsPath}?status=review-error`);
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=reviewed`);
}

// Видалення анкети учасника (тільки адміністратор)
export async function deleteApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!validId(id)) {
    redirect(`${formsPath}?status=application-invalid`);
  }

  const { supabase } = await getUserAndClient();

  const { data: role, error: roleError } = await supabase.rpc(
    "current_verceti_role"
  );

  if (roleError || role !== "admin") {
    redirect(`${formsPath}?status=forbidden`);
  }

  const { error } = await supabase.rpc("delete_application", {
    p_application_id: id,
  });

  if (error) {
    console.error("Delete application:", error.message);
    redirect(`${formsPath}?status=application-error`);
  }

  revalidatePath(formsPath);
  redirect(`${formsPath}?status=application-deleted`);
}

export async function saveBirthday(formData: FormData) {
  const birthDay = Number(formData.get("birth_day") ?? 0);
  const birthMonth = Number(formData.get("birth_month") ?? 0);
  if (!Number.isInteger(birthDay) || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > new Date(Date.UTC(2000, birthMonth, 0)).getUTCDate()) {
    redirect(`${formsPath}?status=birthday-required`);
  }
  const { supabase, user } = await getUserAndClient();
  const { error } = await supabase.from("profiles").update({ birth_day: birthDay, birth_month: birthMonth }).eq("id", user.id);
  if (error) {
    console.error("Save birthday:", error.message);
    redirect(`${formsPath}?status=application-error`);
  }
  revalidatePath(formsPath);
  redirect(`${formsPath}?status=birthday-saved`);
}


export async function setMyBirthday(formData: FormData) {
  const { supabase } = await getUserAndClient();
  const birthDay = Number(formData.get("birth_day") ?? 0);
  const birthMonth = Number(formData.get("birth_month") ?? 0);
  if (!Number.isInteger(birthDay) || !Number.isInteger(birthMonth) ||
      birthMonth < 1 || birthMonth > 12 || birthDay < 1 ||
      birthDay > new Date(Date.UTC(2000, birthMonth, 0)).getUTCDate()) {
    redirect(`${formsPath}?status=birthday-required`);
  }
  const { error } = await supabase.rpc("set_my_birthday_once", {
    p_birth_day: birthDay, p_birth_month: birthMonth,
  });
  if (error) {
    console.error("Set birthday once:", error.message);
    redirect(`${formsPath}?status=birthday-locked`);
  }
  revalidatePath(formsPath);
  redirect(`${formsPath}?status=birthday-saved`);
}

export async function adminUpdateBirthday(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const birthDay = Number(formData.get("birth_day") ?? 0);
  const birthMonth = Number(formData.get("birth_month") ?? 0);
  if (!validId(userId) || !Number.isInteger(birthDay) || !Number.isInteger(birthMonth) ||
      birthMonth < 1 || birthMonth > 12 || birthDay < 1 ||
      birthDay > new Date(Date.UTC(2000, birthMonth, 0)).getUTCDate()) {
    redirect(`${formsPath}?status=birthday-required`);
  }
  const { supabase } = await getUserAndClient();
  const { data: role, error: roleError } = await supabase.rpc("current_verceti_role");
  if (roleError || role !== "admin") redirect(`${formsPath}?status=forbidden`);
  const { error } = await supabase.rpc("admin_update_member_birthday", {
    p_user_id: userId, p_birth_day: birthDay, p_birth_month: birthMonth,
  });
  if (error) {
    console.error("Admin birthday correction:", error.message);
    redirect(`${formsPath}?status=application-error`);
  }
  revalidatePath(formsPath);
  redirect(`${formsPath}?status=birthday-updated`);
}
