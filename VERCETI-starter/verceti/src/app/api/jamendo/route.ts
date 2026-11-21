
import { NextRequest, NextResponse } from "next/server";

const JAMENDO_API = "https://api.jamendo.com/v3.0";

async function jamendoRequest(
  endpoint: string,
  params: URLSearchParams
) {
  const response = await fetch(
    `${JAMENDO_API}${endpoint}?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Jamendo API помилка: ${response.status}`);
  }

  const data = await response.json();

  if (data.headers?.status !== "success") {
    throw new Error(
      data.headers?.error_message || "Jamendo не повернув результати."
    );
  }

  return data.results || [];
}

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.JAMENDO_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: "Не налаштовано JAMENDO_CLIENT_ID у Vercel." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "search";
    const query = searchParams.get("q")?.trim() || "";

    const params = new URLSearchParams({
      client_id: clientId,
      format: "json",
      limit: "30",
      audioformat: "mp32",
      include: "musicinfo",
      type: "single albumtrack",
    });

    let results: any[] = [];

    if (action === "ukrainian") {
      const chartParams = new URLSearchParams(params);
      chartParams.set("limit", "30");
      chartParams.set("country", "UKR");

      const chart = await jamendoRequest(
        "/charts/track/",
        chartParams
      );

      const ids = chart
        .map((item: any) => String(item.id))
        .filter(Boolean);

      if (ids.length > 0) {
        const trackParams = new URLSearchParams(params);
        trackParams.set("id", ids.join("+"));

        results = await jamendoRequest(
          "/tracks/",
          trackParams
        );
      }
    } else if (action === "search") {
      if (!query) {
        return NextResponse.json(
          { error: "Введи назву пісні або виконавця." },
          { status: 400 }
        );
      }

      params.set("search", query);

      results = await jamendoRequest("/tracks/", params);
    } else {
      return NextResponse.json(
        { error: "Невідома дія Jamendo." },
        { status: 400 }
      );
    }

    const tracks = results.map((track: any) => ({
      id: String(track.id),
      title: track.name || "Без назви",
      artist: track.artist_name || "Невідомий виконавець",
      image: track.album_image || track.image || "",
      duration: Number(track.duration) || 0,
      audio: track.audio || "",
      audiodownloadAllowed: track.audiodownload_allowed === true,
      source: "Jamendo",
      url: track.shareurl || "",
    }));

    return NextResponse.json({ results: tracks });
  } catch (error) {
    console.error("Jamendo error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не вдалося отримати музику з Jamendo.",
      },
      { status: 500 }
    );
  }
}
