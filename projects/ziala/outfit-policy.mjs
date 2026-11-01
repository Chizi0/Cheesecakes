function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Use a calendar date in YYYY-MM-DD format.');
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid calendar date.');
  }
  return time / 86400000;
}

export function outfitFallback({ mode, hasSuitableReadyOutfit, hasReadyAlternative = false, today, occasionDate }) {
  if (!['daily', 'occasion'].includes(mode)) throw new Error('Choose daily or occasion styling.');
  if (typeof hasSuitableReadyOutfit !== 'boolean' || typeof hasReadyAlternative !== 'boolean') {
    throw new Error('Confirm closet match and alternative availability.');
  }
  let daysAway;
  if (mode === 'occasion') {
    daysAway = calendarDay(occasionDate) - calendarDay(today);
    if (daysAway < 0) throw new Error('Occasion date cannot be in the past.');
  }
  if (hasSuitableReadyOutfit) return { action: 'closet', reason: 'A suitable, ready-to-wear closet outfit is available.' };
  if (mode === 'daily') {
    return hasReadyAlternative
      ? { action: 'alternative', reason: 'No suitable match is ready. Offer the closest ready alternative and explain the compromise.' }
      : { action: 'no_match', reason: 'No ready-to-wear closet alternative is available.' };
  }
  return daysAway >= 7
    ? { action: 'shopping', daysAway, reason: 'No suitable ready closet outfit. Offer suitable buying options with estimated delivery before the occasion.' }
    : { action: 'in_store', daysAway, reason: 'No suitable ready closet outfit. Offer suitable nearby in-store options with confirmed stock for the user to buy in person.' };
}

export function reviewStoreOptions(options, requestedSize) {
  if (typeof requestedSize !== 'string' || !requestedSize.trim()) {
    throw new Error('Choose a size before checking in-store options.');
  }
  const size = requestedSize.trim().toUpperCase();
  return options.map(option => {
    const sizeAvailable = Array.isArray(option.availableSizes)
      && option.availableSizes.some(value => typeof value === 'string' && value.trim().toUpperCase() === size);
    let reason;
    if (option.occasionSuitable !== true) reason = 'Excluded: occasion suitability is not confirmed.';
    else if (option.nearby !== true) reason = 'Excluded: store is not confirmed within the chosen nearby area.';
    else if (option.inStock !== true) reason = 'Excluded: in-store stock is not confirmed.';
    else if (!sizeAvailable) reason = `Excluded: size ${requestedSize.trim()} is not confirmed available at this store.`;
    else reason = `In-store option in size ${requestedSize.trim()}. Check opening hours and reconfirm stock before visiting.`;
    return { ...option, eligible: option.occasionSuitable === true && option.nearby === true && option.inStock === true && sizeAvailable, reason };
  });
}

export function reviewShoppingOptions(options, occasionDate) {
  const eventDay = calendarDay(occasionDate);
  return options.map(option => {
    if (option.occasionSuitable !== true) {
      return { ...option, eligible: false, reason: 'Excluded: occasion suitability is not confirmed.' };
    }
    if (!option.estimatedDeliveryDate) {
      return { ...option, eligible: false, reason: 'Excluded: estimated delivery date is unavailable.' };
    }
    const deliveryDay = calendarDay(option.estimatedDeliveryDate);
    return {
      ...option,
      eligible: deliveryDay < eventDay,
      reason: deliveryDay < eventDay
        ? `Estimated delivery: ${option.estimatedDeliveryDate}. Arrival is not guaranteed.`
        : 'Excluded: estimated delivery is not before the occasion.',
    };
  });
}
