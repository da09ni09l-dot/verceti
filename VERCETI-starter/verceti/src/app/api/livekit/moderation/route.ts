import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
    }

    const { data: role, error: roleError } = await supabase.rpc("current_verceti_role");
    if (roleError || !["admin", "leader", "moderator"].includes(role)) {
      return NextResponse.json({ error: "Вимикати мікрофони можуть лише Адмін, Лідер і Модератор." }, { status: 403 });
    }

    const { data: member, error: memberError } = await supabase.rpc("is_verceti_member");
    if (memberError || member !== true) {
      return NextResponse.json({ error: "Немає доступу до голосових кімнат." }, { status: 403 });
    }

    const body = await request.json();
    const roomName = typeof body.roomName === "string" ? body.roomName : "";
    const identity = typeof body.identity === "string" ? body.identity : "";
    const trackSid = typeof body.trackSid === "string" ? body.trackSid : "";
    const muted = body.muted;

    if (!/^verceti-voice-\d+$/.test(roomName) || !identity || !trackSid || typeof muted !== "boolean") {
      return NextResponse.json({ error: "Некоректні дані для керування мікрофоном." }, { status: 400 });
    }
    if (identity === user.id) {
      return NextResponse.json({ error: "Власний мікрофон керується кнопкою у голосовій кімнаті." }, { status: 400 });
    }
    // LiveKit remote unmute is disabled for this project. A participant must
    // re-enable their own microphone after a moderator has muted it.
    if (muted === false) {
      return NextResponse.json(
        { error: "Учасник має самостійно ввімкнути свій мікрофон." },
        { status: 409 }
      );
    }

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) {
      return NextResponse.json({ error: "Голосовий сервіс тимчасово недоступний." }, { status: 503 });
    }

    const livekit = new RoomServiceClient(url, key, secret);
    const participants = await livekit.listParticipants(roomName);
    const target = participants.find((participant) => participant.identity === identity);
    if (!target) {
      return NextResponse.json({ error: "Учасник уже залишив кімнату." }, { status: 404 });
    }

    const ownsTrack = target.tracks?.some((track) => track.sid === trackSid);
    if (!ownsTrack) {
      return NextResponse.json({ error: "Мікрофон учасника не знайдено або він уже змінився." }, { status: 409 });
    }

    await livekit.mutePublishedTrack(roomName, identity, trackSid, muted);
    return NextResponse.json({ success: true, muted });
  } catch (error) {
    console.error("LiveKit moderation error:", error);
    return NextResponse.json({ error: "Не вдалося змінити стан мікрофона учасника." }, { status: 500 });
  }
}
