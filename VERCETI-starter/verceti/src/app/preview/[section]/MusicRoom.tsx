
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Source = "YouTube" | "SoundCloud";
type Tab = "personal" | "shared" | "recommendations" | "favorites";

type Track = {
  id: string;
  title: string;
  artist: string;
  source: Source;
  url: string;
  playlist_type: "personal" | "shared";
  user_id: string | null;
};

type Recommendation = {
  id: string;
  title: string;
  artist: string;
  source: Source;
  url: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
};

function getEmbedUrl(track: Track) {
  if (track.source === "YouTube") {
    let videoId = "";

    try {
      const url = new URL(track.url);

      if (url.hostname.includes("youtu.be")) {
        videoId = url.pathname.slice(1);
      } else if (url.hostname.includes("youtube.com")) {
        videoId =
          url.searchParams.get("v") ||
          url.pathname.split("/").pop() ||
          "";
      }
    } catch {
      return "";
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return "";

    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }

  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    track.url
  )}&auto_play=false&visual=true`;
}

function validLink(source: Source, value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return false;

    if (source === "YouTube") {
      return (
        url.hostname === "youtube.com" ||
        url.hostname === "www.youtube.com" ||
        url.hostname === "m.youtube.com" ||
        url.hostname === "youtu.be" ||
        url.hostname === "www.youtu.be"
      );
    }

    return (
      url.hostname === "soundcloud.com" ||
      url.hostname === "www.soundcloud.com" ||
      url.hostname === "m.soundcloud.com"
    );
  } catch {
    return false;
  }
}

export default function MusicRoom() {
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState<Tab>("personal");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState<Source>("YouTube");
  const [url, setUrl] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const isManagement = ["admin", "leader", "moderator"].includes(role);

  const visibleTracks =
    tab === "favorites" ? favorites : tracks;

  const currentTrack =
    visibleTracks.find((track) => track.id === activeId) || null;

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setMessage("Увійди в акаунт, щоб користуватися музикою.");
        setLoading(false);
        return;
      }

      setUserId(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      setRole(profile?.role || "");
    }

    loadUser();
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    async function loadData() {
      setLoading(true);
      setMessage("");

      if (tab === "personal" || tab === "shared") {
        const { data, error } = await supabase
          .from("music_tracks")
          .select("*")
          .eq("playlist_type", tab)
          .order("created_at", { ascending: false });

        if (error) {
          setMessage("Не вдалося завантажити музику: " + error.message);
        } else {
          const list = (data || []) as Track[];
          setTracks(list);

          if (!list.some((track) => track.id === activeId)) {
            setActiveId(list[0]?.id || null);
          }
        }
      }

      if (tab === "recommendations") {
        const { data, error } = await supabase
          .from("music_recommendations")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          setMessage("Не вдалося завантажити рекомендації: " + error.message);
        } else {
          setRecommendations((data || []) as Recommendation[]);
        }
      }

      if (tab === "favorites") {
        const { data, error } = await supabase
          .from("music_favorites")
          .select("track_id");

        if (error) {
          setMessage("Не вдалося завантажити улюблене: " + error.message);
        } else {
          const ids = (data || []).map((item) => item.track_id);

          if (ids.length) {
            const { data: saved, error: savedError } = await supabase
              .from("music_tracks")
              .select("*")
              .in("id", ids);

            if (savedError) {
              setMessage("Не вдалося завантажити пісні: " + savedError.message);
            } else {
              setFavorites((saved || []) as Track[]);
            }
          } else {
            setFavorites([]);
          }
        }
      }

      setLoading(false);
    }

    loadData();
  }, [supabase, userId, tab]);

  function clearForm() {
    setTitle("");
    setArtist("");
    setUrl("");
    setSource("YouTube");
    setShowAdd(false);
  }

  async function addTrack() {
    if (!title.trim() || !validLink(source, url.trim())) {
      setMessage("Вкажи назву та правильне посилання YouTube або SoundCloud.");
      return;
    }

    if (tab === "shared" && !isManagement) {
      setMessage("Додавати спільну музику може лише керівництво.");
      return;
    }

    const playlistType = tab === "shared" ? "shared" : "personal";

    const { data, error } = await supabase
      .from("music_tracks")
      .insert({
        title: title.trim(),
        artist: artist.trim() || "Невідомий виконавець",
        source,
        url: url.trim(),
        playlist_type: playlistType,
        user_id: playlistType === "personal" ? userId : null,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      setMessage("Не вдалося додати пісню: " + error.message);
      return;
    }

    setTracks((previous) => [data as Track, ...previous]);
    setActiveId(data.id);
    setMessage("Композицію додано!");
    clearForm();
  }

  async function sendRecommendation() {
    if (!title.trim() || !validLink(source, url.trim())) {
      setMessage("Вкажи назву та правильне посилання на композицію.");
      return;
    }

    const { error } = await supabase
      .from("music_recommendations")
      .insert({
        title: title.trim(),
        artist: artist.trim() || "Невідомий виконавець",
        source,
        url: url.trim(),
        user_id: userId
      });

    if (error) {
      setMessage("Не вдалося надіслати рекомендацію: " + error.message);
      return;
    }

    setMessage("Рекомендацію надіслано керівництву!");
    clearForm();
  }

  async function deleteTrack(track: Track) {
    if (
      track.playlist_type === "shared" &&
      !isManagement
    ) {
      setMessage("Видаляти спільну музику може лише керівництво.");
      return;
    }

    const { error } = await supabase
      .from("music_tracks")
      .delete()
      .eq("id", track.id);

    if (error) {
      setMessage("Не вдалося видалити композицію: " + error.message);
      return;
    }

    setTracks((previous) => previous.filter((item) => item.id !== track.id));
    setFavorites((previous) => previous.filter((item) => item.id !== track.id));

    if (activeId === track.id) setActiveId(null);

    setMessage("Композицію видалено.");
  }

  async function toggleFavorite(track: Track) {
    const exists = favorites.some((item) => item.id === track.id);

    if (exists) {
      const { error } = await supabase
        .from("music_favorites")
        .delete()
        .eq("track_id", track.id)
        .eq("user_id", userId);

      if (error) {
        setMessage("Не вдалося прибрати з улюбленого: " + error.message);
        return;
      }

      setFavorites((previous) => previous.filter((item) => item.id !== track.id));
      setMessage("Видалено з улюбленого.");
    } else {
      const { error } = await supabase
        .from("music_favorites")
        .insert({ track_id: track.id, user_id: userId });

      if (error) {
        setMessage("Не вдалося зберегти композицію: " + error.message);
        return;
      }

      setFavorites((previous) => [...previous, track]);
      setMessage("Додано до улюбленого!");
    }
  }

  async function reviewRecommendation(
    recommendation: Recommendation,
    approved: boolean
  ) {
    if (!isManagement) return;

    if (approved) {
      const { error: insertError } = await supabase
        .from("music_tracks")
        .insert({
          title: recommendation.title,
          artist: recommendation.artist,
          source: recommendation.source,
          url: recommendation.url,
          playlist_type: "shared",
          user_id: null,
          created_by: userId
        });

      if (insertError) {
        setMessage("Не вдалося додати до спільної музики: " + insertError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("music_recommendations")
      .update({ status: approved ? "approved" : "rejected" })
      .eq("id", recommendation.id);

    if (error) {
      setMessage("Не вдалося оновити рекомендацію: " + error.message);
      return;
    }

    setRecommendations((previous) =>
      previous.map((item) =>
        item.id === recommendation.id
          ? { ...item, status: approved ? "approved" : "rejected" }
          : item
      )
    );

    setMessage(approved ? "Пісню додано до спільного плейлиста!" : "Рекомендацію відхилено.");
  }

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setActiveId(null);
    setShowAdd(false);
    setMessage("");
  }

  return (
    <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>🎵 Музичний простір VERCETI</h2>
        <p className="muted">
          Музика, рекомендації та улюблені композиції спільноти.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
          {[
            ["personal", "🎧 Особистий"],
            ["shared", "🌐 Спільний"],
            ["recommendations", "💡 Рекомендації"],
            ["favorites", "⭐ Улюблене"]
          ].map(([value, label]) => (
            <button
              key={value}
              className="btn"
              type="button"
              onClick={() => changeTab(value as Tab)}
              style={{
                background: tab === value
                  ? "rgba(187,138,255,0.3)"
                  : "rgba(255,255,255,0.05)"
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>
              {tab === "personal" && "🎧 Особиста музика"}
              {tab === "shared" && "🌐 Спільна музика"}
              {tab === "recommendations" && "💡 Рекомендації"}
              {tab === "favorites" && "⭐ Улюблені композиції"}
            </h2>
            <p className="muted">
              {tab === "personal" && "Твій особистий плейлист"}
              {tab === "shared" && "Музика всієї спільноти"}
              {tab === "recommendations" && "Пропозиції учасників для спільного плейлиста"}
              {tab === "favorites" && "Пісні, які ти зберіг"}
            </p>
          </div>

          {(tab === "personal" || tab === "recommendations" ||
            (tab === "shared" && isManagement)) && (
            <button className="btn" type="button" onClick={() => setShowAdd(!showAdd)}>
              + {tab === "recommendations" ? "Запропонувати пісню" : "Додати музику"}
            </button>
          )}
        </div>

        {showAdd && (
          <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0 }}>
              {tab === "recommendations" ? "Нова рекомендація" : "Додати композицію"}
            </h3>

            <label className="muted">Назва композиції</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Назва пісні"
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
            <select value={source} onChange={(event) => setSource(event.target.value as Source)}>
              <option value="YouTube">YouTube</option>
              <option value="SoundCloud">SoundCloud</option>
            </select>

            <label className="muted">Посилання на музику</label>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
              type="url"
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button
                className="btn"
                type="button"
                onClick={tab === "recommendations" ? sendRecommendation : addTrack}
                disabled={!title.trim() || !url.trim()}
              >
                {tab === "recommendations" ? "Надіслати рекомендацію" : "Зберегти пісню"}
              </button>
              <button className="btn" type="button" onClick={clearForm}>
                Скасувати
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="page-note" role="status">{message}</p>
        )}

        {loading ? (
          <p className="muted">Завантаження...</p>
        ) : tab === "recommendations" ? (
          recommendations.length === 0 ? (
            <p className="muted">Рекомендацій поки немає.</p>
          ) : (
            recommendations.map((item) => (
              <div key={item.id} style={{ padding: 14, marginTop: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                <strong>{item.title}</strong>
                <p className="muted">{item.artist}</p>
                <a href={item.url} target="_blank" rel="noreferrer">Відкрити посилання</a>
                <p className="page-note">
                  Статус: {item.status === "pending" ? "Очікує розгляду" : item.status === "approved" ? "Схвалено" : "Відхилено"}
                </p>
                {isManagement && item.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" type="button" onClick={() => reviewRecommendation(item, true)}>
                      ✓ Додати до спільного
                    </button>
                    <button className="btn" type="button" onClick={() => reviewRecommendation(item, false)}>
                      Відхилити
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        ) : visibleTracks.length === 0 ? (
          <p className="muted">У цьому списку поки немає композицій.</p>
        ) : (
          visibleTracks.map((track, index) => {
            const isFavorite = favorites.some((item) => item.id === track.id);

            return (
              <div
                key={track.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  marginTop: 8,
                  borderRadius: 10,
                  background: activeId === track.id
                    ? "rgba(187,138,255,0.15)"
                    : "rgba(255,255,255,0.04)"
                }}
              >
                <span className="muted">{String(index + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  onClick={() => setActiveId(track.id)}
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
                  <strong style={{ display: "block" }}>{track.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{track.artist}</span>
                </button>

                <button className="btn" type="button" onClick={() => toggleFavorite(track)} title="Улюблене">
                  {isFavorite ? "⭐" : "☆"}
                </button>

                {(track.playlist_type === "personal" || isManagement) && (
                  <button className="btn" type="button" onClick={() => deleteTrack(track)} title="Видалити">
                    🗑
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>

      {(tab === "personal" || tab === "shared" || tab === "favorites") && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>▶ Плеєр</h2>

          {currentTrack ? (
            <>
              <h3>{currentTrack.title}</h3>
              <p className="muted">{currentTrack.artist}</p>
              {currentTrack.source === "YouTube" ? (
                <iframe
                  key={currentTrack.id}
                  src={getEmbedUrl(currentTrack)}
                  title={currentTrack.title}
                  width="100%"
                  height="315"
                  style={{ border: 0, borderRadius: 12, marginTop: 12 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <iframe
                  key={currentTrack.id}
                  title={currentTrack.title}
                  width="100%"
                  height="166"
                  scrolling="no"
                  frameBorder="0"
                  allow="autoplay"
                  src={getEmbedUrl(currentTrack)}
                  style={{ borderRadius: 12, marginTop: 12 }}
                />
              )}
              <p className="page-note">
                Керуй відтворенням у вбудованому програвачі YouTube або SoundCloud.
              </p>
            </>
          ) : (
            <p className="muted">Вибери композицію зі списку, щоб відкрити програвач.</p>
          )}
        </section>
      )}
    </div>
  );
}
