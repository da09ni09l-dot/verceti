
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type OnlinePresenceContextType = {
  onlineIds: string[];
};

const OnlinePresenceContext =
  createContext<OnlinePresenceContextType>({
    onlineIds: []
  });

export function useOnlinePresence() {
  return useContext(OnlinePresenceContext);
}

export default function OnlinePresenceProvider({
  children
}: {
  children: ReactNode;
}) {
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    async function startPresence() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (cancelled || error || !user) return;

      channel = supabase.channel("verceti-online", {
        config: {
          presence: {
            key: user.id
          }
        }
      });

      const updateOnlineUsers = () => {
        if (!channel) return;

        const state = channel.presenceState();
        const ids = Object.keys(state);

        setOnlineIds(ids);
      };

      channel
        .on("presence", { event: "sync" }, updateOnlineUsers)
        .on("presence", { event: "join" }, updateOnlineUsers)
        .on("presence", { event: "leave" }, updateOnlineUsers)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString()
            });

            updateOnlineUsers();
          }
        });
    }

    startPresence();

    return () => {
      cancelled = true;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <OnlinePresenceContext.Provider value={{ onlineIds }}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}
