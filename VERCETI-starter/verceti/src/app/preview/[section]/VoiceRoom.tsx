
"use client";

import { useState } from "react";
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
  members: string[];
};

const initialRooms: Room[] = [
  { id: 1, name: "Загальна", members: [] },
  { id: 2, name: "Спілкування", members: [] },
  { id: 3, name: "Ігри", members: [] },
];

export default function VoiceRoom() {
  const [rooms, setRooms] = useState(initialRooms);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const currentRoom = rooms.find((room) => room.id === activeRoom);

  async function joinRoom(id: number) {
    setJoining(true);
    setError("");

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
    }
  }

  function leaveRoom() {
    setToken("");
    setActiveRoom(null);
  }

  function createRoom() {
    const name = newRoom.trim();
    if (!name) return;

    setRooms((previous) => [
      ...previous,
      {
        id: Date.now(),
        name,
        members: [],
      },
    ]);

    setNewRoom("");
    setShowCreate(false);
  }

  function deleteRoom(id: number) {
    if (!window.confirm("Видалити цю кімнату?")) return;

    if (activeRoom === id) {
      leaveRoom();
    }

    setRooms((previous) => previous.filter((room) => room.id !== id));
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(190px, 260px) minmax(0, 1fr)",
        gap: 16,
        marginTop: 24,
        alignItems: "start",
      }}
    >
      <aside className="panel">
        <h2 style={{ marginTop: 0 }}>🎙️ Голосові канали</h2>

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
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className="btn"
              disabled={joining}
              onClick={() => joinRoom(room.id)}
              style={{
                flex: 1,
                textAlign: "left",
                background:
                  activeRoom === room.id
                    ? "rgba(187,138,255,0.2)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              🔊 {room.name}
              {activeRoom === room.id ? " · У кімнаті" : ""}
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
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 13,
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
            Демонстраційний перемикач. Реальні права керівництва підключимо
            окремо.
          </p>
        </div>
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
            onDisconnected={() => {
              setToken("");
              setActiveRoom(null);
            }}
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
            Справжній голосовий канал LiveKit
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
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
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
                  Екран: {track.participant.name || track.participant.identity}
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

        <button
          className="btn"
          type="button"
          onClick={onLeave}
        >
          📞 Вийти з кімнати
        </button>
      </div>

      <p className="page-note">
        Мікрофон, звук та демонстрація екрана працюють через LiveKit.
        Для трансляції браузер попросить вибрати екран або вікно.
      </p>
    </div>
  );
}
