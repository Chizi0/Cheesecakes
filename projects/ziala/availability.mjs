export function checkWearNow(item) {
  if (item?.availability === 'laundry') {
    return { eligible: false, reason: 'Excluded: this item is in the laundry.' };
  }
  if (item?.availability === 'ready') {
    return { eligible: true, reason: 'Ready to wear.' };
  }
  return { eligible: false, reason: 'Excluded: confirm whether this item is ready to wear.' };
}

export function reviewCloset(items) {
  const ids = new Set();
  for (const item of items) {
    if (typeof item?.id !== 'string' || !item.id.trim() || ids.has(item.id)) {
      throw new Error('Closet item IDs must be present and unique.');
    }
    ids.add(item.id);
  }
  return items.map(item => ({ ...item, ...checkWearNow(item) }));
}
