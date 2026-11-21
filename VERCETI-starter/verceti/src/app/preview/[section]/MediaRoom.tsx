
"use client";

import { useState } from "react";

type Album = {
  id: string;
  title: string;
  description: string;
  icon: string;
  access: string;
};

const albums: Album[] = [
  {
    id: "management-photos",
    title: "Фото керівництва",
    description: "Фотографії адміністратора та керівництва VERCETI.",
    icon: "👑",
    access: "Лише керівництво"
  },
  {
    id: "members-photos",
    title: "Фото учасників",
    description: "Спільні фотографії учасників спільноти.",
    icon: "📸",
    access: "Усі учасники"
  },
  {
    id: "management-videos",
    title: "Відео керівництва",
    description: "Відеоматеріали керівництва VERCETI.",
    icon: "🎬",
    access: "Лише керівництво"
  },
  {
    id: "members-videos",
    title: "Відео учасників",
    description: "Відео та моменти з життя спільноти.",
    icon: "🎥",
    access: "Усі учасники"
  }
];

export default function MediaRoom() {
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);

  const selectedAlbum = albums.find(
    (album) => album.id === activeAlbum
  );

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
            <h2 style={{ margin: 0 }}>📷 Медіатека VERCETI</h2>
            <p className="muted">
              Фотографії та відео нашої спільноти
            </p>
          </div>

          <span className="badge">4 альбоми</span>
        </div>

        {selectedAlbum ? (
          <div style={{ marginTop: 20 }}>
            <button
              className="btn"
              type="button"
              onClick={() => setActiveAlbum(null)}
            >
              ← Назад до альбомів
            </button>

            <div className="panel" style={{ marginTop: 18 }}>
              <div style={{ fontSize: 42 }}>
                {selectedAlbum.icon}
              </div>

              <h2>{selectedAlbum.title}</h2>

              <p className="muted">
                {selectedAlbum.description}
              </p>

              <div className="tag" style={{ display: "inline-block" }}>
                {selectedAlbum.access}
              </div>

              <div
                style={{
                  marginTop: 20,
                  padding: 24,
                  textAlign: "center",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px dashed rgba(187,138,255,0.35)"
                }}
              >
                <div style={{ fontSize: 42 }}>🖼️</div>

                <h3>Альбом поки порожній</h3>

                <p className="muted">
                  Тут будуть відображатися фотографії та відео.
                </p>

                <p className="page-note">
                  Завантаження файлів і перевірка прав доступу будуть
                  підключені окремо.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginTop: 20
            }}
          >
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => setActiveAlbum(album.id)}
                style={{
                  textAlign: "left",
                  padding: 20,
                  borderRadius: 14,
                  color: "inherit",
                  cursor: "pointer",
                  background:
                    "linear-gradient(135deg, rgba(115,65,180,0.18), rgba(30,20,55,0.55))",
                  border: "1px solid rgba(187,138,255,0.2)"
                }}
              >
                <div style={{ fontSize: 36 }}>
                  {album.icon}
                </div>

                <h3 style={{ marginBottom: 8 }}>
                  {album.title}
                </h3>

                <p className="muted" style={{ fontSize: 13 }}>
                  {album.description}
                </p>

                <span className="tag">
                  {album.access}
                </span>

                <div
                  style={{
                    marginTop: 18,
                    color: "#bb8aff",
                    fontSize: 13
                  }}
                >
                  Відкрити альбом →
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <p className="page-note">
        Це перша версія інтерфейсу медіатеки. Файли поки не завантажуються
        та не зберігаються. Реальне сховище й контроль доступу додамо окремо.
      </p>
    </div>
  );
}
