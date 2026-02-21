import type { Metadata } from "next";
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
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="https://garrafariaserranegra.com.br/wp-content/uploads/2023/05/cropped-LOGO-GARRAFARIA-SERRA-NEGRA-40-ANOS-SITE-OFICIAL-32x32.png" sizes="32x32" />
        <link rel="icon" href="https://garrafariaserranegra.com.br/wp-content/uploads/2023/05/cropped-LOGO-GARRAFARIA-SERRA-NEGRA-40-ANOS-SITE-OFICIAL-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="https://garrafariaserranegra.com.br/wp-content/uploads/2023/05/cropped-LOGO-GARRAFARIA-SERRA-NEGRA-40-ANOS-SITE-OFICIAL-180x180.png" />
      </head>
      <body className={`${montserrat.variable} ${montserrat.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
