/**
 * Services Factory
 * Configura e injeta dependências dos serviços
 */
import type { Pool } from "pg";
import { PostgresOrderRepository } from "../repositories/postgresOrderRepository.js";
import { InMemoryOrderStore, createOrderCoreService, type OrderCoreService } from "../services/orderCoreService.js";

export type ServicesConfig = {
  usePostgres: boolean;
  pool?: Pool;
};

export type Services = {
  orderCoreService: OrderCoreService;
  // Adicionar outros serviços conforme necessário
};

/**
 * Cria instâncias dos serviços com as dependências configuradas
 */
export const createServices = (config: ServicesConfig): Services => {
  // OrderCoreService
  let orderCoreService: OrderCoreService;

  if (config.usePostgres && config.pool) {
    // Produção: usa PostgreSQL
    const repository = new PostgresOrderRepository(config.pool);
    orderCoreService = createOrderCoreService(repository);
    console.log("✓ OrderCoreService configurado com PostgreSQL");
  } else {
    // Desenvolvimento: usa in-memory
    const repository = new InMemoryOrderStore();
    orderCoreService = createOrderCoreService(repository);
    console.log("⚠ OrderCoreService configurado com in-memory store (desenvolvimento)");
  }

  return {
    orderCoreService
  };
};
