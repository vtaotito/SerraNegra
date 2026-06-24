/**
 * Compat layer — mantido para não quebrar imports existentes.
 *
 * Toda a lógica de envio/templates agora vive em `./email/*` (transporte
 * unificado Resend + SMTP e templates com layout visual da marca).
 */

export {
  isEmailConfigured,
  sendEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendRegistrationReceivedEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendEmailAccessRequestedEmail,
  sendEmailAccessApprovedEmail,
  sendEmailAccessRejectedEmail,
  sendInternalAccessRequestNotification,
  sendOrderConfirmationEmail,
  sendNewOrderToSellerEmail,
  sendOrderInteractionEmail,
  sendOrderApprovedEmail,
  sendOrderRejectedEmail,
  sendBackInStockEmail,
} from "./email/index.js";
