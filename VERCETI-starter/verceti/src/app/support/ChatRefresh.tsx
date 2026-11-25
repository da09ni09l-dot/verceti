"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <p className="muted" style={{ fontSize: 11 }}>
      Повідомлення оновлюються автоматично кожні 5 секунд, поки сторінка відкрита
    </p>
  );
}
