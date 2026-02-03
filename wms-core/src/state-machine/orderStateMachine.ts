import { OrderEventType, OrderStatus } from "../domain/order.js";

export const orderStateMachine = {
  name: "wms_order_state_machine",
  version: "1.0.0",
  initialState: "A_SEPARAR" as OrderStatus,
  finalStates: ["DESPACHADO"] as OrderStatus[],
  transitions: [
    { from: "A_SEPARAR", eventType: "INICIAR_SEPARACAO", to: "EM_SEPARACAO" },
    { from: "EM_SEPARACAO", eventType: "FINALIZAR_SEPARACAO", to: "CONFERIDO" },
    { from: "CONFERIDO", eventType: "SOLICITAR_COTACAO", to: "AGUARDANDO_COTACAO" },
    { from: "AGUARDANDO_COTACAO", eventType: "CONFIRMAR_COTACAO", to: "AGUARDANDO_COLETA" },
    { from: "AGUARDANDO_COLETA", eventType: "DESPACHAR", to: "DESPACHADO" }
  ] as Array<{ from: OrderStatus; eventType: OrderEventType; to: OrderStatus }>
};

export const isFinalState = (status: OrderStatus): boolean =>
  orderStateMachine.finalStates.includes(status);

export const getNextState = (
  from: OrderStatus,
  eventType: OrderEventType
): OrderStatus | null => {
  const transition = orderStateMachine.transitions.find(
    (item) => item.from === from && item.eventType === eventType
  );
  return transition ? transition.to : null;
};
