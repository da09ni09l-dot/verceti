
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NewsBellProps = {
  userId: string;
};

export default function NewsBell({ userId }: NewsBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(0);

  const loadCount = useCallback(async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "news")
      .eq("is_read", false);

    if (!error) {
      setUnread(count ?? 0);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadCount();

    const channel = supabase
      .channel(`verceti-news-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadCount]);

  return (
    <Link
      href="/news"
      aria-label={`Новини. Непрочитаних: ${unread}`}
      title="Новини VERCETI"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 42,
        height: 42,
        flexShrink: 0,
        borderRadius: 13,
        border: "1px solid rgba(216,186,255,0.25)",
        background: "rgba(216,186,255,0.08)",
        color: "#e8d5ff",
        textDecoration: "none",
        fontSize: 21,
      }}
    >
      📰

      {unread > 0 && (
        <span
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 19,
            height: 19,
            padding: "0 5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            background: "#e53950",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            boxShadow: "0 0 10px rgba(229,57,80,0.45)",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
