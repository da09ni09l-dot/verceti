
import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getLiveKitService() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    throw new Error("LiveKit не налаштований.");
  }

  const httpUrl = url
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:");

  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Потрібно увійти в акаунт." },
        { status: 401 }
      );
    }

    const { data: rooms, error } = await supabase
      .from("voice_rooms")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const livekit = getLiveKitService();

    const result = await Promise.all(
      (rooms || []).map(async (room) => {
        const roomName = `verceti-voice-${room.id}`;

        try {
          const participants =
            await livekit.listParticipants(roomName);

          return {
            ...room,
            participant_count: participants.length,
          };
        } catch {
          return {
            ...room,
            participant_count: 0,
          };
        }
      })
    );

    return NextResponse.json({ rooms: result });
  } catch (error) {
    console.error("Voice rooms GET:", error);

    return NextResponse.json(
      { error: "Не вдалося отримати список кімнат." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Потрібно увійти в акаунт." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const maxParticipants =
      body.maxParticipants === null
        ? null
        : Number(body.maxParticipants);

    if (name.length < 1 || name.length > 40) {
      return NextResponse.json(
        { error: "Назва кімнати має містити від 1 до 40 символів." },
        { status: 400 }
      );
    }

    if (
      maxParticipants !== null &&
      (!Number.isInteger(maxParticipants) ||
        maxParticipants < 2 ||
        maxParticipants > 100)
    ) {
      return NextResponse.json(
        { error: "Кількість учасників має бути від 2 до 100." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("voice_rooms")
      .insert({
        name,
        max_participants: maxParticipants,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ room: data });
  } catch (error) {
    console.error("Voice rooms POST:", error);

    return NextResponse.json(
      { error: "Не вдалося створити кімнату." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Потрібно увійти в акаунт." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);

    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Неправильний номер кімнати." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("voice_rooms")
      .delete()
      .eq("id", id)
      .eq("created_by", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Voice rooms DELETE:", error);

    return NextResponse.json(
      { error: "Не вдалося видалити кімнату." },
      { status: 500 }
    );
  }
}
