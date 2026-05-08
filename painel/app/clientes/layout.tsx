"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { SalesPersonFilterProvider } from "@/contexts/SalesPersonFilterContext";

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <DateRangeProvider>
        <SalesPersonFilterProvider>
          <div className="max-w-[1600px] mx-auto w-full">{children}</div>
        </SalesPersonFilterProvider>
      </DateRangeProvider>
    </ProtectedLayout>
  );
}
