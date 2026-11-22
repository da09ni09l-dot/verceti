
import TestsSection from "./TestsSection";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createNews, deleteNews } from "./actions";
import {
  createRule,
  updateRule,
  deleteRule
} from "./rule-actions";

import SectionNavigation from "./SectionNavigation";
import NotificationBell from "./NotificationBell";
import ChatRoom from "./ChatRoom";
import VoiceRoom from "./VoiceRoom";
import MusicRoom from "./MusicRoom";
import MediaRoom from "./MediaRoom";
import ApplicationsSection from "./ApplicationsSection";
import StatsSection from "./StatsSection";

const descriptions: Record<string, { title: string; text: string; items: string[] }> = {
  members: {
    title: "Учасники",
    text: "Список учасників, ролі та профілі.",
    items: ["Пошук за нікнеймом та ігровим ID", "Кольорові позначки ролей", "Історія зміни ролей"]
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
  important: "ВАЖЛИВО"
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { section } = await params;
  const { status } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: staffStatus,
    error: staffError
  } = await supabase.rpc("is_verceti_staff");

  const isStaff = !staffError && staffStatus === true;

  let applicationApproved = false;

  if (!isStaff) {
    const { data: applications, error: applicationError } =
      await supabase
        .from("applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

    applicationApproved =
      !applicationError &&
      applications?.[0]?.status === "approved";
  }

  if (!isStaff && !applicationApproved && section !== "forms") {
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
  }[] = [];

  let newsError = false;

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
      );

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
          changedByNickname: profilesMap.get(item.changed_by) ?? null,
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
      );

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
          moderatorNickname: profilesMap.get(item.issued_by) ?? null,
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
    const { data, error } = await supabase
      .from("news")
      .select("id, title, content, category, event_date, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("VERCETI news loading error:", error.message);
      newsError = true;
    } else {
      newsItems = data ?? [];
    }
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
    <main className="login-wrap">
      <section className="login-card">
        <SectionNavigation />

        <NotificationBell />

        <div className="eyebrow">VERCETI · ПОПЕРЕДНІЙ ПЕРЕГЛЯД</div>

        {section === "chat" ? (
          <>
            <h1>Чат</h1>
            <p className="muted">
              Спілкування учасників спільноти VERCETI.
            </p>
            <ChatRoom />
          </>
        ) : section === "voice" || section === "streams" ? (
          <>
            <h1>Голосові кімнати VERCETI</h1>
            <p className="muted">
              Голосове спілкування та демонстрація екрана в одному місці.
            </p>
            <VoiceRoom isStaff={isStaff} />
          </>
        ) : section === "music" ? (
          <>
            <h1>Музика VERCETI</h1>
            <p className="muted">
              Музичний простір спільноти та список відтворення.
            </p>
            <MusicRoom />
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
            isStaff={isStaff}
            status={status}
          />
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
                          name="id"
                          value={item.id}
                        />
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
                      Дата: {new Date(
                        item.event_date
                          ? `${item.event_date}T12:00:00`
                          : item.created_at
                      ).toLocaleDateString("uk-UA")}
                    </div>

                    {isStaff && (
                      <form
                        action={deleteNews}
                        style={{ marginTop: 14 }}
                      >
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
        ) : section === "tests" ? (
          <TestsSection isStaff={isStaff} />
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
