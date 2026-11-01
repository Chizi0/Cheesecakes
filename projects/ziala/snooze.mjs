import { laundryReminders } from './laundry.mjs';

function instant(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Choose a valid date and time with a timezone.');
  }
  return Date.parse(value);
}

export function snoozeReminder(snoozes, reminderId, until, now) {
  if (!['laundry-top', 'laundry-bottom'].includes(reminderId)) throw new Error('Unknown reminder.');
  const wakeAt = instant(until);
  if (wakeAt <= instant(now)) throw new Error('Choose a time in the future.');
  return { ...snoozes, [reminderId]: new Date(wakeAt).toISOString() };
}

export function visibleLaundryReminders(items, snoozes, now) {
  const current = instant(now);
  return laundryReminders(items).filter(reminder => {
    const until = snoozes[reminder.id];
    return !until || instant(until) <= current;
  });
}
