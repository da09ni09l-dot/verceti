
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Album = {
  id: string;
  title: string;
  description: string;
  icon: string;
  access: string;
};

type MediaFile = {
  name: string;
  url: string;
  isVideo: boolean;
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

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function MediaRoom() {
  const supabase = createClient();

  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [canManage, setCanManage] = useState(false);
  const selectedAlbum = albums.find(
    (album) => album.id === activeAlbum
  );
  useEffect(() => {
  async function checkRole() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setCanManage(
      ["admin", "leader", "moderator"].includes(data?.role ?? "")
    );
  }

  checkRole();
}, []);
  async function loadFiles(albumId: string) {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.storage
      .from("verceti-media")
      .list(albumId, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      });

    if (error) {
      setMessage("Не вдалося завантажити список файлів: " + error.message);
      setFiles([]);
      setLoading(false);
      return;
    }

    const mediaFiles: MediaFile[] = [];

    for (const file of data ?? []) {
      if (!file.name || file.name.startsWith(".")) continue;

      const path = `${albumId}/${file.name}`;

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from("verceti-media")
          .createSignedUrl(path, 3600);

      if (signedError || !signedData) continue;

      const isVideo =
        file.metadata?.mimetype?.startsWith("video/") ||
        /\.(mp4|webm|mov|m4v)$/i.test(file.name);

      mediaFiles.push({
        name: file.name,
        url: signedData.signedUrl,
        isVideo: Boolean(isVideo)
      });
    }

    setFiles(mediaFiles);
    setLoading(false);
  }

  useEffect(() => {
    if (activeAlbum) {
      loadFiles(activeAlbum);
    } else {
      setFiles([]);
      setMessage("");
    }
  }, [activeAlbum]);
  async function deleteFile(fileName: string) {
  if (!activeAlbum || !canManage) return;

  const confirmed = window.confirm(
    `Точно видалити файл "${fileName}"?`
  );

  if (!confirmed) return;

  const filePath = `${activeAlbum}/${fileName}`;

  const { error } = await supabase.storage
    .from("verceti-media")
    .remove([filePath]);

  if (error) {
    setMessage("Помилка видалення: " + error.message);
    return;
  }

  setMessage("Файл успішно видалено.");
  await loadFiles(activeAlbum);
}
  async function uploadFiles(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (!activeAlbum || selectedFiles.length === 0) return;

    const isVideoAlbum = activeAlbum.includes("videos");

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setMessage(`Файл ${file.name} перевищує ліміт 50 МБ.`);
        event.target.value = "";
        return;
      }

      if (
        isVideoAlbum
          ? !file.type.startsWith("video/")
          : !file.type.startsWith("image/")
      ) {
        setMessage(
          isVideoAlbum
            ? "У цей альбом можна додавати лише відео."
            : "У цей альбом можна додавати лише фотографії."
        );
        event.target.value = "";
        return;
      }
    }

    setUploading(true);
    setMessage("");

    for (const file of selectedFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${activeAlbum}/${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabase.storage
        .from("verceti-media")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        setMessage("Помилка завантаження: " + error.message);
        setUploading(false);
        event.target.value = "";
        return;
      }
    }

    setMessage("Файли успішно завантажено!");
    await loadFiles(activeAlbum);

    setUploading(false);
    event.target.value = "";
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

              <div style={{ marginTop: 22 }}>
                <label
                  className="btn"
                  style={{
                    display: "inline-block",
                    cursor: uploading ? "wait" : "pointer",
                    opacity: uploading ? 0.6 : 1
                  }}
                >
                  {uploading ? "Завантаження..." : "＋ Додати файли"}

                  <input
                    type="file"
                    accept={
                    activeAlbum?.includes("videos")
                    ? "video/*"
                    : "image/*"
                    }
                    multiple
                    disabled={uploading}
                    onChange={uploadFiles}
                    style={{ display: "none" }}
                  />
                </label>

                <p className="page-note">
                  Максимальний розмір одного файлу — 50 МБ.
                </p>
              </div>

              {message && (
                <p className="page-note" role="status">
                  {message}
                </p>
              )}

              {loading ? (
                <p className="muted">Завантаження медіатеки...</p>
              ) : files.length === 0 ? (
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
                    Додай перші фотографії або відео.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 14,
                    marginTop: 22
                  }}
                >
                  {files.map((file) => (
                    <div
                      key={file.name}
                      style={{
                        overflow: "hidden",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(187,138,255,0.2)"
                      }}
                    >
                      {file.isVideo ? (
                        <video
                          src={file.url}
                          controls
                          style={{
                            width: "100%",
                            aspectRatio: "4 / 3",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={file.url}
                            alt={file.name}
                            loading="lazy"
                            style={{
                              width: "100%",
                              aspectRatio: "4 / 3",
                              objectFit: "cover",
                              display: "block"
                            }}
                          />
                        </a>
                      )}

                      <p
                        style={{
                          padding: "8px 10px",
                          margin: 0,
                          fontSize: 12,
                          overflowWrap: "anywhere"
                        }}
                      >
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
                <div style={{ fontSize: 36 }}>{album.icon}</div>

                <h3 style={{ marginBottom: 8 }}>{album.title}</h3>

                <p className="muted" style={{ fontSize: 13 }}>
                  {album.description}
                </p>

                <span className="tag">{album.access}</span>

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
        Медіафайли зберігаються у приватному сховищі VERCETI.
        Доступ до них контролюється правилами Supabase.
      </p>
    </div>
  );
}
