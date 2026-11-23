
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
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>ТОП-3 активності</h2>
          <div className="panel-sub">
            Рейтинг за весь час VERCETI
          </div>
        </div>

        <span className="tag">РЕЙТИНГ</span>
      </div>

      {members.length === 0 ? (
        <div className="panel-sub">
          Поки що немає даних для рейтингу.
        </div>
      ) : (
        <div className="member-list">
          {members.map((member, index) => (
            <Link
              href={`/preview/members/${member.user_id}`}
              key={member.user_id}
              className="member-row"
              style={{
                textDecoration: "none",
                color: "inherit"
              }}
            >
              <div className="member-left">
                <div
                  className="member-avatar"
                  style={{ fontSize: 22 }}
                >
                  {medals[index]}
                </div>

                <div>
                  <div className="member-name">
                    {member.nickname || "Без нікнейму"}
                  </div>

                  <div className="member-meta">
                    {member.role.toUpperCase()}
                  </div>
                </div>
              </div>

              <strong style={{ color: "#d8baff", fontSize: 13 }}>
                {formatTime(Number(member.total_seconds))}
              </strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
