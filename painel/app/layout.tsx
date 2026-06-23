import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { PrivacyProvider } from "@/components/PrivacyProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Painel | Garrafaria Serra Negra",
  description: "Painel administrativo — WMS, Cockpit BI & Portal B2B",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <QueryProvider>
            <PrivacyProvider>
              {children}
              <Toaster position="top-right" richColors />
            </PrivacyProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
