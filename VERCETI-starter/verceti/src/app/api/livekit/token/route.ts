
import { NextRequest, NextResponse } from "next/server";
import {
  AccessToken,
  RoomServiceClient,
} from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Перевірка авторизації
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Потрібно увійти в акаунт." },
        { status: 401 }
      );
    }

    const { data: hasCommunityAccess, error: membershipError } = await supabase.rpc("is_verceti_member");
    if (membershipError || hasCommunityAccess !== true) {
      return NextResponse.json(
        { error: "Голосові кімнати доступні після схвалення анкети." },
        { status: 403 }
      );
    }

    // Отримання ID кімнати
    const body = await request.json();
    const roomId = Number(body.roomId);

    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return NextResponse.json(
        { error: "Неправильний номер голосової кімнати." },
        { status: 400 }
      );
    }

    // Перевірка існування кімнати в Supabase
    const { data: room, error: roomError } = await supabase
      .from("voice_rooms")
      .select("id, name, max_participants")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) {
      console.error("Voice room lookup:", roomError);

      return NextResponse.json(
        { error: "Не вдалося перевірити голосову кімнату." },
        { status: 500 }
      );
    }

    if (!room) {
      return NextResponse.json(
        { error: "Голосову кімнату не знайдено." },
        { status: 404 }
      );
    }

    // Перевірка налаштувань LiveKit
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !apiKey || !apiSecret) {
      console.error("LiveKit environment variables are missing.");

      return NextResponse.json(
        { error: "Голосовий сервіс тимчасово недоступний." },
        { status: 500 }
      );
    }

    const livekit = new RoomServiceClient(
      livekitUrl,
      apiKey,
      apiSecret
    );

    const livekitRoomName = `verceti-voice-${room.id}`;

    // Перевірка учасників LiveKit
    let participants: Awaited<
      ReturnType<typeof livekit.listParticipants>
    > = [];

    try {
      participants = await livekit.listParticipants(
        livekitRoomName
      );
    } catch (error) {
      const livekitError = error as {
        status?: number;
        code?: string;
        message?: string;
      };

      const roomDoesNotExist =
        livekitError.status === 404 ||
        livekitError.code === "not_found" ||
        livekitError.message?.toLowerCase().includes(
          "room does not exist"
        );

      if (!roomDoesNotExist) {
        throw error;
      }

      // Кімната ще не створена — перший учасник створить її автоматично.
      participants = [];
    }

    // Перевірка, чи користувач уже підключений
    const alreadyConnected = participants.some(
      (participant) => participant.identity === user.id
    );

    // Перевірка ліміту учасників
    if (
      !alreadyConnected &&
      room.max_participants !== null &&
      participants.length >= room.max_participants
    ) {
      return NextResponse.json(
        {
          error: `Кімната «${room.name}» заповнена. Максимум учасників: ${room.max_participants}.`,
        },
        { status: 409 }
      );
    }

    // Створення токена
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name:
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email ||
        "Учасник",
      ttl: "2h",
    });

    accessToken.addGrant({
      roomJoin: true,
      room: livekitRoomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await accessToken.toJwt();

    return NextResponse.json({
      token,
      serverUrl: livekitUrl,
      roomName: livekitRoomName,
    });
  } catch (error) {
    console.error("LiveKit token error:", error);

    return NextResponse.json(
      { error: "Не вдалося підключитися до голосової кімнати." },
      { status: 500 }
    );
  }
}
