// First product rule: an available checkout workaround lowers urgency one level.
// This initial version handles checkout failures only.
export function prioritizeCheckout(ticket) {
  if (!Number.isInteger(ticket.customersAffected) || ticket.customersAffected < 1) {
    throw new Error('Customers affected must be a positive whole number.');
  }
  const impact = `Checkout failure affects ${ticket.customersAffected} ${ticket.customersAffected === 1 ? 'customer' : 'customers'}.`;

  if (typeof ticket.hasWorkingPaymentLink !== 'boolean') {
    return {
      priority: 'Critical',
      needsTriage: true,
      nextAction: 'Check status of payment link',
      explanation: `${impact} Workaround status is unconfirmed. Keep this ticket at Critical while an agent verifies whether a working payment link is available.`,
    };
  }

  if (ticket.hasWorkingPaymentLink === true) {
    return {
      priority: 'High',
      needsTriage: false,
      explanation: `${impact} A payment link allows purchases to continue, but the extra steps may cause customers to abandon.`,
    };
  }

  return {
    priority: 'Critical',
    needsTriage: false,
    explanation: `${impact} No working payment link is available, so affected customers cannot complete a purchase through these checkout options.`,
  };
}
