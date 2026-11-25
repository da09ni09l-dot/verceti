
import { NextRequest, NextResponse } from "next/server";

const AUDIUS_API = "https://api.audius.co/v1";

async function audiusRequest(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${AUDIUS_API}${path}${separator}app_name=VERCETI`;

  const response = await fetch(url, {
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
    } else if (action === "resolve") {
      const trackUrl = searchParams.get("url")?.trim();

      if (!trackUrl) {
        return NextResponse.json(
          { error: "Не вказано посилання на композицію" },
          { status: 400 }
        );
      }

      const parsedUrl = new URL(trackUrl);

      if (
        !["audius.co", "www.audius.co", "m.audius.co"].includes(
          parsedUrl.hostname
        )
      ) {
        return NextResponse.json(
          { error: "Це не посилання Audius" },
          { status: 400 }
        );
      }

      const result = await audiusRequest(
        `/resolve?url=${encodeURIComponent(trackUrl)}`
      );

      const trackId = result?.data?.id;

      if (!trackId) {
        return NextResponse.json(
          { error: "Не вдалося знайти композицію в Audius" },
          { status: 404 }
        );
      }

      return NextResponse.json({ id: trackId });
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Не вдалося отримати музику з Audius",
      },
      { status: 500 }
    );
  }
}
