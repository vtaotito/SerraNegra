"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search, Lock, EyeOff, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "./ImageUpload";
import { SeoPreview } from "./SeoPreview";
import {
  SEO_TITLE_MAX,
  SEO_DESCRIPTION_MAX,
  type AdminProduct,
} from "@/lib/admin/catalog";
import { cn } from "@/lib/utils";

export interface ProductPatch {
  description_short?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_slug?: string | null;
  og_image_url?: string | null;
  admin_hidden?: boolean;
}

interface ProductDrawerProps {
  product: AdminProduct;
  open: boolean;
  saving: boolean;
  unlocking: boolean;
  onClose: () => void;
  onSave: (patch: ProductPatch) => Promise<void>;
  onUnlock: () => void;
  onImageUploaded: (updated: AdminProduct) => void;
}

function CharCounter({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <span className={cn("text-[11px]", over ? "text-red-400" : "text-slate-500")}>
      {value}/{max}
    </span>
  );
}

export function ProductDrawer({
  product,
  open,
  saving,
  unlocking,
  onClose,
  onSave,
  onUnlock,
  onImageUploaded,
}: ProductDrawerProps) {
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoSlug, setSeoSlug] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [hidden, setHidden] = useState(false);

  // Re-seed ao trocar de produto.
  useEffect(() => {
    setDescription(product.description ?? "");
    setSeoTitle(product.seoTitle ?? "");
    setSeoDescription(product.seoDescription ?? "");
    setSeoSlug(product.seoSlug ?? "");
    setOgImageUrl(product.ogImageUrl ?? "");
    setHidden(product.adminHidden);
  }, [product]);

  const dirty = useMemo(() => {
    return (
      description !== (product.description ?? "") ||
      seoTitle !== (product.seoTitle ?? "") ||
      seoDescription !== (product.seoDescription ?? "") ||
      seoSlug !== (product.seoSlug ?? "") ||
      ogImageUrl !== (product.ogImageUrl ?? "") ||
      hidden !== product.adminHidden
    );
  }, [description, seoTitle, seoDescription, seoSlug, ogImageUrl, hidden, product]);

  async function handleSave() {
    if (!dirty) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    const patch: ProductPatch = {};
    if (description !== (product.description ?? "")) patch.description_short = description || null;
    if (seoTitle !== (product.seoTitle ?? "")) patch.seo_title = seoTitle || null;
    if (seoDescription !== (product.seoDescription ?? "")) patch.seo_description = seoDescription || null;
    if (seoSlug !== (product.seoSlug ?? "")) patch.seo_slug = seoSlug || null;
    if (ogImageUrl !== (product.ogImageUrl ?? "")) patch.og_image_url = ogImageUrl || null;
    if (hidden !== product.adminHidden) patch.admin_hidden = hidden;
    await onSave(patch);
  }

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerHeader
        title={product.name}
        description={`${product.sku}${product.category ? ` · ${product.category}` : ""}`}
        onClose={onClose}
      >
        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.contentLocked && (
            <Badge variant="warning" className="gap-1">
              <Lock className="h-3 w-3" /> Travado
            </Badge>
          )}
          {product.adminHidden && (
            <Badge variant="destructive" className="gap-1">
              <EyeOff className="h-3 w-3" /> Oculto
            </Badge>
          )}
          {!product.imageUrl && (
            <Badge variant="secondary" className="gap-1">
              Sem imagem
            </Badge>
          )}
        </div>
      </DrawerHeader>

      <DrawerBody
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
      >
        {/* Visibilidade */}
        <section className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          <div>
            <Label className="text-slate-200">Exibir no catálogo</Label>
            <p className="text-xs text-slate-500">
              {hidden ? "Produto oculto do catálogo do cliente." : "Produto visível para os clientes."}
            </p>
          </div>
          <Switch
            checked={!hidden}
            onCheckedChange={(v) => setHidden(!v)}
            aria-label="Alternar visibilidade do produto"
          />
        </section>

        {/* Imagem */}
        <section className="space-y-2">
          <Label className="text-slate-200">Imagem do produto</Label>
          <ImageUpload
            sku={product.sku}
            currentImage={product.imageUrl}
            contentLocked={product.contentLocked}
            onUploaded={onImageUploaded}
            onUnlock={onUnlock}
            unlocking={unlocking}
          />
        </section>

        {/* Descrição */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="desc" className="text-slate-200">Descrição</Label>
            <CharCounter value={description.length} max={500} />
          </div>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Descrição curta exibida no catálogo..."
            className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
          />
        </section>

        {/* SEO */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">SEO</h3>
            <span className="text-[11px] text-slate-500">(armazenado; aplicado na vitrine futuramente)</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-title" className="text-slate-300">Título</Label>
              <CharCounter value={seoTitle.length} max={SEO_TITLE_MAX} />
            </div>
            <Input
              id="seo-title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={product.name}
              className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-desc" className="text-slate-300">Meta descrição</Label>
              <CharCounter value={seoDescription.length} max={SEO_DESCRIPTION_MAX} />
            </div>
            <Textarea
              id="seo-desc"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={3}
              placeholder="Resumo exibido nos resultados de busca..."
              className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="seo-slug" className="text-slate-300">Slug</Label>
              <Input
                id="seo-slug"
                value={seoSlug}
                onChange={(e) => setSeoSlug(e.target.value)}
                placeholder="ex.: garrafa-750ml"
                className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-image" className="text-slate-300">Imagem Open Graph (URL)</Label>
              <Input
                id="og-image"
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                placeholder="https://..."
                className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          <SeoPreview
            title={seoTitle}
            description={seoDescription}
            slug={seoSlug}
            ogImageUrl={ogImageUrl}
            fallbackTitle={product.name}
            fallbackImage={product.imageUrl}
          />
        </section>

        {product.updatedBy && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <Tag className="h-3 w-3" />
            Última edição por {product.updatedBy}
            {product.updatedAt && ` em ${new Date(product.updatedAt).toLocaleString("pt-BR")}`}
          </p>
        )}
      </DrawerBody>

      <DrawerFooter>
        <span className="mr-auto text-xs text-slate-500">
          {dirty ? "Alterações não salvas · Ctrl+Enter para salvar" : "Tudo salvo"}
        </span>
        <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
          Fechar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
