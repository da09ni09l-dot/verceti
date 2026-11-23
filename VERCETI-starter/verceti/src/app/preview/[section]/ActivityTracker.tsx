"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ActivityTracker() {
  useEffect(() => {
    const supabase = createClient();

    let seconds = 0;
    let saving = false;
    let cancelled = false;
    let interval: number | undefined;

    const saveActivity = async () => {
      if (saving || seconds === 0) return;

      saving = true;
      const secondsToSave = Math.min(seconds, 60);
      seconds -= secondsToSave;

      const { error } = await supabase.rpc(
        "add_activity_seconds",
        { seconds_to_add: secondsToSave }
      );

      if (error) {
        seconds += secondsToSave;
        console.error("Activity tracking error:", error.message);
      }

      saving = false;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void saveActivity();
      }
    };

    const handleBeforeUnload = () => {
      void saveActivity();
    };

    async function startTracking() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (cancelled || error || !user) return;

      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          seconds += 1;

          if (seconds >= 30) {
            void saveActivity();
          }
        }
      }, 1000);

      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    void startTracking();

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void saveActivity();
    };
  }, []);

  return null;
}
