"use client";

import { PackageCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeliveryFields } from "./DeliveryFields";
import { Spinner } from "./Spinner";
import { isValidCep, type DeliveryForm } from "./types";

export function DeliveryStep({
  delivery,
  loading,
  onChange,
  onSubmit,
}: {
  delivery: DeliveryForm;
  loading: boolean;
  onChange: (patch: Partial<DeliveryForm>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  // Quando o endereço de entrega é próprio, exigimos ao menos um CEP válido.
  const canSubmit =
    delivery.sameAsBilling ||
    (isValidCep(delivery.zipCode) && !!delivery.street.trim());

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Truck className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Nos conte como e onde entregar. Esses dados agilizam a primeira
          entrega e podem ser ajustados depois na sua conta.
        </p>
      </div>

      <DeliveryFields
        value={delivery}
        onChange={onChange}
        disabled={loading}
        idPrefix="onb-delivery"
      />

      <Button
        type="submit"
        className="mt-2 h-11 w-full"
        disabled={loading || !canSubmit}
      >
        {loading ? <Spinner /> : <PackageCheck className="h-4 w-4" />}
        {loading ? "Enviando cadastro..." : "Enviar cadastro"}
      </Button>
    </form>
  );
}
