
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createMember,
  banMember,
  unbanMember,
  deleteMember,
  createNews,
  deleteNews,
  toggleNewsPin,
} from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    news_created?: string;
    news_deleted?: string;
    news_updated?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: role } = await supabase.rpc("current_verceti_role");

  if (role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("id, nickname, role, is_banned, created_at")
    .order("created_at", { ascending: false });

  const { data: newsList, error: newsError } = await supabase
    .from("news")
    .select(
      "id, title, content, category, is_pinned, show_from, show_until, created_at"
    )
    .order("created_at", { ascending: false });

  const errorMessages: Record<string, string> = {
    nickname: "Нікнейм має містити 3–20 символів: латинські літери, цифри або _.",
    password: "Пароль має містити щонайменше 8 символів.",
    role: "Вибрано неправильну роль.",
    create: "Не вдалося створити акаунт. Можливо, такий нікнейм уже існує.",
    role_assignment: "Не вдалося призначити роль. Акаунт не створено.",
    member: "Учасника не знайдено.",
    self_ban: "Не можна заблокувати власний акаунт.",
    self_delete: "Не можна видалити власний акаунт.",
    confirmation: "Для підтвердження видалення введи DELETE.",
    protected: "Адміністратора не можна заблокувати або видалити.",
    ban: "Не вдалося заблокувати учасника.",
    unban: "Не вдалося розблокувати учасника.",
    delete_cleanup: "Не вдалося підготувати дані до видалення. Акаунт не видалено.",
    delete_auth: "Не вдалося видалити Auth-акаунт. Перевір стан даних.",
    news_fields: "Заповни назву та текст новини.",
    news_category: "Вибрано неправильну категорію новини.",
    news_date: "Перевір правильність дат новини.",
    news_period: "Дата завершення має бути пізніше дати початку.",
    news_create: "Не вдалося створити новину.",
    news_notification: "Новину створено, але не вдалося розіслати сповіщення.",
    news: "Новину не знайдено.",
    news_delete: "Не вдалося видалити новину.",
    news_update: "Не вдалося змінити закріплення новини.",
  };

  const roleLabels: Record<string, string> = {
    admin: "Адміністратор",
    junior: "Молодший учасник",
    local: "Учасник",
    senior: "Старший учасник",
    moderator: "Модератор",
    leader: "Лідер",
  };

  const categoryLabels: Record<string, string> = {
    announcement: "Оголошення",
    event: "Подія",
    update: "Оновлення",
    important: "Важливе",
  };

  const formatDate = (value: string | null) => {
    if (!value) return "Не встановлено";

    return new Date(value).toLocaleString("uk-UA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <main className="login-wrap workspace-wrap">
      <section
        className="login-card workspace-card"
        style={{ width: "100%", maxWidth: 760 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className="brand" style={{ padding: 0 }}>
            VERCETI
            <small>АДМІНІСТРУВАННЯ</small>
          </div>
          <Link href="/" className="btn secondary" style={{ whiteSpace: "nowrap" }}>
            ← Назад на сайт
          </Link>
        </div>

        <h1 style={{ fontSize: 27, marginTop: 28 }}>
          Панель адміністратора
        </h1>

        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          Створення облікових записів, керування учасниками та новинами спільноти.
        </p>

        {params.created === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Акаунт успішно створено!
          </p>
        )}

        {params.updated === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Статус учасника успішно змінено.
          </p>
        )}

        {params.deleted === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Акаунт повністю видалено.
          </p>
        )}

        {params.news_created === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Новину успішно опубліковано!
          </p>
        )}

        {params.news_deleted === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Новину видалено.
          </p>
        )}

        {params.news_updated === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Закріплення новини змінено.
          </p>
        )}

        {params.error && errorMessages[params.error] && (
          <p style={{ color: "#ff8f9f", fontSize: 13 }}>
            {errorMessages[params.error]}
          </p>
        )}

        {/* Створення акаунта */}
        <details className="panel" style={{ marginTop: 24 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, padding: 8 }}>📁 Керування акаунтами</summary>

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Створити акаунт</h2>

          <form action={createMember} style={{ marginTop: 16 }}>
            <label>Нікнейм учасника</label>
            <input
              name="nickname"
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              placeholder="Наприклад: Учасник_01"
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Пароль учасника
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Мінімум 8 символів"
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Роль учасника
            </label>

            <select
              name="role"
              defaultValue="junior"
              style={{ width: "100%", marginBottom: 20 }}
            >
              <option value="junior">Молодший учасник</option>
              <option value="local">Учасник</option>
              <option value="senior">Старший учасник</option>
              <option value="moderator">Модератор</option>
              <option value="leader">Лідер</option>
            </select>

            <button
              type="submit"
              className="btn"
              style={{ width: "100%" }}
            >
              Створити акаунт учасника
            </button>
          </form>
        </div>

        </details>

        {/* Керування новинами */}
        <details className="panel" style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, padding: 8 }}>📁 Новини та оголошення</summary>

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Створити новину</h2>

          <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
            Новина з&apos;явиться у стрічці спільноти. Її можна закріпити на головній
            сторінці та встановити період показу.
          </p>

          <form action={createNews} style={{ marginTop: 16 }}>
            <label>Назва новини</label>
            <input
              name="title"
              type="text"
              required
              maxLength={150}
              placeholder="Наприклад: Важливе оголошення"
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Текст новини
            </label>
            <textarea
              name="content"
              required
              rows={6}
              maxLength={10000}
              placeholder="Напиши текст новини..."
              style={{ width: "100%", resize: "vertical" }}
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Категорія
            </label>
            <select
              name="category"
              defaultValue="announcement"
              style={{ width: "100%", marginBottom: 16 }}
            >
              <option value="announcement">Оголошення</option>
              <option value="event">Подія</option>
              <option value="update">Оновлення</option>
              <option value="important">Важливе</option>
            </select>

            <label style={{ display: "block", marginTop: 8 }}>
              Показувати з
            </label>
            <input
              name="show_from"
              type="datetime-local"
              style={{ width: "100%" }}
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Показувати до
            </label>
            <input
              name="show_until"
              type="datetime-local"
              style={{ width: "100%" }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 18,
                marginBottom: 18,
                cursor: "pointer",
              }}
            >
              <input
                name="is_pinned"
                type="checkbox"
                style={{ width: 18, height: 18, margin: 0 }}
              />
              Закріпити на головній сторінці
            </label>

            <button
              type="submit"
              className="btn"
              style={{ width: "100%" }}
            >
              Опублікувати новину
            </button>
          </form>
        </div>

        {/* Список новин */}

        <div style={{ marginTop: 32 }}>
          <h2>Опубліковані новини</h2>

          <p className="muted" style={{ fontSize: 13 }}>
            Усього новин: {newsList?.length ?? 0}
          </p>

          {newsError ? (
            <div className="panel">
              Не вдалося завантажити новини.
            </div>
          ) : !newsList || newsList.length === 0 ? (
            <div className="panel">
              Новин поки немає.
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {newsList.map((news) => (
                <div
                  className="panel"
                  key={news.id}
                  style={{ marginBottom: 12 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <strong>{news.title}</strong>

                    <span className="tag">
                      {categoryLabels[news.category] ?? news.category}
                    </span>
                  </div>

                  <p
                    className="muted"
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      marginTop: 10,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {news.content}
                  </p>

                  <p style={{ fontSize: 12, marginTop: 12 }}>
                    {news.is_pinned ? "📌 Закріплена" : "Не закріплена"}
                  </p>

                  <p className="muted" style={{ fontSize: 11 }}>
                    Початок: {formatDate(news.show_from)}
                  </p>

                  <p className="muted" style={{ fontSize: 11 }}>
                    Завершення: {formatDate(news.show_until)}
                  </p>

                  <p className="muted" style={{ fontSize: 11 }}>
                    Створено: {formatDate(news.created_at)}
                  </p>

                  <form action={toggleNewsPin} style={{ marginTop: 12 }}>
                    <input
                      type="hidden"
                      name="news_id"
                      value={news.id}
                    />
                    <button
                      type="submit"
                      className="btn"
                      style={{ width: "100%" }}
                    >
                      {news.is_pinned
                        ? "Відкріпити від головної"
                        : "Закріпити на головній"}
                    </button>
                  </form>

                  <form action={deleteNews} style={{ marginTop: 8 }}>
                    <input
                      type="hidden"
                      name="news_id"
                      value={news.id}
                    />
                    <button
                      type="submit"
                      className="btn"
                      style={{
                        width: "100%",
                        background: "#8f303f",
                        borderColor: "#b94b5c",
                      }}
                    >
                      Видалити новину
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        </details>

        {/* Учасники спільноти */}
        <details className="panel" style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, padding: 8 }}>📁 Учасники та модерація</summary>

        <div style={{ marginTop: 32 }}>
          <h2>Учасники спільноти</h2>

          <p className="muted" style={{ fontSize: 13 }}>
            Усього учасників: {members?.length ?? 0}
          </p>

          {membersError ? (
            <div className="panel">
              Не вдалося завантажити список учасників.
            </div>
          ) : !members || members.length === 0 ? (
            <div className="panel">
              Учасників поки немає.
            </div>
          ) : (
            <div className="member-list" style={{ marginTop: 16 }}>
              {members.map((member) => (
                <div
                  className="panel"
                  key={member.id}
                  style={{ marginBottom: 12 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <strong>{member.nickname}</strong>

                    <span className="tag">
                      {roleLabels[member.role] ?? member.role}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: member.is_banned ? "#ff8f9f" : "#8ee6a5",
                      marginTop: 10,
                    }}
                  >
                    {member.is_banned ? "ЗАБЛОКОВАНИЙ" : "АКТИВНИЙ"}
                  </p>

                  <p className="muted" style={{ fontSize: 11 }}>
                    Створено:{" "}
                    {new Date(member.created_at).toLocaleDateString("uk-UA")}
                  </p>

                  {member.role === "admin" ? (
                    <p className="muted" style={{ fontSize: 12 }}>
                      Захищений акаунт адміністратора.
                    </p>
                  ) : (
                    <>
                      {member.is_banned ? (
                        <form action={unbanMember}>
                          <input
                            type="hidden"
                            name="member_id"
                            value={member.id}
                          />
                          <button
                            className="btn"
                            type="submit"
                            style={{ width: "100%" }}
                          >
                            Розблокувати
                          </button>
                        </form>
                      ) : (
                        <form action={banMember}>
                          <input
                            type="hidden"
                            name="member_id"
                            value={member.id}
                          />
                          <button
                            className="btn"
                            type="submit"
                            style={{
                              width: "100%",
                              background: "#8f303f",
                              borderColor: "#b94b5c",
                            }}
                          >
                            Заблокувати
                          </button>
                        </form>
                      )}

                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <p
                          style={{
                            color: "#ff8f9f",
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 8,
                          }}
                        >
                          Повне видалення акаунта
                        </p>

                        <p
                          className="muted"
                          style={{
                            fontSize: 11,
                            lineHeight: 1.6,
                            marginBottom: 10,
                          }}
                        >
                          Будуть видалені акаунт, профіль, анкети та
                          результати тестів. Цю дію неможливо скасувати.
                        </p>

                        <form action={deleteMember}>
                          <input
                            type="hidden"
                            name="member_id"
                            value={member.id}
                          />

                          <label
                            style={{
                              display: "block",
                              fontSize: 12,
                              marginBottom: 6,
                            }}
                          >
                            Для підтвердження введи DELETE
                          </label>

                          <input
                            name="confirmation"
                            type="text"
                            required
                            pattern="DELETE"
                            placeholder="DELETE"
                            autoComplete="off"
                          />

                          <button
                            className="btn"
                            type="submit"
                            style={{
                              width: "100%",
                              marginTop: 10,
                              background: "#8f303f",
                              borderColor: "#b94b5c",
                            }}
                          >
                            Видалити акаунт назавжди
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        </details>

        <p className="page-note">
          Доступ до цієї сторінки має лише адміністратор.
          Реєстрація для сторонніх закрита.
        </p>
      </section>
    </main>
  );
}
