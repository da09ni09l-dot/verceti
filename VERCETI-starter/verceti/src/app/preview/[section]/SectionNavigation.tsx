
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SectionNavigation() {
  const router = useRouter();

  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "1px solid rgba(187, 138, 255, 0.2)",
      }}
    >
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push("/");
          }
        }}
      >
        ← Назад
      </button>

      <Link className="btn" href="/">
        ⌂ Головне меню
      </Link>
    </nav>
  );
}
