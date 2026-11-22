
import { createClient } from "@/lib/supabase/server";

import {
  createApplicationQuestion,
  updateApplicationQuestion,
  deleteApplicationQuestion,
  submitApplication,
  editApplicationAnswers,
  reviewApplication,
} from "./application-actions";

const statusLabels: Record<string, string> = {
  pending: "На перевірці",
  needs_changes: "Потрібні виправлення",
  approved: "Схвалено",
  rejected: "Відхилено",
};

const roleLabels: Record<string, string> = {
  junior: "Junior",
  local: "Local",
  senior: "Senior",
  moderator: "Moderator",
  leader: "Leader",
};

export default async function ApplicationsSection({
  status,
}: {
  status?: string;
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

  const { data: questionsData, error: questionsError } = await supabase
    .from("application_questions")
    .select("*")
    .eq("is_active", true)
    .order("position", { ascending: true });

  const questions = questionsData ?? [];

  const { data: applicationsData, error: applicationsError } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  const applications = applicationsData ?? [];

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

  const myApplication = applications.find(
    (application) => application.user_id === user.id
  );

  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  return (
    <>
      <h1>Анкети VERCETI</h1>

      <p className="muted">
        Заповнення анкет та перевірка заявок учасників спільноти.
      </p>

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
      {status === "already-pending" && (
        <div className="panel">Твоя анкета вже очікує перевірки.</div>
      )}
      {status === "no-questions" && (
        <div className="panel">Керівництво ще не створило запитань.</div>
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

      {isStaff && (
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
                                question.options.map((option) => (
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

      {isStaff && (
        <div style={{ marginTop: 28 }}>
          <h2>Анкети учасників</h2>

          {applications.length === 0 ? (
            <div className="panel">
              Поки що учасники не надсилали анкет.
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

                  {application.status === "pending" && (
                    <form
                      action={reviewApplication}
                      className="member-list"
                      style={{
                        marginTop: 20,
                        borderTop: "1px solid rgba(187,138,255,0.2)",
                        paddingTop: 16,
                        gap: 10,
                      }}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={application.id}
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
                        <option value="junior">Junior</option>
                        <option value="local">Local</option>
                        <option value="senior">Senior</option>
                        <option value="moderator">Moderator</option>
                        <option value="leader">Leader</option>
                      </select>

                      <button
                        className="btn"
                        type="submit"
                        name="status"
                        value="approved"
                      >
                        Підтвердити вступ
                      </button>

                      <button
                        className="btn"
                        type="submit"
                        name="status"
                        value="needs_changes"
                      >
                        Повернути на доопрацювання
                      </button>

                      <button
                        className="btn"
                        type="submit"
                        name="status"
                        value="rejected"
                        style={{
                          background: "#8f303f",
                          borderColor: "#b94b5c",
                        }}
                      >
                        Відхилити заявку
                      </button>
                    </form>
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
