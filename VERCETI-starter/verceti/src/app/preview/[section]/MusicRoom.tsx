
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Source = "Audius" | "Jamendo" | "YouTube" | "SoundCloud";
type CatalogSource = "Audius" | "Jamendo";
type Tab = "personal" | "shared" | "recommendations" | "favorites";
type PlaylistType = "personal" | "shared";
type MusicMode = "trending" | "latest" | "ukrainian" | "search";

type Track = {
  id: string;
  title: string;
  artist: string;
  source: Source;
  url: string;
  playlist_type: PlaylistType;
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

type AudiusTrack = {
  id: string;
  title: string;
  user?: { name?: string };
  artwork?: {
    "150x150"?: string;
    "480x480"?: string;
    "1000x1000"?: string;
  };
  permalink?: string;
  duration?: number;
};

type JamendoTrack = {
  id: string;
  title: string;
  artist: string;
  image?: string;
  duration?: number;
  audio?: string;
  url?: string;
};

type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  source: CatalogSource;
  url: string;
};

type PlayingTrack = {
  id: string;
  title: string;
  artist: string;
  source: Source;
  url: string;
};

function audiusTrackUrl(track: AudiusTrack) {
  const permalink = track.permalink || "https://audius.co/";
  return `${permalink}#audius-track-id=${encodeURIComponent(track.id)}`;
}

function soundCloudEmbed(url: string) {
  try {
    const parsed = new URL(url);

    if (
      !["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com"].includes(
        parsed.hostname
      )
    ) {
      return "";
    }

    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&visual=true`;
  } catch {
    return "";
  }
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "";

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

const tabs: { value: Tab; label: string }[] = [
  { value: "personal", label: "🎧 Особистий" },
  { value: "shared", label: "🌐 Спільний" },
  { value: "recommendations", label: "💡 Рекомендації" },
  { value: "favorites", label: "⭐ Улюблене" },
];

export default function MusicRoom() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [tab, setTab] = useState<Tab>("personal");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");

  const [tracks, setTracks] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const [catalogSource, setCatalogSource] =
    useState<CatalogSource>("Audius");
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [search, setSearch] = useState("");
  const [musicMode, setMusicMode] = useState<MusicMode>("trending");
  const [musicLoading, setMusicLoading] = useState(false);

  const [playing, setPlaying] = useState<PlayingTrack | null>(null);
  const [resolvedId, setResolvedId] = useState("");
  const [resolving, setResolving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [audioError, setAudioError] = useState("");

  // Дозволяє безпечно показувати плеєр через createPortal після завантаження сторінки
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    return () => {
      setIsMounted(false);
    };
  }, []);

  const isManagement = ["admin", "leader", "moderator"].includes(role);

  const loadAudius = useCallback(
    async (action: "trending" | "latest" | "search", query = "") => {
      setCatalogSource("Audius");
      setMusicLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams({ action });

        if (action === "search") {
          params.set("q", query);
        }

        const response = await fetch(`/api/audius?${params.toString()}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Не вдалося завантажити Audius.");
        }

        const items: AudiusTrack[] = Array.isArray(result.data)
          ? result.data
          : [];

        setCatalogTracks(
          items.map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.user?.name || "Невідомий виконавець",
            artwork:
              track.artwork?.["480x480"] ||
              track.artwork?.["150x150"] ||
              track.artwork?.["1000x1000"] ||
              "",
            duration: track.duration || 0,
            source: "Audius",
            url: audiusTrackUrl(track),
          }))
        );

        setMusicMode(action);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Помилка з'єднання з Audius."
        );
        setCatalogTracks([]);
      } finally {
        setMusicLoading(false);
      }
    },
    []
  );

  const loadJamendo = useCallback(
    async (action: "ukrainian" | "search", query = "") => {
      setCatalogSource("Jamendo");
      setMusicLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams({ action });

        if (action === "search") {
          params.set("q", query);
        }

        const response = await fetch(`/api/jamendo?${params.toString()}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Не вдалося завантажити Jamendo.");
        }

        const items: JamendoTrack[] = Array.isArray(result.results)
          ? result.results
          : [];

        setCatalogTracks(
          items.map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            artwork: track.image || "",
            duration: track.duration || 0,
            source: "Jamendo",
            url: track.audio || "",
          }))
        );

        setMusicMode(action);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Помилка з'єднання з Jamendo."
        );
        setCatalogTracks([]);
      } finally {
        setMusicLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !data.user) {
        setMessage("Увійди в акаунт, щоб користуватися музикою.");
        setLoading(false);
        return;
      }

      setUserId(data.user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (cancelled) return;

      if (profileError) {
        console.error("Помилка профілю:", profileError.message);
      }

      setRole(profile?.role || "");
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    loadAudius("trending");
  }, [loadAudius]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setMessage("");

      try {
        const { data: favoriteData, error: favoriteError } = await supabase
          .from("music_favorites")
          .select("track_id");

        if (cancelled) return;

        if (favoriteError) {
          throw new Error("Помилка улюбленого: " + favoriteError.message);
        }

        const ids = (favoriteData || []).map((item) => item.track_id);
        setFavoriteIds(ids);

        if (tab === "personal" || tab === "shared") {
          const { data, error } = await supabase
            .from("music_tracks")
            .select("*")
            .eq("playlist_type", tab)
            .order("created_at", { ascending: false });

          if (cancelled) return;

          if (error) {
            throw new Error("Помилка завантаження альбому: " + error.message);
          }

          setTracks((data || []) as Track[]);
        }

        if (tab === "recommendations") {
          const { data, error } = await supabase
            .from("music_recommendations")
            .select("*")
            .order("created_at", { ascending: false });

          if (cancelled) return;

          if (error) {
            throw new Error("Помилка рекомендацій: " + error.message);
          }

          setRecommendations((data || []) as Recommendation[]);
        }

        if (tab === "favorites") {
          if (ids.length > 0) {
            const { data, error } = await supabase
              .from("music_tracks")
              .select("*")
              .in("id", ids);

            if (cancelled) return;

            if (error) {
              throw new Error("Помилка улюбленого: " + error.message);
            }

            setFavorites((data || []) as Track[]);
          } else {
            setFavorites([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Не вдалося завантажити список."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId, tab]);

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setMessage("");
    setAudioError("");
  }

  function playCatalogTrack(track: CatalogTrack) {
    setAudioError("");
    setResolvedId("");

    if (!track.url) {
      setAudioError("Для цієї композиції немає доступного аудіопотоку.");
      return;
    }

    setPlaying({
      id: track.id,
      title: track.title,
      artist: track.artist,
      source: track.source,
      url: track.url,
    });
  }

  async function saveCatalogTrack(
    track: CatalogTrack,
    playlistType: PlaylistType
  ) {
    if (!userId) {
      setMessage("Спочатку увійди в акаунт.");
      return;
    }

    if (playlistType === "shared" && !isManagement) {
      setMessage("Додавати спільну музику може лише керівництво.");
      return;
    }

    if (!track.url) {
      setMessage("У цієї композиції немає посилання для відтворення.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("music_tracks")
      .insert({
        title: track.title,
        artist: track.artist,
        source: track.source,
        url: track.url,
        playlist_type: playlistType,
        user_id: playlistType === "personal" ? userId : null,
        created_by: userId,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setMessage("Не вдалося зберегти пісню: " + error.message);
      return;
    }

    if (tab === playlistType) {
      setTracks((previous) => [data as Track, ...previous]);
    }

    setMessage(
      playlistType === "personal"
        ? "Пісню додано до особистого альбому!"
        : "Пісню додано до спільного альбому!"
    );
  }

  async function recommendCatalogTrack(track: CatalogTrack) {
    if (!userId) {
      setMessage("Спочатку увійди в акаунт.");
      return;
    }

    if (!track.url) {
      setMessage("У цієї композиції немає посилання для відтворення.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("music_recommendations")
      .insert({
        title: track.title,
        artist: track.artist,
        source: track.source,
        url: track.url,
        user_id: userId,
      });

    setSaving(false);

    if (error) {
      setMessage("Не вдалося надіслати рекомендацію: " + error.message);
      return;
    }

    setMessage("Рекомендацію надіслано керівництву!");
  }

  async function deleteTrack(track: Track) {
    if (track.playlist_type === "shared" && !isManagement) {
      setMessage("Видаляти спільну музику може лише керівництво.");
      return;
    }

    const { error } = await supabase
      .from("music_tracks")
      .delete()
      .eq("id", track.id);

    if (error) {
      setMessage("Помилка видалення: " + error.message);
      return;
    }

    setTracks((previous) => previous.filter((item) => item.id !== track.id));
    setFavorites((previous) => previous.filter((item) => item.id !== track.id));
    setFavoriteIds((previous) => previous.filter((id) => id !== track.id));

    if (playing?.id === track.id) {
      stopPlaying();
    }

    setMessage("Композицію видалено.");
  }

  async function toggleFavorite(track: Track) {
    if (!userId) return;

    const exists = favoriteIds.includes(track.id);

    if (exists) {
      const { error } = await supabase
        .from("music_favorites")
        .delete()
        .eq("track_id", track.id)
        .eq("user_id", userId);

      if (error) {
        setMessage("Помилка: " + error.message);
        return;
      }

      setFavoriteIds((previous) => previous.filter((id) => id !== track.id));
      setFavorites((previous) => previous.filter((item) => item.id !== track.id));
      setMessage("Видалено з улюбленого.");
    } else {
      const { error } = await supabase
        .from("music_favorites")
        .insert({
          track_id: track.id,
          user_id: userId,
        });

      if (error) {
        setMessage("Помилка збереження: " + error.message);
        return;
      }

      setFavoriteIds((previous) => [...previous, track.id]);
      setFavorites((previous) => [...previous, track]);
      setMessage("Додано до улюбленого!");
    }
  }

  async function reviewRecommendation(
    item: Recommendation,
    approved: boolean
  ) {
    if (!isManagement) return;

    if (approved) {
      const { error: insertError } = await supabase
        .from("music_tracks")
        .insert({
          title: item.title,
          artist: item.artist,
          source: item.source,
          url: item.url,
          playlist_type: "shared",
          user_id: null,
          created_by: userId,
        });

      if (insertError) {
        setMessage("Помилка додавання: " + insertError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("music_recommendations")
      .update({ status: approved ? "approved" : "rejected" })
      .eq("id", item.id);

    if (error) {
      setMessage("Помилка зміни статусу: " + error.message);
      return;
    }

    setRecommendations((previous) =>
      previous.map((recommendation) =>
        recommendation.id === item.id
          ? {
              ...recommendation,
              status: approved ? "approved" : "rejected",
            }
          : recommendation
      )
    );

    setMessage(
      approved
        ? "Пісню додано до спільного альбому!"
        : "Рекомендацію відхилено."
    );
  }

  async function resolveAudiusId(track: PlayingTrack) {
    const directId = track.url.match(/audius-track-id=([^&]+)/)?.[1];

    if (directId) {
      return decodeURIComponent(directId);
    }

    const params = new URLSearchParams({
      action: "resolve",
      url: track.url.split("#")[0],
    });

    const response = await fetch(`/api/audius?${params.toString()}`);
    const result = await response.json();

    if (!response.ok || !result.id) {
      throw new Error(result.error || "Не вдалося знайти композицію в Audius.");
    }

    return String(result.id);
  }

  useEffect(() => {
    let cancelled = false;

    async function preparePlayer() {
      if (!playing || playing.source !== "Audius") {
        setResolvedId("");
        setResolving(false);
        return;
      }

      setResolving(true);
      setAudioError("");
      setResolvedId("");

      try {
        const id = await resolveAudiusId(playing);

        if (!cancelled) {
          setResolvedId(id);
        }
      } catch (error) {
        if (!cancelled) {
          setAudioError(
            error instanceof Error
              ? error.message
              : "Не вдалося підготувати композицію."
          );
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    preparePlayer();

    return () => {
      cancelled = true;
    };
  }, [playing]);

  function stopPlaying() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setPlaying(null);
    setResolvedId("");
    setAudioError("");
    setResolving(false);
  }

  const visibleTracks = tab === "favorites" ? favorites : tracks;

  const currentStream = resolvedId
    ? `https://api.audius.co/v1/tracks/${encodeURIComponent(
        resolvedId
      )}/stream?app_name=VERCETI`
    : "";

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!search.trim()) return;

    if (catalogSource === "Audius") {
      loadAudius("search", search.trim());
    } else {
      loadJamendo("search", search.trim());
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        marginTop: 24,
        paddingBottom: 260,
      }}
    >
      {pathname === "/preview/music" ? (
        <>
      {/* ВКЛАДКИ */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>🎵 Музичний простір VERCETI</h2>

        <p className="muted">
          Шукай музику, слухай новинки та створюй власні плейлисти.
        </p>

        <div
          role="tablist"
          aria-label="Музичні альбоми"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              className="btn"
              onClick={() => changeTab(item.value)}
              style={{
                background:
                  tab === item.value
                    ? "rgba(187,138,255,0.35)"
                    : "rgba(255,255,255,0.05)",
                border:
                  tab === item.value
                    ? "1px solid rgba(187,138,255,0.8)"
                    : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* АЛЬБОМ ОДРАЗУ ПІД ВКЛАДКАМИ */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>
          {tab === "personal" && "🎧 Особиста музика"}
          {tab === "shared" && "🌐 Спільна музика"}
          {tab === "recommendations" && "💡 Рекомендації"}
          {tab === "favorites" && "⭐ Улюблені композиції"}
        </h2>

        <p className="muted">
          {tab === "personal" && "Твій особистий плейлист"}
          {tab === "shared" && "Музика всієї спільноти"}
          {tab === "recommendations" &&
            "Пропозиції учасників для спільного плейлиста"}
          {tab === "favorites" && "Пісні, які ти зберіг"}
        </p>

        {message && (
          <p className="page-note" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <p className="muted">Завантаження...</p>
        ) : tab === "recommendations" ? (
          recommendations.length === 0 ? (
            <p className="muted">Рекомендацій поки немає.</p>
          ) : (
            recommendations.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 14,
                  marginTop: 10,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <strong>{item.title}</strong>
                <p className="muted">
                  {item.artist} · {item.source}
                </p>

                {item.source === "Audius" || item.source === "Jamendo" ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setAudioError("");
                      setResolvedId("");
                      setPlaying({
                        id: item.id,
                        title: item.title,
                        artist: item.artist,
                        source: item.source,
                        url: item.url,
                      });
                    }}
                  >
                    ▶ Слухати
                  </button>
                ) : (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Відкрити посилання
                  </a>
                )}

                <p className="page-note">
                  Статус:{" "}
                  {item.status === "pending"
                    ? "Очікує розгляду"
                    : item.status === "approved"
                      ? "Схвалено"
                      : "Відхилено"}
                </p>

                {isManagement && item.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => reviewRecommendation(item, true)}
                    >
                      ✓ Додати до спільного
                    </button>

                    <button
                      className="btn"
                      type="button"
                      onClick={() => reviewRecommendation(item, false)}
                    >
                      Відхилити
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        ) : visibleTracks.length === 0 ? (
          <p className="muted">
            У цьому списку поки немає композицій.
          </p>
        ) : (
          visibleTracks.map((track, index) => (
            <div
              key={track.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                marginTop: 8,
                borderRadius: 10,
                background:
                  playing?.id === track.id
                    ? "rgba(187,138,255,0.15)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              <span className="muted">
                {String(index + 1).padStart(2, "0")}
              </span>

              <button
                type="button"
                onClick={() => {
                  setAudioError("");
                  setResolvedId("");
                  setPlaying({
                    id: track.id,
                    title: track.title,
                    artist: track.artist,
                    source: track.source,
                    url: track.url,
                  });
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  background: "transparent",
                  border: 0,
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <strong style={{ display: "block" }}>{track.title}</strong>

                <span className="muted" style={{ fontSize: 12 }}>
                  {track.artist} · {track.source}
                </span>
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => toggleFavorite(track)}
                title="Улюблене"
              >
                {favoriteIds.includes(track.id) ? "⭐" : "☆"}
              </button>

              {(track.playlist_type === "personal" || isManagement) && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => deleteTrack(track)}
                  title="Видалити"
                >
                  🗑
                </button>
              )}
            </div>
          ))
        )}
      </section>

      {/* ПОШУК МУЗИКИ ПІСЛЯ АЛЬБОМІВ */}
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>🔎 Знайти музику</h2>

        <p className="muted">
          Обери музичний каталог або введи назву композиції чи виконавця.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn"
            type="button"
            onClick={() => loadAudius("trending")}
            disabled={musicLoading}
            style={{
              background:
                catalogSource === "Audius"
                  ? "rgba(187,138,255,0.35)"
                  : undefined,
            }}
          >
            🎵 Audius
          </button>

          <button
            className="btn"
            type="button"
            onClick={() => loadJamendo("ukrainian")}
            disabled={musicLoading}
            style={{
              background:
                catalogSource === "Jamendo"
                  ? "rgba(187,138,255,0.35)"
                  : undefined,
            }}
          >
            🇺🇦 Jamendo
          </button>
        </div>

        <form
          onSubmit={submitSearch}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Наприклад, українська музика або назва пісні"
            style={{ flex: 1, minWidth: 180 }}
          />

          <button
            className="btn"
            type="submit"
            disabled={!search.trim() || musicLoading}
          >
            Шукати
          </button>
        </form>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {catalogSource === "Audius" ? (
            <>
              <button
                className="btn"
                type="button"
                onClick={() => loadAudius("trending")}
                disabled={musicLoading}
              >
                🔥 Популярне
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => loadAudius("latest")}
                disabled={musicLoading}
              >
                ✨ Новинки
              </button>
            </>
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => loadJamendo("ukrainian")}
              disabled={musicLoading}
            >
              🇺🇦 Український чарт
            </button>
          )}
        </div>

        <h3 style={{ marginTop: 22 }}>
          {musicMode === "trending"
            ? "🔥 Популярні композиції Audius"
            : musicMode === "latest"
              ? "✨ Нові композиції Audius"
              : musicMode === "ukrainian"
                ? "🇺🇦 Український чарт Jamendo"
                : `🔎 Результати пошуку — ${catalogSource}`}
        </h3>

        {musicLoading ? (
          <p className="muted">Шукаємо музику...</p>
        ) : catalogTracks.length === 0 ? (
          <p className="muted">
            Композицій не знайдено. Спробуй інший запит або каталог.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {catalogTracks.map((track) => (
              <div
                key={`${track.source}-${track.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 10,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  flexWrap: "wrap",
                }}
              >
                {track.artwork ? (
                  <img
                    src={track.artwork}
                    alt=""
                    width={58}
                    height={58}
                    style={{ borderRadius: 8, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(187,138,255,0.15)",
                    }}
                  >
                    🎵
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 130 }}>
                  <strong style={{ display: "block" }}>{track.title}</strong>

                  <span className="muted" style={{ fontSize: 12 }}>
                    {track.artist}
                    {track.duration
                      ? ` · ${formatDuration(track.duration)}`
                      : ""}
                    {" · "}
                    {track.source}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={!track.url}
                    onClick={() => playCatalogTrack(track)}
                    title="Слухати"
                  >
                    ▶
                  </button>

                  <button
                    className="btn"
                    type="button"
                    disabled={saving || !track.url}
                    onClick={() => saveCatalogTrack(track, "personal")}
                    title="В особистий альбом"
                  >
                    +🎧
                  </button>

                  {isManagement && (
                    <button
                      className="btn"
                      type="button"
                      disabled={saving || !track.url}
                      onClick={() => saveCatalogTrack(track, "shared")}
                      title="У спільний альбом"
                    >
                      +🌐
                    </button>
                  )}

                  <button
                    className="btn"
                    type="button"
                    disabled={saving || !track.url}
                    onClick={() => recommendCatalogTrack(track)}
                    title="Запропонувати керівництву"
                  >
                    💡
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Audius і Jamendo надають незалежні музичні каталоги. Доступність
          композицій та можливість відтворення залежать від авторів і джерела.
        </p>
      </section>

        </>
      ) : null}

      {/* ЗАКРІПЛЕНИЙ ПЛЕЄР — ПОЗА ОСНОВНИМ КОНТЕЙНЕРОМ */}
      {isMounted &&
        createPortal(
          <section
            className="panel"
            style={{
              position: "fixed",
              bottom: "max(12px, env(safe-area-inset-bottom))",
              left: 12,
              right: 12,
              zIndex: 10000,
              width: "auto",
              maxWidth: 900,
              margin: "0 auto",
              background: "rgba(25, 20, 38, 0.97)",
              border: "1px solid rgba(187,138,255,0.5)",
              boxShadow: "0 0 25px rgba(0,0,0,0.4)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              maxHeight: "45vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>▶ Музичний плеєр</h2>

            {playing ? (
              <>
                <h3>{playing.title}</h3>
                <p className="muted">
                  {playing.artist} · {playing.source}
                </p>

                {playing.source === "Audius" ? (
                  resolving ? (
                    <p className="muted">
                      Підключаємо композицію до плеєра...
                    </p>
                  ) : currentStream ? (
                    <audio
                      ref={audioRef}
                      key={resolvedId}
                      controls
                      autoPlay
                      preload="auto"
                      src={currentStream}
                      onError={() => {
                        setAudioError(
                          "Audius не зміг передати аудіо. Спробуй іншу композицію."
                        );
                      }}
                      onCanPlay={() => setAudioError("")}
                      style={{ width: "100%", marginTop: 12 }}
                    >
                      Твій браузер не підтримує аудіоплеєр.
                    </audio>
                  ) : null
                ) : playing.source === "Jamendo" ? (
                  <audio
                    ref={audioRef}
                    key={playing.url}
                    controls
                    autoPlay
                    preload="metadata"
                    src={playing.url}
                    onError={() => {
                      setAudioError(
                        "Jamendo не зміг передати аудіо. Спробуй іншу композицію."
                      );
                    }}
                    onCanPlay={() => setAudioError("")}
                    style={{ width: "100%", marginTop: 12 }}
                  >
                    Твій браузер не підтримує аудіоплеєр.
                  </audio>
                ) : playing.source === "SoundCloud" &&
                  soundCloudEmbed(playing.url) ? (
                  <iframe
                    key={playing.id}
                    src={soundCloudEmbed(playing.url)}
                    title={playing.title}
                    width="100%"
                    height="166"
                    style={{ border: 0, borderRadius: 12, marginTop: 12 }}
                    allow="autoplay"
                  />
                ) : (
                  <p className="muted">
                    Цей формат поки не підтримується вбудованим плеєром.
                  </p>
                )}

                {audioError && (
                  <p className="page-note" role="alert">
                    {audioError}
                  </p>
                )}

                {playing.source === "Audius" && (
                  <p>
                    <a
                      href={playing.url.split("#")[0]}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Відкрити сторінку композиції в Audius
                    </a>
                  </p>
                )}

                <button className="btn" type="button" onClick={stopPlaying}>
                  ■ Зупинити
                </button>
              </>
            ) : (
              <p className="muted">
                Вибери композицію зі списку або натисни ▶ біля результату пошуку.
              </p>
            )}
          </section>,
          document.body
        )}
    </div>
  );
}
