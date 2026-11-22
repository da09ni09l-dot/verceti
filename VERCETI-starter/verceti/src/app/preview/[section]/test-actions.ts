// Отримання тестів, до яких учаснику надано доступ
export async function getAvailableTests() {
  const { user } = await getCurrentUser();
  const admin = createAdminClient();

  // Отримуємо всі призначення поточного користувача
  const { data: permissions, error: permissionError } =
    await admin
      .from("test_permissions")
      .select("test_id")
      .eq("user_id", user.id);

  if (permissionError) {
    console.error("GET AVAILABLE TESTS — PERMISSIONS ERROR:", {
      code: permissionError.code,
      message: permissionError.message,
      details: permissionError.details,
    });

    throw new Error("Не вдалося отримати призначені тести");
  }

  const testIds = (permissions || []).map(
    (item) => item.test_id
  );

  if (testIds.length === 0) {
    return [];
  }

  // Отримуємо призначені тести
  const { data: tests, error: testsError } = await admin
    .from("tests")
    .select("id, title, description, is_active")
    .in("id", testIds);

  if (testsError) {
    console.error("GET AVAILABLE TESTS — TESTS ERROR:", {
      code: testsError.code,
      message: testsError.message,
      details: testsError.details,
    });

    throw new Error("Не вдалося завантажити тести");
  }

  // Показуємо учаснику тільки активні тести
  return (tests || [])
    .filter((test) => test.is_active === true)
    .map((test) => ({
      id: test.id,
      title: test.title,
      description: test.description,
    }));
}
