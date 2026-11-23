
import type { Metadata } from "next";
import "./globals.css";
import OnlinePresenceProvider from "./OnlinePresenceProvider";

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
        </OnlinePresenceProvider>
      </body>
    </html>
  );
}
