
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
