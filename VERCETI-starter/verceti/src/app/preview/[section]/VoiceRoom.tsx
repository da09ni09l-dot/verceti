
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";

type Room = {
  id: number;
  name: string;
  max_participants: number | null;
  participant_count: number;
  created_by?: string | null;
};

type VoiceRoomProps = {
  isStaff: boolean;
};

export default function VoiceRoom({ isStaff }: VoiceRoomProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [capacity, setCapacity] = useState("unlimited");
  const [showCreate, setShowCreate] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const currentRoom = rooms.find((room) => room.id === activeRoom);

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/livekit/rooms", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не вдалося завантажити кімнати.");
      }

      setRooms(data.rooms || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Помилка завантаження кімнат."
      );
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();

    const interval = window.setInterval(loadRooms, 5000);

    return () => window.clearInterval(interval);
  }, [loadRooms]);

  async function joinRoom(id: number) {
    const selectedRoom = rooms.find((room) => room.id === id);

    if (!selectedRoom) return;

    if (
      selectedRoom.max_participants !== null &&
      selectedRoom.participant_count >= selectedRoom.max_participants
    ) {
      setError("У цій кімнаті вже немає вільних місць.");
      return;
    }

    setJoining(true);
    setError("");
    setToken("");
    setActiveRoom(null);

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не вдалося підключитися.");
      }

      setServerUrl(data.serverUrl);
      setToken(data.token);
      setActiveRoom(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Помилка підключення до голосової кімнати."
      );
    } finally {
      setJoining(false);
      loadRooms();
    }
  }

  function leaveRoom() {
    setToken("");
    setActiveRoom(null);
    loadRooms();
  }

  async function createRoom() {
    if (!isStaff) return;

    const name = newRoom.trim();

    if (!name) {
      setError("Введи назву кімнати.");
      return;
    }

    setError("");

    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          maxParticipants:
            capacity === "unlimited" ? null : Number(capacity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не вдалося створити кімнату.");
      }

      setNewRoom("");
      setCapacity("unlimited");
      setShowCreate(false);

      await loadRooms();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Помилка створення кімнати."
      );
    }
  }

  async function deleteRoom(id: number) {
    if (!isStaff) return;

    if (!window.confirm("Видалити цю кімнату?")) return;

    setError("");

    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не вдалося видалити кімнату.");
      }

      if (activeRoom === id) {
        leaveRoom();
      }

      await loadRooms();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Помилка видалення кімнати."
      );
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr)",
        gap: 16,
        marginTop: 24,
        alignItems: "start",
      }}
    >
      <aside className="panel" style={{ minWidth: 0 }}>
        <h2 style={{ marginTop: 0 }}>🎙️ Голосові канали</h2>

        <p className="muted" style={{ fontSize: 12 }}>
          Обери кімнату для спілкування
        </p>

        {loadingRooms ? (
          <p className="muted">Завантаження кімнат...</p>
        ) : rooms.length === 0 ? (
          <p className="muted">
            Кімнат поки немає. Керівництво може створити першу кімнату.
          </p>
        ) : (
          rooms.map((room) => {
            const full =
              room.max_participants !== null &&
              room.participant_count >= room.max_participants;

            return (
              <div
                key={room.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="btn"
                  disabled={joining || (full && activeRoom !== room.id)}
                  onClick={() => joinRoom(room.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    background:
                      activeRoom === room.id
                        ? "rgba(187,138,255,0.2)"
                        : "rgba(255,255,255,0.04)",
                    opacity: full && activeRoom !== room.id ? 0.55 : 1,
                  }}
                >
                  <div>🔊 {room.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
                    👥 {room.participant_count}
                    {room.max_participants === null
                      ? " / ∞"
                      : ` / ${room.max_participants}`}
                    {full ? " · Заповнена" : ""}
                    {activeRoom === room.id ? " · Ти тут" : ""}
                  </div>
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
            );
          })
        )}

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

                <p style={{ fontSize: 12, marginBottom: 6 }}>
                  Максимум учасників
                </p>

                <select
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="2">2 людини</option>
                  <option value="3">3 людини</option>
                  <option value="5">5 людей</option>
                  <option value="10">10 людей</option>
                  <option value="unlimited">Для всіх · без обмеження</option>
                </select>

                <button
                  className="btn"
                  type="button"
                  onClick={createRoom}
                  style={{ marginTop: 8, width: "100%" }}
                >
                  Створити кімнату
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
      </aside>

      <section className="panel" style={{ minWidth: 0 }}>
        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              borderRadius: 10,
              background: "rgba(255,60,60,0.12)",
              color: "#ff7777",
            }}
          >
            {error}
          </div>
        )}

        {joining ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <h2>Підключаємося...</h2>
            <p className="muted">Готуємо голосову кімнату VERCETI.</p>
          </div>
        ) : !token || !currentRoom ? (
          <div style={{ textAlign: "center", padding: "70px 16px" }}>
            <div style={{ fontSize: 42 }}>🎙️</div>
            <h2>Голосові кімнати VERCETI</h2>
            <p className="muted">
              Обери голосовий канал зліва, щоб приєднатися.
            </p>
            <p className="page-note">
              Для роботи мікрофона дозволь браузеру доступ до нього.
            </p>
          </div>
        ) : (
          <LiveKitRoom
            key={activeRoom}
            token={token}
            serverUrl={serverUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={leaveRoom}
            onError={(err) => setError(err.message)}
            style={{ width: "100%" }}
          >
            <RoomAudioRenderer />

            <VoiceRoomContent
              roomName={currentRoom.name}
              onLeave={leaveRoom}
            />
          </LiveKitRoom>
        )}
      </section>
    </div>
  );
}

function VoiceRoomContent({
  roomName,
  onLeave,
}: {
  roomName: string;
  onLeave: () => void;
}) {
  const participants = useParticipants();

  const screenTracks = useTracks([
    Track.Source.ScreenShare,
  ]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>🔊 {roomName}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Учасників у кімнаті: {participants.length}
          </p>
        </div>

        <span className="badge">🟢 Підключено</span>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          Учасники ({participants.length})
        </h3>

        {participants.map((participant) => (
          <div
            key={participant.identity}
            style={{
              padding: 10,
              marginTop: 8,
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            🟢 {participant.name || participant.identity}
            {participant.isSpeaking ? " · 🎙️ Говорить" : ""}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 12,
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🖥️ Демонстрація екрана</h3>

        {screenTracks.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {screenTracks.map((track, index) => (
              <div
                key={track.publication.trackSid || index}
                style={{
                  overflow: "hidden",
                  borderRadius: 10,
                  background: "#111",
                }}
              >
                <VideoTrack trackRef={track} />
                <p style={{ padding: 8, margin: 0 }}>
                  Екран:{" "}
                  {track.participant.name || track.participant.identity}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Ніхто поки не демонструє свій екран.
          </p>
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <ControlBar
          controls={{
            microphone: true,
            camera: false,
            screenShare: true,
            leave: false,
          }}
        />

        <button className="btn" type="button" onClick={onLeave}>
          📞 Вийти з кімнати
        </button>
      </div>

      <p className="page-note">
        Мікрофон, звук та демонстрація екрана працюють через LiveKit.
      </p>
    </div>
  );
}
