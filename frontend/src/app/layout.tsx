import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { StoreProvider } from "@/store/StoreProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DataPilot",
  description: "Talk to your PostgreSQL database in plain English.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {/*
          RootProvider lives at the root (not the docs layout) so next-themes'
          inline theme script is server-rendered once and persists across
          navigation - rendering it in a nested, client-navigated layout throws
          "Encountered a script tag while rendering React component".

          Search is disabled here so no global key listener is bound outside the
          docs. /docs mounts its own SearchProvider instead. Note: do NOT pass
          `hotKey: []` to try to disable it - the matcher is `hotKey.every(...)`,
          which is vacuously true for an empty array, so every keypress would
          open the dialog.
        */}
        <RootProvider search={{ enabled: false }}>
          <StoreProvider>{children}</StoreProvider>
        </RootProvider>
      </body>
    </html>
  );
}
