import { prioritizeCheckout } from './priority.mjs';
const root = document.getElementById('signal-desk-card');
const field = name => root.querySelector(`[data-role="${name}"]`);
function updateCard() {
  try {
    const status = field('workaround').value;
    const result = prioritizeCheckout({
      customersAffected: Number(field('count').value),
      hasWorkingPaymentLink: status === 'working' ? true : status === 'unavailable' ? false : undefined,
    });
    field('priority').textContent = result.priority;
    field('priority').dataset.priority = result.priority;
    field('triage').hidden = !result.needsTriage;
    field('explanation').textContent = result.explanation;
    field('action-block').hidden = !result.nextAction;
    field('action').textContent = result.nextAction || '';
    field('error').hidden = true;
    field('result').hidden = false;
  } catch (error) {
    field('priority').textContent = 'Needs valid input';
    field('priority').removeAttribute('data-priority');
    field('triage').hidden = true;
    field('result').hidden = true;
    field('error').textContent = error.message;
    field('error').hidden = false;
  }
}
field('count').addEventListener('input', updateCard);
field('workaround').addEventListener('change', updateCard);
updateCard();
