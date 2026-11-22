export async function getAvailableTests() {
  const { user } = await getCurrentUser();
  const admin = createAdminClient();

  console.log("GET AVAILABLE TESTS — USER:", user.id);

  const { data: permissions, error: permissionError } =
    await admin
      .from("test_permissions")
      .select("test_id, user_id")
      .eq("user_id", user.id);

  if (permissionError) {
    console.error(
      "GET AVAILABLE TESTS — PERMISSIONS ERROR:",
      permissionError
    );

    throw new Error("Не вдалося отримати призначені тести");
  }

  console.log(
    "GET AVAILABLE TESTS — PERMISSIONS:",
    permissions
  );

  const testIds = (permissions || []).map(
    (item) => item.test_id
  );

  if (testIds.length === 0) {
    console.log("GET AVAILABLE TESTS — NO ASSIGNED TESTS");
    return [];
  }

  const { data: tests, error: testsError } = await admin
    .from("tests")
    .select("id, title, description, is_active")
    .in("id", testIds);

  if (testsError) {
    console.error(
      "GET AVAILABLE TESTS — TESTS ERROR:",
      testsError
    );

    throw new Error("Не вдалося завантажити тести");
  }

  console.log("GET AVAILABLE TESTS — FOUND TESTS:", tests);

  const availableTests = (tests || [])
    .filter((test) => test.is_active === true)
    .map((test) => ({
      id: test.id,
      title: test.title,
      description: test.description,
    }));

  console.log(
    "GET AVAILABLE TESTS — RETURNING:",
    availableTests
  );

  return availableTests;
}
