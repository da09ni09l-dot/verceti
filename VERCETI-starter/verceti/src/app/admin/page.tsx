
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createMember } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
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

  return (
    <main className="login-wrap">
      <section
        className="login-card"
        style={{ width: "100%", maxWidth: 560 }}
      >
        <div className="brand" style={{ padding: 0 }}>
          VERCETI
          <small>ADMINISTRATION</small>
        </div>

        <h1 style={{ fontSize: 27, marginTop: 28 }}>
          Панель адміністратора
        </h1>

        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          Створення облікових записів учасників спільноти.
        </p>

        {params.created === "1" && (
          <p style={{ color: "#8ee6a5", fontSize: 13 }}>
            Акаунт успішно створено!
          </p>
        )}

        <form action={createMember} style={{ marginTop: 24 }}>
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

        <p className="page-note">
          Доступ до цієї сторінки має лише адміністратор.
          Реєстрація для сторонніх закрита.
        </p>
      </section>
    </main>
  );
}
