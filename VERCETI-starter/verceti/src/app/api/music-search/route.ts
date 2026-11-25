import { NextRequest, NextResponse } from "next/server";

type UnifiedTrack = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  source: "Audius" | "Jamendo" | "iTunes";
  url: string;
  externalUrl?: string;
};

const AUDIUS_API = "https://api.audius.co/v1";
const JAMENDO_API = "https://api.jamendo.com/v3.0";

async function searchAudius(query: string): Promise<UnifiedTrack[]> {
  const response = await fetch(
    `${AUDIUS_API}/tracks/search?query=${encodeURIComponent(query)}&limit=20&app_name=VERCETI`,
    { cache: "no-store", signal: AbortSignal.timeout(9000) }
  );
  if (!response.ok) throw new Error(`Audius: ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.data) ? payload.data : []).map((track: any) => ({
    id: String(track.id),
    title: track.title || "Без назви",
    artist: track.user?.name || "Невідомий виконавець",
    artwork: track.artwork?.["480x480"] || track.artwork?.["150x150"] || "",
    duration: Number(track.duration) || 0,
    source: "Audius" as const,
    url: `${track.permalink || "https://audius.co/"}#audius-track-id=${encodeURIComponent(String(track.id))}`,
  }));
}

async function searchJamendo(query: string): Promise<UnifiedTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "20",
    audioformat: "mp32",
    include: "musicinfo",
    type: "single albumtrack",
    search: query,
  });
  const response = await fetch(`${JAMENDO_API}/tracks/?${params.toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Jamendo: ${response.status}`);
  const payload = await response.json();
  if (payload.headers?.status !== "success") {
    throw new Error(payload.headers?.error_message || "Jamendo не повернув результати.");
  }
  return (Array.isArray(payload.results) ? payload.results : []).map((track: any) => ({
    id: String(track.id),
    title: track.name || "Без назви",
    artist: track.artist_name || "Невідомий виконавець",
    artwork: track.album_image || track.image || "",
    duration: Number(track.duration) || 0,
    source: "Jamendo" as const,
    url: track.audio || "",
  }));
}

async function searchITunes(query: string): Promise<UnifiedTrack[]> {
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "25",
    country: "ua",
  });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`iTunes: ${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload.results) ? payload.results : [])
    .filter((track: any) => typeof track.previewUrl === "string" && track.previewUrl)
    .map((track: any) => ({
      id: String(track.trackId),
      title: track.trackName || "Без назви",
      artist: track.artistName || "Невідомий виконавець",
      artwork: track.artworkUrl100 || "",
      duration: Math.round((Number(track.trackTimeMillis) || 0) / 1000),
      source: "iTunes" as const,
      url: track.previewUrl,
      externalUrl: track.trackViewUrl || "",
    }));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Введи щонайменше два символи для пошуку." }, { status: 400 });
  }
  if (query.length > 120) {
    return NextResponse.json({ error: "Запит занадто довгий." }, { status: 400 });
  }

  const settled = await Promise.allSettled([
    searchAudius(query),
    searchJamendo(query),
    searchITunes(query),
  ]);
  const results: UnifiedTrack[] = [];
  const errors: string[] = [];
  for (const item of settled) {
    if (item.status === "fulfilled") results.push(...item.value);
    else errors.push(item.reason instanceof Error ? item.reason.message : "Джерело музики тимчасово недоступне.");
  }

  const unique = new Map<string, UnifiedTrack>();
  for (const track of results) {
    const key = `${track.source}:${track.id}`;
    if (!unique.has(key)) unique.set(key, track);
  }
  const sorted = [...unique.values()].sort((a, b) => {
    const priority = { iTunes: 0, Audius: 1, Jamendo: 2 };
    return priority[a.source] - priority[b.source];
  });

  return NextResponse.json({
    results: sorted,
    sources: {
      audius: settled[0].status === "fulfilled",
      jamendo: settled[1].status === "fulfilled",
      itunes: settled[2].status === "fulfilled",
    },
    warning: errors.length ? "Деякі музичні каталоги тимчасово недоступні." : null,
  });
}
