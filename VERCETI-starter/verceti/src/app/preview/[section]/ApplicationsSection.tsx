
import { createClient } from "@/lib/supabase/server";

import {
  createApplicationQuestion,
  updateApplicationQuestion,
  deleteApplicationQuestion,
  submitApplication,
  saveBirthday,
  editApplicationAnswers,
  reviewApplication,
  deleteApplication,
  setMyBirthday,
  adminUpdateBirthday,
} from "./application-actions";

const statusLabels: Record<string, string> = {
  pending: "На перевірці",
  needs_changes: "Потрібні виправлення",
  approved: "Схвалено",
  rejected: "Відхилено",
};

const roleLabels: Record<string, string> = {
  junior: "Молодший учасник",
  local: "Учасник",
  senior: "Старший учасник",
  moderator: "Модератор",
  founder: "Засновник",
  leader: "Лідер",
  admin: "Застаріла роль",
};

export default async function ApplicationsSection({
  status,
  showPendingOnly = false,
  showDatabaseOnly = false,
}: {
  status?: string;
  showPendingOnly?: boolean;
  showDatabaseOnly?: boolean;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Увійди до спільноти, щоб переглянути анкети.</p>;
  }

  const { data: staffResult } = await supabase.rpc("is_verceti_staff");
  const isStaff = staffResult === true;

  const { data: currentRole } = await supabase.rpc(
    "current_verceti_role"
  );

  const isFounder = currentRole === "founder";
  const isAdmin = isFounder;
  const canViewDatabase = isFounder;
  const effectivePendingOnly = showPendingOnly || (isStaff && !isFounder);

  if (showDatabaseOnly && !canViewDatabase) {
    return (
      <div className="panel" role="alert">
        Перегляд бази всіх анкет доступний лише Засновнику.
      </div>
    );
  }

  const { data: questionsData, error: questionsError } = await supabase
    .from("application_questions")
    .select("*")
    .order("position", { ascending: true });

  const questions = questionsData ?? [];

  const { data: myProfile } = await supabase.from("profiles")
    .select("birth_day, birth_month").eq("id", user.id).maybeSingle();

  const applicationsQuery = supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: applicationsData, error: applicationsError } = effectivePendingOnly
    ? await applicationsQuery.eq("status", "pending")
    : await applicationsQuery;

  const allApplications = applicationsData ?? [];
  const applications = allApplications;

  const userIds = Array.from(
    new Set(applications.map((application) => application.user_id))
  );

  let profiles: { id: string; nickname: string; role: string }[] = [];

  if (isStaff && userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, nickname, role")
      .in("id", userIds);

    profiles = profilesData ?? [];
  }


  const { data: birthdayProfilesData } = isAdmin
    ? await supabase.from("profiles").select("id, nickname, birth_day, birth_month").order("nickname")
    : { data: [] as { id: string; nickname: string; birth_day: number | null; birth_month: number | null }[] };
  const birthdayProfiles = birthdayProfilesData ?? [];

  const myApplication = applications.find(
    (application) => application.user_id === user.id
  );

  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  return (
    <>
      <h1>{effectivePendingOnly ? "Анкети на підтвердження" : showDatabaseOnly ? "База анкет" : "Анкети VERCETI"}</h1>

      <p className="muted">
        Заповнення анкет та перевірка заявок учасників спільноти.
      </p>

      {!showPendingOnly && !showDatabaseOnly && (
      <div className="panel" style={{ marginTop: 18 }}>
        <h2>🎂 Дата народження</h2>
        <p className="muted">Вкажи день і місяць, щоб усі учасники отримували сповіщення у твій день народження. Рік не потрібен.</p>
        <form action={saveBirthday} className="member-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label htmlFor="profile_birth_day">День</label>
            <select id="profile_birth_day" name="birth_day" required defaultValue={myProfile?.birth_day ?? ""}>
              <option value="">День</option>
              {Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="profile_birth_month">Місяць</label>
            <select id="profile_birth_month" name="birth_month" required defaultValue={myProfile?.birth_month ?? ""}>
              <option value="">Місяць</option>
              {["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </select>
          </div>
          <button className="btn" type="submit">Зберегти</button>
        </form>
      </div>
      )}

      {status === "question-created" && (
        <div className="panel">Запитання успішно додано.</div>
      )}

      {status === "question-updated" && (
        <div className="panel">Запитання успішно оновлено.</div>
      )}

      {status === "question-deleted" && (
        <div className="panel">Запитання видалено.</div>
      )}

      {status === "submitted" && (
        <div className="panel">Анкету успішно надіслано на перевірку.</div>
      )}

      {status === "answers-updated" && (
        <div className="panel">Відповіді анкети оновлено.</div>
      )}

      {status === "reviewed" && (
        <div className="panel">Рішення щодо анкети збережено.</div>
      )}

      {status === "application-deleted" && (
        <div className="panel">Анкету учасника успішно видалено.</div>
      )}

      {status === "already-pending" && (
        <div className="panel">Твоя анкета вже очікує перевірки.</div>
      )}

      {status === "no-questions" && (
        <div className="panel">Керівництво ще не створило запитань.</div>
      )}

      {status === "birthday-saved" && <div className="panel">Дату народження збережено. Змінити її може лише адміністратор.</div>}
      {status === "birthday-updated" && <div className="panel">Дату народження учасника виправлено.</div>}
      {status === "birthday-locked" && <div className="panel">Дату вже встановлено. Для виправлення звернись до адміністратора.</div>}
      {status === "birthday-required" && (
        <div className="panel">Обери день і місяць народження. Рік не потрібен.</div>
      )}

      {status === "answers-required" && (
        <div className="panel">Заповни всі обов&apos;язкові поля.</div>
      )}

      {status === "question-options" && (
        <div className="panel">
          Для списку вибору потрібно щонайменше два варіанти.
        </div>
      )}

      {status === "question-invalid" && (
        <div className="panel">Перевір правильність запитання.</div>
      )}

      {status === "question-error" && (
        <div className="panel">Не вдалося зберегти запитання.</div>
      )}

      {status === "application-error" && (
        <div className="panel">Не вдалося зберегти анкету.</div>
      )}

      {status === "review-error" && (
        <div className="panel">
          Не вдалося зберегти рішення. Перевір права доступу та статус анкети.
        </div>
      )}

      {status === "forbidden" && (
        <div className="panel">У тебе немає прав для цієї дії.</div>
      )}

      {questionsError && (
        <div className="panel">
          Не вдалося завантажити запитання.
        </div>
      )}

      {applicationsError && (
        <div className="panel">
          Не вдалося завантажити анкети.
        </div>
      )}

      {isFounder && !effectivePendingOnly && !showDatabaseOnly && (
        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Конструктор анкети</h2>

          <p className="muted">
            Створюй запитання, які побачать учасники спільноти.
          </p>

          {questions.map((question) => (
            <form
              key={question.id}
              action={updateApplicationQuestion}
              className="member-list"
              style={{
                borderTop: "1px solid rgba(187,138,255,0.2)",
                paddingTop: 18,
                marginTop: 18,
                gap: 10,
              }}
            >
              <input type="hidden" name="id" value={question.id} />

              <label>Запитання</label>
              <input
                name="question"
                required
                maxLength={1000}
                defaultValue={question.question}
              />

              <label>Пояснення (необов&apos;язково)</label>
              <textarea
                name="description"
                rows={2}
                maxLength={2000}
                defaultValue={question.description ?? ""}
              />

              <label>Тип відповіді</label>
              <select
                name="question_type"
                defaultValue={question.question_type}
              >
                <option value="text">Коротка відповідь</option>
                <option value="textarea">Розгорнута відповідь</option>
                <option value="select">Вибір зі списку</option>
              </select>

              <label>Варіанти відповіді (кожен з нового рядка)</label>
              <textarea
                name="options"
                rows={3}
                defaultValue={
                  Array.isArray(question.options)
                    ? question.options.join("\n")
                    : ""
                }
              />

              <label>
                <input
                  type="checkbox"
                  name="is_required"
                  defaultChecked={question.is_required}
                />
                Обов&apos;язкове запитання
              </label>

              <label>Порядок</label>
              <input
                name="position"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={question.position}
              />

              <button className="btn" type="submit">
                Зберегти запитання
              </button>

              <button
                className="btn"
                type="submit"
                formAction={deleteApplicationQuestion}
                style={{
                  background: "#8f303f",
                  borderColor: "#b94b5c",
                }}
              >
                Видалити запитання
              </button>
            </form>
          ))}

          <h3 style={{ marginTop: 28 }}>Додати запитання</h3>

          <form
            action={createApplicationQuestion}
            className="member-list"
            style={{ gap: 10 }}
          >
            <label>Текст запитання</label>
            <input
              name="question"
              required
              maxLength={1000}
              placeholder="Наприклад: Скільки тобі років?"
            />

            <label>Пояснення</label>
            <textarea
              name="description"
              rows={2}
              maxLength={2000}
              placeholder="Додаткове пояснення для гравця"
            />

            <label>Тип відповіді</label>
            <select name="question_type" defaultValue="text">
              <option value="text">Коротка відповідь</option>
              <option value="textarea">Розгорнута відповідь</option>
              <option value="select">Вибір зі списку</option>
            </select>

            <label>Варіанти відповіді (кожен з нового рядка)</label>
            <textarea
              name="options"
              rows={3}
              placeholder={"Варіант 1\nВаріант 2"}
            />

            <label>
              <input
                type="checkbox"
                name="is_required"
                defaultChecked
              />
              Обов&apos;язкове запитання
            </label>

            <label>Порядок</label>
            <input
              name="position"
              type="number"
              min="0"
              step="1"
              defaultValue={questions.length + 1}
              required
            />

            <button className="btn" type="submit">
              Додати запитання
            </button>
          </form>
        </div>
      )}

      {!isStaff && (
        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Моя анкета</h2>

          {myApplication && (
            <p className="muted">
              Статус:{" "}
              {statusLabels[myApplication.status] ?? myApplication.status}
            </p>
          )}

          {myApplication?.status === "approved" && (
            <p>Твою заявку схвалено. Вітаємо у спільноті!</p>
          )}

          {myApplication?.status === "rejected" && (
            <p>Твою заявку відхилено.</p>
          )}

          {myApplication?.reviewer_note && (
            <p>
              <strong>Коментар керівництва:</strong>{" "}
              {myApplication.reviewer_note}
            </p>
          )}

          {myApplication?.status === "pending" && (
            <p>Анкета очікує перевірки. Поки що змінити її не можна.</p>
          )}

          {myApplication?.status !== "approved" &&
            myApplication?.status !== "rejected" &&
            myApplication?.status !== "pending" && (
              <>
                {questions.length === 0 ? (
                  <p className="muted">
                    Керівництво ще не створило запитань.
                  </p>
                ) : (
                  <form
                    action={submitApplication}
                    className="member-list"
                    style={{ gap: 12, marginTop: 18 }}
                  >
                    <div>
                      <label htmlFor="birth_day">Дата народження *</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <select id="birth_day" name="birth_day" required defaultValue="">
                          <option value="">День</option>
                          {Array.from({ length: 31 }, (_, index) => (
                            <option key={index + 1} value={index + 1}>{index + 1}</option>
                          ))}
                        </select>
                        <select name="birth_month" required defaultValue="">
                          <option value="">Місяць</option>
                          {["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"].map((month, index) => (
                            <option key={month} value={index + 1}>{month}</option>
                          ))}
                        </select>
                      </div>
                      <p className="muted">Рік народження не запитується. У день народження учасники отримають сповіщення.</p>
                    </div>
                    {questions.map((question) => {
                      const oldAnswer =
                        myApplication?.answers &&
                        typeof myApplication.answers === "object" &&
                        !Array.isArray(myApplication.answers)
                          ? String(
                              (myApplication.answers as Record<string, unknown>)[
                                question.id
                              ] ?? ""
                            )
                          : "";

                      return (
                        <div key={question.id}>
                          <label>
                            {question.question}
                            {question.is_required ? " *" : ""}
                          </label>

                          {question.description && (
                            <p className="muted">
                              {question.description}
                            </p>
                          )}

                          {question.question_type === "textarea" ? (
                            <textarea
                              name={`answer_${question.id}`}
                              rows={4}
                              required={question.is_required}
                              defaultValue={oldAnswer}
                            />
                          ) : question.question_type === "select" ? (
                            <select
                              name={`answer_${question.id}`}
                              required={question.is_required}
                              defaultValue={oldAnswer}
                            >
                              <option value="">Обери відповідь</option>
                              {Array.isArray(question.options) &&
                                question.options.map((option: string) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <input
                              name={`answer_${question.id}`}
                              type="text"
                              required={question.is_required}
                              defaultValue={oldAnswer}
                            />
                          )}
                        </div>
                      );
                    })}

                    <button className="btn" type="submit">
                      Надіслати анкету
                    </button>
                  </form>
                )}
              </>
            )}
        </div>
      )}

      {isStaff && (effectivePendingOnly || showDatabaseOnly) && (
        <div style={{ marginTop: 28 }}>
          <h2>{showDatabaseOnly ? "Усі збережені анкети" : "Список заявок, що очікують рішення"}</h2>

          {applications.length === 0 ? (
            <div className="panel">
              {showDatabaseOnly ? "У базі поки немає анкет." : "Немає анкет, які очікують підтвердження."}
            </div>
          ) : (
            applications.map((application) => {
              const profile = profileById.get(application.user_id);

              const answers =
                application.answers &&
                typeof application.answers === "object" &&
                !Array.isArray(application.answers)
                  ? (application.answers as Record<string, unknown>)
                  : {};

              return (
                <div
                  className="panel"
                  key={application.id}
                  style={{ marginTop: 16 }}
                >
                  <h3>{profile?.nickname ?? "Невідомий учасник"}</h3>

                  <p className="muted">
                    Поточна роль:{" "}
                    {profile?.role
                      ? roleLabels[profile.role] ?? profile.role
                      : "Невідома"}
                  </p>

                  <p>
                    Статус:{" "}
                    {statusLabels[application.status] ??
                      application.status}
                  </p>

                  <p className="muted">
                    Надіслано:{" "}
                    {new Date(application.created_at).toLocaleString("uk-UA")}
                  </p>

                  {isAdmin && (
                    <form
                      action={deleteApplication}
                      style={{ marginTop: 12 }}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={application.id}
                      />

                      <button
                        className="btn"
                        type="submit"
                        style={{
                          background: "#8f303f",
                          borderColor: "#b94b5c",
                        }}
                      >
                        Видалити анкету
                      </button>
                    </form>
                  )}

                  <h4>Відповіді</h4>

                  {questions.map((question) => (
                    <div key={question.id} style={{ marginBottom: 12 }}>
                      <strong>{question.question}</strong>
                      <p className="muted">
                        {String(answers[question.id] ?? "Немає відповіді")}
                      </p>
                    </div>
                  ))}

                  <details style={{ marginTop: 18 }}>
                    <summary style={{ cursor: "pointer" }}>
                      Редагувати відповіді
                    </summary>

                    <form
                      action={editApplicationAnswers}
                      className="member-list"
                      style={{ marginTop: 12, gap: 10 }}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={application.id}
                      />

                      <label>Відповіді у форматі JSON</label>
                      <textarea
                        name="answers"
                        rows={10}
                        required
                        defaultValue={JSON.stringify(answers, null, 2)}
                      />

                      <button className="btn" type="submit">
                        Зберегти відповіді
                      </button>
                    </form>
                  </details>

                  {!showDatabaseOnly && application.status === "pending" && (
                    <div
                      className="member-list"
                      style={{
                        marginTop: 20,
                        borderTop: "1px solid rgba(187,138,255,0.2)",
                        paddingTop: 16,
                        gap: 12,
                      }}
                    >
                      <form action={reviewApplication}>
                        <input
                          type="hidden"
                          name="id"
                          value={application.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value="approved"
                        />

                        <label>Коментар керівництва</label>
                        <textarea
                          name="note"
                          rows={3}
                          maxLength={2000}
                          placeholder="Коментар або причина рішення"
                        />

                        <label>Роль після схвалення</label>
                        <select name="assigned_role" defaultValue="">
                          <option value="">Не змінювати роль</option>
                          <option value="junior">Молодший учасник</option>
                          <option value="local">Учасник</option>
                          <option value="senior">Старший учасник</option>
                          <option value="moderator">Модератор</option>
                          {isFounder && <option value="leader">Лідер</option>}
                        </select>

                        <button className="btn" type="submit">
                          Підтвердити вступ
                        </button>
                      </form>

                      <form action={reviewApplication}>
                        <input
                          type="hidden"
                          name="id"
                          value={application.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value="needs_changes"
                        />

                        <label>Коментар для доопрацювання</label>
                        <textarea
                          name="note"
                          rows={2}
                          maxLength={2000}
                        />

                        <button className="btn" type="submit">
                          Повернути на доопрацювання
                        </button>
                      </form>

                      <form action={reviewApplication}>
                        <input
                          type="hidden"
                          name="id"
                          value={application.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value="rejected"
                        />

                        <label>Причина відхилення</label>
                        <textarea
                          name="note"
                          rows={2}
                          maxLength={2000}
                        />

                        <button
                          className="btn"
                          type="submit"
                          style={{
                            background: "#8f303f",
                            borderColor: "#b94b5c",
                          }}
                        >
                          Відхилити заявку
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
