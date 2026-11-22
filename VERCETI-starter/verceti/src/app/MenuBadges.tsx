
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { menu } from "@/lib/demo-data";

type MenuBadgesProps = {
  userId: string;
};

export default function MenuBadges({ userId }: MenuBadgesProps) {
  const supabase = useMemo(() => createClient(), []);

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadCounts = useCallback(async () => {
    const [messagesResult, notificationsResult] = await Promise.all([
      supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false),

      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
    ]);

    if (!messagesResult.error) {
      setUnreadMessages(messagesResult.count ?? 0);
    }

    if (!notificationsResult.error) {
      setUnreadNotifications(notificationsResult.count ?? 0);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadCounts();

    const channel = supabase
      .channel("verceti-menu-unread-badges")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages"
        },
        () => {
          void loadCounts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications"
        },
        () => {
          void loadCounts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, loadCounts]);

  return (
    <nav className="menu" aria-label="Головне меню">
      {menu.map(([label, icon, id], index) => {
        const count =
          id === "chat"
            ? unreadMessages
            : id === "notifications"
              ? unreadNotifications
              : 0;

        return (
          <Link
            key={id}
            className={index === 0 ? "active" : ""}
            href={index === 0 ? "/" : `/preview/${id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <span className="menu-icon">{icon}</span>

            <span style={{ flex: 1 }}>{label}</span>

            {count > 0 && (
              <span
                aria-label={`${count} непрочитаних`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 21,
                  height: 21,
                  padding: "0 6px",
                  boxSizing: "border-box",
                  borderRadius: 20,
                  background: "#e53950",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                  boxShadow: "0 0 10px rgba(229,57,80,0.45)"
                }}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
