"use client";

import { useState } from "react";

export default function MobileMenuToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`mobile-menu-toggle${open ? " mobile-menu-open" : ""}`}
        aria-label={open ? "Закрити меню" : "Відкрити меню"}
        aria-expanded={open}
        aria-controls="verceti-sidebar"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      {open && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Закрити меню"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
