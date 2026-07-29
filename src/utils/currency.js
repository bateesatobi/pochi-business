import { deliveryTimeLabel } from './deliveryTime';

export const MERCHANT_PRODUCT_CURRENCY = 'USD';

export const PRODUCT_CURRENCIES = ['USD', 'UGX', 'KES', 'TZS', 'RWF', 'EUR', 'GBP'];
export const DEFAULT_PREVIEW_CURRENCY = 'UGX';

/** Mirrors backend RoundingRules: UGX/JPY/RWF/TZS → nearest 100; else 2 dp. */
const HUNDRED_ROUND_CURRENCIES = new Set(['UGX', 'JPY', 'RWF', 'TZS']);

export const normalizeCurrency = (code) => {
  if (!code) return 'UGX';
  const upper = String(code).toUpperCase();
  return upper === 'KSH' ? 'KES' : upper;
};

export const roundForCurrency = (amount, currency = 'UGX') => {
  const value = Number(amount) || 0;
  const code = normalizeCurrency(currency);
  if (HUNDRED_ROUND_CURRENCIES.has(code)) {
    return Math.round(value / 100) * 100;
  }
  return Math.round(value * 100) / 100;
};

const CURRENCY_SYMBOLS = {
  UGX: 'USh',
  KES: 'KSh',
  TZS: 'TSh',
  RWF: 'FRw',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
};

export const getCurrencySymbol = (currency) =>
  CURRENCY_SYMBOLS[normalizeCurrency(currency)] || normalizeCurrency(currency);

/** eBay-style local buyer price: "USh 247,900" */
export const formatPublicLocalPrice = (amount, currency) => {
  const code = normalizeCurrency(currency);
  const sym = getCurrencySymbol(code);
  const value = roundForCurrency(amount, code);
  return `${sym} ${value.toLocaleString()}`;
};

/** eBay-style USD reference price: "US$65.99" */
export const formatPublicUsdPrice = (amount) => {
  const value = roundForCurrency(amount, 'USD');
  return `US$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatMoney = (amount, currency = 'UGX') => {
  const code = normalizeCurrency(currency);
  const value = roundForCurrency(amount, code);
  if (HUNDRED_ROUND_CURRENCIES.has(code)) {
    return `${code} ${value.toLocaleString()}`;
  }
  return `${code} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getProductListingPrice = (product) => {
  if (!product) return 0;
  if (product.listing_price != null && product.listing_price > 0) {
    return roundForCurrency(product.listing_price, MERCHANT_PRODUCT_CURRENCY);
  }
  if (product.platform_fee == null || product.vat == null || product.base_price == null) {
    return roundForCurrency(product.base_price || 0, MERCHANT_PRODUCT_CURRENCY);
  }
  const afterFee = product.base_price * (1 + product.platform_fee / 100);
  return roundForCurrency(afterFee * (1 + product.vat / 100), MERCHANT_PRODUCT_CURRENCY);
};

/** Discounted buyer listing (USD) — mirrors backend compute_discounted_listing_price. */
export const getProductDiscountedListingPrice = (product) => {
  if (!product) return null;
  if (product.discounted_listing_price != null && product.discounted_listing_price > 0) {
    return roundForCurrency(product.discounted_listing_price, MERCHANT_PRODUCT_CURRENCY);
  }
  const pct = Number(product.effective_discount_pct ?? product.discount_pct) || 0;
  if (pct <= 0 || product.base_price == null) return null;
  const fee = Number(product.platform_fee ?? 0);
  const vat = Number(product.vat ?? 0);
  const discountedBase = product.base_price * (1 - pct / 100);
  const afterFee = discountedBase * (1 + fee / 100);
  return roundForCurrency(afterFee * (1 + vat / 100), MERCHANT_PRODUCT_CURRENCY);
};

export const productHasDiscount = (product) => {
  const original = getProductListingPrice(product);
  const discounted = getProductDiscountedListingPrice(product);
  return discounted != null && discounted < original;
};

export const convertWithRates = (amount, fromCurrency, toCurrency, rates = {}) => {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  const value = Number(amount) || 0;
  if (from === to) return roundForCurrency(value, to);
  const direct = rates[`${from}-${to}`];
  if (direct) return roundForCurrency(value * direct, to);
  const viaUsd = rates[`${from}-USD`] && rates[`USD-${to}`];
  if (viaUsd) return roundForCurrency(value * rates[`${from}-USD`] * rates[`USD-${to}`], to);
  return null;
};

export const enrichProductForViewer = (product, viewerCurrency, fxRates = {}) => {
  if (!product) return product;
  const viewer = normalizeCurrency(viewerCurrency);
  const listing = getProductListingPrice(product);
  const discountedListing = getProductDiscountedListingPrice(product);
  let enriched = { ...product };

  if (viewer !== MERCHANT_PRODUCT_CURRENCY) {
    const hasDisplay =
      product.display_listing_price != null &&
      product.display_currency &&
      normalizeCurrency(product.display_currency) === viewer;

    if (!hasDisplay) {
      const converted = convertWithRates(listing, MERCHANT_PRODUCT_CURRENCY, viewer, fxRates);
      if (converted != null) {
        enriched = {
          ...enriched,
          currency: MERCHANT_PRODUCT_CURRENCY,
          display_currency: viewer,
          display_listing_price: converted,
        };
      }
    } else {
      enriched = {
        ...enriched,
        display_currency: normalizeCurrency(product.display_currency),
        display_listing_price: roundForCurrency(product.display_listing_price, viewer),
      };
    }

    const hasDisplayDiscount =
      product.display_discounted_listing_price != null &&
      product.display_currency &&
      normalizeCurrency(product.display_currency) === viewer;

    if (hasDisplayDiscount) {
      enriched.display_discounted_listing_price = roundForCurrency(
        product.display_discounted_listing_price,
        viewer
      );
    } else if (discountedListing != null) {
      const convertedDiscount = convertWithRates(
        discountedListing,
        MERCHANT_PRODUCT_CURRENCY,
        viewer,
        fxRates
      );
      if (convertedDiscount != null) {
        enriched = {
          ...enriched,
          display_currency: enriched.display_currency || viewer,
          display_discounted_listing_price: convertedDiscount,
        };
      }
    }

    // Full local price must always accompany a discounted local price
    if (
      enriched.display_discounted_listing_price != null &&
      enriched.display_listing_price == null
    ) {
      const convertedFull = convertWithRates(listing, MERCHANT_PRODUCT_CURRENCY, viewer, fxRates);
      if (convertedFull != null) {
        enriched.display_currency = enriched.display_currency || viewer;
        enriched.display_listing_price = convertedFull;
      }
    }
  }

  return enriched;
};

export const getPublicPriceDisplay = (product, viewerCurrency = 'UGX', fxRates = {}) => {
  const usdOriginal = roundForCurrency(getProductListingPrice(product), MERCHANT_PRODUCT_CURRENCY);
  const usdDiscountedRaw = getProductDiscountedListingPrice(product);
  const usdDiscounted =
    usdDiscountedRaw != null ? roundForCurrency(usdDiscountedRaw, MERCHANT_PRODUCT_CURRENCY) : null;
  const hasDiscount = usdDiscounted != null && usdDiscounted < usdOriginal;
  const viewer = normalizeCurrency(viewerCurrency);

  let localOriginal =
    product?.display_listing_price != null
      ? roundForCurrency(product.display_listing_price, product.display_currency || viewer)
      : null;
  let localDiscounted =
    product?.display_discounted_listing_price != null
      ? roundForCurrency(product.display_discounted_listing_price, product.display_currency || viewer)
      : null;
  const localCurrency = product?.display_currency
    ? normalizeCurrency(product.display_currency)
    : viewer;

  if (localOriginal == null && viewer !== MERCHANT_PRODUCT_CURRENCY) {
    localOriginal = convertWithRates(usdOriginal, MERCHANT_PRODUCT_CURRENCY, viewer, fxRates);
  }
  if (localDiscounted == null && hasDiscount && viewer !== MERCHANT_PRODUCT_CURRENCY) {
    localDiscounted = convertWithRates(
      usdDiscounted,
      MERCHANT_PRODUCT_CURRENCY,
      viewer,
      fxRates
    );
  }
  if (localDiscounted != null && localOriginal == null && viewer !== MERCHANT_PRODUCT_CURRENCY) {
    localOriginal = convertWithRates(usdOriginal, MERCHANT_PRODUCT_CURRENCY, viewer, fxRates);
  }

  const showLocal =
    localOriginal != null &&
    normalizeCurrency(localCurrency) !== MERCHANT_PRODUCT_CURRENCY;

  return {
    usdAmount: usdOriginal,
    usdDiscountedAmount: hasDiscount ? usdDiscounted : null,
    localAmount: showLocal ? localOriginal : null,
    localDiscountedAmount: showLocal && hasDiscount ? localDiscounted : null,
    localCurrency: showLocal ? localCurrency : viewer,
    showBoth: showLocal,
    hasDiscount,
  };
};

export const isFreeDelivery = (product) => product?.free_delivery === true;

const hasDeliveryTime = (product) =>
  Boolean(product?.expected_delivery_time);

/** Card delivery lines — free shipping, expected time, and/or regions when set. */
export const getProductDeliveryDisplay = (product) => {
  if (!product) return { lines: [] };

  const lines = [];
  if (isFreeDelivery(product)) {
    lines.push({ key: 'free', text: 'Free delivery', isFree: true });
  }
  if (hasDeliveryTime(product)) {
    lines.push({
      key: 'time',
      text: deliveryTimeLabel(product.expected_delivery_time),
      isFree: false,
    });
  }
  const regions = Array.isArray(product.delivery_regions) ? product.delivery_regions : [];
  if (regions.length > 0) {
    // Labels resolved in UI via formatDeliveryRegions; codes joined as fallback.
    lines.push({
      key: 'regions',
      text: regions,
      isFree: false,
      isRegions: true,
    });
  }
  return { lines };
};

/** @deprecated Use getProductDeliveryDisplay */
export const getProductDeliveryLabel = (product) => {
  const { lines } = getProductDeliveryDisplay(product);
  if (!lines.length) return null;
  const free = lines.find((l) => l.key === 'free');
  const time = lines.find((l) => l.key === 'time');
  if (free && time) {
    return { text: `${free.text} · ${time.text}`, isFree: true, timeText: time.text };
  }
  if (free) return { text: free.text, isFree: true };
  if (time) return { text: `Delivery: ${time.text}`, isFree: false, timeText: time.text };
  return null;
};

/** Promotion badge / code / expiry for product cards (from unified backend sale context). */
export const getProductPromotionDisplay = (product) => {
  if (!product) return null;
  const badge = product.promotion_badge;
  const code = product.promo_code;
  const endsAt = product.promotion_ends_at;
  const hasDiscount =
    productHasDiscount(product) ||
    (product.effective_discount_pct != null && product.effective_discount_pct > 0);
  if (!badge && !code && !endsAt && !hasDiscount) return null;

  let endsLabel = null;
  if (endsAt) {
    const end = new Date(endsAt);
    if (!Number.isNaN(end.getTime())) {
      endsLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  return {
    badge: badge || (hasDiscount && product.effective_discount_pct
      ? `${Math.round(product.effective_discount_pct)}% off`
      : null),
    code: code || null,
    endsLabel,
    name: product.promotion_name || null,
  };
};

export const getDualPriceLabel = (product) => {
  const currency = normalizeCurrency(product?.currency || MERCHANT_PRODUCT_CURRENCY);
  const listing = getProductListingPrice(product);
  const primary = formatMoney(listing, currency);

  if (
    product?.display_currency &&
    product?.display_listing_price != null &&
    normalizeCurrency(product.display_currency) !== currency
  ) {
    return {
      primary,
      secondary: `≈ ${formatMoney(product.display_listing_price, product.display_currency)}`,
    };
  }

  return { primary, secondary: null };
};
