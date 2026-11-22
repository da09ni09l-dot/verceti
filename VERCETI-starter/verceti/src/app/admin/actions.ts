
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
