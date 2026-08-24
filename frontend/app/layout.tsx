import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Experiment Lab | Sarvam Studio",
  description: "Model GTM experiment funnels and economics for Sarvam Studio.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
