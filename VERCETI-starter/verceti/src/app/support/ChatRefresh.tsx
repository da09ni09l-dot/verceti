"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 7000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <p className="muted" style={{ fontSize: 11 }}>Оновлення повідомлень автоматично кожні 7 секунд</p>;
}
