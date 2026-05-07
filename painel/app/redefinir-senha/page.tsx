import { Suspense } from "react";
import RedefinirSenhaForm from "./RedefinirSenhaForm";

export const dynamic = "force-dynamic";

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div
            className="h-10 w-10 rounded-full border-2 border-gsn-700/20 border-t-gsn-700 animate-spin motion-reduce:animate-none"
            role="status"
            aria-label="Carregando"
          />
        </div>
      }
    >
      <RedefinirSenhaForm />
    </Suspense>
  );
}
