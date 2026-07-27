"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { SalesPersonFilterProvider } from "@/contexts/SalesPersonFilterContext";
import { PracaFilterProvider } from "@/contexts/PracaFilterContext";
import { BITopbar } from "./components/BITopbar";
import { BISubnav } from "./components/BISubnav";
import { BIErrorBoundary } from "./BIErrorBoundary";

export default function BILayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <DateRangeProvider>
        <SalesPersonFilterProvider>
          <PracaFilterProvider>
            <div className="max-w-[1600px] mx-auto w-full">
              <BITopbar />
              <BISubnav />
              <main id="bi-main" className="mt-4" tabIndex={-1}>
                <BIErrorBoundary>{children}</BIErrorBoundary>
              </main>
            </div>
          </PracaFilterProvider>
        </SalesPersonFilterProvider>
      </DateRangeProvider>
    </ProtectedLayout>
  );
}
