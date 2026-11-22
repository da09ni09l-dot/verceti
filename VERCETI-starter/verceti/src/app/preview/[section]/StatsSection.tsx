
import { createDisciplinaryAction } from "./actions";

type RoleHistoryItem = {
  id: string;
  memberNickname: string | null;
  changedByNickname: string | null;
  oldRole: string | null;
  newRole: string;
  reason: string | null;
  createdAt: string;
};

type DisciplinaryActionItem = {
  id: string;
  memberNickname: string | null;
  moderatorNickname: string | null;
  reason: string;
  actionType: string;
  createdAt: string;
};

type DisciplinaryMember = {
  id: string;
  nickname: string;
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
  disciplinaryActions: DisciplinaryActionItem[];
  disciplinaryActionsError: boolean;
  disciplinaryMembers: DisciplinaryMember[];
  disciplinaryMembersError: boolean;
  isStaff: boolean;
  status?: string;
};

const actionLabels: Record<string, string> = {
  warning: "Попередження",
  decision: "Рішення"
};

export default function StatsSection({
  totalMembers,
  newMembers7Days,
  activeChatMembers7Days,
  chatMessages7Days,
  loadError,
  errorDetails,
  roleHistory,
  roleHistoryError,
  disciplinaryActions,
  disciplinaryActionsError,
  disciplinaryMembers,
  disciplinaryMembersError,
  isStaff,
  status
}: StatsSectionProps) {
  return (
    <>
      <h1>Статистика VERCETI</h1>
      <p className="muted">
        Зведена статистика спільноти та модерації.
      </p>

      {loadError && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>Помилка завантаження статистики</h2>
          <p className="muted">
            Не вдалося отримати частину статистичних даних.
          </p>
          <pre style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: 12
          }}>
            {errorDetails}
          </pre>
        </div>
      )}

      <div
        className="member-list"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginTop: 24
        }}
      >
        <div className="panel">
          <div className="muted">Усього учасників</div>
          <h2>{totalMembers}</h2>
        </div>

        <div className="panel">
          <div className="muted">Нові за 7 днів</div>
          <h2>{newMembers7Days}</h2>
        </div>

        <div className="panel">
          <div className="muted">Активні в чаті за 7 днів</div>
          <h2>{activeChatMembers7Days}</h2>
        </div>

        <div className="panel">
          <div className="muted">Повідомлення за 7 днів</div>
          <h2>{chatMessages7Days}</h2>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <h2>Активність учасників</h2>
        <p className="muted">
          За останні 7 днів у чаті активні {activeChatMembers7Days} учасників.
          Усього надіслано {chatMessages7Days} повідомлень.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <h2>Історія ролей</h2>

        {roleHistoryError ? (
          <p className="muted">
            Не вдалося завантажити історію ролей.
          </p>
        ) : roleHistory.length === 0 ? (
          <p className="muted">
            Історія змін ролей поки порожня.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              textAlign: "left"
            }}>
              <thead>
                <tr>
                  <th style={{ padding: 10 }}>Учасник</th>
                  <th style={{ padding: 10 }}>Було</th>
                  <th style={{ padding: 10 }}>Стало</th>
                  <th style={{ padding: 10 }}>Хто змінив</th>
                  <th style={{ padding: 10 }}>Дата</th>
                  <th style={{ padding: 10 }}>Причина</th>
                </tr>
              </thead>
              <tbody>
                {roleHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: 10 }}>
                      {item.memberNickname ?? "Невідомий учасник"}
                    </td>
                    <td style={{ padding: 10 }}>
                      {item.oldRole ?? "—"}
                    </td>
                    <td style={{ padding: 10 }}>
                      {item.newRole}
                    </td>
                    <td style={{ padding: 10 }}>
                      {item.changedByNickname ?? "Невідомо"}
                    </td>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {new Date(item.createdAt).toLocaleString("uk-UA")}
                    </td>
                    <td style={{ padding: 10 }}>
                      {item.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <h2>Попередження та рішення</h2>

        {status === "disciplinary-created" && (
          <p style={{ color: "#55d98a", marginTop: 12 }}>
            Дисциплінарний запис успішно створено.
          </p>
        )}

        {status === "disciplinary-invalid-member" && (
          <p style={{ color: "#ff8585", marginTop: 12 }}>
            Не вдалося знайти вибраного учасника. Онови сторінку та спробуй ще раз.
          </p>
        )}

        {status === "disciplinary-invalid-type" && (
          <p style={{ color: "#ff8585", marginTop: 12 }}>
            Вибрано неправильний тип дисциплінарної дії.
          </p>
        )}

        {status === "disciplinary-invalid-reason" && (
          <p style={{ color: "#ff8585", marginTop: 12 }}>
            Вкажи причину. Максимальна довжина — 2000 символів.
          </p>
        )}

        {status === "disciplinary-error" && (
          <p style={{ color: "#ff8585", marginTop: 12 }}>
            Не вдалося зберегти запис. Перевір журнал помилок Vercel.
          </p>
        )}

        {isStaff && (
          <div style={{ marginTop: 20 }}>
            <h3>Додати попередження або рішення</h3>

            {disciplinaryMembersError ? (
              <p className="muted">
                Не вдалося завантажити список учасників.
              </p>
            ) : disciplinaryMembers.length === 0 ? (
              <p className="muted">
                Список учасників порожній. Неможливо створити запис.
              </p>
            ) : (
              <form
                action={createDisciplinaryAction}
                className="member-list"
                style={{ gap: 12, marginTop: 16 }}
              >
                <label htmlFor="disciplinary-member">
                  Учасник
                </label>

                <select
                  id="disciplinary-member"
                  name="member_id"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Вибери учасника
                  </option>

                  {disciplinaryMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nickname}
                    </option>
                  ))}
                </select>

                <label htmlFor="disciplinary-type">
                  Тип дії
                </label>

                <select
                  id="disciplinary-type"
                  name="action_type"
                  required
                  defaultValue="warning"
                >
                  <option value="warning">Попередження</option>
                  <option value="decision">Рішення</option>
                </select>

                <label htmlFor="disciplinary-reason">
                  Причина
                </label>

                <textarea
                  id="disciplinary-reason"
                  name="reason"
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder="Опиши причину попередження або рішення"
                />

                <button className="btn" type="submit">
                  Зберегти запис
                </button>
              </form>
            )}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <h3>Історія дисциплінарних дій</h3>

          {disciplinaryActionsError ? (
            <p className="muted">
              Не вдалося завантажити попередження та рішення.
            </p>
          ) : disciplinaryActions.length === 0 ? (
            <p className="muted">
              Попереджень і рішень поки немає.
            </p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                textAlign: "left"
              }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10 }}>Учасник</th>
                    <th style={{ padding: 10 }}>Тип</th>
                    <th style={{ padding: 10 }}>Причина</th>
                    <th style={{ padding: 10 }}>Модератор</th>
                    <th style={{ padding: 10 }}>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplinaryActions.map((item) => (
                    <tr key={item.id}>
                      <td style={{ padding: 10 }}>
                        {item.memberNickname ?? "Невідомий учасник"}
                      </td>
                      <td style={{ padding: 10 }}>
                        {actionLabels[item.actionType] ?? item.actionType}
                      </td>
                      <td style={{ padding: 10 }}>
                        {item.reason}
                      </td>
                      <td style={{ padding: 10 }}>
                        {item.moderatorNickname ?? "Невідомо"}
                      </td>
                      <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                        {new Date(item.createdAt).toLocaleString("uk-UA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
