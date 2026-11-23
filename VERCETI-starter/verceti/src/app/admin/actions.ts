
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

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: isStaff, error: staffError } =
    await supabase.rpc("is_verceti_staff");

  if (staffError || isStaff !== true) {
    redirect("/preview/news?status=forbidden");
  }

  return { supabase, user };
}

// Надсилання особистого сповіщення
async function notifyMember(
  userId: string,
  title: string,
  message: string,
  type: string,
  link = "/"
) {
  const admin = createAdminClient();

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    link,
    is_read: false,
  });

  if (error) {
    console.error("Notification error:", error.message);
  }
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

  await notifyMember(
    data.user.id,
    "Ласкаво просимо до VERCETI!",
    "Для тебе створено обліковий запис. Тепер ти можеш увійти до спільноти.",
    "member",
    "/"
  );

  redirect("/admin?created=1");
}


export async function resetMemberPassword(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const password = String(formData.get("new_password") ?? "");
  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) redirect("/admin?error=member");
  if (password.length < 8 || password.length > 128) redirect("/admin?error=password");
  const { user } = await requireAdmin();
  if (memberId === user.id) redirect("/admin?error=self_password");
  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin.from("profiles").select("id, role").eq("id", memberId).single();
  if (memberError || !member) redirect("/admin?error=member");
  if (member.role === "admin") redirect("/admin?error=protected");
  const { error } = await admin.auth.admin.updateUserById(memberId, { password });
  if (error) {
    console.error("Reset member password error:", error.message);
    redirect("/admin?error=password_reset");
  }
  await notifyMember(memberId, "Пароль оновлено", "Адміністрація оновила пароль твого акаунта. Звернися до адміністратора, щоб отримати новий пароль.", "security", "/");
  redirect("/admin?password_reset=1");
}

export async function banMember(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();

  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
    redirect("/admin?error=member");
  }

  const { user } = await requireAdmin();

  if (memberId === user.id) {
    redirect("/admin?error=self_ban");
  }

  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("profiles")
    .select("id, role, is_banned")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    console.error("Find member for ban error:", memberError?.message);
    redirect("/admin?error=member");
  }

  if (member.role === "admin") {
    redirect("/admin?error=protected");
  }

  if (member.is_banned) {
    redirect("/admin?updated=1");
  }

  const { data: updatedMember, error } = await admin
    .from("profiles")
    .update({ is_banned: true })
    .eq("id", memberId)
    .select("id")
    .single();

  if (error || !updatedMember) {
    console.error("Ban member error:", error?.message);
    redirect("/admin?error=ban");
  }

  await notifyMember(
    memberId,
    "Обліковий запис заблоковано",
    "Адміністрація VERCETI заблокувала твій обліковий запис.",
    "warning",
    "/"
  );

  redirect("/admin?updated=1");
}


export async function changeMemberRole(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) redirect("/admin?error=member");
  if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) redirect("/admin?error=role");
  const { supabase, user } = await requireAdmin();
  if (memberId === user.id) redirect("/admin?error=self_role");
  const { data: member, error: memberError } = await supabase.from("profiles").select("id, role").eq("id", memberId).single();
  if (memberError || !member) redirect("/admin?error=member");
  if (member.role === "admin") redirect("/admin?error=protected");
  const { error } = await supabase.rpc("change_member_role", {
    p_member_id: memberId, p_new_role: role, p_reason: "Зміна ролі адміністратором"
  });
  if (error) {
    console.error("Change member role error:", error.message);
    redirect("/admin?error=role_assignment");
  }
  await notifyMember(memberId, "Змінено роль у VERCETI", "Адміністрація змінила твою роль у спільноті.", "system", "/preview/stats");
  redirect("/admin?updated=1");
}

export async function unbanMember(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();

  if (!memberId || !/^[0-9a-f-]{36}$/i.test(memberId)) {
    redirect("/admin?error=member");
  }

  const { user } = await requireAdmin();

  if (memberId === user.id) {
    redirect("/admin?error=protected");
  }

  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("profiles")
    .select("id, role, is_banned")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    console.error("Find member for unban error:", memberError?.message);
    redirect("/admin?error=member");
  }

  if (member.role === "admin") {
    redirect("/admin?error=protected");
  }

  if (!member.is_banned) {
    redirect("/admin?updated=1");
  }

  const { data: updatedMember, error } = await admin
    .from("profiles")
    .update({ is_banned: false })
    .eq("id", memberId)
    .select("id")
    .single();

  if (error || !updatedMember) {
    console.error("Unban member error:", error?.message);
    redirect("/admin?error=unban");
  }

  await notifyMember(
    memberId,
    "Обліковий запис розблоковано",
    "Адміністрація VERCETI відновила доступ до твого облікового запису.",
    "system",
    "/"
  );

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

  const { data: member, error: memberError } = await admin
    .from("profiles")
    .select("id, nickname, role")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    console.error("Find member error:", memberError?.message);
    redirect("/admin?error=member");
  }

  if (member.role === "admin") {
    redirect("/admin?error=protected");
  }

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

    admin
      .from("rewards_prizes")
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

  const { error: resultsError } = await admin
    .from("test_results")
    .delete()
    .eq("user_id", memberId);

  if (resultsError) {
    console.error("Delete test results error:", resultsError.message);
    redirect("/admin?error=delete_cleanup");
  }

  const { error: deleteError } =
    await admin.auth.admin.deleteUser(memberId);

  if (deleteError) {
    console.error("Delete auth user error:", deleteError.message);
    redirect("/admin?error=delete_auth");
  }

  redirect("/admin?deleted=1");
}

// ==========================================
// NEWS MANAGEMENT
// ==========================================

export async function createNews(formData: FormData) {
  const { supabase, user } = await requireStaff();

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(
    formData.get("category") ?? "announcement"
  );
  const isPinned = formData.get("is_pinned") === "on";

  const fromValue = String(
    formData.get("show_from") ?? ""
  ).trim();

  const untilValue = String(
    formData.get("show_until") ?? ""
  ).trim();

  const eventDateValue = String(
    formData.get("event_date") ?? ""
  ).trim();

  if (!title || !content) {
    redirect("/admin?error=news_fields");
  }

  const categories = [
    "announcement",
    "event",
    "update",
    "important",
  ];

  if (!categories.includes(category)) {
    redirect("/admin?error=news_category");
  }

  const showFrom = fromValue ? new Date(fromValue) : null;
  const showUntil = untilValue ? new Date(untilValue) : null;
  const eventDate = eventDateValue
    ? new Date(eventDateValue.length === 10 ? `${eventDateValue}T12:00:00` : eventDateValue)
    : null;

  if (
    (showFrom && Number.isNaN(showFrom.getTime())) ||
    (showUntil && Number.isNaN(showUntil.getTime())) ||
    (eventDate && Number.isNaN(eventDate.getTime()))
  ) {
    redirect("/admin?error=news_date");
  }

  if (
    showFrom &&
    showUntil &&
    showUntil.getTime() <= showFrom.getTime()
  ) {
    redirect("/admin?error=news_period");
  }

  const { data: news, error } = await supabase
    .from("news")
    .insert({
      title,
      content,
      category,
      event_date: category === "event" ? eventDate?.toISOString() ?? null : null,
      is_pinned: isPinned,
      show_from: showFrom?.toISOString() ?? null,
      show_until: showUntil?.toISOString() ?? null,
      created_by: user.id,
    })
    .select("id, title")
    .single();

  if (error || !news) {
    console.error("Create news error:", error?.message);
    redirect("/admin?error=news_create");
  }

  const returnTo = formData.get("return_to") === "/preview/news" ? "/preview/news" : "/admin";
  const successRedirect = returnTo === "/preview/news" ? "/preview/news?status=created" : "/admin?news_created=1";
  const isVisibleNow =
    (!showFrom || showFrom.getTime() <= Date.now()) &&
    (!showUntil || showUntil.getTime() > Date.now());

  if (!isVisibleNow) redirect(successRedirect);

  const admin = createAdminClient();

  const { data: members, error: membersError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_banned", false)
    .neq("id", user.id);

  if (membersError) {
    console.error("Load members for news notification:", membersError.message);
    redirect("/admin?error=news_notification");
  }

  if (members && members.length > 0) {
    const notifications = members.map((member) => ({
      user_id: member.id,
      title: "Нова новина VERCETI",
      message: news.title,
      type: "news",
      link: "/news",
      is_read: false,
    }));

    const { error: notificationError } = await admin
      .from("notifications")
      .insert(notifications);

    if (notificationError) {
      console.error(
        "Create news notifications error:",
        notificationError.message
      );
      redirect("/admin?error=news_notification");
    }
  }

  redirect(successRedirect);
}

export async function deleteNews(formData: FormData) {
  const newsId = String(formData.get("news_id") ?? "").trim();

  if (!newsId || !/^[0-9a-f-]{36}$/i.test(newsId)) {
    redirect("/admin?error=news");
  }

  const { supabase } = await requireStaff();

  const { error } = await supabase
    .from("news")
    .delete()
    .eq("id", newsId);

  if (error) {
    console.error("Delete news error:", error.message);
    redirect("/admin?error=news_delete");
  }

  const returnTo = formData.get("return_to") === "/preview/news" ? "/preview/news" : "/admin";
  redirect(returnTo === "/preview/news" ? "/preview/news?status=deleted" : "/admin?news_deleted=1");
}

export async function toggleNewsPin(formData: FormData) {
  const newsId = String(formData.get("news_id") ?? "").trim();

  if (!newsId || !/^[0-9a-f-]{36}$/i.test(newsId)) {
    redirect("/admin?error=news");
  }

  const { supabase } = await requireAdmin();

  const { data: news, error: findError } = await supabase
    .from("news")
    .select("is_pinned")
    .eq("id", newsId)
    .single();

  if (findError || !news) {
    console.error("Find news error:", findError?.message);
    redirect("/admin?error=news");
  }

  const { error } = await supabase
    .from("news")
    .update({ is_pinned: !news.is_pinned })
    .eq("id", newsId);

  if (error) {
    console.error("Toggle news pin error:", error.message);
    redirect("/admin?error=news_update");
  }

  redirect("/admin?news_updated=1");
}
