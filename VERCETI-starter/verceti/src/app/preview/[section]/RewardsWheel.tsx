"use client";

import { useState } from "react";
import { spinRewards, spinBirthdayRewards } from "./rewards-actions";

type Prize = {
  id: string;
  title: string;
  description: string;
  weight: number;
};

const COLORS = ["#7c3aed", "#db2777", "#2563eb", "#0891b2", "#16a34a", "#d97706", "#9333ea", "#be123c"];

export default function RewardsWheel({
  prizes,
  alreadySpun,
}: {
  prizes: Prize[];
  alreadySpun: boolean;
}) {
  const [hasSpun, setHasSpun] = useState(alreadySpun);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<{ title: string; description: string } | null>(null);
  const [error, setError] = useState("");
  const [birthdayUsed, setBirthdayUsed] = useState(birthdayAlreadySpun);
  const [birthdayPrize, setBirthdayPrize] = useState<{title:string;description:string}|null>(null);

  const totalWeight = prizes.reduce((total, prize) => total + prize.weight, 0);
  let angle = 0;
  const slices = prizes.map((prize, index) => {
    const start = angle;
    angle += totalWeight > 0 ? (prize.weight / totalWeight) * 360 : 0;
    return {
      ...prize,
      color: COLORS[index % COLORS.length],
      start,
      end: angle,
      chance: totalWeight > 0 ? (prize.weight / totalWeight) * 100 : 0,
    };
  });
  const gradient = slices.length
    ? `conic-gradient(${slices.map((slice) => `${slice.color} ${slice.start}deg ${slice.end}deg`).join(", ")})`
    : "conic-gradient(#393044 0deg 360deg)";

  async function handleSpin() {
    if (busy || hasSpun || prizes.length === 0) return;
    setBusy(true);
    setError("");
    setWonPrize(null);

    try {
      const result = await spinRewards();
      if (!result.ok) {
        setError(
          result.error === "used"
            ? "Ти вже використав(ла) щоденний оберт."
            : result.error === "empty"
              ? "Активних призів поки немає."
              : result.error === "unauthorized"
                ? "Увійди до акаунта, щоб крутити рулетку."
                : "Не вдалося виконати оберт. Спробуй ще раз."
        );
        if (result.error === "used") setHasSpun(true);
        setBusy(false);
        return;
      }

      const winningSlice = slices.find((slice) => slice.id === result.prize.id);
      if (!winningSlice) {
        setError("Приз отримано, але його сектор не знайдено на колесі. Онови сторінку.");
        setHasSpun(true);
        setBusy(false);
        return;
      }

      const center = (winningSlice.start + winningSlice.end) / 2;
      const alignment = (360 - (center % 360) + 360) % 360;
      setRotation((current) => current + 360 * 5 + alignment);
      setWonPrize({ title: result.prize.title, description: result.prize.description });
      setHasSpun(true);
      setBusy(false);
    } catch {
      setError("Не вдалося зв’язатися із сервером. Спробуй ще раз.");
      setBusy(false);
    }
  }

  return (
    <div className="rewards-wheel-panel">
      <div className="rewards-wheel-layout">
        <div className="rewards-wheel-stage">
          <div
            className={`rewards-wheel ${prizes.length ? "" : "rewards-wheel-empty"}`}
            style={{ background: gradient, transform: `rotate(${rotation}deg)` }}
            onTransitionEnd={(event) => {
              if (event.propertyName === "transform") setBusy(false);
            }}
            aria-label="Колесо фортуни з доступними призами"
            role="img"
          >
            <div className="rewards-wheel-center">VERCETI</div>
          </div>
          <span className="rewards-wheel-pointer" aria-hidden="true">▼</span>
        </div>

        <div className="rewards-wheel-details">
          <h2>Щоденне колесо фортуни</h2>
          <p className="muted">
            Один безкоштовний оберт на день. Переможець визначається сервером,
            а колесо зупиняється на секторі саме того призу, який випав.
          </p>
          {prizes.length === 0 ? (
            <p className="page-note">Активних призів поки немає.</p>
          ) : hasSpun ? (
            <p className="page-note">Ти вже використав(ла) щоденний оберт. Новий буде доступний завтра.</p>
          ) : (
            <button
              className="btn rewards-spin-button"
              type="button"
              disabled={busy}
              onClick={handleSpin}
              style={{ width: "100%", marginTop: 18, minHeight: 48 }}
            >
              {busy ? "Визначаємо результат..." : "🎡 Крутити рулетку"}
            </button>
          )}
          {birthdayEligible && (
            <div className="panel" style={{marginTop:16}}>
              <h3>🎂 Подарунок до дня народження</h3>
              <p className="muted">Для тебе доступний один безкоштовний святковий оберт.</p>
              {birthdayUsed ? <p className="page-note">Святковий оберт цього року вже використано.</p> : <button className="btn" type="button" disabled={busy || prizes.length===0} onClick={handleBirthdaySpin} style={{width:"100%",marginTop:10}}>🎁 Забрати безкоштовну рулетку</button>}
              {birthdayPrize && <p className="page-note" style={{marginTop:10}}>🎉 Випало: {birthdayPrize.title} {birthdayPrize.description}</p>}
            </div>
          )}
          {error && <p className="page-note" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          {wonPrize && (
            <div className="panel" role="status" aria-live="polite" style={{ marginTop: 14 }}>
              <strong>🎉 Твій приз: {wonPrize.title}</strong>
              {wonPrize.description && <p className="muted" style={{ marginTop: 6 }}>{wonPrize.description}</p>}
            </div>
          )}
          <p className="rewards-wheel-security">
            Результат і перевірка повторного оберту зберігаються на сервері.
          </p>
        </div>
      </div>

      {slices.length > 0 && (
        <div className="rewards-wheel-prizes" aria-label="Призи та ймовірність випадіння">
          {slices.map((prize) => (
            <div className="rewards-wheel-prize" key={prize.id}>
              <span className="rewards-wheel-swatch" style={{ background: prize.color }} />
              <span className="rewards-wheel-prize-name">{prize.title}</span>
              <span className="rewards-wheel-prize-chance">{prize.chance.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
