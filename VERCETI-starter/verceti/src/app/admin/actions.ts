
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
  const reason = "Створення акаунта адміністратором";

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) {
    return {
      error: "Нікнейм має містити 3–20 символів: латинські літери, цифри або _.",
    };
  }

  if (password.length < 8) {
    return { error: "Пароль має містити щонайменше 8 символів." };
  }

  if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
    return { error: "Вибрано неправильну роль." };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Потрібно увійти в адміністративний акаунт." };
  }

  const { data: currentRole, error: roleError } =
    await supabase.rpc("current_verceti_role");

  if (roleError || currentRole !== "admin") {
    return { error: "Створювати акаунти може лише адміністратор." };
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
    return {
      error: "Не вдалося створити акаунт. Можливо, такий нікнейм уже існує.",
    };
  }

  if (role !== "junior") {
    const { error: changeRoleError } = await supabase.rpc(
      "change_member_role",
      {
        p_member_id: data.user.id,
        p_new_role: role,
        p_reason: reason,
      }
    );

    if (changeRoleError) {
      console.error("Assign role error:", changeRoleError.message);

      await admin.auth.admin.deleteUser(data.user.id);

      return {
        error: "Акаунт не створено: не вдалося призначити вибрану роль.",
      };
    }
  }

  redirect("/admin?created=1");
}
