"use client";

import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/context";
import { logoutAction } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="font-semibold">WMS/OMS</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{user.name}</span>
            <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
          </div>

          <form action={logoutAction}>
            <Button variant="ghost" size="icon" type="submit" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
