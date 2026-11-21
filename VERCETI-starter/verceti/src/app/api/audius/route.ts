import { NextRequest, NextResponse } from "next/server";

const AUDIUS_API = "https://api.audius.co/v1";

async function audiusRequest(path: string) {
  const apiKey = process.env.AUDIUS_API_KEY;

  if (!apiKey) {
    throw new Error("Не налаштований AUDIUS_API_KEY у Vercel");
  }

  const response = await fetch(`${AUDIUS_API}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Audius API помилка: ${response.status}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "trending";
    let path = "";

    if (action === "trending") {
      path = "/tracks/trending?limit=20";
    } else if (action === "latest") {
      path = "/tracks/latest?limit=20";
    } else if (action === "search") {
      const query = searchParams.get("q")?.trim();

      if (!query) {
        return NextResponse.json(
          { error: "Введи назву пісні або виконавця" },
          { status: 400 }
        );
      }

      path = `/tracks/search?query=${encodeURIComponent(query)}&limit=20`;
    } else {
      return NextResponse.json(
        { error: "Невідома дія" },
        { status: 400 }
      );
    }

    const data = await audiusRequest(path);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Audius error:", error);

    return NextResponse.json(
      { error: "Не вдалося отримати музику з Audius" },
      { status: 500 }
    );
  }
}
