export function isCleanerAvailable(cleaner) {
  // Unknown availability does not count as confirmed availability.
  return cleaner?.onShift === true
    && cleaner.onBreak === false
    && cleaner.hasActiveTask === false;
}

export function selectCleaner(cleaners) {
  const ids = new Set();
  for (const cleaner of cleaners) {
    if (typeof cleaner?.id !== 'string' || !cleaner.id.trim() || ids.has(cleaner.id)) {
      throw new Error('Cleaner IDs must be present and unique.');
    }
    ids.add(cleaner.id);
  }

  const candidates = cleaners.filter(isCleanerAvailable).map(cleaner => {
    // null explicitly means no previous assignment: place these staff first.
    const lastAssigned = cleaner.lastAssignedAt === null
      ? -Infinity
      : typeof cleaner.lastAssignedAt === 'string' ? Date.parse(cleaner.lastAssignedAt) : NaN;
    if (Number.isNaN(lastAssigned)) {
      throw new Error('Eligible cleaners need a valid last assignment time or null.');
    }
    return { cleaner, lastAssigned };
  });

  candidates.sort((a, b) => {
    if (a.lastAssigned !== b.lastAssigned) return a.lastAssigned < b.lastAssigned ? -1 : 1;
    return a.cleaner.id.localeCompare(b.cleaner.id);
  });
  return candidates[0]?.cleaner ?? null;
}
