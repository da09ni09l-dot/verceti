import Link from "next/link";

import TestsSection from "./TestsSection";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../../logout/actions";
import { createNews, deleteNews } from "../../admin/actions";
import {
  createRule,
  updateRule,
  deleteRule
} from "./rule-actions";

import SectionNavigation from "./SectionNavigation";
import ChatRoom from "./ChatRoom";
import AvatarUploader from "../../AvatarUploader";
import RewardsWheel from "./RewardsWheel";
import MediaRoom from "./MediaRoom";
import ApplicationsSection from "./ApplicationsSection";
import StatsSection from "./StatsSection";
import ProductsBoard from "./ProductsBoard";
import WorkshopBooking from "./WorkshopBooking";
import { createRewardPrize, deleteRewardPrize, restoreRewardPrize, spinWeeklyRewards } from "./rewards-actions";

const descriptions: Record<string, { title: string; text: string; items: string[] }> = {
  members: {
    title: "Учасники",
    text: "Список учасників, ролі та профілі.",
    items: ["Пошук за нікнеймом та ігровим ID", "Кольорові позначки ролей", "Історія зміни ролей"]
  },
  products: {
    title: "Продукція",
    text: "Спільний список продукції учасників VERCETI зі скриншотами та кількістю.",
    items: ["Публікація скриншотів", "Облік кількості продукції", "Редагування власних записів"]
  },
  workshop: {
    title: "Бронювання цеху",
    text: "Погодинний розклад бронювання цеху з вибором виду продукції.",
    items: ["Алко та петрушка", "Перегляд зайнятих годин", "Оновлення розкладу щодня опівночі"]
  },
  voice: {
    title: "Голосові кімнати",
    text: "Голосові канали та демонстрація екрана.",
    items: ["Кілька голосових каналів", "Голосове спілкування", "Демонстрація екрана"]
  },
  streams: {
    title: "Голосові кімнати",
    text: "Голосові канали та демонстрація екрана.",
    items: ["Кілька голосових каналів", "Голосове спілкування", "Демонстрація екрана"]
  },
  music: {
    title: "Музика",
    text: "Особисті та спільні плейлисти.",
    items: ["Особисті добірки", "Спільна черга треків", "Синхронне прослуховування"]
  },
  media: {
    title: "Фото та відео",
    text: "Чотири альбоми спільноти.",
    items: ["Фото керівництва", "Фото учасників", "Відео керівництва", "Відео учасників"]
  },
  tests: {
    title: "Тестування",
    text: "Тести для подання заявки на підвищення ролі.",
    items: ["Доступ до наступного тесту після дозволу Лідера або Модератора", "Історія результатів", "Ручне рішення щодо підвищення"]
  },
  forms: {
    title: "Анкети",
    text: "Перевірка анкет перед прийняттям та видачею ролі.",
    items: ["Статуси: на перевірці, виправлення, схвалено, відхилено", "Перегляд відповідей", "Видача ролі після схвалення"]
  },
  rewards: {
    title: "Рулетка та бонуси",
    text: "Розважальна система віртуальних балів.",
    items: ["Один безкоштовний оберт на день", "Додаткові оберти за бали", "Щотижневі нагороди активності"]
  },
  activity: {
    title: "Онлайн-активність",
    text: "Облік фактичної активності учасників.",
    items: ["Активний час", "Виявлення простою", "Тижневий рейтинг"]
  },
  stats: {
    title: "Статистика",
    text: "Зведена статистика спільноти та модерації.",
    items: ["Активність учасників", "Історія ролей", "Попередження та рішення"]
  },
  notifications: {
    title: "Сповіщення",
    text: "Центр системних повідомлень.",
    items: []
  },
  settings: {
    title: "Налаштування",
    text: "Персональні параметри та безпека.",
    items: ["Приватність", "Звуки сповіщень", "Захист акаунта"]
  }
};

const categoryLabels: Record<string, string> = {
  announcement: "ОГОЛОШЕННЯ",
  event: "ПОДІЯ",
  important: "ВАЖЛИВО",
  update: "ОНОВЛЕННЯ"
};

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type RoleHistoryItem = {
  id: string;
  memberNickname: string | null;
  changedByNickname: string | null;
  oldRole: string | null;
  newRole: string;
  reason: string | null;
  createdAt: string;
};

type DisciplinaryActionItem = {
  id: string;
  memberNickname: string | null;
  moderatorNickname: string | null;
  reason: string;
  actionType: string;
  createdAt: string;
};

type DisciplinaryMember = {
  id: string;
  nickname: string;
};

export default async function PreviewSection({
  params,
  searchParams
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ status?: string; q?: string; recipient?: string }>;
}) {
  const { section } = await params;
  const { status, q = "", recipient } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Перевірка блокування акаунта
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_banned, nickname, avatar_url, birth_day, birth_month")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.is_banned) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const {
    data: staffStatus,
    error: staffError
  } = await supabase.rpc("is_verceti_staff");

  const isStaff = !staffError && staffStatus === true;

  const { data: membershipStatus, error: membershipError } =
    await supabase.rpc("is_verceti_member");
  const hasCommunityAccess = !membershipError && membershipStatus === true;

  if (!hasCommunityAccess && section !== "forms") {
    redirect("/preview/forms");
  }

  const data = descriptions[section] ?? {
    title: "Розділ",
    text: "Цей розділ буде реалізовано на наступному етапі.",
    items: ["Структура сторінки", "Права доступу", "Робочі функції"]
  };

  let newsItems: {
    id: string;
    title: string;
    content: string;
    category: string;
    event_date: string | null;
    created_at: string;
    show_from: string | null;
    show_until: string | null;
  }[] = [];

  let newsError = false;

  let memberItems: { id: string; nickname: string; game_id: string | null; role: string; created_at: string; is_banned: boolean; avatar_url: string | null }[] = [];
  let membersError = false;
  let activityItems: { user_id: string; nickname: string; role: string; total_seconds: number }[] = [];
  let activityError = false;
  let eventItems: { id: string; title: string; content: string; event_date: string | null; created_at: string; show_from: string | null; show_until: string | null }[] = [];
  let eventsError = false;

  let ruleItems: {
    id: string;
    title: string;
    content: string;
    position: number;
  }[] = [];

  let rulesError = false;

  let notificationItems: Notification[] = [];
  let notificationsError = false;

  let stats = {
    totalMembers: 0,
    newMembers7Days: 0,
    activeChatMembers7Days: 0,
    chatMessages7Days: 0
  };

  let statsError = false;
  let statsErrorDetails = "";
  let activityRanking: { user_id: string; nickname: string; role: string; total_seconds: number }[] = [];
  let activityRankingError = false;

  let roleHistory: RoleHistoryItem[] = [];
  let roleHistoryError = false;

  let disciplinaryActions: DisciplinaryActionItem[] = [];
  let disciplinaryActionsError = false;

  let disciplinaryMembers: DisciplinaryMember[] = [];
  let disciplinaryMembersError = false;

  if (section === "stats") {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      membersResult,
      newMembersResult,
      activeMembersResult,
      messagesResult
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id"),

      supabase
        .from("profiles")
        .select("id")
        .gte("created_at", sevenDaysAgo),

      supabase
        .from("chat_messages")
        .select("user_id")
        .gte("created_at", sevenDaysAgo),

      supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo)
    ]);

    const errors = [
      { name: "Учасники", error: membersResult.error },
      { name: "Нові учасники", error: newMembersResult.error },
      { name: "Активні учасники", error: activeMembersResult.error },
      { name: "Повідомлення", error: messagesResult.error }
    ].filter((item) => item.error);

    if (errors.length > 0) {
      statsError = true;

      statsErrorDetails = errors
        .map(({ name, error }) => {
          return [
            `Запит: ${name}`,
            `Код: ${error?.code ?? "немає"}`,
            `Повідомлення: ${error?.message ?? "немає"}`,
            `Деталі: ${error?.details ?? "немає"}`,
            `Підказка: ${error?.hint ?? "немає"}`
          ].join("\n");
        })
        .join("\n\n");

      console.error("VERCETI stats loading error:", statsErrorDetails);
    } else {
      stats = {
        totalMembers: membersResult.data?.length ?? 0,
        newMembers7Days: newMembersResult.data?.length ?? 0,
        activeChatMembers7Days: new Set(
          (activeMembersResult.data ?? []).map((item) => item.user_id)
        ).size,
        chatMessages7Days: messagesResult.count ?? 0
      };
    }

    const { data: historyData, error: historyError } = await supabase
      .from("role_history")
      .select("id, member_id, changed_by, old_role, new_role, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (historyError) {
      console.error(
        "VERCETI role history loading error:",
        historyError.message
      );
      roleHistoryError = true;
    } else if (historyData && historyData.length > 0) {
      const profileIds = Array.from(
        new Set(
          historyData.flatMap((item) => [
            item.member_id,
            item.changed_by
          ])
        )
      ).filter((id): id is string => Boolean(id));

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", profileIds);

      if (profilesError) {
        console.error(
          "VERCETI role history profiles loading error:",
          profilesError.message
        );
        roleHistoryError = true;
      } else {
        const profilesMap = new Map(
          (profilesData ?? []).map((profile) => [
            profile.id,
            profile.nickname
          ])
        );

        roleHistory = historyData.map((item) => ({
          id: item.id,
          memberNickname: profilesMap.get(item.member_id) ?? null,
          changedByNickname: item.changed_by
            ? profilesMap.get(item.changed_by) ?? null
            : null,
          oldRole: item.old_role,
          newRole: item.new_role,
          reason: item.reason,
          createdAt: item.created_at
        }));
      }
    }

    const disciplinaryResult = isStaff
      ? await supabase
          .from("disciplinary_actions")
          .select("id, member_id, issued_by, reason, action_type, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      : await supabase
          .from("disciplinary_actions")
          .select("id, member_id, issued_by, reason, action_type, created_at")
          .eq("member_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);

    const {
      data: disciplinaryData,
      error: disciplinaryError
    } = disciplinaryResult;

    if (disciplinaryError) {
      console.error(
        "VERCETI disciplinary actions loading error:",
        disciplinaryError.message
      );
      disciplinaryActionsError = true;
    } else if (disciplinaryData && disciplinaryData.length > 0) {
      const profileIds = Array.from(
        new Set(
          disciplinaryData.flatMap((item) => [
            item.member_id,
            item.issued_by
          ])
        )
      ).filter((id): id is string => Boolean(id));

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", profileIds);

      if (profilesError) {
        console.error(
          "VERCETI disciplinary profiles loading error:",
          profilesError.message
        );
        disciplinaryActionsError = true;
      } else {
        const profilesMap = new Map(
          (profilesData ?? []).map((profile) => [
            profile.id,
            profile.nickname
          ])
        );

        disciplinaryActions = disciplinaryData.map((item) => ({
          id: item.id,
          memberNickname: profilesMap.get(item.member_id) ?? null,
          moderatorNickname: item.issued_by
            ? profilesMap.get(item.issued_by) ?? null
            : null,
          reason: item.reason,
          actionType: item.action_type,
          createdAt: item.created_at
        }));
      }
    }

    if (isStaff) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .order("nickname", { ascending: true })
        .limit(1000);

      if (profilesError) {
        console.error(
          "VERCETI disciplinary members loading error:",
          profilesError.message
        );
        disciplinaryMembersError = true;
      } else {
        disciplinaryMembers = (profilesData ?? [])
          .filter((profile) => profile.nickname)
          .map((profile) => ({
            id: profile.id,
            nickname: profile.nickname
          }));
      }
    }
  }

  if (section === "stats") {
    const { data: activityData, error: activityError } = await supabase
      .from("member_activity")
      .select("user_id, total_seconds")
      .order("total_seconds", { ascending: false })
      .limit(isStaff ? 100 : 1);

    if (activityError) {
      console.error("VERCETI ranking loading error:", activityError.message);
      activityRankingError = true;
    } else if (activityData && activityData.length > 0) {
      const userIds = activityData.map((item) => item.user_id);
      const { data: rankingProfiles, error: rankingProfilesError } = await supabase
        .from("profiles")
        .select("id, nickname, role, is_banned")
        .in("id", userIds);

      if (rankingProfilesError) {
        console.error("VERCETI ranking profiles error:", rankingProfilesError.message);
        activityRankingError = true;
      } else {
        const profileMap = new Map(
          (rankingProfiles ?? [])
            .filter((item) => !item.is_banned)
            .map((item) => [item.id, item])
        );

        activityRanking = activityData
          .filter((item) => profileMap.has(item.user_id))
          .map((item) => {
            const member = profileMap.get(item.user_id)!;
            return {
              user_id: item.user_id,
              nickname: member.nickname,
              role: member.role,
              total_seconds: Number(item.total_seconds)
            };
          });
      }
    }
  }

  if (section === "members") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, game_id, role, created_at, is_banned, avatar_url")
      .eq("is_banned", false)
      .order("nickname", { ascending: true })
      .limit(500);

    if (error) {
      console.error("VERCETI members loading error:", error.message);
      membersError = true;
    } else {
      const normalizedQuery = q.trim().toLocaleLowerCase("uk-UA");
      memberItems = (data ?? []).filter((member) =>
        !normalizedQuery ||
        member.nickname.toLocaleLowerCase("uk-UA").includes(normalizedQuery) ||
        member.role.toLocaleLowerCase("uk-UA").includes(normalizedQuery) ||
        (member.game_id ?? "").toLocaleLowerCase("uk-UA").includes(normalizedQuery)
      );
    }
  }

  if (section === "activity") {
    const { data, error } = await supabase
      .from("member_activity")
      .select("user_id, total_seconds")
      .order("total_seconds", { ascending: false })
      .limit(isStaff ? 100 : 1);

    if (error) {
      console.error("VERCETI activity loading error:", error.message);
      activityError = true;
    } else if (data && data.length > 0) {
      const userIds = data.map((item) => item.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname, role, is_banned")
        .in("id", userIds);

      if (profilesError) {
        console.error("VERCETI activity profiles loading error:", profilesError.message);
        activityError = true;
      } else {
        const profilesById = new Map(
          (profilesData ?? [])
            .filter((item) => !item.is_banned)
            .map((item) => [item.id, item])
        );
        activityItems = data
          .filter((item) => profilesById.has(item.user_id))
          .map((item) => {
            const member = profilesById.get(item.user_id)!;
            return {
              user_id: item.user_id,
              nickname: member.nickname,
              role: member.role,
              total_seconds: Number(item.total_seconds)
            };
          });
      }
    }
  }

  if (section === "events") {
    const { data, error } = await supabase
      .from("news")
      .select("id, title, content, event_date, created_at, show_from, show_until")
      .eq("category", "event")
      .order("event_date", { ascending: true, nullsFirst: false })
      .limit(100);

    if (error) {
      console.error("VERCETI events loading error:", error.message);
      eventsError = true;
    } else {
      const now = Date.now();
      eventItems = (data ?? []).filter((item) =>
        (!item.show_from || new Date(item.show_from).getTime() <= now) &&
        (!item.show_until || new Date(item.show_until).getTime() > now)
      ).sort((a, b) => {
        const aTime = a.event_date ? new Date(a.event_date).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.event_date ? new Date(b.event_date).getTime() : Number.POSITIVE_INFINITY;
        const aUpcoming = aTime >= now;
        const bUpcoming = bTime >= now;
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
        if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
        return aUpcoming ? aTime - bTime : bTime - aTime;
      });
    }
  }

  if (section === "notifications") {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("VERCETI notifications loading error:", error.message);
      notificationsError = true;
    } else {
      notificationItems = data ?? [];
    }
  }

  if (section === "news") {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "news")
      .eq("is_read", false);

    const { data, error } = await supabase
      .from("news")
      .select("id, title, content, category, event_date, created_at, show_from, show_until")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("VERCETI news loading error:", error.message);
      newsError = true;
    } else {
      const now = Date.now();
      newsItems = (data ?? []).filter((item) =>
        (!item.show_from || new Date(item.show_from).getTime() <= now) &&
        (!item.show_until || new Date(item.show_until).getTime() > now)
      );
    }
  }

  let rewardPrizes: { id: string; title: string; description: string; weight: number; created_by: string; is_active: boolean }[] = [];
  let rewardError = false;
  let canManageRewards = false;
  let rewardsRole: string | null = null;
  let lastRewardSpin: { spun_at: string; prize: { title: string; description: string } | null } | null = null;
  let lastWeeklySpin: { spun_at: string; prize: { title: string; description: string } | null } | null = null;
  let weeklySpinUsed = false;
  let dailySpinUsed = false;
  let birthdaySpinUsed = false;
  let birthdayEligible = false;
  if (section === "rewards") {
    const { data: role } = await supabase.rpc("current_verceti_role");
    rewardsRole = typeof role === "string" ? role : null;
    canManageRewards = rewardsRole === "admin" || rewardsRole === "leader";

    const now = new Date();
    const kyivParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const part = (type: string) => Number(kyivParts.find((item) => item.type === type)?.value ?? 0);
    const kyivYear = part("year");
    const kyivMonth = part("month");
    const kyivDay = part("day");
    const kyivHour = part("hour");
    const kyivMinute = part("minute");
    const kyivSecond = part("second");
    const kyivOffsetMs = Math.round((Date.UTC(kyivYear, kyivMonth - 1, kyivDay, kyivHour, kyivMinute, kyivSecond) - now.getTime()) / 60000) * 60000;
    const kyivDayStart = new Date(Date.UTC(kyivYear, kyivMonth - 1, kyivDay) - kyivOffsetMs);
    const daysSinceMonday = (new Date(Date.UTC(kyivYear, kyivMonth - 1, kyivDay)).getUTCDay() + 6) % 7;
    const kyivWeekStart = new Date(Date.UTC(kyivYear, kyivMonth - 1, kyivDay - daysSinceMonday) - kyivOffsetMs);
    const kyivYearStart = new Date(Date.UTC(kyivYear, 0, 1) - 2 * 60 * 60 * 1000);
    birthdayEligible = Number(profile.birth_day) === kyivDay && Number(profile.birth_month) === kyivMonth;

    const [
      { data, error },
      { data: spinData, error: spinError },
      { data: weeklyData, error: weeklyError },
      { data: birthdayData, error: birthdayError }
    ] = await Promise.all([
      supabase.from("rewards_prizes").select("id, title, description, weight, created_by, is_active").order("created_at", { ascending: true }),
      supabase.from("rewards_spins").select("spun_at, prize:rewards_prizes(title, description)").eq("user_id", user.id).eq("spin_type", "daily").gte("spun_at", kyivDayStart.toISOString()).order("spun_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rewards_spins").select("spun_at, prize:rewards_prizes(title, description)").eq("user_id", user.id).eq("spin_type", "weekly").gte("spun_at", kyivWeekStart.toISOString()).order("spun_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rewards_spins").select("spun_at").eq("user_id", user.id).eq("spin_type", "birthday").gte("spun_at", kyivYearStart.toISOString()).limit(1).maybeSingle()
    ]);

    rewardError = !!error;
    if (spinError || weeklyError || birthdayError) {
      console.error("VERCETI rewards spin history loading error:", spinError?.message ?? weeklyError?.message ?? birthdayError?.message);
    }
    rewardPrizes = data ?? [];
    lastRewardSpin = spinData as typeof lastRewardSpin;
    lastWeeklySpin = weeklyData as typeof lastWeeklySpin;
    weeklySpinUsed = !!weeklyData;
    dailySpinUsed = !!spinData;
    birthdaySpinUsed = !!birthdayData;
  }

  if (section === "rules") {
    const { data, error } = await supabase
      .from("community_rules")
      .select("id, title, content, position")
      .order("position", { ascending: true });

    if (error) {
      console.error("VERCETI rules loading error:", error.message);
      rulesError = true;
    } else {
      ruleItems = data ?? [];
    }
  }

  const ruleTitles = Array.from(
    new Set(ruleItems.map((item) => item.title))
  );

  const unreadNotifications = notificationItems.filter(
    (item) => !item.is_read
  ).length;

  async function markNotificationRead(formData: FormData) {
    "use server";

    const notificationId = String(formData.get("id") ?? "");

    if (!notificationId) return;

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser }
    } = await serverSupabase.auth.getUser();

    if (!currentUser) return;

    await serverSupabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", currentUser.id);

    redirect("/preview/notifications");
  }

  async function markAllNotificationsRead() {
    "use server";

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser }
    } = await serverSupabase.auth.getUser();

    if (!currentUser) return;

    await serverSupabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);

    redirect("/preview/notifications");
  }

  return (
    <main className={`login-wrap workspace-wrap ${section === "tests" ? "tests-page-wrap" : ""}`}>
      <section className={`login-card workspace-card ${section === "chat" ? "chat-page-card" : ""} ${section === "tests" ? "tests-page-card" : ""}`}>
        <SectionNavigation />

        {section === "forms" && (
          <form
            action={logout}
            style={{ marginTop: 16, marginBottom: 16 }}
          >
            <button
              className="btn secondary"
              type="submit"
              style={{ width: "100%" }}
            >
              Вийти з акаунта
            </button>
          </form>
        )}

        <div className="eyebrow">VERCETI · ПОПЕРЕДНІЙ ПЕРЕГЛЯД</div>

        {section === "workshop" ? (
          <>
            <h1>Бронювання цеху</h1>
            <p className="muted">Обери вільну годину та познач продукцію.</p>
            <WorkshopBooking userId={user.id} />
          </>
        ) : section === "products" ? (
          <>
            <h1>📦 Продукція VERCETI</h1>
            <p className="muted">Спільний список продукції учасників. Додавай скриншоти та кількість — записи з’являються в реальному часі.</p>
            <ProductsBoard userId={user.id} />
          </>
        ) : section === "chat" ? (
          <>
            <h1>Чат</h1>
            <p className="muted">
              Спілкування учасників спільноти VERCETI.
            </p>
            <ChatRoom initialRecipientId={recipient ?? null} />
          </>
        ) : section === "voice" || section === "streams" ? (
          <>
            <h1>Голосові кімнати VERCETI</h1>
            <p className="muted">
              Голосове спілкування та демонстрація екрана в одному місці.
            </p>
            <p className="page-note">Підключена голосова кімната залишатиметься активною, навіть коли ти переходиш до інших розділів сайту.</p>
          </>
        ) : section === "music" ? (
          <>
            <h1>Музика VERCETI</h1>
            <p className="muted">
              Музичний простір спільноти та список відтворення.
            </p>
            {/* MusicRoom is mounted globally in the root layout to preserve playback. */}
          </>
        ) : section === "media" ? (
          <>
            <h1>Фото та відео VERCETI</h1>
            <p className="muted">
              Фотоальбоми та відео спільноти.
            </p>
            <MediaRoom />
          </>
        ) : section === "forms" ? (
          <ApplicationsSection status={status} />
        ) : section === "members" ? (
          <>
            <h1>Учасники VERCETI</h1>
            <p className="muted">Список активних профілів спільноти та їхні ролі.</p>
            <form method="get" className="member-search-form" style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <input name="q" type="search" defaultValue={q} placeholder="Пошук за нікнеймом, роллю або ігровим ID" aria-label="Пошук учасників" style={{ flex: "1 1 240px" }} />
              <button className="btn" type="submit">Знайти</button>
              {q && <Link className="btn secondary" href="/preview/members">Скинути</Link>}
            </form>
            {membersError ? (
              <div className="panel" style={{ marginTop: 16 }}>Не вдалося завантажити список учасників. Перевір доступ до профілів у Supabase.</div>
            ) : (
              <div className="member-list" style={{ marginTop: 18 }}>
                <div className="panel" style={{ marginBottom: 12 }}>
                  <strong>Усього у списку: {memberItems.length}</strong>
                </div>
                {memberItems.length === 0 ? (
                  <div className="panel"><p className="muted">За цим запитом учасників не знайдено.</p></div>
                ) : memberItems.map((member) => (
                  <Link
                    href={`/preview/members/${member.id}`}
                    className="member-row"
                    key={member.id}
                    aria-label={`Відкрити профіль ${member.nickname}`}
                    style={{ gap: 12, display: "flex", alignItems: "center", color: "inherit", textDecoration: "none", cursor: "pointer" }}
                  >
                    {member.avatar_url ? <img src={member.avatar_url} alt="" className="avatar" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} /> : <div className="avatar">{member.nickname.slice(0, 1).toUpperCase()}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ overflowWrap: "anywhere" }}>{member.nickname}</strong>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {member.game_id ? `Ігровий ID: ${member.game_id} · ` : ""}У спільноті з {new Date(member.created_at).toLocaleDateString("uk-UA")}
                      </div>
                    </div>
                    <span className={`role ${member.role === "admin" || member.role === "leader" ? "orange" : member.role === "moderator" ? "purple" : member.role === "senior" ? "blue" : member.role === "local" ? "green" : "muted"}`}>{({ admin: "АДМІН", leader: "ЗАСНОВНИК", moderator: "МОДЕРАТОР", senior: "СТАРШИЙ", local: "УЧАСНИК", junior: "МОЛОДШИЙ" } as Record<string, string>)[member.role] ?? member.role}</span>
                    <span aria-hidden="true" style={{ color: "#bb8aff", fontSize: 18 }}>↗</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : section === "stats" ? (
          <StatsSection
            totalMembers={stats.totalMembers}
            newMembers7Days={stats.newMembers7Days}
            activeChatMembers7Days={stats.activeChatMembers7Days}
            chatMessages7Days={stats.chatMessages7Days}
            loadError={statsError}
            errorDetails={statsErrorDetails}
            roleHistory={roleHistory}
            roleHistoryError={roleHistoryError}
            disciplinaryActions={disciplinaryActions}
            disciplinaryActionsError={disciplinaryActionsError}
            disciplinaryMembers={disciplinaryMembers}
            disciplinaryMembersError={disciplinaryMembersError}
            activityRanking={activityRanking}
            activityRankingError={activityRankingError}
            isStaff={isStaff}
            status={status}
          />
        ) : section === "events" ? (
          <>
            <h1>Події VERCETI</h1>
            <p className="muted">Календар оголошених подій спільноти. Події публікуються адміністрацією у новинах з категорією «Подія».</p>
            {eventsError ? (
              <div className="panel" style={{ marginTop: 20 }}>Не вдалося завантажити події. Перевір підключення до таблиці новин.</div>
            ) : eventItems.length === 0 ? (
              <div className="panel" style={{ marginTop: 20 }}>
                <h2>Запланованих подій поки немає</h2>
                <p className="muted">Коли адміністрація опублікує новину з категорією «Подія», вона з’явиться тут.</p>
              </div>
            ) : (
              <div className="member-list" style={{ marginTop: 20 }}>
                {eventItems.map((event) => (
                  <article className="panel" key={event.id} style={{ marginBottom: 14 }}>
                    <div className="eyebrow">{event.event_date ? new Date(event.event_date).toLocaleString("uk-UA", { dateStyle: "long", timeStyle: "short" }) : "ДАТУ НЕ ВКАЗАНО"}</div>
                    <h2 style={{ marginTop: 8 }}>{event.title}</h2>
                    <p className="muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{event.content}</p>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : section === "notifications" ? (
          <>
            <h1>Сповіщення</h1>
            <p className="muted">
              Усі системні та особисті повідомлення твого акаунта.
            </p>

            <div className="panel" style={{ marginTop: 20 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10
              }}>
                <strong>Центр сповіщень</strong>
                <span className="tag">
                  Непрочитаних: {unreadNotifications}
                </span>
              </div>

              {unreadNotifications > 0 && (
                <form action={markAllNotificationsRead} style={{ marginTop: 14 }}>
                  <button className="btn" type="submit">
                    Позначити всі як прочитані
                  </button>
                </form>
              )}
            </div>

            {notificationsError ? (
              <div className="panel" style={{ marginTop: 16 }}>
                <p className="muted">
                  Не вдалося завантажити сповіщення. Перевір підключення до бази даних.
                </p>
              </div>
            ) : notificationItems.length === 0 ? (
              <div className="panel" style={{ marginTop: 16 }}>
                <h2>Поки що сповіщень немає</h2>
                <p className="muted">
                  Коли з&apos;являться нові повідомлення або системні оновлення,
                  вони відображатимуться тут.
                </p>
              </div>
            ) : (
              <div className="member-list" style={{ marginTop: 20 }}>
                {notificationItems.map((item) => (
                  <div
                    className="panel"
                    key={item.id}
                    style={{
                      marginBottom: 12,
                      border: item.is_read
                        ? "1px solid rgba(187,138,255,.12)"
                        : "1px solid rgba(187,138,255,.5)",
                      background: item.is_read
                        ? "rgba(255,255,255,.025)"
                        : "rgba(155,92,255,.12)"
                    }}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10
                    }}>
                      <strong>
                        {item.type === "message" ? "💬 " :
                         item.type === "news" ? "📰 " :
                         item.type === "application" ? "📋 " : "🔔 "}
                        {item.title}
                      </strong>

                      {!item.is_read && (
                        <span className="tag">НОВЕ</span>
                      )}
                    </div>

                    <p className="muted" style={{ marginTop: 10 }}>
                      {item.message}
                    </p>

                    <div className="notice-time">
                      {new Date(item.created_at).toLocaleString("uk-UA")}
                    </div>

                    {!item.is_read && (
                      <form
                        action={markNotificationRead}
                        style={{ marginTop: 12 }}
                      >
                        <input
                          type="hidden"
                          name="news_id"
                          value={item.id}
                        />
                        <input type="hidden" name="return_to" value="/preview/news" />
                        <button className="btn" type="submit">
                          Позначити як прочитане
                        </button>
                      </form>
                    )}

                    {item.link && (
                      <a
                        href={item.link}
                        className="btn"
                        style={{
                          display: "inline-block",
                          marginTop: 12,
                          textDecoration: "none"
                        }}
                      >
                        Відкрити
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : section === "news" ? (
          <>
            <h1>Новини</h1>
            <p className="muted">Новини спільноти, оголошення та події.</p>

            {isStaff && (
              <div className="panel" style={{ marginTop: 24 }}>
                <h2>Створити новину</h2>

                <form action={createNews} className="member-list">
                  <input type="hidden" name="return_to" value="/preview/news" />
                  <label htmlFor="news-title">Заголовок</label>
                  <input
                    id="news-title"
                    name="title"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="Введіть заголовок"
                  />

                  <label htmlFor="news-content">Текст новини</label>
                  <textarea
                    id="news-content"
                    name="content"
                    required
                    maxLength={10000}
                    rows={5}
                    placeholder="Введіть текст новини"
                  />

                  <label htmlFor="news-category">Категорія</label>
                  <select
                    id="news-category"
                    name="category"
                    required
                    defaultValue="announcement"
                  >
                    <option value="announcement">Оголошення</option>
                    <option value="event">Подія</option>
                    <option value="update">Оновлення</option>
                    <option value="important">Важливо</option>
                  </select>

                  <label htmlFor="news-date">
                    Дата події (необов&apos;язково)
                  </label>
                  <input
                    id="news-date"
                    name="event_date"
                    type="date"
                  />

                  <button className="btn" type="submit">
                    Опублікувати новину
                  </button>
                </form>
              </div>
            )}

            {status === "created" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Новину успішно опубліковано.
              </div>
            )}
            {status === "deleted" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Новину успішно видалено.
              </div>
            )}
            {status === "delete-error" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Не вдалося видалити новину.
              </div>
            )}
            {status === "empty" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Заповни заголовок і текст новини.
              </div>
            )}
            {status === "invalid" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Перевір правильність заповнення даних.
              </div>
            )}
            {status === "forbidden" && (
              <div className="panel" style={{ marginTop: 16 }}>
                У тебе немає прав для цієї дії.
              </div>
            )}
            {status === "error" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Не вдалося опублікувати новину. Перевір журнал помилок.
              </div>
            )}

            {newsError ? (
              <div className="panel" style={{ marginTop: 24 }}>
                <p className="muted">
                  Не вдалося завантажити новини. Перевір підключення до бази даних.
                </p>
              </div>
            ) : newsItems.length === 0 ? (
              <div className="panel" style={{ marginTop: 24 }}>
                <h2>Поки що новин немає</h2>
                <p className="muted">
                  Нові оголошення спільноти з&apos;являтимуться тут.
                </p>
              </div>
            ) : (
              <div className="member-list" style={{ margin: "24px 0" }}>
                {newsItems.map((item) => (
                  <div
                    className="panel"
                    key={item.id}
                    style={{ marginBottom: 14 }}
                  >
                    <div className="eyebrow">
                      {categoryLabels[item.category] ?? item.category.toUpperCase()}
                    </div>
                    <h2>{item.title}</h2>
                    <p className="muted">{item.content}</p>
                    <div className="notice-time">
                      Дата: {new Date(item.event_date ?? item.created_at).toLocaleDateString("uk-UA")}
                    </div>

                    {isStaff && (
                      <form
                        action={deleteNews}
                        style={{ marginTop: 14 }}
                      >
                        <input
                          type="hidden"
                          name="news_id"
                          value={item.id}
                        />
                        <input type="hidden" name="return_to" value="/preview/news" />
                        <button
                          className="btn"
                          type="submit"
                          style={{
                            background: "#8f303f",
                            borderColor: "#b94b5c"
                          }}
                        >
                          Видалити новину
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="page-note">
              Новини завантажуються з бази даних VERCETI.
            </p>
          </>
        ) : section === "settings" ? (
          <>
            <h1>Налаштування профілю</h1>
            <p className="muted">Керуй власним нікнеймом і паролем облікового запису.</p>
            <div className="panel" style={{ marginTop: 20 }}>
              <h2>Особисті дані</h2>
              <AvatarUploader userId={user.id} initialUrl={profile.avatar_url ?? null} />
              <form action={async (formData: FormData) => {
                "use server";
                const nickname = String(formData.get("nickname") ?? "").trim();
                if (!/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) redirect("/preview/settings?status=nickname_error");
                const client = await createClient();
                const { data: { user: currentUser } } = await client.auth.getUser();
                if (!currentUser) redirect("/login");
                const { error } = await client.from("profiles").update({ nickname }).eq("id", currentUser.id);
                if (error) {
                  console.error("VERCETI nickname update error:", error.message);
                  redirect("/preview/settings?status=save_error");
                }
                redirect("/preview/settings?status=saved");
              }} className="member-list" style={{ marginTop: 14, gap: 10 }}>
                <label htmlFor="settings-nickname">Нікнейм</label>
                <input id="settings-nickname" name="nickname" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" defaultValue={profile?.nickname ?? ""} />
                <p className="page-note">3–20 символів: латинські літери, цифри та _</p>
                <button className="btn" type="submit">Зберегти нікнейм</button>
              </form>
              {status === "saved" && <p className="page-note">Нікнейм успішно оновлено.</p>}
              {status === "nickname_error" && <p className="page-note">Перевір формат нікнейму: 3–20 дозволених символів.</p>}
              {status === "save_error" && <p className="page-note">Не вдалося зберегти нікнейм. Можливо, він уже зайнятий.</p>}
            </div>
            <div className="panel" style={{ marginTop: 18 }}>
              <h2>Безпека акаунта</h2>
              <form action={async (formData: FormData) => {
                "use server";
                const password = String(formData.get("password") ?? "");
                const confirmation = String(formData.get("password_confirmation") ?? "");
                if (password.length < 8 || password !== confirmation) redirect("/preview/settings?status=password_error");
                const client = await createClient();
                const { data: { user: currentUser } } = await client.auth.getUser();
                if (!currentUser) redirect("/login");
                const { error } = await client.auth.updateUser({ password });
                if (error) {
                  console.error("VERCETI password update error:", error.message);
                  redirect("/preview/settings?status=password_save_error");
                }
                redirect("/preview/settings?status=password_saved");
              }} className="member-list" style={{ marginTop: 14, gap: 10 }}>
                <label htmlFor="settings-password">Новий пароль</label>
                <input id="settings-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                <label htmlFor="settings-password-confirmation">Повторити новий пароль</label>
                <input id="settings-password-confirmation" name="password_confirmation" type="password" required minLength={8} autoComplete="new-password" />
                <button className="btn" type="submit">Оновити пароль</button>
              </form>
              {status === "password_saved" && <p className="page-note">Пароль успішно оновлено.</p>}
              {status === "password_error" && <p className="page-note">Паролі мають збігатися та містити щонайменше 8 символів.</p>}
              {status === "password_save_error" && <p className="page-note">Не вдалося оновити пароль. Спробуй ще раз.</p>}
            </div>
          </>
        ) : section === "rules" ? (
          <>
            <h1>Правила VERCETI</h1>
            <p className="muted">
              Правила поведінки та порядок у спільноті.
            </p>

            {status === "created" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Правило успішно додано.
              </div>
            )}
            {status === "updated" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Правило успішно оновлено.
              </div>
            )}
            {status === "deleted" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Правило успішно видалено.
              </div>
            )}
            {status === "invalid" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Перевір правильність заповнення полів.
              </div>
            )}
            {status === "error" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Не вдалося виконати дію з правилом.
              </div>
            )}

            {rulesError ? (
              <div className="panel" style={{ marginTop: 24 }}>
                <p className="muted">
                  Не вдалося завантажити правила. Перевір підключення до бази даних.
                </p>
              </div>
            ) : ruleItems.length === 0 ? (
              <div className="panel" style={{ marginTop: 24 }}>
                <h2>Правил поки що немає</h2>
                <p className="muted">
                  {isStaff
                    ? "Додай перше правило за допомогою форми нижче."
                    : "Правила спільноти поки не опубліковані."}
                </p>
              </div>
            ) : (
              ruleTitles.map((groupTitle) => (
                <div
                  className="panel"
                  key={groupTitle}
                  style={{ marginTop: 16 }}
                >
                  <h2>{groupTitle}</h2>

                  <div className="member-list">
                    {ruleItems
                      .filter((item) => item.title === groupTitle)
                      .map((item) => (
                        <div
                          className="member-row"
                          key={item.id}
                          style={{
                            alignItems: "flex-start",
                            flexWrap: "wrap"
                          }}
                        >
                          {!isStaff ? (
                            <>
                              <span style={{ color: "#bb8aff" }}>✦</span>
                              <span style={{ fontSize: 13, flex: 1 }}>
                                {item.content}
                              </span>
                            </>
                          ) : (
                            <form
                              action={updateRule}
                              className="member-list"
                              style={{ width: "100%", gap: 10 }}
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={item.id}
                              />

                              <label>Назва групи</label>
                              <input
                                name="title"
                                type="text"
                                required
                                maxLength={150}
                                defaultValue={item.title}
                              />

                              <label>Текст правила</label>
                              <textarea
                                name="content"
                                required
                                maxLength={5000}
                                rows={3}
                                defaultValue={item.content}
                              />

                              <label>Порядок відображення</label>
                              <input
                                name="position"
                                type="number"
                                min="0"
                                step="1"
                                required
                                defaultValue={item.position}
                              />

                              <button className="btn" type="submit">
                                Зберегти зміни
                              </button>
                            </form>
                          )}

                          {isStaff && (
                            <form action={deleteRule}>
                              <input
                                type="hidden"
                                name="id"
                                value={item.id}
                              />
                              <button
                                className="btn"
                                type="submit"
                                style={{
                                  background: "#8f303f",
                                  borderColor: "#b94b5c"
                                }}
                              >
                                Видалити
                              </button>
                            </form>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}

            {isStaff && (
              <div className="panel" style={{ marginTop: 24 }}>
                <h2>Додати нове правило</h2>

                <form
                  action={createRule}
                  className="member-list"
                  style={{ gap: 10 }}
                >
                  <label htmlFor="rule-title">Назва групи</label>
                  <input
                    id="rule-title"
                    name="title"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="Наприклад: Правила чату"
                  />

                  <label htmlFor="rule-content">Текст правила</label>
                  <textarea
                    id="rule-content"
                    name="content"
                    required
                    maxLength={5000}
                    rows={4}
                    placeholder="Введіть текст нового правила"
                  />

                  <label htmlFor="rule-position">
                    Порядок відображення
                  </label>
                  <input
                    id="rule-position"
                    name="position"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={ruleItems.length + 1}
                  />

                  <button className="btn" type="submit">
                    Додати правило
                  </button>
                </form>
              </div>
            )}

            <p className="page-note">
              Правила зберігаються в базі даних VERCETI.
            </p>
          </>
        ) : section === "rewards" ? (
          <>
            <h1>🎡 Рулетка та бонуси</h1>
            <p className="muted">Спільна рулетка VERCETI — призи доступні всім учасникам.</p>
            {status === "created" && <div className="panel" style={{ marginTop: 14 }}>Приз додано до загальної рулетки.</div>}
            {status === "archived" && <div className="panel" style={{ marginTop: 14 }}>Приз прибрано з активної рулетки. Історію обертань збережено.</div>}{status === "restored" && <div className="panel" style={{ marginTop: 14 }}>Приз повернуто до активної рулетки.</div>}
            {(status === "won" || status === "weekly_won") && <div className="panel" style={{ marginTop: 14 }}><strong>🎉 Твій результат</strong><p style={{ marginTop: 8 }}>{(status === "weekly_won" ? (lastWeeklySpin as { prize: { title: string; description: string } | null } | null)?.prize?.title : (lastRewardSpin as { prize: { title: string; description: string } | null } | null)?.prize?.title) ?? "Оберт успішно зафіксовано."}</p>{(status === "weekly_won" ? (lastWeeklySpin as { prize: { title: string; description: string } | null } | null)?.prize?.description : (lastRewardSpin as { prize: { title: string; description: string } | null } | null)?.prize?.description) && <p className="muted" style={{ marginTop: 6 }}>{status === "weekly_won" ? (lastWeeklySpin as { prize: { title: string; description: string } | null } | null)?.prize?.description : (lastRewardSpin as { prize: { title: string; description: string } | null } | null)?.prize?.description}</p>}</div>}
            {status === "used" && <div className="panel" style={{ marginTop: 14 }}>Ти вже використав(ла) безкоштовний оберт сьогодні. Повертайся завтра!</div>}
            {status === "weekly_used" && <div className="panel" style={{ marginTop: 14 }}>Щотижневий бонус уже використано. Новий буде доступний наступного понеділка.</div>}
            {status === "empty" && <div className="panel" style={{ marginTop: 14 }}>Активних призів поки немає.</div>}
            {status === "forbidden" && <div className="panel" style={{ marginTop: 14 }}>Керувати призами можуть лише адміністратор і лідер.</div>}
            {(status === "invalid" || status === "error" || status === "spin-error") && <div className="panel" style={{ marginTop: 14 }}>Не вдалося виконати дію. Перевір дані та налаштування бази.</div>}
            <div className="panel" style={{ marginTop: 20 }}>
              <RewardsWheel prizes={rewardPrizes.filter((prize) => prize.is_active)} alreadySpun={dailySpinUsed || status === "used"} birthdayEligible={birthdayEligible} birthdayAlreadySpun={birthdaySpinUsed} />
            </div>
            <div className="panel" style={{ marginTop: 16 }}>
              <h2>🎁 Щотижневий бонусний оберт</h2>
              <p className="muted">Один додатковий оберт на календарний тиждень, окремо від щоденного.</p>
              {weeklySpinUsed || status === "weekly_used" ? (
                <p className="page-note" style={{ marginTop: 12 }}>Тижневий бонус уже використано. Наступний доступний із понеділка.</p>
              ) : (
                <form action={spinWeeklyRewards} style={{ marginTop: 12 }}>
                  <button className="btn secondary" type="submit" disabled={!rewardPrizes.some((prize) => prize.is_active)} style={{ width: "100%" }}>Забрати тижневий бонус</button>
                </form>
              )}
            </div>
            <div className="panel" style={{ marginTop: 20 }}>
              <h2>Загальні призи</h2>
              {rewardError ? <p className="muted">Не вдалося завантажити призи. Переконайся, що SQL-скрипт rewards.sql виконаний у Supabase.</p> : rewardPrizes.length === 0 ? <p className="muted">Призів поки немає.</p> : (
                <div className="member-list" style={{ marginTop: 14 }}>
                  {rewardPrizes.map((prize) => (
                    <div className="member-row" key={prize.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 220px" }}>
                        <strong>{prize.title}</strong>{!prize.is_active && <span className="tag" style={{ marginLeft: 8 }}>В АРХІВІ</span>}
                        {prize.description && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{prize.description}</p>}
                        <p className="notice-time">Вага випадіння: {prize.weight}</p>
                      </div>
                      {(rewardsRole === "admin" || (rewardsRole === "leader" && prize.created_by === user.id)) && (
                        <form action={prize.is_active ? deleteRewardPrize : restoreRewardPrize}>
                          <input type="hidden" name="id" value={prize.id} />
                          <button className="btn" type="submit" style={prize.is_active ? { background: "#8f303f", borderColor: "#b94b5c" } : undefined}>{prize.is_active ? "Прибрати з рулетки" : "Повернути в рулетку"}</button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {canManageRewards && (
              <div className="panel" style={{ marginTop: 20 }}>
                <h2>Додати приз до загальної рулетки</h2>
                <p className="muted">Доданий приз зможуть виграти всі користувачі. Вага визначає відносну ймовірність випадіння.</p>
                <form action={createRewardPrize} className="member-list" style={{ marginTop: 14, gap: 10 }}>
                  <label htmlFor="reward-title">Назва призу</label>
                  <input id="reward-title" name="title" required maxLength={100} placeholder="Наприклад: 100 бонусних балів" />
                  <label htmlFor="reward-description">Опис призу</label>
                  <textarea id="reward-description" name="description" maxLength={500} rows={3} placeholder="Що отримує переможець?" />
                  <label htmlFor="reward-weight">Вага випадіння (1–10000)</label>
                  <input id="reward-weight" name="weight" type="number" min="1" max="10000" step="1" defaultValue="1" required />
                  <button className="btn" type="submit">Додати приз</button>
                </form>
              </div>
            )}
          </>
        ) : section === "tests" ? (
          <TestsSection isStaff={isStaff} />
        ) : section === "activity" ? (
          <>
            <h1>Онлайн-активність</h1>
            <p className="muted">
              Облік часу, коли сторінка VERCETI відкрита та активна.
            </p>
            {activityError ? (
              <div className="panel" style={{ marginTop: 20 }}>
                Не вдалося завантажити статистику активності. Перевір, чи виконана міграція site_features.sql у Supabase.
              </div>
            ) : activityItems.length === 0 ? (
              <div className="panel" style={{ marginTop: 20 }}>
                Поки немає накопичених даних. Час почне рахуватися під час активного перебування на сторінках спільноти.
              </div>
            ) : (
              <div className="panel" style={{ marginTop: 20 }}>
                <h2>{isStaff ? "Рейтинг активності учасників" : "Твоя активність"}</h2>
                <p className="muted" style={{ fontSize: 12 }}>
                  {isStaff ? "Топ учасників за сумарним активним часом." : "Твій накопичений активний час."}
                </p>
                <div className="member-list" style={{ marginTop: 14 }}>
                  {activityItems.map((item, index) => {
                    const hours = Math.floor(item.total_seconds / 3600);
                    const minutes = Math.floor((item.total_seconds % 3600) / 60);
                    const seconds = item.total_seconds % 60;
                    return (
                      <div className="member-row" key={item.user_id}>
                        <span className="tag">{isStaff ? `#${index + 1}` : "ЧАС"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{item.nickname}</strong>
                          <p className="muted" style={{ fontSize: 11 }}>{item.role}</p>
                        </div>
                        <strong style={{ whiteSpace: "nowrap" }}>
                          {hours > 0 ? `${hours} год ` : ""}{minutes} хв {seconds} с
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h1>{data.title}</h1>
            <p className="muted">{data.text}</p>

            <div className="member-list" style={{ margin: "24px 0" }}>
              {data.items.map((item) => (
                <div className="member-row" key={item}>
                  <span style={{ color: "#bb8aff" }}>✦</span>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    {item}
                  </span>
                  <span className="tag">ПЛАН</span>
                </div>
              ))}
            </div>

            <p className="page-note">
              Це поки що схема розділу, а не підключена функція.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
