import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Silhouette Telephone",
  description: "Adivina lo que dibujó el anterior a través de siluetas borrosas.",
  icons: {
    icon: "data:,",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full min-h-screen bg-gradient-to-b from-violet-950 via-black to-violet-950 text-violet-100 antialiased">
        {children}
      </body>
    </html>
  );
}
