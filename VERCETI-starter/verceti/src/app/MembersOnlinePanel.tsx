
"use client";

import Link from "next/link";
import { useOnlinePresence } from "./OnlinePresenceProvider";

type Member = {
  id: string;
  nickname: string | null;
  role: string;
  is_banned: boolean;
};

const roleInfo: Record<
  string,
  { label: string; color: string; order: number }
> = {
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
      const onlineA = onlineIds.includes(a.id) ? 0 : 1;
      const onlineB = onlineIds.includes(b.id) ? 0 : 1;

      if (onlineA !== onlineB) return onlineA - onlineB;

      const orderA = roleInfo[a.role]?.order ?? 99;
      const orderB = roleInfo[b.role]?.order ?? 99;

      if (orderA !== orderB) return orderA - orderB;

      return (a.nickname ?? "").localeCompare(
        b.nickname ?? "",
        "uk"
      );
    });

  const onlineCount = activeMembers.filter((member) =>
    onlineIds.includes(member.id)
  ).length;

  return (
    <section className="panel online-members-panel">
      <div className="panel-head">
        <div>
          <h2>УЧАСНИКИ СПІЛЬНОТИ</h2>
          <div className="panel-sub">
            Учасники VERCETTI в реальному часі
          </div>
        </div>

        <span className="tag online-members-tag">
          <span className="online-tag-dot" />
          {onlineCount} ОНЛАЙН
        </span>
      </div>

      <div className="online-members-list">
        {activeMembers.map((member) => {
          const isOnline = onlineIds.includes(member.id);

          const role = roleInfo[member.role] ?? {
            label: member.role.toUpperCase(),
            color: "muted",
            order: 99
          };

          const nickname = member.nickname || "Без нікнейму";

          return (
            <Link
              href={`/preview/members/${member.id}`}
              className={`online-member-row ${
                isOnline ? "is-online" : ""
              }`}
              key={member.id}
            >
              <div className="online-member-left">
                <div className="online-member-avatar">
                  {nickname.slice(0, 1).toUpperCase()}

                  <span
                    className={`online-avatar-status ${
                      isOnline ? "active" : ""
                    }`}
                  />
                </div>

                <div className="online-member-info">
                  <div className="online-member-name">
                    {nickname}
                  </div>

                  <div className="online-member-status">
                    {isOnline ? (
                      <>
                        <span className="online-status-indicator" />
                        <span>Зараз онлайн</span>
                      </>
                    ) : (
                      <>
                        <span className="offline-status-indicator" />
                        <span>Офлайн</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className={`online-member-role ${role.color}`}>
                {role.label}
              </div>
            </Link>
          );
        })}

        {activeMembers.length === 0 && (
          <div className="online-members-empty">
            <span>✦</span>
            <p>Поки що учасників немає</p>
          </div>
        )}
      </div>

      <div className="online-members-footer">
        <div className="online-footer-status">
          <span className="online-status-indicator" />
          <span>АКТИВНІ ЗАРАЗ</span>
        </div>

        <div className="online-footer-count">
          <strong>{onlineCount}</strong>
          <span>/ {activeMembers.length}</span>
        </div>
      </div>
    </section>
  );
}
