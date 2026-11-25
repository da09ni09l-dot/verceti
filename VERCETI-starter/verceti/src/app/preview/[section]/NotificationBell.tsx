
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const loadNotifications = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, link, is_read, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) {
      setNotifications(data ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      await loadNotifications(user.id);

      if (!active) return;

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadNotifications(user.id);
          }
        )
        .subscribe();
    }

    initialize();

    return () => {
      active = false;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, loadNotifications]);

  async function markAsRead(id: string) {
    if (!userId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );
    }
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (!error) {
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
    }
  }

  async function openNotification(item: Notification) {
    if (!item.is_read) {
      await markAsRead(item.id);
    }

    setIsOpen(false);

    if (item.link) {
      router.push(item.link);
    }
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

  return (
    <div style={{ position: "relative", marginBottom: 18 }}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((value) => !value);
          if (!isOpen && userId) loadNotifications(userId);
        }}
        aria-label="Сповіщення"
        aria-expanded={isOpen}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "11px 16px",
          borderRadius: 12,
          border: "1px solid rgba(187,138,255,.3)",
          background: "rgba(155,92,255,.12)",
          color: "#e9d9ff",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 700
        }}
      >
        <span style={{ fontSize: 19 }}>🔔</span>
        Сповіщення

        {unreadCount > 0 && (
          <span
            style={{
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#e34d75",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            top: "calc(100% + 10px)",
            left: 0,
            width: "min(380px, calc(100vw - 48px))",
            maxHeight: 430,
            overflowY: "auto",
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(187,138,255,.25)",
            background: "#15121f",
            boxShadow: "0 15px 45px rgba(0,0,0,.5)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12
            }}
          >
            <strong style={{ color: "#fff" }}>
              Ваші сповіщення
            </strong>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#bb8aff",
                  cursor: "pointer",
                  fontSize: 11
                }}
              >
                Прочитати всі
              </button>
            )}
          </div>

          {loading ? (
            <p style={{ color: "#aaa" }}>Завантаження...</p>
          ) : notifications.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: 13 }}>
              Поки що сповіщень немає.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 11,
                    border: "1px solid rgba(187,138,255,.13)",
                    background: item.is_read
                      ? "rgba(255,255,255,.035)"
                      : "rgba(155,92,255,.14)",
                    color: "#eee",
                    cursor: "pointer"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>
                      {item.type === "message" ? "💬 " :
                       item.type === "news" ? "📰 " :
                       item.type === "application" ? "📋 " : "🔔 "}
                      {item.title}
                    </strong>

                    {!item.is_read && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          flexShrink: 0,
                          borderRadius: "50%",
                          background: "#bb8aff"
                        }}
                      />
                    )}
                  </div>

                  <p
                    style={{
                      margin: "7px 0",
                      color: "#c5bfd2",
                      fontSize: 12,
                      lineHeight: 1.5
                    }}
                  >
                    {item.message}
                  </p>

                  <span style={{ color: "#888198", fontSize: 10 }}>
                    {formatDate(item.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
