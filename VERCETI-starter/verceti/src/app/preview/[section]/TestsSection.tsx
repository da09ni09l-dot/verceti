
"use client";

import { useEffect, useState } from "react";

import {
  createTest,
  getAllTests,
  createTestQuestion,
  getTestMembers,
  grantTestPermission,
  updateTestStatus,
  getAvailableTests,
  getTestForMember,
  submitTestAnswers,
  getAllTestResults,
  getTestResultDetails,
  getMyTestResults,
} from "./test-actions";

type AnyRecord = Record<string, any>;

export default function TestsSection({
  isStaff,
}: {
  isStaff: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tests, setTests] = useState<AnyRecord[]>([]);
  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [results, setResults] = useState<AnyRecord[]>([]);
  const [myResults, setMyResults] = useState<AnyRecord[]>([]);

  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedTest, setSelectedTest] = useState<AnyRecord | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string[]>
  >({});

  const [testResult, setTestResult] = useState<AnyRecord | null>(null);
  const [resultDetails, setResultDetails] = useState<AnyRecord | null>(null);

  const [questionText, setQuestionText] = useState("");
  const [answerOptions, setAnswerOptions] = useState([
    { answer: "", is_correct: false },
    { answer: "", is_correct: false },
    { answer: "", is_correct: false },
    { answer: "", is_correct: false },
  ]);

  const [permissionTestId, setPermissionTestId] = useState("");
  const [permissionUserId, setPermissionUserId] = useState("");

  const [activeTab, setActiveTab] = useState<
    "tests" | "questions" | "permissions" | "results"
  >("tests");

  useEffect(() => {
    loadData();
  }, [isStaff]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      if (isStaff) {
        const [allTests, allMembers, allResults] = await Promise.all([
          getAllTests(),
          getTestMembers(),
          getAllTestResults(),
        ]);

        setTests(Array.isArray(allTests) ? allTests : []);
        setMembers(Array.isArray(allMembers) ? allMembers : []);
        setResults(Array.isArray(allResults) ? allResults : []);
      } else {
        const [availableTests, history] = await Promise.all([
          getAvailableTests(),
          getMyTestResults(),
        ]);

        setTests(Array.isArray(availableTests) ? availableTests : []);
        setMyResults(Array.isArray(history) ? history : []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не вдалося завантажити дані."
      );
    } finally {
      setLoading(false);
    }
  }

  function showError(err: unknown) {
    setError(
      err instanceof Error ? err.message : "Сталася помилка. Спробуйте ще раз."
    );
  }

  function clearNotices() {
    setError("");
    setMessage("");
  }

  async function handleCreateTest(formData: FormData) {
    clearNotices();
    setBusy(true);

    try {
      await createTest(formData);
      setMessage("Тест створено.");
      await loadData();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateQuestion(formData: FormData) {
    clearNotices();

    const answers = answerOptions
      .map((item) => ({
        answer: item.answer.trim(),
        is_correct: item.is_correct,
      }))
      .filter((item) => item.answer.length > 0);

    const correctCount = answers.filter((item) => item.is_correct).length;

    if (!selectedTestId) {
      setError("Спочатку виберіть тест.");
      return;
    }

    if (!questionText.trim()) {
      setError("Введіть текст питання.");
      return;
    }

    if (answers.length < 2) {
      setError("Додайте щонайменше два варіанти відповіді.");
      return;
    }

    if (correctCount < 1 || correctCount > 2) {
      setError("Позначте один або два правильні варіанти.");
      return;
    }

    formData.set("test_id", selectedTestId);
    formData.set("question", questionText.trim());
    formData.set("answers", JSON.stringify(answers));

    setBusy(true);

    try {
      await createTestQuestion(formData);
      setMessage("Питання додано.");
      setQuestionText("");
      setAnswerOptions([
        { answer: "", is_correct: false },
        { answer: "", is_correct: false },
        { answer: "", is_correct: false },
        { answer: "", is_correct: false },
      ]);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleGrantPermission(formData: FormData) {
    clearNotices();

    if (!permissionTestId || !permissionUserId) {
      setError("Виберіть тест і учасника.");
      return;
    }

    formData.set("test_id", permissionTestId);
    formData.set("user_id", permissionUserId);

    setBusy(true);

    try {
      await grantTestPermission(formData);
      setMessage("Дозвіл на тестування надано.");
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTest(test: AnyRecord) {
    clearNotices();
    setBusy(true);

    try {
      await updateTestStatus(test.id, !test.is_active);
      setMessage(
        !test.is_active ? "Тест активовано." : "Тест деактивовано."
      );
      await loadData();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function openTest(testId: string) {
    clearNotices();
    setBusy(true);
    setTestResult(null);
    setSelectedAnswers({});

    try {
      const data = await getTestForMember(testId);
      setSelectedTest(data);
      setSelectedTestId(testId);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  function toggleAnswer(questionId: string, answerId: string) {
    setSelectedAnswers((previous) => {
      const current = previous[questionId] || [];

      if (current.includes(answerId)) {
        return {
          ...previous,
          [questionId]: current.filter((id) => id !== answerId),
        };
      }

      if (current.length >= 2) {
        return previous;
      }

      return {
        ...previous,
        [questionId]: [...current, answerId],
      };
    });
  }

  async function handleSubmitTest() {
    if (!selectedTestId || !selectedTest) return;

    clearNotices();

    const questions = selectedTest.questions || [];

    if (questions.length === 0) {
      setError("У цьому тесті поки немає питань.");
      return;
    }

    if (questions.some((question: AnyRecord) =>
      !(selectedAnswers[question.id] || []).length
    )) {
      setError("Дайте відповідь на кожне питання.");
      return;
    }

    setBusy(true);

    try {
      const result = await submitTestAnswers(
        selectedTestId,
        selectedAnswers
      );

      setTestResult(result);
      setSelectedTest(null);
      setSelectedAnswers({});
      await loadData();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function openResultDetails(resultId: string) {
    clearNotices();
    setBusy(true);
    setResultDetails(null);

    try {
      const details = await getTestResultDetails(resultId);
      setResultDetails(details);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  function getPercentage(item: AnyRecord) {
    if (typeof item.percentage === "number") {
      return item.percentage;
    }

    if (
      typeof item.score === "number" &&
      typeof item.total_questions === "number" &&
      item.total_questions > 0
    ) {
      return Math.round((item.score / item.total_questions) * 100);
    }

    return 0;
  }

  function getStatus(item: AnyRecord) {
    return item.passed ? "Складено" : "Не складено";
  }

  function getQuestions(data: AnyRecord) {
    return data?.questions || data?.result?.questions || [];
  }

  function getDetailsResult(data: AnyRecord) {
    return data?.result || data;
  }

  if (loading) {
    return <div className="panel">Завантаження тестування...</div>;
  }

  return (
    <div className="panel">
      <div className="eyebrow">VERCETI</div>
      <h1>Тестування</h1>

      {error && (
        <div className="panel" role="alert" style={{ borderColor: "#d9534f" }}>
          {error}
        </div>
      )}

      {message && (
        <div className="panel" style={{ borderColor: "#3a9b68" }}>
          {message}
        </div>
      )}

      {busy && <p className="muted">Виконується операція...</p>}

      {!isStaff && (
        <>
          {testResult && (
            <div className="panel">
              <h2>Результат тестування</h2>
              <p>
                **{getPercentage(testResult)}%**
              </p>
              <p>
                {testResult.passed ? "Складено" : "Не складено"}
              </p>
              <p className="muted">
                Спроба №{testResult.attempt_number}
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setTestResult(null);
                  clearNotices();
                }}
              >
                Закрити результат
              </button>
            </div>
          )}

          {!selectedTest && !testResult && (
            <>
              <h2>Доступні тести</h2>

              {tests.length === 0 ? (
                <p className="muted">
                  Наразі немає тестів, доступних для проходження.
                </p>
              ) : (
                <div className="member-list">
                  {tests.map((test) => (
                    <div className="member-row" key={test.id}>
                      <div>
                        <strong>{test.title}</strong>
                        {test.description && (
                          <p className="muted">{test.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => openTest(test.id)}
                      >
                        Почати
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {selectedTest && (
            <div className="panel">
              <button
                type="button"
                className="btn"
                onClick={() => setSelectedTest(null)}
              >
                Назад до тестів
              </button>

              <h2>{selectedTest.test?.title || selectedTest.title}</h2>

              {(selectedTest.questions || []).map(
                (question: AnyRecord, index: number) => (
                  <div className="panel" key={question.id}>
                    <h3>
                      {index + 1}. {question.question}
                    </h3>

                    {(question.answers || []).map(
                      (answer: AnyRecord) => {
                        const checked = (
                          selectedAnswers[question.id] || []
                        ).includes(answer.id);

                        return (
                          <label
                            key={answer.id}
                            className="member-row"
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleAnswer(question.id, answer.id)
                              }
                            />
                            <span>{answer.answer}</span>
                          </label>
                        );
                      }
                    )}
                  </div>
                )
              )}

              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={handleSubmitTest}
              >
                Завершити тест
              </button>
            </div>
          )}

          <div className="panel">
            <h2>Моя історія результатів</h2>

            {myResults.length === 0 ? (
              <p className="muted">Спроб тестування ще немає.</p>
            ) : (
              <div className="member-list">
                {myResults.map((item, index) => (
                  <div
                    className="member-row"
                    key={item.id || `${item.test_id}-${item.attempt_number}-${index}`}
                  >
                    <div>
                      <strong>
                        {item.test?.title || item.test_title || "Тест"}
                      </strong>
                      <p className="muted">
                        Спроба №{item.attempt_number} ·{" "}
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString("uk-UA")
                          : ""}
                      </p>
                    </div>
                    <div>
                      <strong>{getPercentage(item)}%</strong>
                      <p className="muted">{getStatus(item)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isStaff && (
        <>
          <div
            className="member-list"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => {
                setActiveTab("tests");
                clearNotices();
              }}
            >
              Тести
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setActiveTab("questions");
                clearNotices();
              }}
            >
              Питання
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setActiveTab("permissions");
                clearNotices();
              }}
            >
              Доступи
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setActiveTab("results");
                clearNotices();
              }}
            >
              Результати
            </button>
          </div>

          {activeTab === "tests" && (
            <>
              <h2>Створити тест</h2>

              <form action={handleCreateTest} className="panel">
                <label>
                  Назва тесту
                  <input
                    name="title"
                    required
                    maxLength={200}
                    placeholder="Назва тесту"
                  />
                </label>

                <label>
                  Опис
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Опис тесту"
                  />
                </label>

                <button className="btn" type="submit" disabled={busy}>
                  Створити тест
                </button>
              </form>

              <h2>Усі тести</h2>

              {tests.length === 0 ? (
                <p className="muted">Тестів поки немає.</p>
              ) : (
                <div className="member-list">
                  {tests.map((test) => (
                    <div className="member-row" key={test.id}>
                      <div>
                        <strong>{test.title}</strong>
                        <p className="muted">
                          {test.is_active ? "Активний" : "Неактивний"}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => handleToggleTest(test)}
                      >
                        {test.is_active ? "Деактивувати" : "Активувати"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "questions" && (
            <>
              <h2>Додати питання до тесту</h2>

              <div className="panel">
                <label>
                  Виберіть тест
                  <select
                    value={selectedTestId}
                    onChange={(event) =>
                      setSelectedTestId(event.target.value)
                    }
                    required
                  >
                    <option value="">Оберіть тест</option>
                    {tests.map((test) => (
                      <option key={test.id} value={test.id}>
                        {test.title}
                      </option>
                    ))}
                  </select>
                </label>

                <form
                  action={handleCreateQuestion}
                  className="panel"
                >
                  <label>
                    Текст питання
                    <textarea
                      value={questionText}
                      onChange={(event) =>
                        setQuestionText(event.target.value)
                      }
                      required
                      rows={3}
                      placeholder="Введіть питання"
                    />
                  </label>

                  <h3>Варіанти відповідей</h3>

                  {answerOptions.map((option, index) => (
                    <div className="member-row" key={index}>
                      <input
                        value={option.answer}
                        onChange={(event) => {
                          const updated = [...answerOptions];
                          updated[index] = {
                            ...updated[index],
                            answer: event.target.value,
                          };
                          setAnswerOptions(updated);
                        }}
                        placeholder={`Варіант ${index + 1}`}
                      />

                      <label>
                        <input
                          type="checkbox"
                          checked={option.is_correct}
                          onChange={(event) => {
                            const updated = [...answerOptions];
                            updated[index] = {
                              ...updated[index],
                              is_correct: event.target.checked,
                            };
                            setAnswerOptions(updated);
                          }}
                        />
                        Правильна
                      </label>
                    </div>
                  ))}

                  {answerOptions.length < 6 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setAnswerOptions([
                          ...answerOptions,
                          { answer: "", is_correct: false },
                        ])
                      }
                    >
                      Додати варіант
                    </button>
                  )}

                  {answerOptions.length > 2 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setAnswerOptions(answerOptions.slice(0, -1))
                      }
                    >
                      Видалити останній варіант
                    </button>
                  )}

                  <button
                    className="btn"
                    type="submit"
                    disabled={busy}
                  >
                    Додати питання
                  </button>
                </form>
              </div>
            </>
          )}

          {activeTab === "permissions" && (
            <>
              <h2>Надати учаснику доступ до тесту</h2>

              <form action={handleGrantPermission} className="panel">
                <label>
                  Тест
                  <select
                    value={permissionTestId}
                    onChange={(event) =>
                      setPermissionTestId(event.target.value)
                    }
                    required
                  >
                    <option value="">Оберіть тест</option>
                    {tests.map((test) => (
                      <option key={test.id} value={test.id}>
                        {test.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Учасник
                  <select
                    value={permissionUserId}
                    onChange={(event) =>
                      setPermissionUserId(event.target.value)
                    }
                    required
                  >
                    <option value="">Оберіть учасника</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nickname || "Без нікнейму"}
                        {member.game_id ? ` · ${member.game_id}` : ""}
                        {member.role ? ` · ${member.role}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button className="btn" type="submit" disabled={busy}>
                  Надати доступ
                </button>
              </form>
            </>
          )}

          {activeTab === "results" && (
            <>
              <h2>Результати учасників</h2>

              {results.length === 0 ? (
                <p className="muted">Результатів поки немає.</p>
              ) : (
                <div className="member-list">
                  {results.map((item, index) => (
                    <div
                      className="member-row"
                      key={item.id || index}
                    >
                      <div>
                        <strong>
                          {item.profile?.nickname ||
                            item.user?.nickname ||
                            item.nickname ||
                            "Учасник"}
                        </strong>
                        <p className="muted">
                          {item.profile?.game_id || item.game_id || ""}
                          {" · "}
                          {item.profile?.role || item.role || ""}
                        </p>
                        <p>
                          {item.test?.title ||
                            item.test_title ||
                            "Тест"}
                        </p>
                        <p className="muted">
                          Спроба №{item.attempt_number}
                          {" · "}
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString("uk-UA")
                            : ""}
                        </p>
                      </div>

                      <div>
                        <strong>{getPercentage(item)}%</strong>
                        <p className="muted">{getStatus(item)}</p>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => openResultDetails(item.id)}
                        >
                          Деталі
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resultDetails && (
                <div className="panel">
                  <h2>Деталі результату</h2>

                  {(() => {
                    const result = getDetailsResult(resultDetails);
                    const questions = getQuestions(resultDetails);

                    return (
                      <>
                        <p>
                          Учасник:{" "}
                          {result.profile?.nickname ||
                            result.nickname ||
                            "Учасник"}
                        </p>
                        <p>
                          Результат: {getPercentage(result)}%
                        </p>
                        <p>{getStatus(result)}</p>

                        {questions.map(
                          (question: AnyRecord, index: number) => (
                            <div className="panel" key={question.id || index}>
                              <h3>
                                {index + 1}. {question.question}
                              </h3>

                              <p className="muted">
                                {question.is_correct
                                  ? "Питання виконано правильно"
                                  : "Питання виконано неправильно"}
                              </p>

                              {(question.answers || []).map(
                                (answer: AnyRecord) => (
                                  <div
                                    className="member-row"
                                    key={answer.id}
                                  >
                                    <span>{answer.answer}</span>
                                    <span>
                                      {answer.is_selected && (
                                        <span className="tag">
                                          Обрав
                                        </span>
                                      )}
                                      {answer.is_correct && (
                                        <span className="tag">
                                          Правильна
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )
                        )}
                      </>
                    );
                  })()}

                  <button
                    type="button"
                    className="btn"
                    onClick={() => setResultDetails(null)}
                  >
                    Закрити деталі
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
