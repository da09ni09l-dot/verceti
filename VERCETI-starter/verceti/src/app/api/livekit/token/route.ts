
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

    const [{ data: hasCommunityAccess, error: membershipError }, { data: hasStaffAccess, error: staffError }] = await Promise.all([
      supabase.rpc("is_verceti_member"),
      supabase.rpc("is_verceti_staff"),
    ]);
    if ((membershipError || hasCommunityAccess !== true) && (staffError || hasStaffAccess !== true)) {
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
      .select("id, name, max_participants, is_hidden, created_by")
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

    if (room.is_hidden) {
      const { data: role, error: roleError } = await supabase.rpc("current_verceti_role");
      const { data: roomCreatorIsStaff } = await supabase.rpc("is_verceti_staff");
      if (roleError || (role !== "founder" && !(roomCreatorIsStaff === true && room.created_by === user.id))) {
        const { data: assignment, error: assignmentError } = await supabase
          .from("voice_room_assignments").select("room_id").eq("user_id", user.id).maybeSingle();
        if (assignmentError) {
          console.error("Hidden voice room assignment lookup:", assignmentError);
          return NextResponse.json({ error: "Не вдалося перевірити доступ до прихованої кімнати." }, { status: 500 });
        }
        if (assignment?.room_id !== roomId) {
          return NextResponse.json({ error: "Ця голосова кімната прихована. Доступ має надати керівництво." }, { status: 403 });
        }
      }
    }

    const { data: assignedRoom, error: assignedRoomError } = await supabase
      .from("voice_room_assignments").select("room_id").eq("user_id", user.id).maybeSingle();
    if (assignedRoomError) {
      console.error("Voice room assignment lookup:", assignedRoomError);
      return NextResponse.json({ error: "Не вдалося перевірити призначену кімнату." }, { status: 500 });
    }
    if (assignedRoom && assignedRoom.room_id !== roomId) {
      return NextResponse.json({ error: "Керівництво призначило тобі іншу голосову кімнату." }, { status: 403 });
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

    // Use the community nickname in the participant metadata; never expose email or user ID.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Voice participant profile lookup:", profileError.message);
      return NextResponse.json(
        { error: "Не вдалося завантажити ім’я учасника." },
        { status: 500 }
      );
    }

    const participantName =
      typeof profile?.nickname === "string" && profile.nickname.trim()
        ? profile.nickname.trim()
        : "Учасник";

    // Створення токена
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: participantName,
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
