
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createMember,
  banMember,
  unbanMember,
} from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
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

  const errorMessages: Record<string, string> = {
    nickname: "Нікнейм має містити 3–20 символів: латинські літери, цифри або _.",
    password: "Пароль має містити щонайменше 8 символів.",
    role: "Вибрано неправильну роль.",
    create: "Не вдалося створити акаунт. Можливо, такий нікнейм уже існує.",
    role_assignment: "Не вдалося призначити роль. Акаунт не створено.",
    member: "Учасника не знайдено.",
    self_ban: "Не можна заблокувати власний акаунт.",
    protected: "Адміністратора не можна заблокувати цією дією.",
    ban: "Не вдалося заблокувати учасника.",
    unban: "Не вдалося розблокувати учасника.",
  };

  const roleLabels: Record<string, string> = {
    admin: "Адміністратор",
    junior: "Junior",
    local: "Local",
    senior: "Senior",
    moderator: "Moderator",
    leader: "Leader",
  };

  return (
    <main className="login-wrap">
      <section
        className="login-card"
        style={{ width: "100%", maxWidth: 760 }}
      >
        <div className="brand" style={{ padding: 0 }}>
          VERCETI
          <small>ADMINISTRATION</small>
        </div>

        <h1 style={{ fontSize: 27, marginTop: 28 }}>
          Панель адміністратора
        </h1>

        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          Створення облікових записів та керування учасниками спільноти.
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

        {params.error && errorMessages[params.error] && (
          <p style={{ color: "#ff8f9f", fontSize: 13 }}>
            {errorMessages[params.error]}
          </p>
        )}

        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Створити акаунт</h2>

          <form action={createMember} style={{ marginTop: 16 }}>
            <label>Нікнейм гравця</label>
            <input
              name="nickname"
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              placeholder="Наприклад: Player_01"
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Пароль гравця
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Мінімум 8 символів"
            />

            <label style={{ display: "block", marginTop: 16 }}>
              Роль гравця
            </label>

            <select
              name="role"
              defaultValue="junior"
              style={{ width: "100%", marginBottom: 20 }}
            >
              <option value="junior">Junior</option>
              <option value="local">Local</option>
              <option value="senior">Senior</option>
              <option value="moderator">Moderator</option>
              <option value="leader">Leader</option>
            </select>

            <button
              type="submit"
              className="btn"
              style={{ width: "100%" }}
            >
              Створити акаунт гравця
            </button>
          </form>
        </div>

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
                  ) : member.is_banned ? (
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
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="page-note">
          Доступ до цієї сторінки має лише адміністратор.
          Реєстрація для сторонніх закрита.
        </p>
      </section>
    </main>
  );
}
