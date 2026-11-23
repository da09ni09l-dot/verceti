
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PASS_PERCENTAGE = 80;

async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Потрібно увійти в акаунт.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_banned) {
    throw new Error("Обліковий запис не має доступу до тестування.");
  }

  return { user, supabase };
}

async function checkStaff() {
  const { supabase } = await getCurrentUser();

  const { data, error } = await supabase.rpc("is_verceti_staff");

  if (error || data !== true) {
    throw new Error("Недостатньо прав доступу.");
  }
}

function validateId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new Error("Некоректний ідентифікатор.");
  }
}

function calculatePercentage(score: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}

// =====================================================
// ОТРИМАННЯ ВСІХ ТЕСТІВ ДЛЯ АДМІНІСТРАЦІЇ
// =====================================================

export async function getAllTests() {
  await checkStaff();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET ALL TESTS:", error);
    throw new Error("Не вдалося завантажити тести.");
  }

  return data || [];
}

// =====================================================
// ОТРИМАННЯ УЧАСНИКІВ
// =====================================================

export async function getTestMembers() {
  await checkStaff();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, nickname, game_id, role")
    .order("nickname", { ascending: true });

  if (error) {
    console.error("GET TEST MEMBERS:", error);
    throw new Error("Не вдалося завантажити учасників.");
  }

  return data || [];
}

// =====================================================
// СТВОРЕННЯ ТЕСТУ
// =====================================================

export async function createTest(formData: FormData) {
  const { user } = await getCurrentUser();
  await checkStaff();

  const title = String(formData.get("title") || "").trim();
  const description =
    String(formData.get("description") || "").trim() || null;

  if (!title) {
    throw new Error("Введіть назву тесту.");
  }

  if (title.length > 200) {
    throw new Error("Назва тесту задовга.");
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tests")
    .insert({
      title,
      description,
      created_by: user.id,
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    console.error("CREATE TEST:", error);
    throw new Error("Не вдалося створити тест.");
  }

  return data;
}

// =====================================================
// ДОДАВАННЯ ПИТАННЯ ТА ВАРІАНТІВ ВІДПОВІДІ
// =====================================================

export async function createTestQuestion(formData: FormData) {
  await checkStaff();

  const testId = String(formData.get("test_id") || "");
  const questionText = String(formData.get("question") || "").trim();
  const answersRaw = String(formData.get("answers") || "");

  validateId(testId);

  if (!questionText) {
    throw new Error("Введіть текст питання.");
  }

  let answers: { answer: string; is_correct: boolean }[];

  try {
    answers = JSON.parse(answersRaw);
  } catch {
    throw new Error("Некоректні варіанти відповідей.");
  }

  if (!Array.isArray(answers) || answers.length < 2 || answers.length > 6) {
    throw new Error("Потрібно додати від 2 до 6 варіантів.");
  }

  answers = answers.map((item) => ({
    answer: String(item.answer || "").trim(),
    is_correct: item.is_correct === true,
  }));

  if (answers.some((item) => !item.answer)) {
    throw new Error("Усі варіанти відповідей повинні бути заповнені.");
  }

  const correctCount = answers.filter((item) => item.is_correct).length;

  if (correctCount < 1 || correctCount > 2) {
    throw new Error("Позначте один або два правильні варіанти.");
  }

  const admin = createAdminClient();

  const { data: test, error: testError } = await admin
    .from("tests")
    .select("id")
    .eq("id", testId)
    .maybeSingle();

  if (testError || !test) {
    throw new Error("Тест не знайдено.");
  }

  const { data: existingQuestions, error: questionsError } = await admin
    .from("test_questions")
    .select("id")
    .eq("test_id", testId);

  if (questionsError) {
    throw new Error("Не вдалося перевірити питання тесту.");
  }

  const position = existingQuestions?.length || 0;

  const { data: question, error: questionError } = await admin
    .from("test_questions")
    .insert({
      test_id: testId,
      question: questionText,
      position,
    })
    .select()
    .single();

  if (questionError || !question) {
    console.error("CREATE QUESTION:", questionError);
    throw new Error("Не вдалося створити питання.");
  }

  const answerRows = answers.map((item, index) => ({
    question_id: question.id,
    answer: item.answer,
    is_correct: item.is_correct,
    position: index,
  }));

  const { error: answersError } = await admin
    .from("test_answers")
    .insert(answerRows);

  if (answersError) {
    console.error("CREATE ANSWERS:", answersError);

    await admin
      .from("test_questions")
      .delete()
      .eq("id", question.id);

    throw new Error("Не вдалося зберегти варіанти відповідей.");
  }

  return question;
}

// =====================================================
// НАДАННЯ ДОСТУПУ ДО ТЕСТУ
// =====================================================

export async function grantTestPermission(formData: FormData) {
  const { user } = await getCurrentUser();
  await checkStaff();

  const testId = String(formData.get("test_id") || "");
  const userId = String(formData.get("user_id") || "");

  validateId(testId);
  validateId(userId);

  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("test_permissions")
    .select("id")
    .eq("test_id", testId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error("Не вдалося перевірити доступ.");
  }

  if (existing) {
    throw new Error("Цей учасник уже має доступ до тесту.");
  }

  const { error } = await admin.from("test_permissions").insert({
    test_id: testId,
    user_id: userId,
    granted_by: user.id,
  });

  if (error) {
    console.error("GRANT TEST PERMISSION:", error);
    throw new Error("Не вдалося надати доступ.");
  }

  return { success: true };
}

// =====================================================
// АКТИВАЦІЯ / ДЕАКТИВАЦІЯ ТЕСТУ
// =====================================================

export async function updateTestStatus(
  testId: string,
  isActive: boolean
) {
  await checkStaff();
  validateId(testId);

  const admin = createAdminClient();

  const { error } = await admin
    .from("tests")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", testId);

  if (error) {
    console.error("UPDATE TEST STATUS:", error);
    throw new Error("Не вдалося змінити статус тесту.");
  }

  return { success: true };
}

// =====================================================
// ВИДАЛЕННЯ ТЕСТУ
// =====================================================

export async function deleteTest(testId: string) {
  await checkStaff();
  validateId(testId);

  const admin = createAdminClient();

  const { data: results, error: resultsError } = await admin
    .from("test_results")
    .select("id")
    .eq("test_id", testId)
    .limit(1);

  if (resultsError) {
    throw new Error("Не вдалося перевірити результати тесту.");
  }

  if (results && results.length > 0) {
    throw new Error(
      "Не можна видалити тест, для якого вже є результати проходження."
    );
  }

  const { error } = await admin
    .from("tests")
    .delete()
    .eq("id", testId);

  if (error) {
    console.error("DELETE TEST:", error);
    throw new Error("Не вдалося видалити тест.");
  }

  return { success: true };
}

// =====================================================
// ОТРИМАННЯ ДОСТУПНИХ ТЕСТІВ ДЛЯ УЧАСНИКА
// =====================================================

export async function getAvailableTests() {
  const { user } = await getCurrentUser();
  const admin = createAdminClient();

  const { data: permissions, error: permissionError } = await admin
    .from("test_permissions")
    .select("test_id")
    .eq("user_id", user.id);

  if (permissionError) {
    console.error("GET AVAILABLE TESTS:", permissionError);
    throw new Error("Не вдалося отримати призначені тести.");
  }

  const testIds = (permissions || []).map((item) => item.test_id);

  if (testIds.length === 0) {
    return [];
  }

  const { data: tests, error } = await admin
    .from("tests")
    .select("id, title, description, is_active")
    .in("id", testIds)
    .eq("is_active", true);

  if (error) {
    console.error("GET AVAILABLE TESTS:", error);
    throw new Error("Не вдалося завантажити тести.");
  }

  return tests || [];
}

// =====================================================
// ОТРИМАННЯ ТЕСТУ ДЛЯ ПРОХОДЖЕННЯ
// =====================================================

export async function getTestForMember(testId: string) {
  const { user } = await getCurrentUser();
  validateId(testId);

  const admin = createAdminClient();

  const { data: permission, error: permissionError } = await admin
    .from("test_permissions")
    .select("id")
    .eq("test_id", testId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (permissionError || !permission) {
    throw new Error("У вас немає доступу до цього тесту.");
  }

  const { data: test, error: testError } = await admin
    .from("tests")
    .select("id, title, description, is_active")
    .eq("id", testId)
    .eq("is_active", true)
    .maybeSingle();

  if (testError || !test) {
    throw new Error("Тест недоступний.");
  }

  const { data: questions, error: questionsError } = await admin
    .from("test_questions")
    .select("id, test_id, question, position")
    .eq("test_id", testId)
    .order("position", { ascending: true });

  if (questionsError) {
    throw new Error("Не вдалося завантажити питання.");
  }

  const questionIds = (questions || []).map((item) => item.id);

  let answers: {
    id: string;
    question_id: string;
    answer: string;
    position: number;
  }[] = [];

  if (questionIds.length > 0) {
    const { data, error } = await admin
      .from("test_answers")
      .select("id, question_id, answer, position")
      .in("question_id", questionIds)
      .order("position", { ascending: true });

    if (error) {
      throw new Error("Не вдалося завантажити відповіді.");
    }

    answers = data || [];
  }

  return {
    test,
    questions: (questions || []).map((question) => ({
      ...question,
      answers: answers.filter(
        (answer) => answer.question_id === question.id
      ),
    })),
  };
}

// =====================================================
// НАДСИЛАННЯ ВІДПОВІДЕЙ ТА ПІДРАХУНОК РЕЗУЛЬТАТУ
// =====================================================

export async function submitTestAnswers(
  testId: string,
  submittedAnswers: {
    question_id: string;
    answer_ids: string[];
  }[]
) {
  const { user } = await getCurrentUser();
  validateId(testId);

  if (!Array.isArray(submittedAnswers)) {
    throw new Error("Некоректні відповіді.");
  }

  const admin = createAdminClient();

  const { data: permission } = await admin
    .from("test_permissions")
    .select("id")
    .eq("test_id", testId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!permission) {
    throw new Error("У вас немає доступу до цього тесту.");
  }

  const { data: test } = await admin
    .from("tests")
    .select("id")
    .eq("id", testId)
    .eq("is_active", true)
    .maybeSingle();

  if (!test) {
    throw new Error("Тест більше не доступний.");
  }

  const { data: questions, error: questionsError } = await admin
    .from("test_questions")
    .select("id")
    .eq("test_id", testId);

  if (questionsError || !questions || questions.length === 0) {
    throw new Error("У тесті немає питань.");
  }

  const questionIds = questions.map((item) => item.id);

  if (
    submittedAnswers.length !== questionIds.length ||
    submittedAnswers.some(
      (item) => !questionIds.includes(item.question_id)
    )
  ) {
    throw new Error("Потрібно відповісти на кожне питання.");
  }

  const { data: correctAnswers, error: answersError } = await admin
    .from("test_answers")
    .select("id, question_id, is_correct")
    .in("question_id", questionIds);

  if (answersError || !correctAnswers) {
    throw new Error("Не вдалося перевірити відповіді.");
  }

  let score = 0;

  const savedAnswers = questions.map((question) => {
    const submitted = submittedAnswers.find(
      (item) => item.question_id === question.id
    );

    const selectedIds = Array.isArray(submitted?.answer_ids)
      ? submitted.answer_ids
      : [];

    if (
      selectedIds.length === 0 ||
      selectedIds.length > 2 ||
      new Set(selectedIds).size !== selectedIds.length
    ) {
      throw new Error("Некоректний вибір відповіді.");
    }

    const questionAnswers = correctAnswers.filter(
      (answer) => answer.question_id === question.id
    );

    const validIds = questionAnswers.map((answer) => answer.id);

    if (selectedIds.some((id) => !validIds.includes(id))) {
      throw new Error("Виявлено недійсну відповідь.");
    }

    const correctIds = questionAnswers
      .filter((answer) => answer.is_correct)
      .map((answer) => answer.id)
      .sort();

    const selectedSorted = [...selectedIds].sort();

    const isCorrect =
      correctIds.length === selectedSorted.length &&
      correctIds.every((id, index) => id === selectedSorted[index]);

    if (isCorrect) {
      score++;
    }

    return {
      question_id: question.id,
      answer_ids: selectedSorted,
    };
  });

  const totalQuestions = questions.length;
  const percentage = calculatePercentage(score, totalQuestions);
  const passed = percentage >= PASS_PERCENTAGE;

  const { data: previousResults, error: previousError } = await admin
    .from("test_results")
    .select("attempt_number")
    .eq("test_id", testId)
    .eq("user_id", user.id)
    .order("attempt_number", { ascending: false })
    .limit(1);

  if (previousError) {
    throw new Error("Не вдалося перевірити попередні спроби.");
  }

  const attemptNumber =
    (previousResults?.[0]?.attempt_number || 0) + 1;

  const { data: result, error: resultError } = await admin
    .from("test_results")
    .insert({
      test_id: testId,
      user_id: user.id,
      score,
      total_questions: totalQuestions,
      passed,
      answers: savedAnswers,
      attempt_number: attemptNumber,
    })
    .select()
    .single();

  if (resultError || !result) {
    console.error("SUBMIT TEST RESULT:", resultError);
    throw new Error("Не вдалося зберегти результат тесту.");
  }

  return {
    ...result,
    percentage,
    attempt_number: attemptNumber,
  };
}

// =====================================================
// ОТРИМАННЯ ВСІХ РЕЗУЛЬТАТІВ ДЛЯ АДМІНІСТРАЦІЇ
// =====================================================

export async function getAllTestResults() {
  await checkStaff();

  const admin = createAdminClient();

  const { data: results, error } = await admin
    .from("test_results")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET ALL TEST RESULTS:", error);
    throw new Error("Не вдалося завантажити результати.");
  }

  if (!results || results.length === 0) {
    return [];
  }

  const testIds = [...new Set(results.map((item) => item.test_id))];
  const userIds = [...new Set(results.map((item) => item.user_id))];

  const [{ data: tests }, { data: profiles }] = await Promise.all([
    admin.from("tests").select("id, title").in("id", testIds),
    admin
      .from("profiles")
      .select("id, nickname, game_id, role")
      .in("id", userIds),
  ]);

  return results.map((result) => {
    const percentage = calculatePercentage(
      result.score,
      result.total_questions
    );

    return {
      ...result,
      percentage,
      test: tests?.find((item) => item.id === result.test_id) || null,
      profile:
        profiles?.find((item) => item.id === result.user_id) || null,
    };
  });
}

// =====================================================
// ІСТОРІЯ РЕЗУЛЬТАТІВ УЧАСНИКА
// =====================================================

export async function getMyTestResults() {
  const { user } = await getCurrentUser();

  const admin = createAdminClient();

  const { data: results, error } = await admin
    .from("test_results")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET MY TEST RESULTS:", error);
    throw new Error("Не вдалося завантажити історію тестування.");
  }

  if (!results || results.length === 0) {
    return [];
  }

  const testIds = [...new Set(results.map((item) => item.test_id))];

  const { data: tests } = await admin
    .from("tests")
    .select("id, title")
    .in("id", testIds);

  return results.map((result) => ({
    ...result,
    percentage: calculatePercentage(
      result.score,
      result.total_questions
    ),
    test: tests?.find((item) => item.id === result.test_id) || null,
  }));
}

// =====================================================
// ДЕТАЛІ РЕЗУЛЬТАТУ ДЛЯ АДМІНІСТРАЦІЇ
// =====================================================

export async function getTestResultDetails(resultId: string) {
  await checkStaff();
  validateId(resultId);

  const admin = createAdminClient();

  const { data: result, error: resultError } = await admin
    .from("test_results")
    .select("*")
    .eq("id", resultId)
    .maybeSingle();

  if (resultError || !result) {
    throw new Error("Результат не знайдено.");
  }

  const [{ data: profile }, { data: test }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, nickname, game_id, role")
      .eq("id", result.user_id)
      .maybeSingle(),

    admin
      .from("tests")
      .select("id, title")
      .eq("id", result.test_id)
      .maybeSingle(),
  ]);

  const { data: questions, error: questionsError } = await admin
    .from("test_questions")
    .select("id, question, position")
    .eq("test_id", result.test_id)
    .order("position", { ascending: true });

  if (questionsError) {
    throw new Error("Не вдалося завантажити питання.");
  }

  const questionIds = (questions || []).map((item) => item.id);

  let allAnswers: {
    id: string;
    question_id: string;
    answer: string;
    is_correct: boolean;
    position: number;
  }[] = [];

  if (questionIds.length > 0) {
    const { data, error } = await admin
      .from("test_answers")
      .select("id, question_id, answer, is_correct, position")
      .in("question_id", questionIds)
      .order("position", { ascending: true });

    if (error) {
      throw new Error("Не вдалося завантажити варіанти відповідей.");
    }

    allAnswers = data || [];
  }

  const savedAnswers = Array.isArray(result.answers)
    ? result.answers
    : [];

  const detailedQuestions = (questions || []).map((question) => {
    const saved = savedAnswers.find(
      (item: { question_id: string }) =>
        item.question_id === question.id
    );

    const selectedIds: string[] = saved?.answer_ids || [];

    const questionAnswers = allAnswers.filter(
      (answer) => answer.question_id === question.id
    );

    const correctIds = questionAnswers
      .filter((answer) => answer.is_correct)
      .map((answer) => answer.id)
      .sort();

    const selectedSorted = [...selectedIds].sort();

    const isCorrect =
      correctIds.length === selectedSorted.length &&
      correctIds.every((id, index) => id === selectedSorted[index]);

    return {
      ...question,
      is_correct: isCorrect,
      answers: questionAnswers.map((answer) => ({
        ...answer,
        is_selected: selectedIds.includes(answer.id),
      })),
    };
  });

  return {
    result: {
      ...result,
      percentage: calculatePercentage(
        result.score,
        result.total_questions
      ),
      profile,
      test,
    },
    questions: detailedQuestions,
  };
}
