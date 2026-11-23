
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const categoryLabels: Record<string, string> = {
  announcement: "Оголошення",
  event: "Подія",
  update: "Оновлення",
  important: "Важливе",
};

export default async function NewsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: news, error } = await supabase
    .from("news")
    .select(
      "id, title, content, category, is_pinned, show_from, show_until, created_at"
    )
    .order("created_at", { ascending: false });

  const now = Date.now();

  const visibleNews = (news ?? []).filter((item) => {
    const starts = !item.show_from || new Date(item.show_from).getTime() <= now;
    const ends = !item.show_until || new Date(item.show_until).getTime() > now;

    return starts && ends;
  });

  return (
    <main className="login-wrap">
      <section
        className="login-card"
        style={{ width: "100%", maxWidth: 760 }}
      >
        <div className="brand" style={{ padding: 0 }}>
          VERCETI
          <small>COMMUNITY NEWS</small>
        </div>

        <h1 style={{ fontSize: 27, marginTop: 28 }}>
          Новини спільноти
        </h1>

        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          Оголошення, важливі повідомлення та події VERCETI.
        </p>

        <div style={{ marginTop: 20 }}>
          <Link href="/" className="btn">
            ← На головну
          </Link>
        </div>

        {error ? (
          <div className="panel" style={{ marginTop: 24 }}>
            Не вдалося завантажити новини. Спробуй оновити сторінку.
          </div>
        ) : visibleNews.length === 0 ? (
          <div className="panel" style={{ marginTop: 24 }}>
            <h2>Поки немає новин</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Коли адміністрація опублікує новини, вони з'являться тут.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            {visibleNews.map((item) => (
              <article
                className="panel"
                key={item.id}
                style={{ marginBottom: 16 }}
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
                  <span className="tag">
                    {categoryLabels[item.category] ?? item.category}
                  </span>

                  {item.is_pinned && (
                    <span style={{ color: "#8ee6a5", fontSize: 12 }}>
                      📌 Закріплена новина
                    </span>
                  )}
                </div>

                <h2 style={{ marginTop: 16, fontSize: 20 }}>
                  {item.title}
                </h2>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.8,
                    marginTop: 12,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.content}
                </p>

                <p
                  className="muted"
                  style={{ fontSize: 11, marginTop: 18 }}
                >
                  Опубліковано:{" "}
                  {new Date(item.created_at).toLocaleString("uk-UA")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
