"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  VideoTrack,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Headphones, Mic2, Users, Plus, Trash2, DoorOpen, MonitorUp, Settings, Eye, EyeOff,
  Radio, LoaderCircle, X, CheckCircle2, Volume2,
  Mic, MicOff, ScreenShare, ScreenShareOff, RadioTower, Camera, CameraOff,
} from "lucide-react";

type Room = {
  id: number;
  name: string;
  max_participants: number | null;
  participant_count: number;
  created_by?: string | null;
  is_hidden?: boolean;
  can_manage?: boolean;
  can_manage_visibility?: boolean;
};
type VoiceMember = { id: string; nickname: string; role: string };

type VoiceRoomProps = { isStaff: boolean; canModerateVoice?: boolean };

export default function VoiceRoom({ isStaff, canModerateVoice = isStaff }: VoiceRoomProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<VoiceMember[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [destinationRoom, setDestinationRoom] = useState("");
  const [isHiddenRoom, setIsHiddenRoom] = useState(false);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [capacity, setCapacity] = useState("unlimited");
  const [showCreate, setShowCreate] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [editingRoomCapacity, setEditingRoomCapacity] = useState("unlimited");
  const [loadingRooms, setLoadingRooms] = useState(true);

  const currentRoom = rooms.find((room) => room.id === activeRoom);
  const pathname = usePathname();
  const isVoicePage = pathname === "/preview/voice" || pathname === "/preview/streams";

  const roomsRequestInFlight = useRef(false);

  const loadRooms = useCallback(async () => {
    // Prevent overlapping 10-second refreshes from racing each other.
    if (roomsRequestInFlight.current) return;
    roomsRequestInFlight.current = true;
    try {
      const response = await fetch("/api/livekit/rooms", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Сервер голосових кімнат тимчасово недоступний."
        );
      }
      if (!Array.isArray(data.rooms)) {
        throw new Error("Сервер повернув некоректний список голосових кімнат.");
      }
      setRooms(data.rooms);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setError("");
    } catch (err) {
      // Keep the last successful room list visible during a temporary outage.
      console.error("Voice rooms refresh failed:", err);
      setError("Не вдалося оновити голосові кімнати. Перевір з’єднання та спробуй ще раз.");
    } finally {
      roomsRequestInFlight.current = false;
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
      if (document.visibilityState === "visible" && !roomsRequestInFlight.current) {
        void loadRooms();
      }
    }, 15000);
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


  async function setRoomHidden(id: number, isHidden: boolean) {
    if (!isStaff || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-hidden", id, isHidden }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося змінити видимість кімнати.");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка зміни видимості кімнати.");
    } finally { setBusy(false); }
  }

  async function moveMember() {
    if (!isStaff || busy || !selectedMember || !destinationRoom) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move-member", userId: selectedMember, destinationRoomId: Number(destinationRoom) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося перемістити учасника.");
      setError(data.message || "Призначення учасника оновлено.");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка переміщення учасника.");
    } finally { setBusy(false); }
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
        body: JSON.stringify({ name, maxParticipants: capacity === "unlimited" ? null : Number(capacity), isHidden: isHiddenRoom }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося створити кімнату.");
      setNewRoom("");
      setCapacity("unlimited");
      setIsHiddenRoom(false);
      setShowCreate(false);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка створення кімнати.");
    } finally {
      setBusy(false);
    }
  }

  function startEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setEditingRoomName(room.name);
    setEditingRoomCapacity(room.max_participants === null ? "unlimited" : String(room.max_participants));
    setError("");
  }

  async function saveRoomDetails() {
    if (editingRoomId === null || busy) return;
    const name = editingRoomName.trim();
    if (!name || name.length > 40) {
      setError("Назва кімнати має містити від 1 до 40 символів.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/livekit/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-details",
          id: editingRoomId,
          name,
          maxParticipants: editingRoomCapacity === "unlimited" ? null : Number(editingRoomCapacity),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося зберегти налаштування кімнати.");
      setEditingRoomId(null);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка збереження кімнати.");
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
                      <strong>{room.name}{room.is_hidden ? " · Прихована" : ""}</strong>
                      <small><Users size={12} /> {room.participant_count}{room.max_participants === null ? " / без ліміту" : ` / ${room.max_participants}`}</small>
                    </span>
                    <span className={`voice-room-state ${full ? "is-full" : selected ? "is-connected" : ""}`}>
                      {full ? "Заповнена" : selected ? "Ти тут" : "Приєднатись"}
                    </span>
                  </button>
                  <div className="voice-room-actions">
                    {room.can_manage && (
                      <button type="button" className="voice-icon-button" onClick={() => startEditRoom(room)} disabled={busy} title="Налаштування кімнати" aria-label="Налаштування кімнати">
                        <Settings size={15} />
                      </button>
                    )}
                    {room.can_manage_visibility && (
                      <button type="button" className="voice-icon-button" onClick={() => void setRoomHidden(room.id, !room.is_hidden)} disabled={busy} title={room.is_hidden ? "Зробити кімнату видимою" : "Приховати кімнату"} aria-label={room.is_hidden ? "Зробити кімнату видимою" : "Приховати кімнату"}>
                        {room.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    )}
                    {room.can_manage && (
                      <button type="button" className="voice-icon-button is-danger" onClick={() => void deleteRoom(room.id)} disabled={busy} title="Видалити кімнату" aria-label={`Видалити кімнату ${room.name}`}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  {editingRoomId === room.id && (
                    <div className="voice-create-form" style={{ flexBasis: "100%", marginTop: 8 }}>
                      <label htmlFor={`voice-edit-name-${room.id}`}>Назва кімнати</label>
                      <input id={`voice-edit-name-${room.id}`} value={editingRoomName} onChange={(event) => setEditingRoomName(event.target.value)} maxLength={40} />
                      <label htmlFor={`voice-edit-capacity-${room.id}`}>Ліміт учасників</label>
                      <select id={`voice-edit-capacity-${room.id}`} value={editingRoomCapacity} onChange={(event) => setEditingRoomCapacity(event.target.value)}>
                        <option value="2">2 людини</option><option value="3">3 людини</option><option value="5">5 людей</option><option value="10">10 людей</option><option value="unlimited">Без обмеження</option>
                      </select>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn" onClick={() => void saveRoomDetails()} disabled={busy || !editingRoomName.trim()}>Зберегти</button>
                        <button type="button" className="btn secondary" onClick={() => setEditingRoomId(null)} disabled={busy}>Скасувати</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isStaff && (
          <div className="voice-create-wrap">
            <div className="voice-create-form" style={{ marginBottom: 12 }}>
              <strong>Перемістити учасника</strong>
              <label htmlFor="voice-member-select">Учасник</label>
              <select id="voice-member-select" value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)}>
                <option value="">Обери учасника</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.nickname} · {member.role}</option>)}
              </select>
              <label htmlFor="voice-destination-select">Кімната призначення</label>
              <select id="voice-destination-select" value={destinationRoom} onChange={(event) => setDestinationRoom(event.target.value)}>
                <option value="">Обери кімнату</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}{room.is_hidden ? " · Прихована" : ""}</option>)}
              </select>
              <button className="btn voice-create-submit" type="button" onClick={() => void moveMember()} disabled={busy || !selectedMember || !destinationRoom}>Перемістити / призначити</button>
            </div>
            {showCreate ? (
              <div className="voice-create-form">
                <div className="voice-create-title"><strong>Нова кімната</strong><button type="button" className="voice-icon-button" onClick={() => setShowCreate(false)} aria-label="Закрити"><X size={16} /></button></div>
                <label htmlFor="voice-room-name">Назва каналу</label>
                <input id="voice-room-name" value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="Наприклад, Загальний чат" maxLength={40} />
                <label className="voice-hidden-toggle"><input type="checkbox" checked={isHiddenRoom} onChange={(event) => setIsHiddenRoom(event.target.checked)} /> Прихована кімната (доступ лише за призначенням)</label>
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
            <VoiceRoomContent roomName={`verceti-voice-${currentRoom.id}`} displayRoomName={currentRoom.name} onLeave={leaveRoom} compact={!isVoicePage} isStaffForRoom={canModerateVoice && Boolean(currentRoom?.can_manage)} />
          </LiveKitRoom>
        )}
      </section>
    </div>
  );
}

function VoiceRoomContent({ roomName, displayRoomName, onLeave, compact = false, isStaffForRoom = false }: { roomName: string; displayRoomName: string; onLeave: () => void; compact?: boolean; isStaffForRoom?: boolean }) {
  const participants = useParticipants();
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [moderating, setModerating] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState("");
  const [screenShareSupported, setScreenShareSupported] = useState(false);
  const [dockPosition, setDockPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    setScreenShareSupported(
      typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof navigator.mediaDevices?.getDisplayMedia === "function"
    );
  }, []);
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; left: number; top: number } | null>(null);

  function startDockDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const rect = event.currentTarget.closest(".voice-floating-dock")?.getBoundingClientRect();
    if (!rect) return;
    dragOrigin.current = { pointerX: event.clientX, pointerY: event.clientY, left: rect.left, top: rect.top };
    setDockPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDock(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) return;
    const origin = dragOrigin.current;
    const width = event.currentTarget.closest(".voice-floating-dock")?.getBoundingClientRect().width ?? 340;
    const height = event.currentTarget.closest(".voice-floating-dock")?.getBoundingClientRect().height ?? 160;
    setDockPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, origin.left + event.clientX - origin.pointerX)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, origin.top + event.clientY - origin.pointerY)),
    });
  }

  function stopDockDrag() {
    dragOrigin.current = null;
  }

  async function toggleMicrophone() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      setModerationError("Не вдалося змінити стан мікрофона. Перевір дозвіл браузера.");
    }
  }

  async function toggleCamera() {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      setModerationError("Не вдалося увімкнути камеру. Перевір дозвіл браузера.");
    }
  }

  async function toggleScreenShare() {
    setModerationError("");
    if (!screenShareSupported) {
      setModerationError("Цей мобільний браузер не підтримує демонстрацію екрана на сайті. Спробуй відкрити VERCETI у підтримуваному браузері на комп’ютері.");
      return;
    }
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "AbortError") {
        setModerationError("Демонстрацію екрана скасовано або браузер не надав дозвіл.");
      } else if (name === "NotFoundError" || name === "NotReadableError") {
        setModerationError("Браузер не зміг отримати доступ до екрана. Перезапусти сторінку та спробуй ще раз.");
      } else {
        setModerationError("Не вдалося запустити демонстрацію екрана. Перевір підтримку браузера та дозвіл на захоплення екрана.");
      }
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
      <div className="voice-floating-dock" style={dockPosition ? { left: dockPosition.left, top: dockPosition.top, right: "auto", bottom: "auto" } : undefined}>
        <div
          className="voice-floating-dock-header"
          onPointerDown={startDockDrag}
          onPointerMove={moveDock}
          onPointerUp={stopDockDrag}
          onPointerCancel={stopDockDrag}
          title="Перетягни, щоб перемістити панель"
        >
          <span className="voice-drag-grip" aria-hidden="true">⠿</span>
          <span className="voice-mini-indicator" />
          <strong>{displayRoomName}</strong>
          <span className="voice-mini-count"><Users size={12} /> {participants.length}</span>
          <span className="voice-drag-hint">Перемістити</span>
        </div>
        <div className="voice-floating-dock-actions">
          <button type="button" className={`voice-dock-icon-button ${isMicrophoneEnabled ? "" : "is-muted"}`} onClick={() => void toggleMicrophone()} title={isMicrophoneEnabled ? "Вимкнути мікрофон" : "Увімкнути мікрофон"} aria-label={isMicrophoneEnabled ? "Вимкнути мікрофон" : "Увімкнути мікрофон"}>
            {isMicrophoneEnabled ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
          <button type="button" className={`voice-dock-icon-button ${isCameraEnabled ? "is-muted" : ""}`} onClick={() => void toggleCamera()} title={isCameraEnabled ? "Вимкнути камеру" : "Увімкнути камеру"} aria-label={isCameraEnabled ? "Вимкнути камеру" : "Увімкнути камеру"}>{isCameraEnabled ? <CameraOff size={17} /> : <Camera size={17} />}</button>
          <Link className="voice-dock-icon-button" href="/preview/voice" title="Відкрити голосову кімнату" aria-label="Відкрити голосову кімнату"><RadioTower size={17} /></Link>
          <button className="voice-dock-leave" type="button" onClick={onLeave}><DoorOpen size={16} /> Вийти з голосу</button>
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
                        disabled={moderating === participant.identity || microphone.isMuted}
                        onClick={() => void toggleParticipantMute(participant.identity, microphone.trackSid!, true)}
                        title={microphone.isMuted ? "Учасник має самостійно ввімкнути мікрофон" : "Вимкнути мікрофон учаснику"}
                        aria-label={microphone.isMuted ? "Учасник має самостійно ввімкнути мікрофон" : "Вимкнути мікрофон учаснику"}
                      >
                        {moderating === participant.identity ? <LoaderCircle size={15} className="voice-spin" /> : microphone.isMuted ? <Mic size={15} /> : <MicOff size={15} />}
                        <span>{microphone.isMuted ? "Вимкнено" : "Вимкнути звук"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <p className="voice-muted">Поки що нікого немає в кімнаті.</p>}
        </section>

        <section className="voice-content-card voice-screen-card">
          <div className="voice-card-heading"><MonitorUp size={17} /><h3>Відео та демонстрація екрана</h3></div>
          {cameraTracks.length > 0 && (
            <div className="voice-camera-grid">
              {cameraTracks.map((track, index) => (
                <div className="voice-camera-track" key={track.publication.trackSid || `camera-${index}`}>
                  <VideoTrack trackRef={track} />
                  <p>{track.participant.identity === localParticipant.identity ? "Ти" : (track.participant.name || track.participant.identity)}</p>
                </div>
              ))}
            </div>
          )}
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
        <div><strong>Керування звуком і відео</strong><small>Мікрофон, камера та демонстрація екрана</small></div>
        <div className="voice-action-group"><button type="button" className={`voice-action-button ${isMicrophoneEnabled ? "" : "is-muted"}`} onClick={() => void toggleMicrophone()}><>{isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}{isMicrophoneEnabled ? "Мікрофон увімкнено" : "Мікрофон вимкнено"}</></button><button type="button" className={`voice-action-button ${isCameraEnabled ? "is-sharing" : ""}`} onClick={() => void toggleCamera()}><>{isCameraEnabled ? <CameraOff size={18} /> : <Camera size={18} />}{isCameraEnabled ? "Вимкнути камеру" : "Увімкнути камеру"}</></button><button type="button" className={`voice-action-button ${isScreenShareEnabled ? "is-sharing" : ""}`} onClick={() => void toggleScreenShare()} disabled={!screenShareSupported && !isScreenShareEnabled} title={!screenShareSupported ? "Демонстрація екрана недоступна в цьому браузері" : undefined}><>{isScreenShareEnabled ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}{isScreenShareEnabled ? "Зупинити трансляцію" : screenShareSupported ? "Транслювати екран" : "Екран недоступний у браузері"}</></button></div>
        <button className="voice-leave-button" type="button" onClick={onLeave}><DoorOpen size={17} /> Вийти з кімнати</button>
      </div>
      {moderationError && <p className="voice-error" role="alert">{moderationError}</p>}
      <p className="voice-footnote">Звук оптимізовано: придушення еха, фонових шумів та автоматичне регулювання гучності.</p>
    </div>
  );
}
