
"use client";

import { useOnlinePresence } from "./OnlinePresenceProvider";

type Member = {
  id: string;
  nickname: string | null;
  role: string;
  is_banned: boolean;
};

const roleInfo: Record<string, { label: string; color: string; order: number }> = {
  leader: { label: "ЗАСНОВНИК", color: "orange", order: 1 },
  admin: { label: "АДМІНІСТРАТОР", color: "orange", order: 2 },
  moderator: { label: "МОДЕРАТОР", color: "purple", order: 3 },
  senior: { label: "СТАРШИЙ УЧАСНИК", color: "blue", order: 4 },
  local: { label: "УЧАСНИК", color: "green", order: 5 },
  junior: { label: "МОЛОДШИЙ УЧАСНИК", color: "muted", order: 6 }
};

export default function MembersOnlinePanel({
  members
}: {
  members: Member[];
}) {
  const { onlineIds } = useOnlinePresence();

  const activeMembers = members
    .filter((member) => !member.is_banned)
    .sort((a, b) => {
      const orderA = roleInfo[a.role]?.order ?? 99;
      const orderB = roleInfo[b.role]?.order ?? 99;

      if (orderA !== orderB) return orderA - orderB;

      return (a.nickname ?? "").localeCompare(b.nickname ?? "", "uk");
    });

  const onlineCount = activeMembers.filter((member) =>
    onlineIds.includes(member.id)
  ).length;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Учасники спільноти</h2>
          <div className="panel-sub">
            Реальний список учасників VERCETI
          </div>
        </div>
        <span className="tag">{activeMembers.length} УЧАСНИКІВ</span>
      </div>

      <div className="member-list">
        {activeMembers.map((member) => {
          const isOnline = onlineIds.includes(member.id);
          const role = roleInfo[member.role] ?? {
            label: member.role.toUpperCase(),
            color: "muted"
          };

          const nickname = member.nickname || "Без нікнейму";

          return (
            <div className="member-row" key={member.id}>
              <div className="member-left">
                <div className="member-avatar">
                  {nickname.slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <div className="member-name">{nickname}</div>

                  <div className="member-meta">
                    {isOnline ? (
                      <>
                        <span className="status-dot" />
                        Онлайн
                      </>
                    ) : (
                      "Офлайн"
                    )}
                  </div>
                </div>
              </div>

              <span className={`role ${role.color}`}>
                {role.label}
              </span>
            </div>
          );
        })}

        {activeMembers.length === 0 && (
          <div className="panel-sub">
            Поки що учасників немає.
          </div>
        )}
      </div>

      <div className="panel-sub" style={{ marginTop: 18 }}>
        <span className="status-dot" />
        Зараз онлайн: <strong>{onlineCount}</strong> із{" "}
        <strong>{activeMembers.length}</strong> учасників
      </div>
    </div>
  );
}
