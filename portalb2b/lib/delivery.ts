import type { DeliveryForm } from "@/components/onboarding/types";

/** Linha legível do endereço de entrega (ou cobrança, se sameAsBilling). */
export function formatDeliveryAddress(delivery: DeliveryForm | null | undefined): string | null {
  if (!delivery) return null;
  if (delivery.sameAsBilling) {
    return "Mesmo endereço de cobrança";
  }
  const line1 = [delivery.street, delivery.number].filter(Boolean).join(", ");
  const line2 = [delivery.neighborhood, delivery.city, delivery.state]
    .filter(Boolean)
    .join(" · ");
  const cep = delivery.zipCode?.trim();
  const parts = [line1, line2, cep ? `CEP ${cep}` : ""].filter(Boolean);
  return parts.length ? parts.join(" — ") : null;
}

export function formatDeliveryContact(delivery: DeliveryForm | null | undefined): string | null {
  if (!delivery) return null;
  const parts = [delivery.contactName, delivery.contactPhone].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
