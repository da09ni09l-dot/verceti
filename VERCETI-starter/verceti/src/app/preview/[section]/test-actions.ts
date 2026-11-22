
"use server";

import {
  createClient,
  createAdminClient,
} from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type TestAnswer = {
  answer: string;
  is_correct: boolean;
};

type SubmittedAnswer = {
  question_id: string;
  answer_ids: string[];
};

async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function checkStaff() {
  const { supabase, user } = await getCurrentUser();

  const { data: isStaff, error } = await supabase.rpc(
    "is_verceti_staff"
  );

  if (error || isStaff !== true) {
    throw new Error("Недостатньо прав для цієї дії");
  }

  return { supabase, user };
}

// Створення тесту
export async function createTest(formData: FormData) {
  const { supabase, user } = await checkStaff();

  const title = String(formData.get("title") || "").trim();
  const description = String(
    formData.get("description") || ""
  ).trim();

  if (!title) {
    throw new Error("Вкажіть назву тесту");
  }

  const { error } = await supabase.from("tests").insert({
    title,
    description: description || null,
    created_by: user.id,
    is_active: false,
  });

  if (error) {
    console.error("CREATE TEST SUPABASE ERROR:", error);
    throw new Error(`Не вдалося створити тест: ${error.message}`);
  }

  revalidatePath("/preview/tests");
}

// Отримання всіх тестів для Staff
export async function getAllTests() {
  const { supabase } = await checkStaff();

  const { data, error } = await supabase
    .from("tests")
    .select("id, title, description, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Не вдалося отримати список тестів");
  }

  return data || [];
}

// Додавання запитання та відповідей
export async function createTestQuestion(formData: FormData) {
  const { supabase } = await checkStaff();

  const testId = String(formData.get("test_id") || "");
  const question = String(
    formData.get("question") || ""
  ).trim();

  const answersRaw = String(
    formData.get("answers") || ""
  );

  if (!testId || !question) {
    throw new Error("Заповніть запитання");
  }

  let answers: TestAnswer[];

  try {
    answers = JSON.parse(answersRaw);
  } catch {
    throw new Error("Некоректний формат відповідей");
  }

  if (
    !Array.isArray(answers) ||
    answers.length < 2 ||
    answers.some(
      (item) =>
        typeof item.answer !== "string" ||
        !item.answer.trim() ||
        typeof item.is_correct !== "boolean"
    )
  ) {
    throw new Error("Додайте щонайменше дві коректні відповіді");
  }

  const correctCount = answers.filter(
    (item) => item.is_correct
  ).length;

  if (correctCount !== 1 && correctCount !== 2) {
    throw new Error(
      "Потрібно визначити одну або дві правильні відповіді"
    );
  }

  const { data: existingQuestions, error: countError } =
    await supabase
      .from("test_questions")
      .select("id")
      .eq("test_id", testId);

  if (countError || !existingQuestions) {
    throw new Error("Не вдалося перевірити тест");
  }

  const { data: questionData, error: questionError } =
    await supabase
      .from("test_questions")
      .insert({
        test_id: testId,
        question,
        position: existingQuestions.length,
      })
      .select("id")
      .single();

  if (questionError || !questionData) {
    throw new Error("Не вдалося додати запитання");
  }

  const { error: answersError } = await supabase
    .from("test_answers")
    .insert(
      answers.map((item, index) => ({
        question_id: questionData.id,
        answer: item.answer.trim(),
        is_correct: item.is_correct,
        position: index,
      }))
    );

  if (answersError) {
    throw new Error("Не вдалося додати відповіді");
  }

  revalidatePath("/preview/tests");
}

// Отримання учасників для Staff
export async function getTestMembers() {
  const { supabase } = await checkStaff();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, game_id, role")
    .order("nickname", { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error("Не вдалося отримати список учасників");
  }

  return (data || []).filter((item) => item.nickname);
}

// Надання учаснику доступу до тесту
export async function grantTestPermission(formData: FormData) {
  const { supabase, user } = await checkStaff();

  const testId = String(formData.get("test_id") || "");
  const userId = String(formData.get("user_id") || "");

  if (!testId || !userId) {
    throw new Error("Не вибрано тест або учасника");
  }

  const { error } = await supabase
    .from("test_permissions")
    .upsert(
      {
        test_id: testId,
        user_id: userId,
        granted_by: user.id,
      },
      {
        onConflict: "test_id,user_id",
      }
    );

  if (error) {
    throw new Error("Не вдалося надати доступ");
  }

  revalidatePath("/preview/tests");
}

// Активація або деактивація тесту
export async function updateTestStatus(
  testId: string,
  isActive: boolean
) {
  const { supabase } = await checkStaff();

  if (!testId || typeof isActive !== "boolean") {
    throw new Error("Некоректні дані");
  }

  const { error } = await supabase
    .from("tests")
    .update({ is_active: isActive })
    .eq("id", testId);

  if (error) {
    throw new Error("Не вдалося змінити статус тесту");
  }

  revalidatePath("/preview/tests");
}

// Отримання тестів, до яких учаснику надано доступ
export async function getAvailableTests() {
  const { user } = await getCurrentUser();
  const admin = createAdminClient();

  const { data: permissions, error: permissionError } =
    await admin
      .from("test_permissions")
      .select("test_id")
      .eq("user_id", user.id);

  if (permissionError || !permissions) {
    throw new Error("Не вдалося отримати доступні тести");
  }

  const testIds = permissions.map((item) => item.test_id);

  if (testIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("tests")
    .select("id, title, description")
    .in("id", testIds)
    .eq("is_active", true);

  if (error) {
    throw new Error("Не вдалося завантажити тести");
  }

  return data || [];
}

// Отримання запитань тесту без правильних відповідей
export async function getTestForMember(testId: string) {
  const { user } = await getCurrentUser();
  const admin = createAdminClient();

  if (!testId) {
    throw new Error("Не вказано тест");
  }

  const { data: permission, error: permissionError } =
    await admin
      .from("test_permissions")
      .select("id")
      .eq("test_id", testId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (permissionError || !permission) {
    throw new Error("У вас немає доступу до цього тесту");
  }

  const { data: test, error: testError } = await admin
    .from("tests")
    .select("id, title, description")
    .eq("id", testId)
    .eq("is_active", true)
    .maybeSingle();

  if (testError || !test) {
    throw new Error("Тест недоступний");
  }

  const { data: questions, error: questionsError } =
    await admin
      .from("test_questions")
      .select("id, question, position")
      .eq("test_id", testId)
      .order("position");

  if (questionsError) {
    throw new Error("Не вдалося завантажити запитання");
  }

  const questionIds = (questions || []).map(
    (item) => item.id
  );

  if (questionIds.length === 0) {
    return { ...test, questions: [] };
  }

  const { data: answers, error: answersError } = await admin
    .from("test_answers")
    .select("id, question_id, answer, position")
    .in("question_id", questionIds)
    .order("position");

  if (answersError) {
    throw new Error("Не вдалося завантажити відповіді");
  }

  return {
    ...test,
    questions: (questions || []).map((question) => ({
      ...question,
      answers: (answers || [])
        .filter((answer) => answer.question_id === question.id)
        .map((answer) => ({
          id: answer.id,
          answer: answer.answer,
        })),
    })),
  };
}

// Надсилання та перевірка відповідей
export async function submitTestAnswers(
  testId: string,
  submittedAnswers: SubmittedAnswer[]
) {
  const { user } = await getCurrentUser();
  const admin = createAdminClient();

  if (!testId || !Array.isArray(submittedAnswers)) {
    throw new Error("Некоректні дані тесту");
  }

  const { data: permission, error: permissionError } =
    await admin
      .from("test_permissions")
      .select("id")
      .eq("test_id", testId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (permissionError || !permission) {
    throw new Error("У вас немає доступу до цього тесту");
  }

  const { data: test } = await admin
    .from("tests")
    .select("id")
    .eq("id", testId)
    .eq("is_active", true)
    .maybeSingle();

  if (!test) {
    throw new Error("Тест недоступний");
  }

  const { data: questions, error: questionsError } =
    await admin
      .from("test_questions")
      .select("id")
      .eq("test_id", testId);

  if (questionsError || !questions || questions.length === 0) {
    throw new Error("У тесті немає запитань");
  }

  const questionIds = questions.map((item) => item.id);

  if (
    submittedAnswers.length !== questionIds.length ||
    submittedAnswers.some(
      (item) =>
        !questionIds.includes(item.question_id) ||
        !Array.isArray(item.answer_ids) ||
        item.answer_ids.length < 1 ||
        item.answer_ids.length > 2 ||
        new Set(item.answer_ids).size !== item.answer_ids.length
    ) ||
    new Set(submittedAnswers.map((item) => item.question_id)).size !==
      questionIds.length
  ) {
    throw new Error("Надано некоректні відповіді");
  }

  const { data: correctAnswers, error: answersError } =
    await admin
      .from("test_answers")
      .select("id, question_id, is_correct")
      .in("question_id", questionIds);

  if (answersError || !correctAnswers) {
    throw new Error("Не вдалося перевірити відповіді");
  }

  const answersByQuestion = new Map(
    questionIds.map((questionId) => [
      questionId,
      new Set(
        correctAnswers
          .filter((item) => item.question_id === questionId)
          .map((item) => item.id)
      ),
    ])
  );

  if (
    submittedAnswers.some((item) => {
      const validIds = answersByQuestion.get(item.question_id);

      return item.answer_ids.some(
        (id) => !validIds?.has(id)
      );
    })
  ) {
    throw new Error("Виявлено некоректний варіант відповіді");
  }

  let score = 0;

  for (const questionId of questionIds) {
    const selected = submittedAnswers
      .find((item) => item.question_id === questionId)!
      .answer_ids
      .slice()
      .sort();

    const correct = correctAnswers
      .filter(
        (item) =>
          item.question_id === questionId && item.is_correct
      )
      .map((item) => item.id)
      .sort();

    if (
      correct.length > 0 &&
      selected.length === correct.length &&
      selected.every((id, index) => id === correct[index])
    ) {
      score++;
    }
  }

  const { data: previousResults, error: historyError } =
    await admin
      .from("test_results")
      .select("attempt_number")
      .eq("test_id", testId)
      .eq("user_id", user.id)
      .order("attempt_number", { ascending: false })
      .limit(1);

  if (historyError) {
    throw new Error("Не вдалося перевірити історію спроб");
  }

  const attemptNumber =
    (previousResults?.[0]?.attempt_number || 0) + 1;

  const totalQuestions = questionIds.length;
  const percentage = Math.round(
    (score / totalQuestions) * 100
  );
  const passed = score === totalQuestions;

  const { data: result, error: insertError } = await admin
    .from("test_results")
    .insert({
      test_id: testId,
      user_id: user.id,
      score,
      total_questions: totalQuestions,
      passed,
      answers: submittedAnswers,
      attempt_number: attemptNumber,
    })
    .select("attempt_number, created_at")
    .single();

  if (insertError || !result) {
    console.error("SAVE TEST RESULT ERROR:", {
      code: insertError?.code,
      message: insertError?.message,
      details: insertError?.details,
      hint: insertError?.hint,
    });

    throw new Error(
      `Не вдалося зберегти результат: ${
        insertError?.message ||
        "Результат не повернувся після збереження"
      }`
    );
  }

  revalidatePath("/preview/tests");

  return {
    percentage,
    passed,
    attempt_number: result.attempt_number,
    created_at: result.created_at,
  };
}

// Отримання всіх результатів для Staff
export async function getAllTestResults() {
  // Спочатку перевіряємо користувача та його роль Staff
  await checkStaff();

  // Адміністративний клієнт використовується тільки після перевірки Staff
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("test_results")
    .select(`
      id,
      test_id,
      user_id,
      score,
      total_questions,
      passed,
      attempt_number,
      created_at,
      profiles:user_id (
        nickname,
        game_id,
        role
      ),
      tests:test_id (
        title
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET ALL TEST RESULTS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    throw new Error(
      `Не вдалося отримати результати тестів: ${error.message}`
    );
  }

  return data || [];
}

// Детальний перегляд відповідей конкретної спроби — тільки Staff
export async function getTestResultDetails(resultId: string) {
  const { supabase } = await checkStaff();
  const admin = createAdminClient();

  if (!resultId) {
    throw new Error("Не вказано результат тесту");
  }

  const { data: result, error: resultError } = await admin
    .from("test_results")
    .select(`
      id,
      test_id,
      user_id,
      score,
      total_questions,
      passed,
      answers,
      attempt_number,
      created_at
    `)
    .eq("id", resultId)
    .maybeSingle();

  if (resultError || !result) {
    throw new Error("Не вдалося знайти результат тесту");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nickname, game_id, role")
    .eq("id", result.user_id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Не вдалося отримати профіль учасника");
  }

  const { data: test, error: testError } = await admin
    .from("tests")
    .select("title")
    .eq("id", result.test_id)
    .maybeSingle();

  if (testError || !test) {
    throw new Error("Не вдалося отримати назву тесту");
  }

  const { data: questions, error: questionsError } =
    await admin
      .from("test_questions")
      .select("id, question, position")
      .eq("test_id", result.test_id)
      .order("position");

  if (questionsError || !questions) {
    throw new Error("Не вдалося отримати запитання");
  }

  const questionIds = questions.map((item) => item.id);

  const { data: answers, error: answersError } = questionIds.length
    ? await admin
        .from("test_answers")
        .select("id, question_id, answer, is_correct, position")
        .in("question_id", questionIds)
        .order("position")
    : { data: [], error: null };

  if (answersError || !answers) {
    throw new Error("Не вдалося отримати варіанти відповідей");
  }

  const submittedAnswers = Array.isArray(result.answers)
    ? result.answers as SubmittedAnswer[]
    : [];

  const details = questions.map((question) => {
    const selectedIds =
      submittedAnswers.find(
        (item) => item.question_id === question.id
      )?.answer_ids || [];

    const questionAnswers = answers
      .filter((item) => item.question_id === question.id)
      .map((answer) => ({
        id: answer.id,
        answer: answer.answer,
        is_correct: answer.is_correct,
        is_selected: selectedIds.includes(answer.id),
      }));

    const selected = questionAnswers
      .filter((item) => item.is_selected)
      .map((item) => item.id)
      .sort();

    const correct = questionAnswers
      .filter((item) => item.is_correct)
      .map((item) => item.id)
      .sort();

    const isCorrect =
      selected.length === correct.length &&
      selected.every((id, index) => id === correct[index]);

    return {
      id: question.id,
      question: question.question,
      position: question.position,
      is_correct: isCorrect,
      answers: questionAnswers,
    };
  });

  return {
    id: result.id,
    test_id: result.test_id,
    test_title: test.title,
    user_id: result.user_id,
    nickname: profile?.nickname ?? "Невідомий учасник",
    game_id: profile?.game_id ?? null,
    role: profile?.role ?? null,
    score: result.score,
    total_questions: result.total_questions,
    percentage: Math.round(
      (result.score / Math.max(result.total_questions, 1)) * 100
    ),
    passed: result.passed,
    attempt_number: result.attempt_number,
    created_at: result.created_at,
    questions: details,
  };
}

// Отримання власної історії — без деталізації відповідей
export async function getMyTestResults() {
  const { supabase, user } = await getCurrentUser();

  const { data, error } = await supabase
    .from("test_results")
    .select(`
      id,
      score,
      total_questions,
      passed,
      attempt_number,
      created_at,
      tests:test_id (
        title
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Не вдалося отримати історію результатів");
  }

  return (data || []).map((item) => ({
    id: item.id,
    percentage: Math.round(
      (item.score / Math.max(item.total_questions, 1)) * 100
    ),
    passed: item.passed,
    attempt_number: item.attempt_number,
    created_at: item.created_at,
    tests: item.tests,
  }));
}
