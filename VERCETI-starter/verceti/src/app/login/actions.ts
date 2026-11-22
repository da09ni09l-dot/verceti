
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loginWithNickname(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nickname || !password) {
    return { error: "Введи нікнейм і пароль." };
  }

  if (nickname.length > 50) {
    return { error: "Неправильний нікнейм або пароль." };
  }

  try {
    const admin = createAdminClient();

    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, nickname");

    if (profileError) {
      console.error("Profile lookup error:", profileError.message);
      return { error: "Не вдалося знайти профіль." };
    }

    const profile = profiles?.find(
      (item) => item.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (!profile) {
      return { error: "Неправильний нікнейм або пароль." };
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.id);

    if (userError || !userData.user?.email) {
      console.error("Get user error:", userError?.message);
      return { error: "Не вдалося знайти обліковий запис." };
    }

    const supabase = await createClient();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password,
    });

    if (loginError) {
      console.error("Sign in error:", loginError.message);
      return { error: "Неправильний нікнейм або пароль." };
    }

    return { success: true };
  } catch (error) {
    console.error("Login server error:", error);
    return { error: "Помилка сервера під час входу." };
  }
}
