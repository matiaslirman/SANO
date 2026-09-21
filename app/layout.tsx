import type { Metadata, Viewport } from "next";
import { Oswald, Archivo } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sano — Comida lista y sana | 22 Bistro",
  description:
    "Platos de chef listos para retirar en Ciudad Colón. Elegí tu menú de la semana y coordiná por WhatsApp. Cupos limitados por entrega.",
  icons: {
    icon: "/brand/logo-seal.svg",
  },
  openGraph: {
    title: "Sano — Comida lista y sana",
    description: "Resolvé almuerzos y cenas. Platos de chef, listos para retirar.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#921A1B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${oswald.variable} ${archivo.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
