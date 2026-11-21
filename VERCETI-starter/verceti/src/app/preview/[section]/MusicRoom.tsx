
"use client";

import { useState } from "react";

type Track = {
  id: number;
  title: string;
  artist: string;
};

const initialTracks: Track[] = [
  { id: 1, title: "Нічне місто", artist: "VERCETI Radio" },
  { id: 2, title: "Без меж", artist: "VERCETI Radio" },
  { id: 3, title: "Атмосфера", artist: "VERCETI Radio" }
];

export default function MusicRoom() {
  const [tracks, setTracks] = useState(initialTracks);
  const [activeTrack, setActiveTrack] = useState<number | null>(1);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState("YouTube");
  const [showAdd, setShowAdd] = useState(false);

  const currentTrack = tracks.find((track) => track.id === activeTrack);

  function addTrack() {
    if (!title.trim()) return;

    const track: Track = {
      id: Date.now(),
      title: title.trim(),
      artist: artist.trim() || "Невідомий виконавець"
    };

    setTracks((previous) => [...previous, track]);
    setActiveTrack(track.id);
    setPlaying(false);
    setTitle("");
    setArtist("");
    setShowAdd(false);
  }

  function deleteTrack(id: number) {
    setTracks((previous) => previous.filter((track) => track.id !== id));

    if (activeTrack === id) {
      setActiveTrack(null);
      setPlaying(false);
    }
  }

  function selectTrack(id: number) {
    setActiveTrack(id);
    setPlaying(false);
  }

  return (
    <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>🎵 Музичний простір</h2>
            <p className="muted">
              Музика для всієї спільноти VERCETI
            </p>
          </div>

          <span className="badge">Музика</span>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 24,
            borderRadius: 14,
            textAlign: "center",
            background:
              "linear-gradient(135deg, rgba(115,65,180,0.25), rgba(30,20,55,0.7))",
            border: "1px solid rgba(187,138,255,0.2)"
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎧</div>

          <h2 style={{ margin: 0 }}>
            {currentTrack?.title || "Нічого не вибрано"}
          </h2>

          <p className="muted">
            {currentTrack?.artist || "Вибери композицію зі списку"}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              alignItems: "center",
              marginTop: 20
            }}
          >
            <button
              className="btn"
              type="button"
              disabled={!currentTrack}
              onClick={() => {
                const index = tracks.findIndex(
                  (track) => track.id === activeTrack
                );
                if (index > 0) selectTrack(tracks[index - 1].id);
              }}
            >
              ⏮
            </button>

            <button
              className="btn"
              type="button"
              disabled={!currentTrack}
              onClick={() => setPlaying((value) => !value)}
              style={{
                minWidth: 110,
                background: "rgba(187,138,255,0.25)"
              }}
            >
              {playing ? "⏸ Пауза" : "▶ Слухати"}
            </button>

            <button
              className="btn"
              type="button"
              disabled={!currentTrack}
              onClick={() => {
                const index = tracks.findIndex(
                  (track) => track.id === activeTrack
                );
                if (index >= 0 && index < tracks.length - 1) {
                  selectTrack(tracks[index + 1].id);
                }
              }}
            >
              ⏭
            </button>
          </div>

          <p className="page-note">
            Це поки демонстраційний плеєр. Реальне відтворення музики
            та синхронізацію між учасниками підключимо окремо.
          </p>
        </div>
      </section>

      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>📃 Список відтворення</h2>
            <p className="muted">
              Композиції спільноти: {tracks.length}
            </p>
          </div>

          <button
            className="btn"
            type="button"
            onClick={() => setShowAdd((value) => !value)}
          >
            + Додати музику
          </button>
        </div>

        {showAdd && (
          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 12,
              background: "rgba(0,0,0,0.2)"
            }}
          >
            <h3 style={{ marginTop: 0 }}>Додати композицію</h3>

            <label className="muted">Назва композиції</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Введи назву"
              maxLength={100}
            />

            <label className="muted">Виконавець</label>
            <input
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="Ім'я виконавця"
              maxLength={100}
            />

            <label className="muted">Джерело</label>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option>YouTube</option>
              <option>SoundCloud</option>
            </select>

            <p className="page-note">
              Обране джерело: {source}. Підключення посилань буде наступним етапом.
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                type="button"
                onClick={addTrack}
                disabled={!title.trim()}
              >
                Додати
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => setShowAdd(false)}
              >
                Скасувати
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          {tracks.length === 0 ? (
            <p className="muted">Список поки порожній.</p>
          ) : (
            tracks.map((track, index) => (
              <div
                key={track.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  marginTop: 8,
                  borderRadius: 10,
                  background:
                    activeTrack === track.id
                      ? "rgba(187,138,255,0.15)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    activeTrack === track.id
                      ? "1px solid rgba(187,138,255,0.3)"
                      : "1px solid transparent"
                }}
              >
                <span style={{ opacity: 0.6, minWidth: 22 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>

                <button
                  type="button"
                  onClick={() => selectTrack(track.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    background: "transparent",
                    border: 0,
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  <strong style={{ display: "block" }}>
                    {track.title}
                  </strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {track.artist}
                  </span>
                </button>

                <button
                  className="btn"
                  type="button"
                  onClick={() => deleteTrack(track.id)}
                  title="Видалити зі списку"
                >
                  🗑
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
