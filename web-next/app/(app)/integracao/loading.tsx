import { Skeleton } from "@/components/ui/skeleton";

export default function IntegracaoLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
