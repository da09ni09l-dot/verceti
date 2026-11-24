
import type { Metadata } from "next";
import "./globals.css";
import OnlinePresenceProvider from "./OnlinePresenceProvider";
import MusicRoom from "./preview/[section]/MusicRoom";
import PinnedSiteActions from "./PinnedSiteActions";
import LiveDataRefresh from "./LiveDataRefresh";
import ActivityTracker from "./preview/[section]/ActivityTracker";
import VoiceRoom from "./preview/[section]/VoiceRoom";
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
  if (user) {
    const { data, error } = await supabase.rpc("is_verceti_staff");
    isStaff = !error && data === true;
  }

  return (
    <html lang="uk">
      <body>
        <OnlinePresenceProvider>
          <LiveDataRefresh />
          <ActivityTracker />
          {children}
          <MusicRoom />
          <VoiceRoom isStaff={isStaff} />
          <PinnedSiteActions />
        </OnlinePresenceProvider>
      </body>
    </html>
  );
}
