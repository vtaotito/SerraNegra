"use client";

import { Clock, MapPin, Truck, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ESTADOS_BR,
  formatCep,
  formatPhone,
  type DeliveryForm,
} from "./types";

interface DeliveryFieldsProps {
  value: DeliveryForm;
  onChange: (patch: Partial<DeliveryForm>) => void;
  disabled?: boolean;
  /** Prefixo para gerar ids únicos quando houver mais de um formulário na tela. */
  idPrefix?: string;
}

const fieldLabel = "text-sm font-medium text-gsn-text";
const inputClass = "h-11 sm:h-10";

export function DeliveryFields({
  value,
  onChange,
  disabled = false,
  idPrefix = "delivery",
}: DeliveryFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const sameAddress = value.sameAsBilling;

  return (
    <div className="space-y-5">
      {/* Toggle: mesmo endereço de cobrança */}
      <label
        htmlFor={id("sameAsBilling")}
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3 transition-colors",
          sameAddress
            ? "border-gsn-brand/40 bg-gsn-brand/5"
            : "border-input bg-background",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <input
          id={id("sameAsBilling")}
          type="checkbox"
          checked={sameAddress}
          disabled={disabled}
          onChange={(e) => onChange({ sameAsBilling: e.target.checked })}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-input accent-gsn-brand"
        />
        <span className="text-sm">
          <span className="font-medium text-gsn-text">
            Entregar no mesmo endereço de cobrança
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Desmarque para informar um endereço de entrega diferente.
          </span>
        </span>
      </label>

      {/* Endereço de entrega */}
      {!sameAddress && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gsn-text">
            <MapPin className="h-4 w-4 text-gsn-brand" />
            Endereço de entrega
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={id("zipCode")} className={fieldLabel}>
                CEP
              </label>
              <Input
                id={id("zipCode")}
                value={value.zipCode}
                onChange={(e) => onChange({ zipCode: formatCep(e.target.value) })}
                placeholder="00000-000"
                inputMode="numeric"
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id("number")} className={fieldLabel}>
                Número
              </label>
              <Input
                id={id("number")}
                value={value.number}
                onChange={(e) => onChange({ number: e.target.value })}
                placeholder="123"
                disabled={disabled}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id("street")} className={fieldLabel}>
              Logradouro
            </label>
            <Input
              id={id("street")}
              value={value.street}
              onChange={(e) => onChange({ street: e.target.value })}
              placeholder="Rua, avenida..."
              disabled={disabled}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={id("complement")} className={fieldLabel}>
                Complemento
              </label>
              <Input
                id={id("complement")}
                value={value.complement}
                onChange={(e) => onChange({ complement: e.target.value })}
                placeholder="Sala, galpão..."
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id("neighborhood")} className={fieldLabel}>
                Bairro
              </label>
              <Input
                id={id("neighborhood")}
                value={value.neighborhood}
                onChange={(e) => onChange({ neighborhood: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label htmlFor={id("city")} className={fieldLabel}>
                Cidade
              </label>
              <Input
                id={id("city")}
                value={value.city}
                onChange={(e) => onChange({ city: e.target.value })}
                disabled={disabled}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={id("state")} className={fieldLabel}>
                UF
              </label>
              <select
                id={id("state")}
                value={value.state}
                onChange={(e) => onChange({ state: e.target.value })}
                disabled={disabled}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:h-10 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">UF</option>
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={id("reference")} className={fieldLabel}>
              Ponto de referência
            </label>
            <Input
              id={id("reference")}
              value={value.reference}
              onChange={(e) => onChange({ reference: e.target.value })}
              placeholder="Próximo a..."
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </section>
      )}

      {/* Contato de recebimento */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gsn-text">
          <UserRound className="h-4 w-4 text-gsn-brand" />
          Contato para recebimento
        </h3>

        <div className="space-y-1.5">
          <label htmlFor={id("contactName")} className={fieldLabel}>
            Nome do responsável
          </label>
          <Input
            id={id("contactName")}
            value={value.contactName}
            onChange={(e) => onChange({ contactName: e.target.value })}
            placeholder="Quem recebe a mercadoria"
            disabled={disabled}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={id("contactPhone")} className={fieldLabel}>
              Telefone
            </label>
            <Input
              id={id("contactPhone")}
              value={value.contactPhone}
              onChange={(e) =>
                onChange({ contactPhone: formatPhone(e.target.value) })
              }
              placeholder="(00) 00000-0000"
              inputMode="tel"
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id("contactEmail")} className={fieldLabel}>
              E-mail
            </label>
            <Input
              id={id("contactEmail")}
              type="email"
              value={value.contactEmail}
              onChange={(e) => onChange({ contactEmail: e.target.value })}
              placeholder="recebimento@empresa.com"
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Janela e restrições de entrega */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gsn-text">
          <Truck className="h-4 w-4 text-gsn-brand" />
          Janela e restrições
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={id("deliveryDays")} className={fieldLabel}>
              Dias para entrega
            </label>
            <Input
              id={id("deliveryDays")}
              value={value.deliveryDays}
              onChange={(e) => onChange({ deliveryDays: e.target.value })}
              placeholder="Ex.: Seg a Sex"
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id("deliveryHours")} className={fieldLabel}>
              Horários
            </label>
            <Input
              id={id("deliveryHours")}
              value={value.deliveryHours}
              onChange={(e) => onChange({ deliveryHours: e.target.value })}
              placeholder="Ex.: 08h às 17h"
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={id("vehicleRestriction")} className={fieldLabel}>
            Restrição de veículo
          </label>
          <Input
            id={id("vehicleRestriction")}
            value={value.vehicleRestriction}
            onChange={(e) => onChange({ vehicleRestriction: e.target.value })}
            placeholder="Ex.: Somente veículo até 3/4"
            disabled={disabled}
            className={inputClass}
          />
        </div>

        <label
          htmlFor={id("needsScheduling")}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-input bg-background p-3",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          )}
        >
          <input
            id={id("needsScheduling")}
            type="checkbox"
            checked={value.needsScheduling}
            disabled={disabled}
            onChange={(e) => onChange({ needsScheduling: e.target.checked })}
            className="h-5 w-5 flex-shrink-0 rounded border-input accent-gsn-brand"
          />
          <span className="flex items-center gap-1.5 text-sm text-gsn-text">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Entrega precisa de agendamento prévio
          </span>
        </label>

        <div className="space-y-1.5">
          <label htmlFor={id("notes")} className={fieldLabel}>
            Observações de entrega
          </label>
          <textarea
            id={id("notes")}
            value={value.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
            placeholder="Informações adicionais para a equipe de logística..."
            disabled={disabled}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </section>
    </div>
  );
}
