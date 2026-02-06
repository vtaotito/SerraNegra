"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Save, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { useSaveSapConfig, useTestSapConfig } from "../hooks/useSapIntegration";
import type { SapConfig } from "../types";

const sapConfigSchema = z.object({
  baseUrl: z.string().url("URL inválida").min(1, "URL é obrigatória"),
  companyDb: z.string().min(1, "Database é obrigatório"),
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type SapConfigFormData = z.infer<typeof sapConfigSchema>;

interface SapConfigFormProps {
  initialConfig?: SapConfig;
}

export function SapConfigForm({ initialConfig }: SapConfigFormProps) {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm<SapConfigFormData>({
    resolver: zodResolver(sapConfigSchema),
    defaultValues: initialConfig || {
      baseUrl: "https://",
      companyDb: "",
      username: "",
      password: "",
    },
  });

  const saveMutation = useSaveSapConfig();
  const testMutation = useTestSapConfig();

  const onTest = async () => {
    const values = watch();
    setTestResult(null);

    try {
      const result = await testMutation.mutateAsync(values as SapConfig);
      setTestResult({
        success: result.success,
        message: result.message,
      });

      if (result.success) {
        toast.success("Conexão testada com sucesso!", {
          description: `Tempo de resposta: ${result.connection_time_ms}ms`,
        });
      } else {
        toast.error("Falha ao testar conexão", {
          description: result.error || result.message,
        });
      }
    } catch (error: any) {
      const errorMessage = typeof error === 'string' 
        ? error 
        : error?.message || error?.error || "Erro ao testar conexão";
      
      setTestResult({
        success: false,
        message: String(errorMessage),
      });
      toast.error("Erro ao testar conexão", {
        description: String(errorMessage),
      });
    }
  };

  const onSave = async (data: SapConfigFormData) => {
    try {
      await saveMutation.mutateAsync(data as SapConfig);
      toast.success("Configuração salva com sucesso!", {
        description: "As credenciais foram atualizadas.",
      });
      setTestResult(null);
    } catch (error: any) {
      const errorMessage = typeof error === 'string'
        ? error
        : error?.message || error?.error || "Erro ao salvar configuração";
      
      toast.error("Erro ao salvar configuração", {
        description: String(errorMessage),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração SAP Business One</CardTitle>
        <CardDescription>
          Configure as credenciais de acesso ao Service Layer do SAP B1
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              Service Layer URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="baseUrl"
              type="url"
              placeholder="https://sap-server:50000"
              {...register("baseUrl")}
            />
            {errors.baseUrl && (
              <p className="text-sm text-red-500">{errors.baseUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Ex: https://sap-garrafariasnegra-sl.skyinone.net:50000
            </p>
          </div>

          {/* Company DB */}
          <div className="space-y-2">
            <Label htmlFor="companyDb">
              Company Database <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyDb"
              type="text"
              placeholder="SBO_COMPANY_NAME"
              {...register("companyDb")}
            />
            {errors.companyDb && (
              <p className="text-sm text-red-500">{errors.companyDb.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Nome do banco de dados da empresa no SAP B1
            </p>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">
              Usuário <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="usuario.sap"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              Senha <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              A senha é armazenada de forma segura no servidor
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`rounded-lg border p-4 ${
                testResult.success
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    {testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}
                  </p>
                  <p className="text-sm mt-1">{testResult.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onTest}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <TestTube2 className="mr-2 h-4 w-4" />
                  Testar Conexão
                </>
              )}
            </Button>

            <Button
              type="submit"
              disabled={!isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
            <p className="font-medium mb-1">💡 Dica</p>
            <p>
              Teste a conexão antes de salvar para garantir que as credenciais estão corretas.
              A configuração é armazenada de forma segura no servidor.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
