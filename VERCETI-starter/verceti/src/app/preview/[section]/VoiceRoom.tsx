
"use client";

import { useState } from "react";

type Room = {
  id: number;
  name: string;
  members: string[];
};

const initialRooms: Room[] = [
  { id: 1, name: "Загальна", members: ["Адміністратор", "Лідер"] },
  { id: 2, name: "Спілкування", members: ["Модератор"] },
  { id: 3, name: "Ігри", members: [] }
];

export default function VoiceRoom() {
  const [rooms, setRooms] = useState(initialRooms);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const currentRoom = rooms.find((room) => room.id === activeRoom);

  function createRoom() {
    const name = newRoom.trim();
    if (!name) return;

    setRooms((previous) => [
      ...previous,
      {
        id: Date.now(),
        name,
        members: []
      }
    ]);

    setNewRoom("");
    setShowCreate(false);
  }

  function deleteRoom(id: number) {
    if (!window.confirm("Видалити цю кімнату?")) return;

    setRooms((previous) => previous.filter((room) => room.id !== id));

    if (activeRoom === id) {
      setActiveRoom(null);
      setSharing(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(190px, 260px) minmax(0, 1fr)",
        gap: 16,
        marginTop: 24,
        alignItems: "start"
      }}
    >
      <aside className="panel">
        <h2 style={{ marginTop: 0 }}>Голосові канали</h2>

        <p className="muted" style={{ fontSize: 12 }}>
          Обери кімнату для спілкування
        </p>

        {rooms.map((room) => (
          <div
            key={room.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => {
                setActiveRoom(room.id);
                setSharing(false);
              }}
              style={{
                flex: 1,
                textAlign: "left",
                background:
                  activeRoom === room.id
                    ? "rgba(187,138,255,0.2)"
                    : "rgba(255,255,255,0.04)"
              }}
            >
              🔊 {room.name}
              <span style={{ opacity: 0.65, marginLeft: 8 }}>
                {room.members.length}
              </span>
            </button>

            {isStaff && (
              <button
                type="button"
                className="btn"
                onClick={() => deleteRoom(room.id)}
                title="Видалити кімнату"
              >
                🗑
              </button>
            )}
          </div>
        ))}

        {isStaff && (
          <div style={{ marginTop: 16 }}>
            {showCreate ? (
              <>
                <input
                  value={newRoom}
                  onChange={(event) => setNewRoom(event.target.value)}
                  placeholder="Назва кімнати"
                  maxLength={40}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={createRoom}
                  style={{ marginTop: 8, width: "100%" }}
                >
                  Створити
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ marginTop: 6, width: "100%" }}
                >
                  Скасувати
                </button>
              </>
            ) : (
              <button
                className="btn"
                type="button"
                onClick={() => setShowCreate(true)}
                style={{ width: "100%" }}
              >
                + Створити кімнату
              </button>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 13
            }}
          >
            <input
              type="checkbox"
              checked={isStaff}
              onChange={(event) => setIsStaff(event.target.checked)}
            />
            Режим керівництва (демо)
          </label>
          <p className="page-note">
            Перемикач лише для демонстрації. Права доступу підключимо через акаунт.
          </p>
        </div>
      </aside>

      <section className="panel" style={{ minWidth: 0 }}>
        {!currentRoom ? (
          <div style={{ textAlign: "center", padding: "70px 16px" }}>
            <div style={{ fontSize: 42 }}>🎙️</div>
            <h2>Голосові кімнати VERCETI</h2>
            <p className="muted">
              Обери голосовий канал зліва, щоб приєднатися.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap"
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>🔊 {currentRoom.name}</h2>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Голосовий канал
                </p>
              </div>
              <span className="badge">У кімнаті</span>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 12,
                background: "rgba(0,0,0,0.2)"
              }}
            >
              <h3 style={{ marginTop: 0 }}>Учасники</h3>

              {currentRoom.members.length === 0 ? (
                <p className="muted">
                  Поки що немає інших учасників.
                </p>
              ) : (
                currentRoom.members.map((member) => (
                  <div
                    key={member}
                    style={{
                      padding: 10,
                      marginTop: 8,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.05)"
                    }}
                  >
                    🟢 {member}
                  </div>
                ))
              )}

              <p className="page-note">
                Список учасників поки демонстраційний.
              </p>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 12,
                background: "rgba(0,0,0,0.2)"
              }}
            >
              <h3 style={{ marginTop: 0 }}>Демонстрація екрана</h3>

              {sharing ? (
                <div
                  style={{
                    padding: 28,
                    textAlign: "center",
                    border: "1px dashed #bb8aff",
                    borderRadius: 10
                  }}
                >
                  <div style={{ fontSize: 36 }}>🖥️</div>
                  <strong>Демонстрацію увімкнено локально</strong>
                  <p className="muted">
                    Інші учасники поки не бачать цей екран.
                  </p>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setSharing(false)}
                  >
                    Завершити демонстрацію
                  </button>
                </div>
              ) : (
                <button
                  className="btn"
                  type="button"
                  onClick={() => setSharing(true)}
                >
                  🖥️ Поділитися екраном (демо)
                </button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 20
              }}
            >
              <button
                className="btn"
                type="button"
                onClick={() => setMuted(!muted)}
              >
                {muted ? "🔇 Увімкнути мікрофон" : "🎙️ Вимкнути мікрофон"}
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => setDeafened(!deafened)}
              >
                {deafened ? "🔊 Увімкнути звук" : "🎧 Вимкнути звук"}
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => {
                  setActiveRoom(null);
                  setSharing(false);
                }}
              >
                📞 Вийти з кімнати
              </button>
            </div>

            <p className="page-note">
              Керування мікрофоном і звуком поки демонстраційне. Справжній Голосовий зв&apos;язок та передавання екрана підключимо окремо.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
