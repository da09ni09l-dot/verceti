
import type { Metadata } from "next";
import "./globals.css";
import OnlinePresenceProvider from "./OnlinePresenceProvider";
import MusicRoom from "./preview/[section]/MusicRoom";
import PinnedSiteActions from "./PinnedSiteActions";

export const metadata: Metadata = {
  title: "VERCETI — закрита спільнота",
  description: "Приватний простір спільноти VERCETI"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>
        <OnlinePresenceProvider>
          {children}
          <MusicRoom />
          <PinnedSiteActions />
        </OnlinePresenceProvider>
      </body>
    </html>
  );
}
