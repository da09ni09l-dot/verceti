"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { spinRewards } from "./rewards-actions";

type Prize = {
  id: string;
  title: string;
  description: string;
  weight: number;
};

const COLORS = ["#7c3aed", "#db2777", "#2563eb", "#0891b2", "#16a34a", "#d97706", "#9333ea", "#be123c"];

function SpinButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="btn rewards-spin-button"
      type="submit"
      disabled={disabled || pending}
      style={{ width: "100%" }}
    >
      {pending ? "Колесо крутиться..." : "🎡 Крутити рулетку"}
    </button>
  );
}

export default function RewardsWheel({
  prizes,
  alreadySpun,
}: {
  prizes: Prize[];
  alreadySpun: boolean;
}) {
  const [spinning, setSpinning] = useState(false);
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

  return (
    <div className="rewards-wheel-panel">
      <div className="rewards-wheel-layout">
        <div className="rewards-wheel-stage">
          <div
            className={`rewards-wheel ${prizes.length ? "" : "rewards-wheel-empty"} ${spinning ? "is-spinning" : ""}`}
            style={{ background: gradient }}
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
            а вага кожного призу впливає на ймовірність випадіння.
          </p>
          {prizes.length === 0 ? (
            <p className="page-note">Активних призів поки немає.</p>
          ) : alreadySpun ? (
            <p className="page-note">Ти вже використав(ла) щоденний оберт. Новий буде доступний завтра.</p>
          ) : (
            <form action={spinRewards} className="rewards-wheel-form" onSubmit={() => setSpinning(true)}>
              <SpinButton disabled={prizes.length === 0} />
            </form>
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
