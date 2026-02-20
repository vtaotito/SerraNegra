"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/api/queryClient";
import { AuthProvider } from "@/lib/auth/context";
import { CartProvider } from "@/lib/cart/context";
import { AuthGuard } from "@/components/layout/AuthGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <AuthGuard>{children}</AuthGuard>
        </CartProvider>
      </AuthProvider>
      <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  );
}
