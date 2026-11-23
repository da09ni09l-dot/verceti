
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type TopMember = {
  user_id: string;
  nickname: string | null;
  role: string;
  total_seconds: number;
};

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} год ${minutes} хв`;
  }

  return `${minutes} хв`;
}

const medals = ["🥇", "🥈", "🥉"];

const roleLabels: Record<string, string> = {
  admin: "АДМІНІСТРАТОР",
  leader: "ЛІДЕР",
  moderator: "МОДЕРАТОР",
  senior: "СТАРШИЙ УЧАСНИК",
  local: "УЧАСНИК",
  junior: "МОЛОДШИЙ УЧАСНИК"
};

export default async function TopMembersPanel() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_verceti_top_members"
  );

  if (error) {
    console.error("Top members loading error:", error.message);
  }

  const members = (data ?? []) as TopMember[];

  return (
    <section className="panel top-ranking-panel">
      <div className="panel-head">
        <div>
          <h2>ТОП-3 АКТИВНОСТІ</h2>
          <div className="panel-sub">
            Найактивніші учасники VERCETTI
          </div>
        </div>

        <span className="tag top-ranking-tag">
          <span className="ranking-live-dot" />
          РЕЙТИНГ
        </span>
      </div>

      {members.length === 0 ? (
        <div className="ranking-empty">
          <span className="ranking-empty-icon">✦</span>
          <div>Рейтинг поки формується</div>
          <p>Будь активним, щоб потрапити до ТОП-3!</p>
        </div>
      ) : (
        <div className="top-ranking-list">
          {members.slice(0, 3).map((member, index) => (
            <Link
              href={`/preview/members/${member.user_id}`}
              key={member.user_id}
              className={`top-ranking-row ranking-place-${index + 1}`}
            >
              <div className="ranking-position">
                <span className="ranking-medal">
                  {medals[index] || `${index + 1}`}
                </span>
              </div>

              <div className="ranking-member-info">
                <div className="ranking-member-name">
                  {member.nickname || "Без нікнейму"}
                </div>

                <div className="ranking-member-role">
                  {roleLabels[member.role] ?? "УЧАСНИК"}
                </div>
              </div>

              <div className="ranking-member-activity">
                <strong>
                  {formatTime(Number(member.total_seconds))}
                </strong>
                <span>АКТИВНІСТЬ</span>
              </div>

              <span className="ranking-arrow">↗</span>
            </Link>
          ))}
        </div>
      )}

      <div className="ranking-footer">
        <span>VERCETTI COMMUNITY</span>
        <span>АКТИВНІСТЬ ЗА ВЕСЬ ЧАС</span>
      </div>
    </section>
  );
}
