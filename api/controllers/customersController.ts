import { WmsError } from "../../wms-core/src/errors.js";
import {
  Customer,
  CustomerCreateRequest,
  CustomerQuery,
  CustomerUpdateRequest
} from "../dtos/customers.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString, requireString } from "../utils/validation.js";

export type CustomersService = {
  listCustomers: (query: CustomerQuery) => Promise<{ data: Customer[]; nextCursor?: string }>;
  getCustomer: (customerId: string) => Promise<Customer | undefined>;
  createCustomer: (input: CustomerCreateRequest, actorId: string) => Promise<Customer>;
  updateCustomer: (customerId: string, input: CustomerUpdateRequest, actorId: string) => Promise<Customer>;
  deleteCustomer: (customerId: string, actorId: string) => Promise<void>;
};

export const createCustomersController = (service: CustomersService) => {
  const listCustomers: ApiHandler = async (req) => {
    const query: CustomerQuery = {
      search: optionalString(req.query?.search),
      type: optionalString(req.query?.type),
      active: req.query?.active === "true" ? true : req.query?.active === "false" ? false : undefined,
      limit: optionalNumber(req.query?.limit),
      cursor: optionalString(req.query?.cursor)
    };
    const result = await service.listCustomers(query);
    return {
      status: 200,
      body: result
    };
  };

  const getCustomer: ApiHandler = async (req) => {
    const customerId = req.params?.customerId;
    if (!customerId) {
      throw new WmsError("WMS-VAL-001", "customerId obrigatorio.");
    }
    const customer = await service.getCustomer(customerId);
    if (!customer) {
      return { status: 404, body: { error: { code: "NOT_FOUND", message: "Cliente nao encontrado." } } };
    }
    return {
      status: 200,
      body: customer
    };
  };

  const createCustomer: ApiHandler<CustomerCreateRequest> = async (req, ctx) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const input: CustomerCreateRequest = {
      customerCode: requireString(req.body.customerCode, "customerCode"),
      name: requireString(req.body.name, "name"),
      email: optionalString(req.body.email),
      phone: optionalString(req.body.phone),
      taxId: optionalString(req.body.taxId),
      billingAddress: req.body.billingAddress,
      shippingAddress: req.body.shippingAddress,
      type: req.body.type,
      creditLimit: optionalNumber(req.body.creditLimit),
      paymentTerms: optionalString(req.body.paymentTerms),
      notes: optionalString(req.body.notes)
    };
    const customer = await service.createCustomer(input, ctx.auth.userId);
    return {
      status: 201,
      body: customer
    };
  };

  const updateCustomer: ApiHandler<CustomerUpdateRequest> = async (req, ctx) => {
    const customerId = req.params?.customerId;
    if (!customerId) {
      throw new WmsError("WMS-VAL-001", "customerId obrigatorio.");
    }
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    const customer = await service.updateCustomer(customerId, req.body, ctx.auth.userId);
    return {
      status: 200,
      body: customer
    };
  };

  const deleteCustomer: ApiHandler = async (req, ctx) => {
    const customerId = req.params?.customerId;
    if (!customerId) {
      throw new WmsError("WMS-VAL-001", "customerId obrigatorio.");
    }
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    await service.deleteCustomer(customerId, ctx.auth.userId);
    return { status: 204 };
  };

  return {
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer
  };
};
