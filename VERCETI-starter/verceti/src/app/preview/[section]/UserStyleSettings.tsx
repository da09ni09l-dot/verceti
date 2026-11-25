"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const nicknameColors = [
  { label: "Неонова фуксія", value: "#ff4fd8" },
  { label: "Електрик", value: "#8b7bff" },
  { label: "Бірюза", value: "#35e6d0" },
  { label: "Лайм", value: "#b8f34a" },
  { label: "Золото", value: "#ffc857" },
  { label: "Кораловий", value: "#ff766e" },
  { label: "Льодяний синій", value: "#62c8ff" },
  { label: "Перлинний", value: "#e9d5ff" }
];

const messageColors = [
  { label: "Світлий", value: "#f7f3ff" },
  { label: "Рожевий", value: "#ff9bd5" },
  { label: "Блакитний", value: "#8bdcff" },
  { label: "М'ятний", value: "#8df0c5" },
  { label: "Лавандовий", value: "#c5a5ff" },
  { label: "Теплий персик", value: "#ffc39b" },
  { label: "Жовтий", value: "#ffe38a" }
];

const fonts = [
  { label: "Manrope — сучасний", value: "manrope", css: "Manrope, Arial, sans-serif" },
  { label: "Orbitron — футуристичний", value: "orbitron", css: "Orbitron, Arial, sans-serif" },
  { label: "Rajdhani — технологічний", value: "rajdhani", css: "Rajdhani, Arial, sans-serif" },
  { label: "Nunito — округлий", value: "nunito", css: "Nunito Sans, Arial, sans-serif" },
  { label: "Georgia — класичний", value: "georgia", css: "Georgia, serif" },
  { label: "Monospace — цифровий", value: "mono", css: "monospace" }
];

type Props = {
  userId: string;
  nickname: string;
  nicknameColor: string;
  nicknameFont: string;
  messageColor: string;
  messageFont: string;
};

export default function UserStyleSettings({
  userId,
  nickname,
  nicknameColor: initialNicknameColor,
  nicknameFont: initialNicknameFont,
  messageColor: initialMessageColor,
  messageFont: initialMessageFont
}: Props) {
  const [nicknameColor, setNicknameColor] = useState(initialNicknameColor || "#ff4fd8");
  const [nicknameFont, setNicknameFont] = useState(initialNicknameFont || "manrope");
  const [messageColor, setMessageColor] = useState(initialMessageColor || "#f7f3ff");
  const [messageFont, setMessageFont] = useState(initialMessageFont || "manrope");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const selectedNicknameFont = fonts.find((font) => font.value === nicknameFont)?.css ?? fonts[0].css;
  const selectedMessageFont = fonts.find((font) => font.value === messageFont)?.css ?? fonts[0].css;

  async function savePreferences() {
    setSaving(true);
    setNotice("");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      setNotice("Не вдалося підтвердити акаунт. Увійди повторно.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").update({
      nickname_color: nicknameColor,
      nickname_font: nicknameFont,
      message_color: messageColor,
      message_font: messageFont
    }).eq("id", userId);
    setNotice(error ? "Не вдалося зберегти стиль. Перевір оновлення сторінки." : "Персональний стиль збережено.");
    setSaving(false);
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <h2>Персональний стиль</h2>
      <p className="muted">Налаштуй вигляд свого нікнейму та повідомлень окремо. Зміни зберігаються у профілі.</p>

      <div className="member-list" style={{ gap: 12, marginTop: 18 }}>
        <div>
          <h3 style={{ marginBottom: 8 }}>Нікнейм — один колір і свій шрифт</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {nicknameColors.map((color) => (
              <button key={color.value} type="button" aria-label={color.label} title={color.label}
                onClick={() => setNicknameColor(color.value)}
                style={{ width: 34, height: 34, borderRadius: "50%", border: nicknameColor === color.value ? "3px solid white" : "2px solid rgba(255,255,255,.22)", background: color.value, boxShadow: nicknameColor === color.value ? `0 0 14px ${color.value}` : "none", cursor: "pointer" }} />
            ))}
          </div>
          <label htmlFor="nickname-font" style={{ display: "block", marginTop: 12 }}>Дизайн шрифту нікнейму</label>
          <select id="nickname-font" value={nicknameFont} onChange={(event) => setNicknameFont(event.target.value)} style={{ width: "100%", marginTop: 6 }}>
            {fonts.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </select>
          <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
            <span className="muted" style={{ fontSize: 11 }}>ПЕРЕГЛЯД НІКНЕЙМУ</span>
            <div style={{ color: nicknameColor, fontFamily: selectedNicknameFont, fontSize: 22, fontWeight: 800, textShadow: `0 0 12px ${nicknameColor}66`, overflowWrap: "anywhere" }}>{nickname || "YourNickname"}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Повідомлення — окремий колір і шрифт</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {messageColors.map((color) => (
              <button key={color.value} type="button" aria-label={color.label} title={color.label}
                onClick={() => setMessageColor(color.value)}
                style={{ width: 34, height: 34, borderRadius: "50%", border: messageColor === color.value ? "3px solid white" : "2px solid rgba(255,255,255,.22)", background: color.value, boxShadow: messageColor === color.value ? `0 0 12px ${color.value}66` : "none", cursor: "pointer" }} />
            ))}
          </div>
          <label htmlFor="message-font" style={{ display: "block", marginTop: 12 }}>Шрифт повідомлень</label>
          <select id="message-font" value={messageFont} onChange={(event) => setMessageFont(event.target.value)} style={{ width: "100%", marginTop: 6 }}>
            {fonts.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </select>
          <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
            <span className="muted" style={{ fontSize: 11 }}>ПЕРЕГЛЯД ПОВІДОМЛЕННЯ</span>
            <p style={{ color: messageColor, fontFamily: selectedMessageFont, margin: "8px 0 0" }}>Привіт! Це приклад твого повідомлення у VERCETI.</p>
          </div>
        </div>
        <button className="btn" type="button" onClick={savePreferences} disabled={saving}>{saving ? "Збереження..." : "Зберегти стиль"}</button>
        {notice && <p className="page-note" role="status">{notice}</p>}
      </div>
    </section>
  );
}
