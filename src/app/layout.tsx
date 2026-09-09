import type { Metadata } from "next";
import "./globals.css";
import MusicPlayer from "@/components/MusicPlayer";

export const metadata: Metadata = {
  title: "Who Ya Got? — NFL Picks Pool",
  description: "Paul, Brian, Anwar & Kevin's weekly NFL picks pool",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <MusicPlayer />
      </body>
    </html>
  );
}
