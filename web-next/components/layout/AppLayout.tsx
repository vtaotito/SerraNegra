import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils/cn";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (Desktop) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <Topbar />

        {/* Page Content */}
        <main
          className={cn(
            "min-h-[calc(100vh-4rem)] p-4 lg:p-6 pb-20 lg:pb-6",
            className
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile Navigation (Bottom) */}
      <MobileNav />
    </div>
  );
}
