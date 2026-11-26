
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

async function isCommunityMember(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("is_verceti_member");
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

    if (!(await isCommunityMember(supabase)) && !(await checkStaff(supabase))) {
      return NextResponse.json(
        { error: "Голосові кімнати доступні після схвалення анкети." },
        { status: 403 }
      );
    }

    const { data: rooms, error } = await supabase
      .from("voice_rooms")
      .select("id, name, max_participants, created_by, created_at, is_hidden")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Voice rooms GET:", error);

      return NextResponse.json(
        { error: "Не вдалося отримати список кімнат." },
        { status: 500 }
      );
    }

    // A temporary LiveKit outage must not hide the rooms stored in Supabase.
    // Participants are supplementary presence data, not a prerequisite for listing rooms.
    let livekit: RoomServiceClient | null = null;
    try {
      livekit = getLiveKitService();
    } catch (error) {
      console.error("LiveKit presence unavailable:", error);
    }

    const { data: viewerRole } = await supabase.rpc("current_verceti_role");
    const viewerIsStaff = ["founder", "admin", "leader", "moderator"].includes(String(viewerRole ?? ""));
    const roomsWithCounts = await Promise.all(
      (rooms || []).map(async (room) => {
        let participantCount = 0;

        if (livekit) {
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

            // A room that has not yet been created in LiveKit has no participants.
            if (
              liveKitError.status !== 404 &&
              liveKitError.code !== "not_found"
            ) {
              console.error(
                `LiveKit participants for room ${room.id}:`,
                error
              );
            }
          }
        }

        return {
          ...room,
          participant_count: participantCount,
          can_manage: viewerRole === "founder" || (viewerIsStaff && room.created_by === user.id) || (viewerRole === "admin" && room.is_hidden === false),
          can_manage_visibility: viewerRole === "founder" || (viewerIsStaff && room.created_by === user.id),
        };
      })
    );

    let members: { id: string; nickname: string; role: string }[] = [];
    if (await checkStaff(supabase)) {
      const { data: memberRows, error: membersError } = await supabase
        .from("profiles")
        .select("id, nickname, role")
        .eq("membership_approved", true)
        .eq("is_banned", false)
        .order("nickname", { ascending: true });
      if (membersError) {
        console.error("Voice room member list:", membersError);
        return NextResponse.json({ error: "Не вдалося завантажити список учасників." }, { status: 500 });
      }
      members = memberRows || [];
    }

    return NextResponse.json(
      { rooms: roomsWithCounts, members, presence_available: livekit !== null },
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

    if (!(await isCommunityMember(supabase)) && !(await checkStaff(supabase))) {
      return NextResponse.json(
        { error: "Немає доступу до спільноти." },
        { status: 403 }
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
        is_hidden: body.isHidden === true,
      })
      .select("id, name, max_participants, created_by, created_at, is_hidden")
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


export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
    if (!(await isCommunityMember(supabase)) && !(await checkStaff(supabase))) {
      return NextResponse.json({ error: "Керувати голосовими кімнатами може тільки керівництво." }, { status: 403 });
    }

    const body = await request.json();
    if (body.action === "update-details") {
      const id = Number(body.id);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const maxParticipants = body.maxParticipants;
      if (!Number.isSafeInteger(id) || id <= 0 || !name || name.length > 40 ||
          (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 100))) {
        return NextResponse.json({ error: "Перевір назву кімнати та ліміт учасників." }, { status: 400 });
      }
      const { data, error } = await supabase.from("voice_rooms")
        .update({ name, max_participants: maxParticipants })
        .eq("id", id)
        .select("id, name, max_participants, is_hidden, created_by")
        .maybeSingle();
      if (error) {
        console.error("Voice room details update:", error);
        return NextResponse.json({ error: "Не вдалося зберегти налаштування кімнати." }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: "Немає прав на цю кімнату або її не знайдено." }, { status: 404 });
      return NextResponse.json({ room: data });
    }

    if (body.action === "set-hidden") {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id <= 0 || typeof body.isHidden !== "boolean") {
        return NextResponse.json({ error: "Некоректні параметри кімнати." }, { status: 400 });
      }
      const { data: targetRoom, error: targetRoomError } = await supabase
        .from("voice_rooms").select("id, created_by").eq("id", id).maybeSingle();
      if (targetRoomError || !targetRoom) {
        return NextResponse.json({ error: "Кімнату не знайдено." }, { status: 404 });
      }
      const { data: actorRole, error: actorRoleError } = await supabase.rpc("current_verceti_role");
      const actorIsStaff = await checkStaff(supabase);
      if (actorRoleError || (actorRole !== "founder" && !(actorIsStaff && targetRoom.created_by === user.id))) {
        return NextResponse.json({ error: "Керувати видимістю цієї кімнати може лише її автор або Засновник." }, { status: 403 });
      }

      if (body.isHidden) {
        try {
          const livekit = getLiveKitService();
          const participants = await livekit.listParticipants(`verceti-voice-${id}`);
          if (participants.length > 0) {
            return NextResponse.json({ error: "Спочатку перемісти всіх учасників з кімнати, а потім приховуй її." }, { status: 409 });
          }
        } catch (error) {
          const liveKitError = error as { status?: number; code?: string };
          if (liveKitError.status !== 404 && liveKitError.code !== "not_found") {
            console.error("Check room before hiding:", error);
            return NextResponse.json({ error: "Не вдалося перевірити учасників кімнати. Спробуй пізніше." }, { status: 503 });
          }
        }
      }

      const { data, error } = await supabase.from("voice_rooms")
        .update({ is_hidden: body.isHidden }).eq("id", id)
        .select("id, name, is_hidden").maybeSingle();
      if (error) {
        console.error("Voice room visibility update:", error);
        return NextResponse.json({ error: "Не вдалося змінити видимість кімнати." }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: "Кімнату не знайдено." }, { status: 404 });
      if (!body.isHidden) {
        const { error: clearAssignmentsError } = await supabase
          .from("voice_room_assignments").delete().eq("room_id", id);
        if (clearAssignmentsError) {
          console.error("Clear hidden room assignments:", clearAssignmentsError);
          return NextResponse.json({ error: "Кімнату відкрито, але не вдалося очистити призначення." }, { status: 500 });
        }
      }
      return NextResponse.json({ room: data });
    }

    if (body.action === "move-member") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      const destinationRoomId = Number(body.destinationRoomId);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
          !Number.isSafeInteger(destinationRoomId) || destinationRoomId <= 0) {
        return NextResponse.json({ error: "Некоректний учасник або кімната." }, { status: 400 });
      }

      const [{ data: member, error: memberError }, { data: destination, error: destinationError }] = await Promise.all([
        supabase.from("profiles").select("id, nickname").eq("id", userId).eq("membership_approved", true).eq("is_banned", false).maybeSingle(),
        supabase.from("voice_rooms").select("id, name, is_hidden").eq("id", destinationRoomId).maybeSingle(),
      ]);
      if (memberError || destinationError) {
        console.error("Voice room move lookup:", memberError || destinationError);
        return NextResponse.json({ error: "Не вдалося перевірити учасника або кімнату." }, { status: 500 });
      }
      if (!member) return NextResponse.json({ error: "Учасника не знайдено або він не має доступу до спільноти." }, { status: 404 });
      if (!destination) return NextResponse.json({ error: "Кімнату не знайдено." }, { status: 404 });

      if (destination.is_hidden) {
        const { error: assignError } = await supabase.from("voice_room_assignments").upsert({
          user_id: userId, room_id: destinationRoomId, assigned_by: user.id,
        }, { onConflict: "user_id" });
        if (assignError) {
          console.error("Voice room assignment:", assignError);
          return NextResponse.json({ error: "Не вдалося призначити учасника до прихованої кімнати." }, { status: 500 });
        }
      } else {
        const { error: clearError } = await supabase.from("voice_room_assignments").delete().eq("user_id", userId);
        if (clearError) {
          console.error("Voice room assignment cleanup:", clearError);
          return NextResponse.json({ error: "Не вдалося оновити призначення учасника." }, { status: 500 });
        }
      }

      let movedLive = false;
      try {
        const livekit = getLiveKitService();
        const { data: allRooms, error: roomsError } = await supabase.from("voice_rooms").select("id");
        if (roomsError) throw roomsError;
        for (const room of allRooms || []) {
          const sourceName = `verceti-voice-${room.id}`;
          if (room.id === destinationRoomId) continue;
          let participants;
          try { participants = await livekit.listParticipants(sourceName); }
          catch (error) {
            const e = error as { status?: number; code?: string };
            if (e.status === 404 || e.code === "not_found") continue;
            throw error;
          }
          if (participants.some((participant) => participant.identity === userId)) {
            await livekit.moveParticipant(sourceName, userId, `verceti-voice-${destinationRoomId}`);
            movedLive = true;
            break;
          }
        }
      } catch (error) {
        // Assignment is still saved; the participant can join the destination room on their next connection.
        console.error("LiveKit participant move:", error);
      }

      return NextResponse.json({
        success: true,
        nickname: member.nickname,
        destination: destination.name,
        moved_live: movedLive,
        message: movedLive ? "Учасника переміщено." : "Призначення збережено. Учасник потрапить до кімнати під час наступного підключення.",
      });
    }

    return NextResponse.json({ error: "Невідома дія." }, { status: 400 });
  } catch (error) {
    console.error("Voice rooms PATCH error:", error);
    return NextResponse.json({ error: "Помилка сервера під час керування кімнатами." }, { status: 500 });
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

    if (!(await isCommunityMember(supabase)) && !(await checkStaff(supabase))) {
      return NextResponse.json(
        { error: "Немає доступу до спільноти." },
        { status: 403 }
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
