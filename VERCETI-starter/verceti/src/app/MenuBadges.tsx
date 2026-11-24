
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MenuBadgesProps = {
  userId: string;
};

const menuGroups = [
  {
    title: "ГОЛОВНЕ",
    items: [
      ["Головна", "⌂", "home", "/"],
      ["Чат", "▤", "chat", "/preview/chat"],
      ["Учасники", "♙", "members", "/preview/members"],
      ["Анкети", "▣", "forms", "/preview/forms"],
      ["Події", "◷", "events", "/preview/events"],
      ["Рейтинг", "▥", "stats", "/preview/stats"],
    ],
  },
  {
    title: "МУЛЬТИМЕДІА",
    items: [
      ["Голосова кімната", "◖", "voice", "/preview/voice"],
      ["Музика", "♫", "music", "/preview/music"],
      ["Фото", "▧", "media", "/preview/media"],
    ],
  },
  {
    title: "СПІЛЬНОТА",
    items: [
      ["Рулетка", "◇", "rewards", "/preview/rewards"],
      ["Активність", "◷", "activity", "/preview/activity"],
      ["Правила", "⚖", "rules", "/preview/rules"],
      ["Тестування", "✧", "tests", "/preview/tests"],
    ],
  },
] as const;

export default function MenuBadges({ userId }: MenuBadgesProps) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadCounts = useCallback(async () => {
    const messagesResult = await supabase
      supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false),;

    if (!messagesResult.error) {
      setUnreadMessages(messagesResult.count ?? 0);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadCounts();

    const channel = supabase
      .channel("vercetti-menu-unread-badges")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
        },
        () => void loadCounts()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, loadCounts]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const renderItem = (
    item: readonly [string, string, string, string]
  ) => {
    const [label, icon, id, href] = item;

    const count =
      id === "chat"
        ? unreadMessages
        : 0;

    return (
      <Link
        key={id}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`menu-link ${pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "active" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
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
              background: "#e53970",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              lineHeight: 1,
              boxShadow: "0 0 12px rgba(229,57,112,0.4)",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={mobileOpen ? "Закрити меню" : "Відкрити меню"}
        aria-expanded={mobileOpen}
        aria-controls="vercetti-mobile-navigation"
        onClick={() => setMobileOpen((current) => !current)}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      <div
        className={`mobile-menu-backdrop ${mobileOpen ? "is-open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav
        id="vercetti-mobile-navigation"
        className={`menu ${mobileOpen ? "mobile-menu-open" : ""}`}
        aria-label="Головне меню"
      >
        <div className="mobile-menu-header">
          <span>VERCETTI</span>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрити меню"
          >
            ✕
          </button>
        </div>

        {menuGroups.map((group) => (
          <div className="menu-group" key={group.title}>
            <div className="menu-group-title">{group.title}</div>

            {group.items.map((item) => renderItem(item))}
          </div>
        ))}

        <div className="menu-group menu-bottom">
          <div className="menu-group-title">ПРОФІЛЬ</div>

          {renderItem([
            "Налаштування",
            "⚙",
            "settings",
            "/preview/settings",
          ])}
        </div>
      </nav>
    </>
  );
}
