import { redirect } from "next/navigation";

export default function MargensLegacyRedirect() {
  redirect("/business-intelligence/faturamento?tab=descontos");
}
