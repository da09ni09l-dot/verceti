import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });

    const { data: member, error: memberError } = await supabase.rpc("is_verceti_member");
    if (memberError || member !== true) return NextResponse.json({ error: "Дзвінки доступні лише підтвердженим учасникам." }, { status: 403 });

    const body = await request.json();
    const targetId = typeof body.targetId === "string" ? body.targetId : "";
    const callId = typeof body.callId === "string" ? body.callId : "";
    const mode = body.mode === "video" ? "video" : "audio";
    if (!/^[0-9a-f-]{36}$/i.test(targetId) || !/^[0-9a-f-]{36}$/i.test(callId) || targetId === user.id) {
      return NextResponse.json({ error: "Некоректні параметри дзвінка." }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabase
      .from("profiles").select("id,is_banned").eq("id", targetId).maybeSingle();
    if (targetError || !target || target.is_banned) return NextResponse.json({ error: "Учасника не знайдено." }, { status: 404 });

    const { data: targetAccess, error: targetAccessError } = await supabase.rpc("is_verceti_member", { user_id: targetId });
    if (targetAccessError || targetAccess !== true) return NextResponse.json({ error: "Цей учасник поки не має доступу до дзвінків." }, { status: 403 });

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitUrl || !apiKey || !apiSecret) return NextResponse.json({ error: "Сервіс дзвінків тимчасово недоступний." }, { status: 503 });

    const roomName = `verceti-call-${callId}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || "Учасник",
      ttl: "30m",
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
    return NextResponse.json({ token: await token.toJwt(), serverUrl: livekitUrl, roomName, mode });
  } catch (error) {
    console.error("LiveKit call token error:", error);
    return NextResponse.json({ error: "Не вдалося підготувати дзвінок." }, { status: 500 });
  }
}
