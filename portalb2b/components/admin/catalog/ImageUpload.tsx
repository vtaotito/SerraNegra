"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud, Loader2, ImageOff, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { adminUpload } from "@/lib/admin/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminProduct } from "@/lib/admin/catalog";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

interface ImageUploadProps {
  sku: string;
  currentImage: string | null;
  contentLocked: boolean;
  onUploaded: (product: AdminProduct) => void;
  onUnlock: () => void;
  unlocking?: boolean;
}

export function ImageUpload({
  sku,
  currentImage,
  contentLocked,
  onUploaded,
  onUnlock,
  unlocking,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!ACCEPT.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande (máx. 8MB).");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    setProgress(0);
    try {
      const res = await adminUpload<{ ok: boolean; data: AdminProduct; imageUrl: string }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(sku)}/image`,
        file,
        setProgress,
      );
      toast.success("Imagem enviada com sucesso.");
      if (res.data) onUploaded(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(0);
      URL.revokeObjectURL(localUrl);
    }
  }

  const shown = preview ?? currentImage;

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          dragOver
            ? "border-emerald-400 bg-emerald-500/10"
            : "border-slate-600 bg-slate-800/40 hover:border-slate-500",
        )}
      >
        <div className="relative h-40 w-40 overflow-hidden rounded-lg bg-slate-900">
          {shown ? (
            <Image src={shown} alt="Imagem do produto" fill unoptimized className="object-contain" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-600">
              <ImageOff className="h-8 w-8" />
              <span className="mt-1 text-xs">Sem imagem</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <span className="text-xs text-white">{progress}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <UploadCloud className="h-4 w-4" />
          <span>
            Arraste uma imagem ou <span className="text-emerald-400">clique para enviar</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-500">JPG, PNG ou WEBP · até 8MB</p>
        {uploading && (
          <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {contentLocked ? (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Conteúdo travado — o sync não altera imagem/descrição.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onUnlock}
            disabled={unlocking}
            className="h-7 gap-1 px-2 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
          >
            {unlocking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
            Voltar a usar imagem do sync
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Unlock className="h-3.5 w-3.5" />
          Seguindo o sync automático. Enviar imagem ou editar trava o conteúdo.
        </p>
      )}
    </div>
  );
}
