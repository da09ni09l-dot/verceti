
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

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
      return { error: "Не вдалося виконати вхід. Спробуй пізніше." };
    }

    const profile = profiles?.find(
      (item) =>
        item.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (!profile) {
      return { error: "Неправильний нікнейм або пароль." };
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.id);

    const email = userData.user?.email;

    if (userError || !email) {
      return { error: "Не вдалося виконати вхід. Спробуй пізніше." };
    }

    const supabase = await createClient();

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      return { error: "Неправильний нікнейм або пароль." };
    }
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Сталася помилка під час входу." };
  }

  redirect("/");
}
