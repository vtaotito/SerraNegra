import { redirect } from "next/navigation";

export default function ResumoLegacyRedirect() {
  redirect("/business-intelligence/faturamento?tab=resumo");
}
