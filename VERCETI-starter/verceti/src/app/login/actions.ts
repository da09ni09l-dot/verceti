
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
      .select("id, nickname, is_banned");

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

    if (profile.is_banned) {
      return {
        error: "Твій акаунт заблоковано. Звернися до адміністрації.",
      };
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

export async function registerWithNickname(formData: FormData) {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nickname || !password) {
    return { error: "Заповни нікнейм і пароль." };
  }

  if (nickname.length > 50) {
    return { error: "Нікнейм має містити не більше 50 символів." };
  }

  if (password.length < 6) {
    return { error: "Пароль має містити щонайменше 6 символів." };
  }

  try {
    const admin = createAdminClient();

    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("nickname");

    if (profileError) {
      console.error("Nickname lookup error:", profileError.message);
      return { error: "Не вдалося перевірити нікнейм." };
    }

    const nicknameExists = profiles?.some(
      (item) => item.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (nicknameExists) {
      return { error: "Цей нікнейм уже зайнятий. Обери інший." };
    }

    const email = `user-${crypto.randomUUID()}@verceti.vercel.app`;

    const { data, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nickname,
        },
      });

    if (createError || !data.user) {
      console.error("Registration error:", createError?.message);

      return {
        error: "Не вдалося створити акаунт. Перевір нікнейм і спробуй ще раз.",
      };
    }

    const supabase = await createClient();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      console.error("Auto login error:", loginError.message);

      return {
        error: "Акаунт створено, але автоматичний вхід не вдався. Спробуй увійти.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Registration server error:", error);

    return {
      error: "Помилка сервера під час реєстрації.",
    };
  }
}
