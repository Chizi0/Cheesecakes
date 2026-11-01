import { reviewCloset } from './availability.mjs';

const patterns = [
  { id: 'separates', categories: ['top', 'bottom', 'shoes', 'bag'] },
  { id: 'dress', categories: ['dress', 'shoes', 'bag'] },
];

export function buildClosetOutfits(items, occasion) {
  if (typeof occasion !== 'string' || !occasion.trim()) throw new Error('Choose an occasion tag.');
  const reviewed = reviewCloset(items).map(item => {
    if (!item.eligible) return item;
    const suitable = Array.isArray(item.occasions) && item.occasions.includes(occasion);
    return { ...item, eligible: suitable, reason: suitable ? 'Ready and tagged suitable for this occasion.' : 'Excluded: this item is not tagged suitable for the occasion.' };
  });
  const eligible = reviewed.filter(item => item.eligible).sort((a, b) => a.id.localeCompare(b.id));
  const results = patterns.map(pattern => {
    const missingCategories = pattern.categories.filter(category => !eligible.some(item => item.category === category));
    return {
      pattern: pattern.id,
      complete: missingCategories.length === 0,
      missingCategories,
      items: pattern.categories.map(category => eligible.find(item => item.category === category)).filter(Boolean),
    };
  });
  return { hasSuitableReadyOutfit: results.some(result => result.complete), patterns: results, reviewedItems: reviewed };
}
