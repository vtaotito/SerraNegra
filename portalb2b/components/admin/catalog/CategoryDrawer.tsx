"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Sparkles, AlertTriangle, X, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { SeoFieldDiff } from "./SeoFieldDiff";
import { SEO_TITLE_MAX, SEO_DESCRIPTION_MAX, type AdminCategory } from "@/lib/admin/catalog";
import {
  suggestCategorySeo,
  fetchSeoConfig,
  type CategorySeoSuggestion,
} from "@/lib/admin/seo";
import { cn } from "@/lib/utils";

export interface CategorySeoPatch {
  category_name: string;
  seo_title?: string | null;
  seo_description?: string | null;
  intro_text?: string | null;
  seo_keywords?: string[] | null;
}

interface CategoryDrawerProps {
  category: AdminCategory;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: CategorySeoPatch) => Promise<void>;
}

function CharCounter({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <span className={cn("text-[11px]", over ? "text-red-400" : "text-slate-500")}>
      {value}/{max}
    </span>
  );
}

export function CategoryDrawer({ category, open, saving, onClose, onSave }: CategoryDrawerProps) {
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [introText, setIntroText] = useState("");
  const [keywords, setKeywords] = useState("");

  const [suggestion, setSuggestion] = useState<CategorySeoSuggestion | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);

  const configQuery = useQuery({ queryKey: ["admin-seo-config"], queryFn: fetchSeoConfig });
  const aiConfigured = configQuery.data?.data.openaiConfigured ?? false;

  useEffect(() => {
    setSeoTitle(category.seo_title ?? "");
    setSeoDescription(category.seo_description ?? "");
    setIntroText(category.intro_text ?? "");
    setKeywords(category.seo_keywords ?? "");
    setSuggestion(null);
    setApplied({});
  }, [category]);

  const keywordsArray = useMemo(
    () => keywords.split(",").map((k) => k.trim()).filter(Boolean),
    [keywords],
  );

  const dirty = useMemo(
    () =>
      seoTitle !== (category.seo_title ?? "") ||
      seoDescription !== (category.seo_description ?? "") ||
      introText !== (category.intro_text ?? "") ||
      keywords !== (category.seo_keywords ?? ""),
    [seoTitle, seoDescription, introText, keywords, category],
  );

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await suggestCategorySeo(category.category_name);
      setSuggestion(res.data);
      setApplied({});
      toast.success("Sugestão gerada. Revise e aplique.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar sugestão com IA");
    } finally {
      setGenerating(false);
    }
  }

  function applyField(field: string) {
    if (!suggestion) return;
    if (field === "seo_title") setSeoTitle(suggestion.seo_title);
    if (field === "seo_description") setSeoDescription(suggestion.seo_description);
    if (field === "intro_text") setIntroText(suggestion.intro_text);
    if (field === "keywords") setKeywords(suggestion.keywords.join(", "));
    setApplied((a) => ({ ...a, [field]: true }));
  }

  function applyAll() {
    if (!suggestion) return;
    setSeoTitle(suggestion.seo_title);
    setSeoDescription(suggestion.seo_description);
    setIntroText(suggestion.intro_text);
    setKeywords(suggestion.keywords.join(", "));
    setApplied({ seo_title: true, seo_description: true, intro_text: true, keywords: true });
    toast.success("Todos os campos aplicados. Revise e salve.");
  }

  async function handleSave() {
    if (!dirty) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    const patch: CategorySeoPatch = { category_name: category.category_name };
    if (seoTitle !== (category.seo_title ?? "")) patch.seo_title = seoTitle || null;
    if (seoDescription !== (category.seo_description ?? "")) patch.seo_description = seoDescription || null;
    if (introText !== (category.intro_text ?? "")) patch.intro_text = introText || null;
    if (keywords !== (category.seo_keywords ?? "")) patch.seo_keywords = keywordsArray;
    await onSave(patch);
  }

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerHeader
        title={`SEO · ${category.category_name}`}
        description={`${category.product_count} produto(s)`}
        onClose={onClose}
      />
      <DrawerBody>
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
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar com IA
            </Button>
          </div>

          {!aiConfigured ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                IA não configurada. Defina <code className="text-amber-100">OPENAI_API_KEY</code> no
                gateway para habilitar a geração automática.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Gera título, meta, texto de introdução e palavras-chave da categoria. Revise e aplique.
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
                label="Texto de introdução"
                current={introText}
                suggested={suggestion.intro_text}
                applied={!!applied.intro_text}
                onApply={() => applyField("intro_text")}
              />
              <SeoFieldDiff
                label="Palavras-chave"
                current={keywordsArray.join(", ")}
                suggested={suggestion.keywords.join(", ")}
                applied={!!applied.keywords}
                onApply={() => applyField("keywords")}
              />
            </div>
          )}
        </section>

        {/* Campos */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">SEO da categoria</h3>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-seo-title" className="text-slate-300">Título</Label>
              <CharCounter value={seoTitle.length} max={SEO_TITLE_MAX} />
            </div>
            <Input
              id="cat-seo-title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={category.category_name}
              className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-seo-desc" className="text-slate-300">Meta descrição</Label>
              <CharCounter value={seoDescription.length} max={SEO_DESCRIPTION_MAX} />
            </div>
            <Textarea
              id="cat-seo-desc"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={3}
              placeholder="Resumo da categoria nos resultados de busca..."
              className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-intro" className="text-slate-300">Texto de introdução</Label>
            <Textarea
              id="cat-intro"
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={5}
              placeholder="Texto de apresentação da categoria (exibido no topo da listagem)..."
              className="border-slate-600 bg-slate-800/60 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-keywords" className="text-slate-300">Palavras-chave (separadas por vírgula)</Label>
            <Input
              id="cat-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ex.: garrafas de vidro, embalagens, atacado"
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
        </section>
      </DrawerBody>

      <DrawerFooter>
        <span className="mr-auto text-xs text-slate-500">
          {dirty ? "Alterações não salvas" : "Tudo salvo"}
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
