import { prioritizeCheckout } from './priority.mjs';
const priorityRank = { Critical: 0, High: 1 };

export function rankTickets(tickets) {
  const ids = new Set();
  return tickets.map(ticket => {
    if (!ticket.id || ids.has(ticket.id)) throw new Error('Ticket IDs must be present and unique.');
    ids.add(ticket.id);
    const arrivedAt = Date.parse(ticket.arrivedAt);
    if (!Number.isFinite(arrivedAt)) throw new Error('Each ticket needs a valid arrival time.');
    return { ...ticket, ...prioritizeCheckout(ticket), arrivalTimestamp: arrivedAt };
  }).sort((a, b) =>
    priorityRank[a.priority] - priorityRank[b.priority]
    || b.customersAffected - a.customersAffected
    || a.arrivalTimestamp - b.arrivalTimestamp
    || a.id.localeCompare(b.id)
  );
}
