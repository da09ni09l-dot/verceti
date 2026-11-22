
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const allowedRoles = [
  "junior",
  "local",
  "senior",
  "moderator",
  "leader",
] as const;

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: currentRole, error: roleError } =
    await supabase.rpc("current_verceti_role");

  if (roleError || currentRole !== "admin") {
    redirect("/");
  }

  return { supabase, user };
}

export async function createMember(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "junior");

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) {
    redirect("/admin?error=nickname");
  }

  if (password.length < 8) {
    redirect("/admin?error=password");
  }

  if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
    redirect("/admin?error=role");
  }

  const { supabase } = await requireAdmin();
  const admin = createAdminClient();

  const email = `${nickname.toLowerCase()}@login.verceti.invalid`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nickname,
    },
  });

  if (error || !data.user) {
    console.error("Create member error:", error?.message);
    redirect("/admin?error=create");
  }

  if (role !== "junior") {
    const { error: changeRoleError } = await supabase.rpc(
      "change_member_role",
      {
        p_member_id: data.user.id,
        p_new_role: role,
        p_reason: "Створення акаунта адміністратором",
      }
    );

    if (changeRoleError) {
      console.error("Assign role error:", changeRoleError.message);

      await admin.auth.admin.deleteUser(data.user.id);

      redirect("/admin?error=role_assignment");
    }
  }

  redirect("/admin?created=1");
}

export async function banMember(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();

  if (!memberId) {
    redirect("/admin?error=member");
  }

  const { supabase, user } = await requireAdmin();

  if (memberId === user.id) {
    redirect("/admin?error=self_ban");
  }

  const { data: member, error: memberError } = await supabase
    .from("profiles")
    .select("id, role, is_banned")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    redirect("/admin?error=member");
  }

  if (member.role === "admin") {
    redirect("/admin?error=protected");
  }

  if (member.is_banned) {
    redirect("/admin?updated=1");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: true })
    .eq("id", memberId);

  if (error) {
    console.error("Ban member error:", error.message);
    redirect("/admin?error=ban");
  }

  redirect("/admin?updated=1");
}

export async function unbanMember(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();

  if (!memberId) {
    redirect("/admin?error=member");
  }

  const { supabase } = await requireAdmin();

  const { data: member, error: memberError } = await supabase
    .from("profiles")
    .select("id, is_banned")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    redirect("/admin?error=member");
  }

  if (!member.is_banned) {
    redirect("/admin?updated=1");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: false })
    .eq("id", memberId);

  if (error) {
    console.error("Unban member error:", error.message);
    redirect("/admin?error=unban");
  }

  redirect("/admin?updated=1");
}

export async function deleteMember(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const confirmation = String(
    formData.get("confirmation") ?? ""
  ).trim();

  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
    redirect("/admin?error=member");
  }

  if (confirmation !== "DELETE") {
    redirect("/admin?error=confirmation");
  }

  const { user } = await requireAdmin();

  if (memberId === user.id) {
    redirect("/admin?error=self_delete");
  }

  const admin = createAdminClient();

  // Перевіряємо цільовий акаунт
  const { data: member, error: memberError } = await admin
    .from("profiles")
    .select("id, nickname, role")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    console.error("Find member error:", memberError?.message);
    redirect("/admin?error=member");
  }

  // Захист від видалення адміністраторів
  if (member.role === "admin") {
    redirect("/admin?error=protected");
  }

  // Від'єднуємо автора від спільних записів
  const detachOperations = [
    admin
      .from("application_questions")
      .update({ created_by: null })
      .eq("created_by", memberId),

    admin
      .from("applications")
      .update({ reviewed_by: null })
      .eq("reviewed_by", memberId),

    admin
      .from("disciplinary_actions")
      .update({ issued_by: null })
      .eq("issued_by", memberId),

    admin
      .from("moderation_actions")
      .update({ moderator_id: null })
      .eq("moderator_id", memberId),

    admin
      .from("role_history")
      .update({ changed_by: null })
      .eq("changed_by", memberId),

    admin
      .from("test_permissions")
      .update({ granted_by: null })
      .eq("granted_by", memberId),

    admin
      .from("tests")
      .update({ created_by: null })
      .eq("created_by", memberId),
  ];

  const detachResults = await Promise.all(detachOperations);

  const detachError = detachResults.find((result) => result.error);

  if (detachError?.error) {
    console.error(
      "Detach member references error:",
      detachError.error.message
    );
    redirect("/admin?error=delete_cleanup");
  }

  // Видаляємо результати тестів користувача
  const { error: resultsError } = await admin
    .from("test_results")
    .delete()
    .eq("user_id", memberId);

  if (resultsError) {
    console.error("Delete test results error:", resultsError.message);
    redirect("/admin?error=delete_cleanup");
  }

  // Видаляємо Auth-акаунт.
  // Профіль видалиться автоматично через ON DELETE CASCADE.
  const { error: deleteError } =
    await admin.auth.admin.deleteUser(memberId);

  if (deleteError) {
    console.error("Delete auth user error:", deleteError.message);
    redirect("/admin?error=delete_auth");
  }

  redirect("/admin?deleted=1");
}
