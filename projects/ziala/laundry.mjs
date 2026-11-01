import { reviewCloset } from './availability.mjs';

export function laundryReminders(items) {
  const closet = reviewCloset(items);
  const categories = [
    { id: 'top', singular: 'top', plural: 'tops' },
    { id: 'bottom', singular: 'bottom', plural: 'bottoms' },
  ];
  return categories.flatMap(category => {
    const matching = closet.filter(item => item.category === category.id);
    const readyCount = matching.filter(item => item.availability === 'ready').length;
    const laundryCount = matching.filter(item => item.availability === 'laundry').length;
    if (readyCount >= 2 || laundryCount === 0) return [];
    return [{
      id: `laundry-${category.id}`,
      category: category.id,
      readyCount,
      laundryCount,
      message: `You have ${readyCount} ready-to-wear ${readyCount === 1 ? category.singular : category.plural} left, and ${laundryCount} ${laundryCount === 1 ? 'is' : 'are'} in the laundry. Time for a laundry day?`,
    }];
  });
}
