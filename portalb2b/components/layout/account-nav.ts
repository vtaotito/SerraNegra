import {
  ClipboardList,
  Heart,
  ListOrdered,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type AccountNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Itens de conta/conta do cliente — ficam no menu do usuário, não na nav principal. */
export const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/listas", label: "Listas", icon: ListOrdered },
  { href: "/pedidos", label: "Meus Pedidos", icon: ClipboardList },
  { href: "/entrega", label: "Entrega", icon: Truck },
];

export function isAccountNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAnyAccountNavActive(pathname: string): boolean {
  return ACCOUNT_NAV_ITEMS.some((item) => isAccountNavActive(pathname, item.href));
}
