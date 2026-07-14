"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Search, Lock, EyeOff, Tag, Sparkles, AlertTriangle, X } from "lucide-react";
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
import { SeoFieldDiff } from "./SeoFieldDiff";
import { SeoScorePanel } from "./SeoScorePanel";
import {
  SEO_TITLE_MAX,
  SEO_DESCRIPTION_MAX,
  type AdminProduct,
} from "@/lib/admin/catalog";
import {
  suggestProductSeo,
  fetchSeoConfig,
  type ProductSeoSuggestion,
} from "@/lib/admin/seo";
import { cn } from "@/lib/utils";

export interface ProductPatch {
  description_short?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_slug?: string | null;
  seo_keywords?: string[] | null;
  seo_attributes?: { name: string; value: string }[] | null;
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

type AppliedFields = Record<string, boolean>;

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
  const [keywords, setKeywords] = useState("");
  const [attributes, setAttributes] = useState<{ name: string; value: string }[]>([]);
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [hidden, setHidden] = useState(false);

  // Estado da geração por IA (modo revisão).
  const [suggestion, setSuggestion] = useState<ProductSeoSuggestion | null>(null);
  const [applied, setApplied] = useState<AppliedFields>({});
  const [generating, setGenerating] = useState(false);

  const configQuery = useQuery({ queryKey: ["admin-seo-config"], queryFn: fetchSeoConfig });
  const aiConfigured = configQuery.data?.data.openaiConfigured ?? false;

  // Re-seed ao trocar de produto.
  useEffect(() => {
    setDescription(product.description ?? "");
    setSeoTitle(product.seoTitle ?? "");
    setSeoDescription(product.seoDescription ?? "");
    setSeoSlug(product.seoSlug ?? "");
    setKeywords((product.seoKeywords ?? []).join(", "));
    setAttributes(product.seoAttributes ?? []);
    setOgImageUrl(product.ogImageUrl ?? "");
    setHidden(product.adminHidden);
    setSuggestion(null);
    setApplied({});
  }, [product]);

  const keywordsArray = useMemo(
    () => keywords.split(",").map((k) => k.trim()).filter(Boolean),
    [keywords],
  );

  const originalKeywords = (product.seoKeywords ?? []).join(", ");

  const dirty = useMemo(() => {
    return (
      description !== (product.description ?? "") ||
      seoTitle !== (product.seoTitle ?? "") ||
      seoDescription !== (product.seoDescription ?? "") ||
      seoSlug !== (product.seoSlug ?? "") ||
      keywords !== originalKeywords ||
      JSON.stringify(attributes) !== JSON.stringify(product.seoAttributes ?? []) ||
      ogImageUrl !== (product.ogImageUrl ?? "") ||
      hidden !== product.adminHidden
    );
  }, [description, seoTitle, seoDescription, seoSlug, keywords, attributes, ogImageUrl, hidden, product, originalKeywords]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await suggestProductSeo(product.sku);
      setSuggestion(res.data);
      setApplied({});
      toast.success("Sugestão gerada. Revise e aplique os campos desejados.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar sugestão com IA");
    } finally {
      setGenerating(false);
    }
  }

  function applyField(field: string) {
    if (!suggestion) return;
    switch (field) {
      case "seo_title":
        setSeoTitle(suggestion.seo_title);
        break;
      case "seo_description":
        setSeoDescription(suggestion.seo_description);
        break;
      case "seo_slug":
        setSeoSlug(suggestion.seo_slug);
        break;
      case "description":
        setDescription(suggestion.description_rich);
        break;
      case "keywords":
        setKeywords(suggestion.keywords.join(", "));
        break;
      case "attributes":
        setAttributes(suggestion.attributes);
        break;
    }
    setApplied((a) => ({ ...a, [field]: true }));
  }

  function applyAll() {
    if (!suggestion) return;
    setSeoTitle(suggestion.seo_title);
    setSeoDescription(suggestion.seo_description);
    setSeoSlug(suggestion.seo_slug);
    setDescription(suggestion.description_rich);
    setKeywords(suggestion.keywords.join(", "));
    setAttributes(suggestion.attributes);
    setApplied({
      seo_title: true,
      seo_description: true,
      seo_slug: true,
      description: true,
      keywords: true,
      attributes: true,
    });
    toast.success("Todos os campos aplicados. Revise e salve.");
  }

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
    if (keywords !== originalKeywords) patch.seo_keywords = keywordsArray;
    if (JSON.stringify(attributes) !== JSON.stringify(product.seoAttributes ?? []))
      patch.seo_attributes = attributes;
    if (ogImageUrl !== (product.ogImageUrl ?? "")) patch.og_image_url = ogImageUrl || null;
    if (hidden !== product.adminHidden) patch.admin_hidden = hidden;
    await onSave(patch);
  }

  const scoreInput = {
    seoTitle,
    seoDescription,
    seoSlug,
    description,
    imageUrl: product.imageUrl,
    ogImageUrl,
    keywords: keywordsArray,
  };

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
          {!product.canonicalUrl && (
            <Badge variant="outline" className="border-slate-600 text-slate-400">
              Sem página pública
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

        {/* Qualidade de SEO (score determinístico ao vivo) */}
        <SeoScorePanel input={scoreInput} />

        {/* Geração por IA */}
        <section className="space-y-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-200">IA especialista em SEO</h3>
            </div>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!aiConfigured || generating}
              className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Gerar com IA
            </Button>
          </div>

          {!aiConfigured ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                IA não configurada. Defina <code className="text-amber-100">OPENAI_API_KEY</code> no
                gateway para habilitar a geração automática de SEO.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Gera sugestões de título, meta, slug, descrição, palavras-chave e atributos. Nada é
              salvo automaticamente: revise e aplique.
            </p>
          )}

          {suggestion && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Revisão da sugestão</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={applyAll}
                    className="h-7 gap-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Aplicar todos
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSuggestion(null)}
                    className="h-7 gap-1 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" /> Descartar
                  </Button>
                </div>
              </div>
              <SeoFieldDiff
                label="Título"
                current={seoTitle}
                suggested={suggestion.seo_title}
                applied={!!applied.seo_title}
                onApply={() => applyField("seo_title")}
              />
              <SeoFieldDiff
                label="Meta descrição"
                current={seoDescription}
                suggested={suggestion.seo_description}
                applied={!!applied.seo_description}
                onApply={() => applyField("seo_description")}
              />
              <SeoFieldDiff
                label="Slug"
                current={seoSlug}
                suggested={suggestion.seo_slug}
                applied={!!applied.seo_slug}
                onApply={() => applyField("seo_slug")}
              />
              <SeoFieldDiff
                label="Descrição comercial"
                current={description}
                suggested={suggestion.description_rich}
                applied={!!applied.description}
                onApply={() => applyField("description")}
              />
              <SeoFieldDiff
                label="Palavras-chave"
                current={keywordsArray.join(", ")}
                suggested={suggestion.keywords.join(", ")}
                applied={!!applied.keywords}
                onApply={() => applyField("keywords")}
              />
              <SeoFieldDiff
                label="Atributos"
                current={attributes.map((a) => `${a.name}: ${a.value}`).join(" · ")}
                suggested={suggestion.attributes.map((a) => `${a.name}: ${a.value}`).join(" · ")}
                applied={!!applied.attributes}
                onApply={() => applyField("attributes")}
              />
            </div>
          )}
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

          <div className="space-y-1.5">
            <Label htmlFor="seo-keywords" className="text-slate-300">Palavras-chave (separadas por vírgula)</Label>
            <Input
              id="seo-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ex.: garrafa de vidro, embalagem, 750ml"
              className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
            />
            {keywordsArray.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {keywordsArray.map((k) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                ))}
              </div>
            )}
          </div>

          {attributes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-slate-300">Atributos sugeridos</Label>
              <div className="flex flex-wrap gap-1.5">
                {attributes.map((a, i) => (
                  <span
                    key={`${a.name}-${i}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    <span className="text-slate-500">{a.name}:</span> {a.value}
                    <button
                      type="button"
                      onClick={() => setAttributes((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-0.5 text-slate-500 hover:text-rose-300"
                      aria-label={`Remover atributo ${a.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

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
