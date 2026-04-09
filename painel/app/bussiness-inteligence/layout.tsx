"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { SalesPersonFilterProvider } from "@/contexts/SalesPersonFilterContext";
import { BITopbar } from "./components/BITopbar";
import { BISubnav } from "./components/BISubnav";

export default function BILayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <DateRangeProvider>
        <SalesPersonFilterProvider>
          <div className="max-w-[1600px] mx-auto w-full">
            <BITopbar />
            <BISubnav />
            <div className="mt-4">{children}</div>
          </div>
        </SalesPersonFilterProvider>
      </DateRangeProvider>
    </ProtectedLayout>
  );
}
