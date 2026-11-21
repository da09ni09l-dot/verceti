
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createNews } from "./actions";

const descriptions: Record<string, { title: string; text: string; items: string[] }> = {
  members: { title: "Учасники", text: "Список учасників, ролі та профілі.", items: ["Пошук за нікнеймом та ігровим ID", "Кольорові позначки ролей", "Історія зміни ролей"] },
  chat: { title: "Чат", text: "Місце для загального та приватного спілкування.", items: ["Загальний чат", "Особисті повідомлення", "Скарги та модерація"] },
  voice: { title: "Голосові кімнати", text: "Макет майбутніх голосових кімнат.", items: ["Загальні та приватні кімнати", "Керування мікрофоном", "Демонстрація екрана"] },
  streams: { title: "Трансляції", text: "Сторінка майбутніх прямих ефірів.", items: ["Список активних ефірів", "Чат трансляції", "Скарги на порушення"] },
  music: { title: "Музика", text: "Особисті та спільні плейлисти.", items: ["Особисті добірки", "Спільна черга треків", "Синхронне прослуховування"] },
  media: { title: "Фото та відео", text: "Чотири альбоми спільноти.", items: ["Фото керівництва", "Фото учасників", "Відео керівництва", "Відео учасників"] },
  tests: { title: "Тестування", text: "Тести для подання заявки на підвищення ролі.", items: ["Доступ до наступного тесту після дозволу Лідера або Модератора", "Історія результатів", "Ручне рішення щодо підвищення"] },
  forms: { title: "Анкети", text: "Перевірка анкет перед прийняттям та видачею ролі.", items: ["Статуси: на перевірці, виправлення, схвалено, відхилено", "Перегляд відповідей", "Видача ролі після схвалення"] },
  rewards: { title: "Рулетка та бонуси", text: "Розважальна система віртуальних балів.", items: ["Один безкоштовний оберт на день", "Додаткові оберти за бали", "Щотижневі нагороди активності"] },
  activity: { title: "Онлайн-активність", text: "Облік фактичної активності учасників.", items: ["Активний час", "Виявлення простою", "Тижневий рейтинг"] },
  stats: { title: "Статистика", text: "Зведена статистика спільноти та модерації.", items: ["Активність учасників", "Історія ролей", "Попередження та рішення"] },
  notifications: { title: "Сповіщення", text: "Центр системних повідомлень.", items: ["Звичайні, важливі та термінові", "Звукові сигнали", "Налаштування гучності"] },
  settings: { title: "Налаштування", text: "Персональні параметри та безпека.", items: ["Приватність", "Звуки сповіщень", "Захист акаунта"] }
};

const ruleGroups = [
  { title: "Правила спільноти", items: ["Поважайте інших учасників.", "Не допускайте образ, цькування та погроз.", "Не поширюйте особисту інформацію інших людей.", "Дотримуйтеся рішень керівництва."] },
  { title: "Правила чату", items: ["Не спамте та не засмічуйте повідомленнями чат.", "Не публікуйте заборонений або образливий контент.", "Не провокуйте конфлікти та не порушуйте порядок спілкування."] },
  { title: "Правила голосових кімнат", items: ["Не перебивайте інших учасників навмисно.", "Не використовуйте мікрофон для шуму або образ.", "Дотримуйтеся вказівок модератора кімнати."] },
  { title: "Можливі санкції", items: ["Попередження.", "Тимчасове обмеження чату або голосу.", "Тимчасове відсторонення від спільноти.", "Видалення зі спільноти у разі серйозних або повторних порушень."] }
];

const categoryLabels: Record<string, string> = {
  announcement: "ОГОЛОШЕННЯ",
  event: "ПОДІЯ",
  important: "ВАЖЛИВО"
};

export default async function PreviewSection({
  params,
  searchParams
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { section } = await params;
  const { status } = await searchParams;

  const data = descriptions[section] ?? {
    title: "Розділ",
    text: "Цей розділ буде реалізовано на наступному етапі.",
    items: ["Структура сторінки", "Права доступу", "Робочі функції"]
  };

  let newsItems: {
    id: string;
    title: string;
    content: string;
    category: string;
    event_date: string | null;
    created_at: string;
  }[] = [];

  let newsError = false;
  let isStaff = false;

  if (section === "news") {
    const supabase = await createClient();

    const { data: staffStatus, error: staffError } =
      await supabase.rpc("is_verceti_staff");

    isStaff = !staffError && staffStatus === true;

    const { data, error } = await supabase
      .from("news")
      .select("id, title, content, category, event_date, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("VERCETI news loading error:", error.message);
      newsError = true;
    } else {
      newsItems = data ?? [];
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="eyebrow">VERCETI · ПОПЕРЕДНІЙ ПЕРЕГЛЯД</div>

        {section === "news" ? (
          <>
            <h1>Новини</h1>
            <p className="muted">Новини спільноти, оголошення та події.</p>

            {isStaff && (
              <div className="panel" style={{ marginTop: 24 }}>
                <h2>Створити новину</h2>

                <form action={createNews} className="member-list">
                  <label htmlFor="news-date">Дата події (необов&apos;язково)</label>
                  <input
                    id="news-title"
                    name="title"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="Введіть заголовок"
                  />

                  <label htmlFor="news-content">Текст новини</label>
                  <textarea
                    id="news-content"
                    name="content"
                    required
                    maxLength={10000}
                    rows={5}
                    placeholder="Введіть текст новини"
                  />

                  <label htmlFor="news-category">Категорія</label>
                  <select id="news-category" name="category" required defaultValue="announcement">
                    <option value="announcement">Оголошення</option>
                    <option value="event">Подія</option>
                    <option value="important">Важливо</option>
                  </select>

                  <label htmlFor="news-date">Дата події (необов'язково)</label>
                  <input id="news-date" name="event_date" type="date" />

                  <button className="btn" type="submit">
                    Опублікувати новину
                  </button>
                </form>
              </div>
            )}

            {status === "created" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Новину успішно опубліковано.
              </div>
            )}
            {status === "empty" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Заповни заголовок і текст новини.
              </div>
            )}
            {status === "invalid" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Обрана неправильна категорія.
              </div>
            )}
            {status === "forbidden" && (
              <div className="panel" style={{ marginTop: 16 }}>
                У тебе немає прав для створення новин.
              </div>
            )}
            {status === "error" && (
              <div className="panel" style={{ marginTop: 16 }}>
                Не вдалося опублікувати новину. Перевір журнал помилок.
              </div>
            )}

            {newsError ? (
              <div className="panel" style={{ marginTop: 24 }}>
                <p className="muted">Не вдалося завантажити новини. Перевір підключення до бази даних.</p>
              </div>
            ) : newsItems.length === 0 ? (
              <div className="panel" style={{ marginTop: 24 }}>
                <h2>Поки що новин немає</h2>
                <p className="muted">Нові оголошення спільноти з&apos;являтимуться тут.</p>
              </div>
            ) : (
              <div className="member-list" style={{ margin: "24px 0" }}>
                {newsItems.map((item) => (
                  <div className="panel" key={item.id} style={{ marginBottom: 14 }}>
                    <div className="eyebrow">
                      {categoryLabels[item.category] ?? item.category.toUpperCase()}
                    </div>
                    <h2>{item.title}</h2>
                    <p className="muted">{item.content}</p>
                    <div className="notice-time">
                      Дата: {new Date(
                        item.event_date
                          ? `${item.event_date}T12:00:00`
                          : item.created_at
                      ).toLocaleDateString("uk-UA")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="page-note">
              Новини завантажуються з бази даних VERCETI.
            </p>
          </>
        ) : section === "rules" ? (
          <>
            <h1>Правила VERCETI</h1>
            <p className="muted">Правила поведінки та порядок у спільноті.</p>
            {ruleGroups.map((group) => (
              <div className="panel" key={group.title} style={{ marginTop: 16 }}>
                <h2>{group.title}</h2>
                <div className="member-list">
                  {group.items.map((item) => (
                    <div className="member-row" key={item}>
                      <span style={{ color: "#bb8aff" }}>✦</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="panel" style={{ marginTop: 16 }}>
              <h2>Історія оновлень правил</h2>
              <p className="muted">Поки що змін не зафіксовано. Тут відображатимуться дата та опис кожного оновлення.</p>
            </div>
            <p className="page-note">Правила зможуть читати всі учасники. Створювати, редагувати й видаляти їх зможуть адміністратор та уповноважене керівництво. Це демонстраційний вміст.</p>
          </>
        ) : (
          <>
            <h1>{data.title}</h1>
            <p className="muted">{data.text}</p>
            <div className="member-list" style={{ margin: "24px 0" }}>
              {data.items.map((item) => (
                <div className="member-row" key={item}>
                  <span style={{ color: "#bb8aff" }}>✦</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{item}</span>
                  <span className="tag">ПЛАН</span>
                </div>
              ))}
            </div>
            <p className="page-note">Це поки що схема розділу, а не підключена функція.</p>
          </>
        )}

        <Link className="btn" href="/">← Повернутися на головну</Link>
      </section>
    </main>
  );
}
