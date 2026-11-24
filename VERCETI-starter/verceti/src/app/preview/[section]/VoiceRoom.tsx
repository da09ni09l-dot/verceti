"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useParticipants,
  useTracks,
  VideoTrack,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Headphones, Mic2, Users, Plus, Trash2, DoorOpen, MonitorUp,
  Radio, LoaderCircle, X, CheckCircle2, Volume2, VolumeX,
  Mic, MicOff, ScreenShare, ScreenShareOff, RadioTower, UserX,
} from "lucide-react";

type Room = {
  id: number;
  name: string;
  max_participants: number | null;
  participant_count: number;
  created_by?: string | null;
};

type VoiceRoomProps = { isStaff: boolean; canModerateVoice: boolean };

export default function VoiceRoom({ isStaff, canModerateVoice }: VoiceRoomProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [capacity, setCapacity] = useState("unlimited");
  const [showCreate, setShowCreate] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const currentRoom = rooms.find((room) => room.id === activeRoom);
  const pathname = usePathname();
  const isVoicePage = pathname === "/preview/voice" || pathname === "/preview/streams";

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/livekit/rooms", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося завантажити кімнати.");
      setRooms(data.rooms || []);
      setError((current) => current === "Не вдалося завантажити кімнати." ? "" : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка завантаження кімнат.");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    // The global layout mounts this component on every route. Avoid polling
    // the protected voice API unless the voice page is open or a room is active.
    if (!isVoicePage && !token) {
      setLoadingRooms(false);
      return;
    }
    void loadRooms();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadRooms();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [isVoicePage, token, loadRooms]);

  async function joinRoom(id: number) {
    const selectedRoom = rooms.find((room) => room.id === id);
    if (!selectedRoom) return;
    if (selectedRoom.max_participants !== null && selectedRoom.participant_count >= selectedRoom.max_participants) {
      setError("У цій кімнаті вже немає вільних місць.");
      return;
    }

    setJoining(true);
    setError("");
    setToken("");
    setActiveRoom(null);
    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося підключитися.");
      setServerUrl(data.serverUrl);
      setToken(data.token);
      setActiveRoom(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка підключення до голосової кімнати.");
    } finally {
      setJoining(false);
      void loadRooms();
    }
  }

  function leaveRoom() {
    setToken("");
    setActiveRoom(null);
    void loadRooms();
  }

  async function createRoom() {
    if (!isStaff || busy) return;
    const name = newRoom.trim();
    if (!name) {
      setError("Введи назву кімнати.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, maxParticipants: capacity === "unlimited" ? null : Number(capacity) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося створити кімнату.");
      setNewRoom("");
      setCapacity("unlimited");
      setShowCreate(false);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка створення кімнати.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoom(id: number) {
    if (!isStaff || busy || !window.confirm("Видалити цю голосову кімнату?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося видалити кімнату.");
      if (activeRoom === id) {
        setToken("");
        setActiveRoom(null);
      }
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка видалення кімнати.");
    } finally {
      setBusy(false);
    }
  }

  if (!isVoicePage && (!token || !currentRoom)) return null;

  return (
    <div className={`voice-room-layout ${isVoicePage ? "is-page" : "is-dock"}`}>
      <aside className="voice-room-list-panel panel">
        <div className="voice-section-heading">
          <div className="voice-heading-icon"><Headphones size={19} /></div>
          <div>
            <h2>Голосові кімнати</h2>
            <p>Обери канал для спілкування</p>
          </div>
          <span className="voice-live-pill"><span /> LIVE</span>
        </div>

        {loadingRooms ? (
          <div className="voice-empty-state"><LoaderCircle className="voice-spin" size={20} /> Завантажуємо кімнати…</div>
        ) : rooms.length === 0 ? (
          <div className="voice-empty-state"><Radio size={22} /><span>Поки немає активних кімнат</span>{isStaff && <small>Створи першу кімнату нижче</small>}</div>
        ) : (
          <div className="voice-room-list">
            {rooms.map((room) => {
              const full = room.max_participants !== null && room.participant_count >= room.max_participants;
              const selected = activeRoom === room.id;
              return (
                <div key={room.id} className={`voice-room-row ${selected ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="voice-room-select"
                    disabled={joining || (full && !selected)}
                    onClick={() => selected ? undefined : void joinRoom(room.id)}
                    aria-label={`Приєднатися до кімнати ${room.name}`}
                  >
                    <span className="voice-room-symbol"><Volume2 size={17} /></span>
                    <span className="voice-room-copy">
                      <strong>{room.name}</strong>
                      <small><Users size={12} /> {room.participant_count}{room.max_participants === null ? " / без ліміту" : ` / ${room.max_participants}`}</small>
                    </span>
                    <span className={`voice-room-state ${full ? "is-full" : selected ? "is-connected" : ""}`}>
                      {full ? "Заповнена" : selected ? "Ти тут" : "Приєднатись"}
                    </span>
                  </button>
                  {isStaff && (
                    <button type="button" className="voice-icon-button is-danger" onClick={() => void deleteRoom(room.id)} disabled={busy} title="Видалити кімнату" aria-label={`Видалити кімнату ${room.name}`}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isStaff && (
          <div className="voice-create-wrap">
            {showCreate ? (
              <div className="voice-create-form">
                <div className="voice-create-title"><strong>Нова кімната</strong><button type="button" className="voice-icon-button" onClick={() => setShowCreate(false)} aria-label="Закрити"><X size={16} /></button></div>
                <label htmlFor="voice-room-name">Назва каналу</label>
                <input id="voice-room-name" value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="Наприклад, Загальний чат" maxLength={40} />
                <label htmlFor="voice-room-capacity">Ліміт учасників</label>
                <select id="voice-room-capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)}>
                  <option value="2">2 людини</option><option value="3">3 людини</option><option value="5">5 людей</option><option value="10">10 людей</option><option value="unlimited">Без обмеження</option>
                </select>
                <button className="btn voice-create-submit" type="button" onClick={() => void createRoom()} disabled={busy || !newRoom.trim()}>
                  {busy ? <LoaderCircle size={16} className="voice-spin" /> : <Plus size={16} />} Створити кімнату
                </button>
              </div>
            ) : (
              <button type="button" className="voice-add-room" onClick={() => setShowCreate(true)}><Plus size={17} /> Створити кімнату</button>
            )}
          </div>
        )}
      </aside>

      <section className="voice-room-session-panel panel">
        {error && <div className="voice-error" role="alert">{error}</div>}
        {joining ? (
          <div className="voice-welcome"><LoaderCircle className="voice-spin" size={30} /><h2>Підключаємося…</h2><p>Зачекай, готуємо голосовий канал.</p></div>
        ) : !token || !currentRoom ? (
          <div className="voice-welcome">
            <div className="voice-welcome-icon"><Mic2 size={30} /></div>
            <h2>Твоя голосова кімната</h2>
            <p>Обери канал у списку, щоб почати спілкування з командою.</p>
            <span><CheckCircle2 size={14} /> Дозволь браузеру доступ до мікрофона</span>
          </div>
        ) : (
          <LiveKitRoom
            key={activeRoom}
            token={token}
            serverUrl={serverUrl}
            connect
            audio={{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }}
            video={false}
            onDisconnected={leaveRoom}
            onError={(err) => setError(err.message)}
            style={{ width: "100%" }}
          >
            <RoomAudioRenderer />
            <VoiceRoomContent roomName={`verceti-voice-${currentRoom.id}`} displayRoomName={currentRoom.name} onLeave={leaveRoom} compact={!isVoicePage} isStaffForRoom={canModerateVoice} />
          </LiveKitRoom>
        )}
      </section>
    </div>
  );
}

function VoiceRoomContent({ roomName, displayRoomName, onLeave, compact = false, isStaffForRoom = false }: { roomName: string; displayRoomName: string; onLeave: () => void; compact?: boolean; isStaffForRoom?: boolean }) {
  const participants = useParticipants();
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [moderating, setModerating] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState("");

  async function toggleMicrophone() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      setModerationError("Не вдалося змінити стан мікрофона. Перевір дозвіл браузера.");
    }
  }

  async function toggleScreenShare() {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch {
      setModerationError("Не вдалося запустити демонстрацію екрана.");
    }
  }

  async function toggleParticipantMute(identity: string, trackSid: string, muted: boolean) {
    setModerating(identity);
    setModerationError("");
    try {
      const response = await fetch("/api/livekit/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, identity, trackSid, muted }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося змінити звук учасника.");
    } catch (error) {
      setModerationError(error instanceof Error ? error.message : "Помилка модерації.");
    } finally {
      setModerating(null);
    }
  }

  if (compact) {
    return (
      <div className="voice-mini-dock-inner">
        <div className="voice-mini-status"><span className="voice-mini-indicator" /><strong>{displayRoomName}</strong><span><Users size={13} /> {participants.length}</span></div>
        <div className="voice-mini-actions">
          <button type="button" className={`voice-action-button ${isMicrophoneEnabled ? "" : "is-muted"}`} onClick={() => void toggleMicrophone()} title={isMicrophoneEnabled ? "Вимкнути мікрофон" : "Увімкнути мікрофон"}><>{isMicrophoneEnabled ? <Mic size={17} /> : <MicOff size={17} />}{isMicrophoneEnabled ? "Мікрофон" : "Мікрофон вимкнено"}</></button>
          <Link className="btn secondary" href="/preview/voice"><Radio size={15} /> Відкрити</Link>
          <button className="btn voice-leave-mini" type="button" onClick={onLeave}><DoorOpen size={15} /> Вийти</button>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-session">
      <div className="voice-session-top">
        <div className="voice-session-title">
          <div className="voice-session-avatar"><Headphones size={22} /></div>
          <div><h2>{displayRoomName}</h2><p><span className="voice-online-dot" /> Підключено · {participants.length} {participants.length === 1 ? "учасник" : "учасників"}</p></div>
        </div>
        <span className="voice-connected-badge"><CheckCircle2 size={14} /> На зв’язку</span>
      </div>

      <div className="voice-content-grid">
        <section className="voice-content-card">
          <div className="voice-card-heading"><Users size={17} /><h3>Учасники</h3><span>{participants.length}</span></div>
          {participants.length ? (
            <div className="voice-participant-list">
              {participants.map((participant) => {
                const microphone = participant.getTrackPublication(Track.Source.Microphone);
                const canModerate = isStaffForRoom && participant.identity !== localParticipant.identity && Boolean(microphone?.trackSid);
                return (
                  <div className={`voice-participant ${participant.isSpeaking ? "is-speaking" : ""}`} key={participant.identity}>
                    <span className="voice-participant-avatar">{(participant.name || participant.identity).slice(0, 1).toUpperCase()}</span>
                    <span className="voice-participant-name">{participant.name || participant.identity}</span>
                    {participant.isSpeaking ? <span className="voice-speaking-label"><RadioTower size={13} /> Говорить</span> : <span className="voice-participant-dot" />}
                    {canModerate && microphone?.trackSid && (
                      <button
                        type="button"
                        className={`voice-moderation-button ${microphone.isMuted ? "is-muted" : ""}`}
                        disabled={moderating === participant.identity}
                        onClick={() => void toggleParticipantMute(participant.identity, microphone.trackSid!, !microphone.isMuted)}
                        title={microphone.isMuted ? "Увімкнути мікрофон учаснику" : "Вимкнути мікрофон учаснику"}
                        aria-label={microphone.isMuted ? "Увімкнути мікрофон учаснику" : "Вимкнути мікрофон учаснику"}
                      >
                        {moderating === participant.identity ? <LoaderCircle size={15} className="voice-spin" /> : microphone.isMuted ? <Mic size={15} /> : <MicOff size={15} />}
                        <span>{microphone.isMuted ? "Увімкнути" : "Вимкнути звук"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <p className="voice-muted">Поки що нікого немає в кімнаті.</p>}
        </section>

        <section className="voice-content-card voice-screen-card">
          <div className="voice-card-heading"><MonitorUp size={17} /><h3>Демонстрація екрана</h3></div>
          {screenTracks.length ? (
            <div className="voice-screen-list">
              {screenTracks.map((track, index) => (
                <div className="voice-screen-track" key={track.publication.trackSid || index}>
                  <VideoTrack trackRef={track} />
                  <p>Екран: {track.participant.name || track.participant.identity}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="voice-screen-empty"><MonitorUp size={25} /><p>Ніхто поки не демонструє свій екран</p><small>Натисни кнопку демонстрації нижче, щоб поділитися екраном</small></div>
          )}
        </section>
      </div>

      <div className="voice-controls-panel">
        <div><strong>Керування звуком</strong><small>Мікрофон та демонстрація екрана</small></div>
        <div className="voice-action-group"><button type="button" className={`voice-action-button ${isMicrophoneEnabled ? "" : "is-muted"}`} onClick={() => void toggleMicrophone()}><>{isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}{isMicrophoneEnabled ? "Мікрофон увімкнено" : "Мікрофон вимкнено"}</></button><button type="button" className={`voice-action-button ${isScreenShareEnabled ? "is-sharing" : ""}`} onClick={() => void toggleScreenShare()}><>{isScreenShareEnabled ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}{isScreenShareEnabled ? "Зупинити трансляцію" : "Транслювати екран"}</></button></div>
        <button className="voice-leave-button" type="button" onClick={onLeave}><DoorOpen size={17} /> Вийти з кімнати</button>
      </div>
      {moderationError && <p className="voice-error" role="alert">{moderationError}</p>}\n      <p className="voice-footnote">Звук оптимізовано: придушення еха, фонових шумів та автоматичне регулювання гучності.</p>
    </div>
  );
}
