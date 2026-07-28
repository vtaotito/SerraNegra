"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

export interface InboxItem {
  docEntry: number;
  docNum: number | null;
  messages: number;
  openRequests: number;
  lastAuthor: "customer" | "seller" | null;
  lastBody: string | null;
  lastAt: string | null;
}

interface InboxResponse {
  items: InboxItem[];
  awaitingCount: number;
}

const SEEN_KEY = "b2b_inbox_seen";
export const INBOX_QUERY_KEY = ["b2b-inbox"] as const;

type SeenMap = Record<string, string>;

function loadSeen(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeenMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistSeen(map: SeenMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

function isUnread(item: InboxItem, seen: SeenMap): boolean {
  if (item.lastAuthor !== "seller" || !item.lastAt) return false;
  const seenAt = seen[String(item.docEntry)];
  if (!seenAt) return true;
  return new Date(item.lastAt).getTime() > new Date(seenAt).getTime();
}

/**
 * Inbox de mensagens do portal: pedidos cuja última mensagem é do vendedor
 * contam como não lidas até o cliente abrir o pedido.
 */
export function useInbox() {
  const { isAuthenticated } = useAuth();
  const [seen, setSeen] = useState<SeenMap>({});
  const [seenReady, setSeenReady] = useState(false);

  useEffect(() => {
    setSeen(loadSeen());
    setSeenReady(true);
  }, []);

  const query = useQuery<InboxResponse>({
    queryKey: INBOX_QUERY_KEY,
    queryFn: () => get<InboxResponse>("/b2b/messages/inbox"),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const items = query.data?.items ?? [];

  const unreadItems = useMemo(() => {
    if (!seenReady) return [];
    return items.filter((i) => isUnread(i, seen));
  }, [items, seen, seenReady]);

  const unreadCount = unreadItems.length;

  const markSeen = useCallback((docEntry: number | string, at?: string | null) => {
    const key = String(docEntry);
    const stamp = at ?? new Date().toISOString();
    setSeen((prev) => {
      const next = { ...prev, [key]: stamp };
      persistSeen(next);
      return next;
    });
  }, []);

  const summaryFor = useCallback(
    (docEntry: number) => items.find((i) => i.docEntry === docEntry) ?? null,
    [items],
  );

  return {
    items,
    unreadItems,
    unreadCount,
    awaitingCount: query.data?.awaitingCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    markSeen,
    summaryFor,
    isUnread: (docEntry: number) => {
      const item = items.find((i) => i.docEntry === docEntry);
      return item ? isUnread(item, seen) : false;
    },
  };
}
