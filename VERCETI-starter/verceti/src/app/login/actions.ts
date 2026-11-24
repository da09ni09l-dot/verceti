"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeNickname(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export async function loginWithNickname(formData: FormData) {
  const nickname = normalizeNickname(formData.get("nickname"));
  const password = String(formData.get("password") ?? "");

  if (!nickname || !password) return { error: "Введи нікнейм і пароль." };
  if (nickname.length > 50) return { error: "Неправильний нікнейм або пароль." };

  try {
    const admin = createAdminClient();
    const { data: profiles, error: profileError } = await admin
      .from("profiles").select("id, nickname, is_banned");
    if (profileError) {
      console.error("Profile lookup error:", profileError.message);
      return { error: "Не вдалося знайти профіль." };
    }

    const profile = profiles?.find(
      (item) => item.nickname.toLowerCase() === nickname.toLowerCase()
    );
    if (!profile || profile.is_banned) {
      return { error: profile?.is_banned
        ? "Твій акаунт заблоковано. Звернися до адміністрації."
        : "Неправильний нікнейм або пароль." };
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData.user?.email) {
      console.error("Get user error:", userError?.message);
      return { error: "Не вдалося знайти обліковий запис." };
    }

    const supabase = await createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: userData.user.email, password,
    });
    if (loginError) return { error: "Неправильний нікнейм або пароль." };
    return { success: true };
  } catch (error) {
    console.error("Login server error:", error);
    return { error: "Помилка сервера під час входу." };
  }
}

export async function registerWithNickname(formData: FormData) {
  const nickname = normalizeNickname(formData.get("nickname"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!/^[\p{L}\p{N}_. -]{3,32}$/u.test(nickname)) {
    return { error: "Нікнейм має містити 3–32 символи: літери, цифри, пробіл, крапку, дефіс або _." };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: "Пароль має містити від 8 до 72 символів." };
  }
  if (password !== confirmPassword) return { error: "Паролі не збігаються." };

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("profiles").select("id").ilike("nickname", nickname).limit(1);
  if (lookupError) {
    console.error("Nickname lookup error:", lookupError.message);
    return { error: "Не вдалося перевірити нікнейм. Спробуй ще раз." };
  }
  if (existing?.length) return { error: "Цей нікнейм уже зайнятий. Обери інший." };

  // Supabase Auth requires an email/phone identifier. This private,
  // non-deliverable address is never shown to users; sign-in remains nickname-based.
  const internalEmail = `${randomUUID()}@accounts.verceti.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail, password, email_confirm: true,
    user_metadata: { nickname },
  });
  if (createError || !created.user) {
    console.error("Account creation error:", createError?.message);
    return { error: "Не вдалося створити акаунт. Спробуй ще раз." };
  }

  // New accounts remain outside the community until their application is approved.
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id, nickname, membership_approved: false,
  });
  if (profileError) {
    console.error("Profile creation error:", profileError.message);
    await admin.auth.admin.deleteUser(created.user.id);
    if (profileError.code === "23505") return { error: "Цей нікнейм уже зайнятий. Обери інший." };
    return { error: "Не вдалося створити профіль. Спробуй ще раз." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: internalEmail, password,
  });
  if (signInError) {
    console.error("New account sign-in error:", signInError.message);
    await admin.from("profiles").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Акаунт створено, але не вдалося увійти. Спробуй авторизуватися." };
  }
  return { success: true };
}
