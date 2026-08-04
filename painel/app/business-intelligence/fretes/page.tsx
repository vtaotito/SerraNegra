import { redirect } from "next/navigation";

/**
 * Fretes unificados em /pedidos?view=fretes.
 */
export default function FretesBIRedirect() {
  redirect("/pedidos?view=fretes");
}
