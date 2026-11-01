function instant(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('Schedule timestamps need an explicit timezone.');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid schedule timestamp.');
  return parsed;
}

export function applySchedule(cleaner, schedule, now) {
  const current = instant(now);
  const start = instant(schedule.shiftStart);
  const end = instant(schedule.shiftEnd);
  if (end <= start) throw new Error('Shift end must follow shift start.');
  const breaks = schedule.breaks.map(period => {
    const from = instant(period.start);
    const to = instant(period.end);
    if (to <= from || from < start || to > end) {
      throw new Error('Break must be within the shift with end after start.');
    }
    return { from, to };
  });
  const onShift = current >= start && current < end;
  const breakScheduled = breaks.some(period => current >= period.from && current < period.to);
  const hasTask = cleaner.hasActiveTask === true;
  return {
    ...cleaner,
    onShift,
    // Blocks new work during the scheduled break, even if an active task is retained.
    onBreak: breakScheduled,
    scheduleFlag: hasTask && breakScheduled ? 'Break due—active task'
      : hasTask && !onShift ? 'Shift ended—active task' : null,
  };
}
