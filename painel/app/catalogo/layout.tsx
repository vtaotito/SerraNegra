"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { SalesPersonFilterProvider } from "@/contexts/SalesPersonFilterContext";

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <SalesPersonFilterProvider>
        <div className="max-w-[1600px] mx-auto w-full">{children}</div>
      </SalesPersonFilterProvider>
    </ProtectedLayout>
  );
}
