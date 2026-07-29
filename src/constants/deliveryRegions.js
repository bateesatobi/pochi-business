/** Optional delivery regions sellers can tick when adding/editing a product. */
export const DELIVERY_REGION_OPTIONS = [
  { code: 'UGANDA', label: 'Uganda', flag: '🇺🇬' },
  { code: 'KENYA', label: 'Kenya', flag: '🇰🇪' },
  { code: 'TANZANIA', label: 'Tanzania', flag: '🇹🇿' },
  { code: 'RWANDA', label: 'Rwanda', flag: '🇷🇼' },
  { code: 'EAST_AFRICA', label: 'East Africa', flag: '🌍' },
];

export const deliveryRegionLabel = (code) => {
  const opt = DELIVERY_REGION_OPTIONS.find((o) => o.code === code);
  if (!opt) return code;
  return `${opt.label} ${opt.flag}`.trim();
};

export const formatDeliveryRegions = (codes) => {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  return codes.map(deliveryRegionLabel);
};
