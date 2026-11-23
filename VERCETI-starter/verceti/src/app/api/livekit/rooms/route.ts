
import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getLiveKitService() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit не налаштований на сервері.");
  }

  return new RoomServiceClient(url, apiKey, apiSecret);
}

async function checkStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("is_verceti_staff");

  return !error && data === true;
}

// Отримати список кімнат
export async function GET() {
  try {
    const supabase = await createClient();

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.is_banned) {
      return NextResponse.json(
        { error: "Немає доступу до спільноти." },
        { status: 403 }
      );
    }

    const staff = await checkStaff(supabase);
    let hasCommunityAccess = staff;

    if (!hasCommunityAccess) {
      const { data: applications, error: applicationError } = await supabase
        .from("applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      hasCommunityAccess =
        !applicationError && applications?.[0]?.status === "approved";
    }

    if (!hasCommunityAccess) {
      return NextResponse.json(
        { error: "Голосові кімнати доступні після схвалення анкети." },
        { status: 403 }
      );
    }

    const { data: rooms, error } = await supabase
      .from("voice_rooms")
      .select("id, name, max_participants, created_by, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Voice rooms GET:", error);

      return NextResponse.json(
        { error: "Не вдалося отримати список кімнат." },
        { status: 500 }
      );
    }

    const livekit = getLiveKitService();

    const roomsWithCounts = await Promise.all(
      (rooms || []).map(async (room) => {
        let participantCount = 0;

        try {
          const participants = await livekit.listParticipants(
            `verceti-voice-${room.id}`
          );

          participantCount = participants.length;
        } catch (error) {
          const liveKitError = error as {
            status?: number;
            code?: string;
          };

          // Кімната ще не створена в LiveKit — це нормально.
          if (
            liveKitError.status === 404 ||
            liveKitError.code === "not_found"
          ) {
            participantCount = 0;
          } else {
            console.error(
              `LiveKit participants for room ${room.id}:`,
              error
            );
          }
        }

        return {
          ...room,
          participant_count: participantCount,
        };
      })
    );

    return NextResponse.json(
      { rooms: roomsWithCounts },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Voice rooms GET error:", error);

    return NextResponse.json(
      { error: "Помилка сервера під час завантаження кімнат." },
      { status: 500 }
    );
  }
}

// Створити кімнату — тільки керівництво
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const staff = await checkStaff(supabase);

    if (!staff) {
      return NextResponse.json(
        { error: "Створювати голосові кімнати може тільки керівництво." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const maxParticipants = body.maxParticipants;

    if (!name || name.length > 40) {
      return NextResponse.json(
        { error: "Назва кімнати має містити від 1 до 40 символів." },
        { status: 400 }
      );
    }

    if (
      maxParticipants !== null &&
      maxParticipants !== undefined &&
      (!Number.isInteger(maxParticipants) ||
        maxParticipants < 2 ||
        maxParticipants > 100)
    ) {
      return NextResponse.json(
        { error: "Ліміт учасників має бути від 2 до 100 або без обмеження." },
        { status: 400 }
      );
    }

    const { data: room, error } = await supabase
      .from("voice_rooms")
      .insert({
        name,
        max_participants: maxParticipants ?? null,
        created_by: user.id,
      })
      .select("id, name, max_participants, created_by, created_at")
      .single();

    if (error) {
      console.error("Voice rooms POST:", error);

      return NextResponse.json(
        { error: "Не вдалося створити кімнату." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        room: {
          ...room,
          participant_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Voice rooms POST error:", error);

    return NextResponse.json(
      { error: "Помилка сервера під час створення кімнати." },
      { status: 500 }
    );
  }
}

// Видалити кімнату — тільки керівництво
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const staff = await checkStaff(supabase);

    if (!staff) {
      return NextResponse.json(
        { error: "Видаляти голосові кімнати може тільки керівництво." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Неправильний номер кімнати." },
        { status: 400 }
      );
    }

    const { data: room, error: findError } = await supabase
      .from("voice_rooms")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("Voice rooms DELETE find:", findError);

      return NextResponse.json(
        { error: "Не вдалося перевірити кімнату." },
        { status: 500 }
      );
    }

    if (!room) {
      return NextResponse.json(
        { error: "Такої кімнати не існує." },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from("voice_rooms")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Voice rooms DELETE:", deleteError);

      return NextResponse.json(
        { error: "Не вдалося видалити кімнату." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Voice rooms DELETE error:", error);

    return NextResponse.json(
      { error: "Помилка сервера під час видалення кімнати." },
      { status: 500 }
    );
  }
}
