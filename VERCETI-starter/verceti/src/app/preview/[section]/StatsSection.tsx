
type RoleHistoryItem = {
  id: string;
  memberNickname: string | null;
  changedByNickname: string | null;
  oldRole: string | null;
  newRole: string;
  reason: string | null;
  createdAt: string;
};

type StatsSectionProps = {
  totalMembers: number;
  newMembers7Days: number;
  activeChatMembers7Days: number;
  chatMessages7Days: number;
  loadError: boolean;
  errorDetails: string;
  roleHistory: RoleHistoryItem[];
  roleHistoryError: boolean;
};

export default function StatsSection({
  totalMembers,
  newMembers7Days,
  activeChatMembers7Days,
  chatMessages7Days,
  loadError,
  errorDetails,
  roleHistory,
  roleHistoryError
}: StatsSectionProps) {
  return (
    <>
      <h1>Статистика VERCETI</h1>
      <p className="muted">
        Реальна активність учасників спільноти за даними Supabase.
      </p>

      {loadError ? (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>Помилка завантаження статистики</h2>
          <p className="muted">
            Нижче наведено технічну інформацію для діагностики.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 12,
              marginTop: 14,
              padding: 12,
              background: "rgba(0,0,0,.2)",
              borderRadius: 8
            }}
          >
            {errorDetails || "Деталі помилки відсутні."}
          </pre>
        </div>
      ) : (
        <>
          <div
            className="member-list"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 14,
              marginTop: 24
            }}
          >
            <div className="panel">
              <div className="eyebrow">УЧАСНИКИ</div>
              <h2 style={{ fontSize: 32, margin: "10px 0" }}>
                {totalMembers}
              </h2>
              <p className="muted">Усього в спільноті</p>
            </div>

            <div className="panel">
              <div className="eyebrow">НОВІ УЧАСНИКИ</div>
              <h2 style={{ fontSize: 32, margin: "10px 0" }}>
                {newMembers7Days}
              </h2>
              <p className="muted">За останні 7 днів</p>
            </div>

            <div className="panel">
              <div className="eyebrow">АКТИВНІ УЧАСНИКИ</div>
              <h2 style={{ fontSize: 32, margin: "10px 0" }}>
                {activeChatMembers7Days}
              </h2>
              <p className="muted">Писали в чаті за 7 днів</p>
            </div>

            <div className="panel">
              <div className="eyebrow">ПОВІДОМЛЕННЯ</div>
              <h2 style={{ fontSize: 32, margin: "10px 0" }}>
                {chatMessages7Days}
              </h2>
              <p className="muted">У чаті за останні 7 днів</p>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h2>Активність учасників</h2>
            <p className="muted">
              Активним вважається учасник, який надіслав хоча б одне
              повідомлення в загальний чат протягом останніх 7 днів.
            </p>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h2>Історія ролей</h2>
            <p className="muted">
              Історія змін ролей учасників спільноти.
            </p>

            {roleHistoryError ? (
              <p className="muted" style={{ marginTop: 16 }}>
                Не вдалося завантажити історію ролей.
                Перевір журнал помилок Vercel.
              </p>
            ) : roleHistory.length === 0 ? (
              <p className="muted" style={{ marginTop: 16 }}>
                Записів про зміну ролей поки немає.
              </p>
            ) : (
              <div style={{ overflowX: "auto", marginTop: 16 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 700
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 10 }}>
                        Учасник
                      </th>
                      <th style={{ textAlign: "left", padding: 10 }}>
                        Було
                      </th>
                      <th style={{ textAlign: "left", padding: 10 }}>
                        Стало
                      </th>
                      <th style={{ textAlign: "left", padding: 10 }}>
                        Хто змінив
                      </th>
                      <th style={{ textAlign: "left", padding: 10 }}>
                        Дата
                      </th>
                      <th style={{ textAlign: "left", padding: 10 }}>
                        Причина
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {roleHistory.map((item) => (
                      <tr key={item.id}>
                        <td style={{ padding: 10 }}>
                          {item.memberNickname || "Невідомий учасник"}
                        </td>
                        <td style={{ padding: 10 }}>
                          {item.oldRole || "—"}
                        </td>
                        <td style={{ padding: 10 }}>
                          {item.newRole}
                        </td>
                        <td style={{ padding: 10 }}>
                          {item.changedByNickname || "Невідомий модератор"}
                        </td>
                        <td
                          style={{
                            padding: 10,
                            whiteSpace: "nowrap"
                          }}
                        >
                          {new Date(item.createdAt).toLocaleString("uk-UA")}
                        </td>
                        <td style={{ padding: 10 }}>
                          {item.reason || "Не вказана"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
