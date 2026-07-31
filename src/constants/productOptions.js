/** Optional product attributes — apply to any category, not just apparel/shoes. */

export const LETTER_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

/** Common numeric sizes (footwear, rings, kids wear, etc.) — presets only; custom allowed. */
export const NUMERIC_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12'];

/** Common capacity/volume labels — presets only; custom allowed (e.g. 200ml, 1L). */
export const CAPACITY_PRESETS = ['50ml', '100ml', '125ml'];

export const GENDER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'UNISEX', label: 'Unisex' },
];

export function formatGender(value) {
  if (!value) return null;
  const key = String(value).toUpperCase();
  const match = GENDER_OPTIONS.find((o) => o.value === key);
  return match?.label || value;
}

export function normalizeOptionLabel(value) {
  return String(value || '').trim();
}

/** Case-insensitive membership check for option lists. */
export function hasOption(list, value) {
  const target = normalizeOptionLabel(value).toLowerCase();
  if (!target) return false;
  return (list || []).some((item) => normalizeOptionLabel(item).toLowerCase() === target);
}

export function toggleOption(list, value) {
  const label = normalizeOptionLabel(value);
  if (!label) return list || [];
  const current = list || [];
  if (hasOption(current, label)) {
    return current.filter((item) => normalizeOptionLabel(item).toLowerCase() !== label.toLowerCase());
  }
  return [...current, label];
}

export function addCustomOption(list, value) {
  const label = normalizeOptionLabel(value);
  if (!label) return { list: list || [], added: false };
  if (hasOption(list, label)) return { list: list || [], added: false };
  return { list: [...(list || []), label], added: true };
}
