"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Booking = {
  id: string;
  booking_date: string;
  hour_slot: number;
  user_id: string;
  alcohol: boolean;
  parsley: boolean;
};
type BookingView = Booking & { nickname: string };

const panel: React.CSSProperties = {
  border: "1px solid rgba(187,138,255,.22)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,.035)",
};

function localDateKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export default function WorkshopBooking({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(localDateKey);
  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [choices, setChoices] = useState<Record<number, { alcohol: boolean; parsley: boolean }>>({});
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("workshop_bookings")
      .select("id,booking_date,hour_slot,user_id,alcohol,parsley")
      .eq("booking_date", date)
      .order("hour_slot");
    if (queryError) {
      setError("Не вдалося завантажити бронювання.");
      return;
    }
    const rows = (data ?? []) as Booking[];
    const ids = Array.from(new Set(rows.map((row) => row.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,nickname").in("id", ids)
      : { data: [] as { id: string; nickname: string | null }[] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.nickname || "Учасник"]));
    setBookings(rows.map((row) => ({ ...row, nickname: names.get(row.user_id) ?? "Учасник" })));
  }, [supabase, date]);

  useEffect(() => {
    const refreshDate = () => setDate(localDateKey());
    refreshDate();
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const timer = window.setTimeout(refreshDate, Math.max(1000, nextMidnight - now.getTime() + 500));
    const onVisible = () => { if (document.visibilityState === "visible") refreshDate(); };
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase.channel("workshop-bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "workshop_bookings" }, () => { void load(); })
      .subscribe();
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(channel); };
  }, [supabase, load]);

  useEffect(() => { void load(); }, [load]);

  function selected(slot: number) {
    return choices[slot] ?? { alcohol: false, parsley: false };
  }

  async function save(slot: number) {
    const choice = selected(slot);
    if (!choice.alcohol && !choice.parsley) {
      setError("Обери хоча б один вид продукції: алко або петрушка.");
      return;
    }
    setBusySlot(slot);
    setError("");
    setNotice("");
    const existing = bookings.find((item) => item.hour_slot === slot);
    const result = existing?.user_id === userId
      ? await supabase.from("workshop_bookings").update({ ...choice, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", userId)
      : await supabase.from("workshop_bookings").insert({ booking_date: date, hour_slot: slot, user_id: userId, ...choice });
    if (result.error) {
      setError(result.error.code === "23505" ? "Цей час щойно забронював інший учасник. Онови розклад." : "Не вдалося зберегти бронювання.");
    } else {
      setNotice("Бронювання збережено.");
      setChoices((current) => { const next = { ...current }; delete next[slot]; return next; });
      await load();
    }
    setBusySlot(null);
  }

  async function remove(slot: number) {
    const existing = bookings.find((item) => item.hour_slot === slot && item.user_id === userId);
    if (!existing) return;
    setBusySlot(slot);
    const { error: deleteError } = await supabase.from("workshop_bookings").delete().eq("id", existing.id).eq("user_id", userId);
    if (deleteError) setError("Не вдалося скасувати бронювання.");
    else { setNotice("Бронювання скасовано."); await load(); }
    setBusySlot(null);
  }

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
      <section style={panel}>
        <h2 style={{ marginTop: 0 }}>🏭 Бронювання цеху</h2>
        <p className="muted">Розклад на добу: 24 часові проміжки від 00:00 до 00:00. Вільний час можна забронювати, обравши алко та/або петрушку. Розклад автоматично перемикається на нову дату опівночі.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong>Дата:</strong>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={{ maxWidth: 190 }} />
          <button className="btn secondary" type="button" onClick={() => setDate(localDateKey())}>Сьогодні</button>
          <span className="page-note">{bookings.length}/24 годин заброньовано</span>
        </div>
      </section>
      {error && <p role="alert" style={{ color: "#ff9b9b", margin: 0 }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#8fe0ad", margin: 0 }}>{notice}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))", gap: 10 }}>
        {Array.from({ length: 24 }, (_, slot) => {
          const booking = bookings.find((item) => item.hour_slot === slot);
          const own = booking?.user_id === userId;
          const choice = selected(slot);
          const start = String(slot).padStart(2, "0") + ":00";
          const end = String((slot + 1) % 24).padStart(2, "0") + ":00";
          return (
            <article key={slot} style={{ ...panel, borderColor: booking ? "rgba(187,138,255,.38)" : "rgba(255,255,255,.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 17 }}>{start} – {end}</strong>
                <span className="tag">{booking ? (own ? "ТВОЄ" : "ЗАЙНЯТО") : "ВІЛЬНО"}</span>
              </div>
              {booking && !own ? (
                <div style={{ marginTop: 10 }}>
                  <strong>{booking.nickname}</strong>
                  <p className="muted" style={{ margin: "6px 0 0" }}>{[booking.alcohol ? "Алко" : "", booking.parsley ? "Петрушка" : ""].filter(Boolean).join(" · ")}</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <input type="checkbox" checked={own ? booking.alcohol : choice.alcohol} onChange={(event) => setChoices((current) => ({ ...current, [slot]: { ...selected(slot), alcohol: event.target.checked } }))} />
                      Алко
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <input type="checkbox" checked={own ? booking.parsley : choice.parsley} onChange={(event) => setChoices((current) => ({ ...current, [slot]: { ...selected(slot), parsley: event.target.checked } }))} />
                      Петрушка
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" type="button" disabled={busySlot === slot} onClick={() => void save(slot)}>{busySlot === slot ? "..." : own ? "Оновити" : "Забронювати"}</button>
                    {own && <button className="btn secondary" type="button" disabled={busySlot === slot} onClick={() => void remove(slot)}>Скасувати</button>}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
