
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NewsBellProps = {
  userId: string;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function getNotificationIcon(type: string) {
  switch (type) {
    case "news":
      return "📰";
    case "warning":
      return "⚠️";
    case "application":
      return "📋";
    case "birthday":
      return "🎂";
    case "member":
      return "👤";
    case "system":
      return "⚙️";
    default:
      return "🔔";
  }
}

function getTime(date: string) {
  return new Date(date).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NewsBell({ userId }: NewsBellProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<NotificationItem | null>(null);

  const loadNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, link, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data as NotificationItem[]);
      setUnread(data.filter((item) => !item.is_read).length);
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void loadNotifications();

    const channel = supabase
      .channel(`verceti-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setToast(payload.new as NotificationItem);
          }
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, loadNotifications]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (!error) {
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
      setUnread(0);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.is_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", item.id)
        .eq("user_id", userId);

      if (!error) {
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, is_read: true }
              : notification
          )
        );
        setUnread((current) => Math.max(0, current - 1));
      }
    }

    setIsOpen(false);

    const destination =
      item.link && item.link.startsWith("/") ? item.link : "/news";

    router.push(destination);
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", zIndex: 20, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Сповіщення. Непрочитаних: ${unread}`}
        aria-expanded={isOpen}
        title="Сповіщення VERCETI"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 42,
          height: 42,
          borderRadius: 13,
          border: "1px solid rgba(216,186,255,0.25)",
          background: isOpen
            ? "rgba(216,186,255,0.18)"
            : "rgba(216,186,255,0.08)",
          color: "#e8d5ff",
          cursor: "pointer",
          fontSize: 21,
        }}
      >
        🔔

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
      </button>

      {toast && !isOpen && (
        <button
          type="button"
          onClick={() => void openNotification(toast)}
          style={{
            position: "fixed", top: 68, right: 16, zIndex: 1201,
            width: "min(350px, calc(100vw - 32px))", display: "flex",
            gap: 11, padding: 14, textAlign: "left",
            border: "1px solid rgba(216,186,255,0.32)", borderRadius: 14,
            background: "#211a30", color: "#fff",
            boxShadow: "0 12px 36px rgba(0,0,0,.42)", cursor: "pointer"
          }}
        >
          <span style={{ fontSize: 22 }}>{getNotificationIcon(toast.type)}</span>
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 13 }}>{toast.title}</strong>
            <span style={{ display: "block", color: "#c9bfd5", fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>{toast.message}</span>
            <span style={{ display: "block", color: "#cda6ff", fontSize: 10, marginTop: 7 }}>Натисни, щоб відкрити</span>
          </span>
        </button>
      )}

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 50,
              right: 0,
              width: "min(360px, calc(100vw - 32px))",
              maxHeight: 470,
              overflowY: "auto",
              zIndex: 100,
              border: "1px solid rgba(216,186,255,0.2)",
              borderRadius: 16,
              background: "#171321",
              boxShadow: "0 15px 45px rgba(0,0,0,0.5)",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                gap: 10,
              }}
            >
              <div>
                <strong style={{ fontSize: 15 }}>Сповіщення</strong>
                <div
                  style={{
                    color: "#aaa0b8",
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  Непрочитаних: {unread}
                </div>
              </div>

              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#cda6ff",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Прочитати все
                </button>
              )}
            </div>

            {loading ? (
              <div
                style={{
                  padding: 25,
                  textAlign: "center",
                  color: "#aaa0b8",
                  fontSize: 13,
                }}
              >
                Завантаження...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#aaa0b8",
                }}
              >
                <div style={{ fontSize: 30, marginBottom: 10 }}>🔔</div>
                <strong style={{ fontSize: 13 }}>
                  Поки немає сповіщень
                </strong>
                <p style={{ fontSize: 11, marginTop: 6 }}>
                  Тут з&apos;являтимуться важливі повідомлення.
                </p>
              </div>
            ) : (
              <div>
                {notifications.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => void openNotification(item)}
                    style={{
                      display: "flex",
                      width: "100%",
                      gap: 11,
                      padding: 13,
                      textAlign: "left",
                      border: 0,
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: item.is_read
                        ? "transparent"
                        : "rgba(157,100,230,0.12)",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 21, flexShrink: 0 }}>
                      {getNotificationIcon(item.type)}
                    </span>

                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {item.title}
                        {!item.is_read && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#b77aff",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </span>

                      <span
                        style={{
                          display: "block",
                          color: "#bdb4c8",
                          fontSize: 11,
                          lineHeight: 1.5,
                          marginTop: 5,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {item.message}
                      </span>

                      <span
                        style={{
                          display: "block",
                          color: "#82798d",
                          fontSize: 10,
                          marginTop: 6,
                        }}
                      >
                        {getTime(item.created_at)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Link
              href="/news"
              onClick={() => setIsOpen(false)}
              style={{
                display: "block",
                padding: 13,
                textAlign: "center",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                color: "#cda6ff",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              Перейти до новин →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
