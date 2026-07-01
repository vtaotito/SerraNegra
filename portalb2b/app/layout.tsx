import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "./providers";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Portal - Garrafaria Serra Negra",
  description: "Portal de pedidos B2B - Garrafaria Serra Negra",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#AA1A1B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="https://garrafariaserranegra.com.br/wp-content/uploads/2020/08/cropped-favicon_serranegra_2016-32x32.png" sizes="32x32" />
        <link rel="icon" href="https://garrafariaserranegra.com.br/wp-content/uploads/2020/08/cropped-favicon_serranegra_2016-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="https://garrafariaserranegra.com.br/wp-content/uploads/2020/08/cropped-favicon_serranegra_2016-180x180.png" />
      </head>
      <body className={`${montserrat.variable} ${montserrat.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
