import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text to 3D motion - pipeline proof of concept",
  description:
    "Proves that stored motion data can drive a rigged 3D human in the browser. Technical test only - not validated Auslan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
