
import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Перевіряємо авторизацію користувача
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Потрібно увійти в акаунт VERCETI." },
        { status: 401 }
      );
    }

    // Отримуємо номер голосової кімнати
    const body = await request.json();
    const roomId = String(body.roomId ?? "");

    if (!/^\d{1,20}$/.test(roomId)) {
      return NextResponse.json(
        { error: "Неправильний номер кімнати." },
        { status: 400 }
      );
    }

    // Перевіряємо налаштування LiveKit
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !serverUrl) {
      console.error("LiveKit environment variables are missing.");

      return NextResponse.json(
        { error: "Сервер голосового зв'язку не налаштований." },
        { status: 500 }
      );
    }

    // Створюємо спільну назву кімнати
    const roomName = `verceti-voice-${roomId}`;

    const participantName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Учасник";

    // Створюємо персональний токен
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: String(participantName),
      ttl: "2h",
    });

    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await accessToken.toJwt();

    return NextResponse.json({
      token,
      serverUrl,
      roomName,
      participantName,
    });
  } catch (error) {
    console.error("LiveKit token error:", error);

    return NextResponse.json(
      { error: "Не вдалося підключитися до голосової кімнати." },
      { status: 500 }
    );
  }
}
