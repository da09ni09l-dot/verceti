
import type { Metadata } from "next";
import "./globals.css";
import "@livekit/components-styles";
import OnlinePresenceProvider from "./OnlinePresenceProvider";
import MusicRoom from "./preview/[section]/MusicRoom";
import PinnedSiteActions from "./PinnedSiteActions";
import LiveDataRefresh from "./LiveDataRefresh";
import ActivityTracker from "./preview/[section]/ActivityTracker";
import VoiceRoom from "./preview/[section]/VoiceRoom";
import CallActions from "./preview/members/[id]/CallActions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "VERCETI — закрита спільнота",
  description: "Приватний простір спільноти VERCETI"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isStaff = false;
  let canModerateVoice = false;
  if (user) {
    const [{ data: staffData, error: staffError }, { data: roleData, error: roleError }] = await Promise.all([
      supabase.rpc("is_verceti_staff"),
      supabase.rpc("current_verceti_role")
    ]);
    isStaff = !staffError && staffData === true;
    canModerateVoice = !roleError && ["admin", "leader", "moderator"].includes(String(roleData));
  }

  return (
    <html lang="uk">
      <body>
        <OnlinePresenceProvider>
          <LiveDataRefresh />
          <ActivityTracker />
          {children}
          <MusicRoom />
          <VoiceRoom isStaff={isStaff} canModerateVoice={canModerateVoice} />
          {user && <CallActions currentUserId={user.id} listenForCalls />}
          <PinnedSiteActions />
        </OnlinePresenceProvider>
      </body>
    </html>
  );
}
