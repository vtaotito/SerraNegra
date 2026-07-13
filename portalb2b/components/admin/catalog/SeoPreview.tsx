"use client";

import Image from "next/image";
import { Globe, ImageOff } from "lucide-react";

const PORTAL_ORIGIN = "garrafariaserranegra.com.br";

interface SeoPreviewProps {
  title: string;
  description: string;
  slug: string;
  ogImageUrl: string;
  fallbackTitle: string;
  fallbackImage: string | null;
}

/** Preview ao vivo: snippet SERP do Google + card Open Graph. */
export function SeoPreview({
  title,
  description,
  slug,
  ogImageUrl,
  fallbackTitle,
  fallbackImage,
}: SeoPreviewProps) {
  const shownTitle = title.trim() || fallbackTitle;
  const shownDesc =
    description.trim() ||
    "A descrição de SEO aparecerá aqui. Escreva um resumo atraente do produto.";
  const cleanSlug = slug.trim().replace(/^\/+/, "");
  const url = `${PORTAL_ORIGIN}/b2b${cleanSlug ? `/catalogo/${cleanSlug}` : "/catalogo"}`;
  const ogImg = ogImageUrl.trim() || fallbackImage || "";

  return (
    <div className="space-y-4">
      {/* SERP (Google) */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Prévia no Google
        </p>
        <div className="rounded-lg border border-slate-700 bg-white p-3">
          <div className="flex items-center gap-1 text-xs text-[#4d5156]">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100">
              <Globe className="h-2.5 w-2.5 text-slate-500" />
            </span>
            <span className="truncate">{url}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-lg leading-6 text-[#1a0dab]">
            {shownTitle}
          </p>
          <p className="line-clamp-2 text-sm leading-5 text-[#4d5156]">{shownDesc}</p>
        </div>
      </div>

      {/* Card Open Graph */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Prévia de compartilhamento (Open Graph)
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
          <div className="relative aspect-[1.91/1] w-full bg-slate-900">
            {ogImg ? (
              <Image
                src={ogImg}
                alt="Prévia Open Graph"
                fill
                unoptimized
                className="object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-slate-600">
                <ImageOff className="h-8 w-8" />
                <span className="mt-1 text-xs">Sem imagem</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-700 p-3">
            <p className="text-[11px] uppercase text-slate-500">{PORTAL_ORIGIN}</p>
            <p className="line-clamp-1 text-sm font-semibold text-slate-100">
              {shownTitle}
            </p>
            <p className="line-clamp-2 text-xs text-slate-400">{shownDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
