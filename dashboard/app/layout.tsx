import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";

// Overpass is an open-source take on Highway Gothic, the road-sign face.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: "HeatTrace Supervisor",
  description: "Live worker WBGT, zone heat and alert log for site supervisors.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${overpass.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
