import { toast } from "sonner";

/** Toast de item adicionado com CTA para abrir o carrinho. */
export function toastAddedToCart(
  title: string,
  opts?: { description?: string; onViewCart?: () => void; asIs?: boolean },
) {
  toast.success(opts?.asIs ? title : `${title} adicionado ao carrinho`, {
    description: opts?.description,
    duration: 5000,
    action: {
      label: "Ver carrinho",
      onClick: () => {
        if (opts?.onViewCart) {
          opts.onViewCart();
          return;
        }
        window.location.assign("/carrinho");
      },
    },
  });
}
