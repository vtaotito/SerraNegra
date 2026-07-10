"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Truck } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliveryFields } from "@/components/onboarding/DeliveryFields";
import {
  EMPTY_DELIVERY_FORM,
  isValidCep,
  type DeliveryForm,
} from "@/components/onboarding/types";
import { useAuth } from "@/lib/auth/context";
import { get, put } from "@/lib/api/client";

interface DeliveryResponse {
  delivery: DeliveryForm | null;
}

export default function EntregaPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<DeliveryForm>(EMPTY_DELIVERY_FORM);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const { data, isLoading, isError } = useQuery<DeliveryResponse>({
    queryKey: ["b2b-delivery"],
    queryFn: () => get("/b2b/delivery"),
    enabled: isAuthenticated,
  });

  // Sincroniza o formulário local quando os dados chegam do servidor.
  useEffect(() => {
    if (data?.delivery) {
      setForm({ ...EMPTY_DELIVERY_FORM, ...data.delivery });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: DeliveryForm) =>
      put<{ ok: boolean; delivery: DeliveryForm }>("/b2b/delivery", payload),
    onSuccess: (res) => {
      if (res?.delivery) {
        setForm({ ...EMPTY_DELIVERY_FORM, ...res.delivery });
      }
      queryClient.invalidateQueries({ queryKey: ["b2b-delivery"] });
      toast.success("Dados de entrega salvos com sucesso");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sameAsBilling && !isValidCep(form.zipCode)) {
      toast.error("Informe um CEP válido para o endereço de entrega");
      return;
    }
    mutation.mutate(form);
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gsn-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gsn-brand/10 text-gsn-brand">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gsn-text">
                Dados de Entrega
              </h1>
              <p className="text-sm text-muted-foreground">
                Mantenha seu endereço e preferências de entrega atualizados.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-gsn-text">
                Preferências de entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-md" />
                  ))}
                </div>
              ) : isError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  Não foi possível carregar seus dados de entrega. Tente
                  novamente mais tarde.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <DeliveryFields
                    value={form}
                    onChange={(patch) =>
                      setForm((prev) => ({ ...prev, ...patch }))
                    }
                    disabled={mutation.isPending}
                    idPrefix="conta-delivery"
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      className="h-11 w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white sm:w-auto"
                    >
                      {mutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {mutation.isPending ? "Salvando..." : "Salvar alterações"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
