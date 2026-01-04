export const biasCategoryKeys = ['market', 'growth', 'techno', 'power'] as const;
export type BiasCategoryKey = typeof biasCategoryKeys[number];

const biasCategoryIdMap: Record<BiasCategoryKey, string[]> = {
  market: ['market_default_bias', 'market_default', 'capitalism_normalization', 'market', 'market_bias'],
  growth: ['growth_normalization', 'growth'],
  techno: ['technosolutionism', 'techno'],
  power: ['power_invisibility', 'power'],
};

const normalizeBiasId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const mapBiasIdsToCategories = (ids: string[] | null | undefined): BiasCategoryKey[] => {
  if (!ids || ids.length === 0) return [];
  const categories = new Set<BiasCategoryKey>();
  for (const rawId of ids) {
    const normalized = normalizeBiasId(rawId);
    (Object.keys(biasCategoryIdMap) as BiasCategoryKey[]).forEach((category) => {
      if (biasCategoryIdMap[category].includes(normalized)) {
        categories.add(category);
      }
    });
  }
  return Array.from(categories);
};
