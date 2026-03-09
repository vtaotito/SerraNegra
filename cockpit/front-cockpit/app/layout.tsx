"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { useState } from "react";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="pt-BR" className={font.variable}>
      <head>
        <title>Cockpit BI — Serra Negra</title>
        <meta name="description" content="Painel analítico comercial e operacional" />
      </head>
      <body className="min-h-screen flex bg-cockpit-bg text-gray-200">
        <DateRangeProvider>
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
          </div>
        </DateRangeProvider>
      </body>
    </html>
  );
}
