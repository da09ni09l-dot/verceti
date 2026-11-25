"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useLocalParticipant, useParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CallInvite = { callId: string; callerId: string; callerName: string; mode: "audio" | "video"; targetId: string };

export default function CallActions({ targetId, currentUserId, listenForCalls = false }: { targetId?: string; currentUserId: string; listenForCalls?: boolean }) {
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const [session, setSession] = useState<{ token: string; serverUrl: string; roomName: string; mode: "audio" | "video" } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [supabase] = useState(() => createClient());

  useEffect(() => {\n    if (!listenForCalls) return;
    const channel = supabase.channel(`user-calls:${currentUserId}`);
    channel.on("broadcast", { event: "incoming-call" }, ({ payload }) => {
      const incoming = payload as CallInvite;
      if (incoming.targetId === currentUserId) setInvite(incoming);
    });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId, listenForCalls, supabase]);

  async function startCall(mode: "audio" | "video") {
    if (busy || session) return;
    setBusy(true); setStatus("");
    try {
      const callId = crypto.randomUUID();
      if (!targetId) return;\n      const response = await fetch("/api/livekit/call-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId, callId, mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося почати дзвінок.");
      const channel = supabase.channel(`user-calls:${targetId}`);
      await channel.subscribe();
      await channel.send({ type: "broadcast", event: "incoming-call", payload: { callId, callerId: currentUserId, callerName: "Учасник VERCETI", mode, targetId } });
      await supabase.removeChannel(channel);
      setSession(data);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Помилка дзвінка."); }
    finally { setBusy(false); }
  }

  async function answerCall() {
    if (!invite || busy) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/livekit/call-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: invite.callerId, callId: invite.callId, mode: invite.mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося прийняти дзвінок.");
      setSession(data); setInvite(null);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Помилка підключення."); }
    finally { setBusy(false); }
  }

  return (
    <div className={targetId ? "member-call-actions" : "global-call-listener"}>
      {targetId && <><button className="btn" type="button" disabled={busy || !!session} onClick={() => void startCall("audio")}><Phone size={16}/> Зателефонувати</button><button className="btn" type="button" disabled={busy || !!session} onClick={() => void startCall("video")}><Video size={16}/> Відеодзвінок</button></>}
      {status && <p className="voice-error" role="alert">{status}</p>}
      {invite && !session && <div className="call-incoming panel" role="dialog" aria-label="Вхідний дзвінок"><strong>{invite.callerName} телефонує</strong><p>{invite.mode === "video" ? "Відеодзвінок" : "Аудіодзвінок"}</p><button className="btn" disabled={busy} onClick={() => void answerCall()}><Phone size={16}/> Прийняти</button><button className="tag" onClick={() => setInvite(null)}><PhoneOff size={16}/> Відхилити</button></div>}
      {session && <div className="call-session panel"><div className="call-session-head"><strong>{session.mode === "video" ? "Відеодзвінок" : "Аудіодзвінок"}</strong><button className="tag" onClick={() => setSession(null)}><X size={16}/> Завершити</button></div><LiveKitRoom token={session.token} serverUrl={session.serverUrl} connect audio video={false} onDisconnected={() => setSession(null)}><RoomAudioRenderer/><CallMedia mode={session.mode}/></LiveKitRoom></div>}
    </div>
  );
}

function CallMedia({ mode }: { mode: "audio" | "video" }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  useEffect(() => { if (mode === "video") void localParticipant.setCameraEnabled(true).catch(() => undefined); }, [mode, localParticipant]);
  return <div className="call-media"><p>У дзвінку: {participants.length + 1}</p>{mode === "video" && <div className="voice-camera-grid">{tracks.map((track) => <div className="voice-camera-track" key={track.publication.trackSid}><VideoTrack trackRef={track}/><p>{track.participant.name || track.participant.identity}</p></div>)}</div>}<div className="voice-action-group"><button className="voice-action-button" onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}>{isMicrophoneEnabled ? <MicOff size={17}/> : <Mic size={17}/>} Мікрофон</button>{mode === "video" && <button className="voice-action-button" onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}>{isCameraEnabled ? <VideoOff size={17}/> : <Video size={17}/>} Камера</button>}</div></div>;
}
