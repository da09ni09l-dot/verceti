"use server";

import { createClient } from "@/lib/supabase/server";

export async function loginWithNickname(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nickname || !password) {
    return { error: "Введи нікнейм і пароль." };
  }

  if (!/^[a-zA-Z0-9_]{3,50}$/.test(nickname)) {
    return { error: "Неправильний нікнейм або пароль." };
  }

  // VERCETI invited accounts use a deterministic internal email address.
  // Signing in through the public Supabase client avoids requiring the
  // privileged service-role key just to authenticate an existing member.
  const supabase = await createClient();
  const { data, error: loginError } = await supabase.auth.signInWithPassword({
    email: `${nickname.toLowerCase()}@login.verceti.invalid`,
    password,
  });

  if (loginError || !data.user) {
    if (loginError) console.error("Sign in error:", loginError.message);
    return { error: "Неправильний нікнейм або пароль." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_banned")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile || profile.is_banned) {
    await supabase.auth.signOut();
    if (profileError) console.error("Profile lookup error:", profileError.message);
    return {
      error: profile?.is_banned
        ? "Твій акаунт заблоковано. Звернися до адміністрації."
        : "Не вдалося знайти профіль. Звернися до адміністрації.",
    };
  }

  return { success: true };
}

// Public self-registration is disabled: VERCETI accounts are created by an administrator.
export async function registerWithNickname(_formData: FormData) {
  return {
    error: "Реєстрація доступна лише за запрошенням адміністрації VERCETI."
  };
}
