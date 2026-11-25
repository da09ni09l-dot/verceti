"use client";

import { useState } from "react";
import Link from "next/link";

type Props = { isAdmin: boolean };

export default function PinnedSiteActionsMenu({ isAdmin }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pinned-site-actions">
      {open && (
        <nav className="pinned-site-actions-menu" aria-label="Інструменти VERCETI">
          {isAdmin && (
            <>
              <Link href="/admin/support" className="btn secondary" onClick={() => setOpen(false)}>
                💬 Чат адміністрації
              </Link>
              <Link href="/admin" className="btn" onClick={() => setOpen(false)}>
                ⚙ Адмін-панель
              </Link>
            </>
          )}
          <Link href="/support" className="btn secondary" onClick={() => setOpen(false)}>
            ✉ Зв’язок з адміністрацією
          </Link>
        </nav>
      )}
      <button
        type="button"
        className="pinned-site-actions-trigger"
        aria-label={open ? "Закрити інструменти" : "Відкрити інструменти"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
    </div>
  );
}
