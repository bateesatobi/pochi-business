import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { useCategories } from '../hooks/queries';
import { MERCHANT_PRODUCT_CURRENCY, normalizeCurrency, formatMoney } from '../utils/currency';
import { DELIVERY_TIME_OPTIONS, DEFAULT_DELIVERY_TIME } from '../utils/deliveryTime';
import { PRODUCT_COLORS, getProductColorPreview } from '../constants/productColors';
import { DELIVERY_REGION_OPTIONS } from '../constants/deliveryRegions';
import {
  LETTER_SIZES,
  NUMERIC_SIZES,
  CAPACITY_PRESETS,
  GENDER_OPTIONS,
  hasOption,
  toggleOption,
  addCustomOption,
} from '../constants/productOptions';
import { Package, Tag, DollarSign, Info, Plus } from 'lucide-react';
import './AddProduct.css';

const AddProduct = () => {
  const { data: categories = [] } = useCategories();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    basePrice: '',
    categoryId: '',
    stockQuantity: '',
    discountPct: '',
    promoCode: '',
    minimumOrderQty: '',
    vatPct: '18',
    condition: 'NEW',
    gender: '',
    freeDelivery: 'no',
    expectedDeliveryTime: DEFAULT_DELIVERY_TIME,
    bulkTiers: [],
    availableSizes: [],
    availableColors: [],
    deliveryRegions: [],
  });
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [customCapacityInput, setCustomCapacityInput] = useState('');
  const [pricePreview, setPricePreview] = useState({
    base_price: 0,
    platform_fee_pct: null,
    vat_pct: null,
    platform_fee_amount: 0,
    vat_amount: 0,
    listing_price: 0,
    previewUnavailable: false,
  });

  const selectedCategory = categories.find((c) => String(c.id) === String(formData.categoryId));
  const categoryChannel = selectedCategory?.channel || 'BOTH';
  const showRetailFields = categoryChannel === 'RETAIL' || categoryChannel === 'BOTH';
  const showWholesaleFields = categoryChannel === 'WHOLESALE' || categoryChannel === 'BOTH';

  useEffect(() => {
    const price = parseFloat(formData.basePrice);
    if (!price || price <= 0) return;
    const vat = parseFloat(formData.vatPct);
    const token = localStorage.getItem('token');
    axios.post(
      `${API_BASE}/pricing/preview`,
      {
        base_price: price,
        vat_pct: Number.isFinite(vat) ? vat : undefined,
        currency: MERCHANT_PRODUCT_CURRENCY,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => setPricePreview({ ...res.data, previewUnavailable: false }))
      .catch(() => {
        setPricePreview({
          base_price: price,
          platform_fee_pct: null,
          vat_pct: null,
          platform_fee_amount: 0,
          vat_amount: 0,
          listing_price: 0,
          previewUnavailable: true,
        });
      });
  }, [formData.basePrice, formData.vatPct]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSizeToggle = (size) => {
    setFormData({
      ...formData,
      availableSizes: toggleOption(formData.availableSizes, size),
    });
  };

  const submitCustomSize = () => {
    const { list, added } = addCustomOption(formData.availableSizes, customSizeInput);
    if (!added) return;
    setFormData({ ...formData, availableSizes: list });
    setCustomSizeInput('');
  };

  const submitCustomCapacity = () => {
    const { list, added } = addCustomOption(formData.availableSizes, customCapacityInput);
    if (!added) return;
    setFormData({ ...formData, availableSizes: list });
    setCustomCapacityInput('');
  };

  const handleColorToggle = (color) => {
    setFormData({
      ...formData,
      availableColors: formData.availableColors.includes(color)
        ? formData.availableColors.filter(c => c !== color)
        : [...formData.availableColors, color]
    });
  };

  const handleRegionToggle = (code) => {
    setFormData({
      ...formData,
      deliveryRegions: formData.deliveryRegions.includes(code)
        ? formData.deliveryRegions.filter((c) => c !== code)
        : [...formData.deliveryRegions, code],
    });
  };

  const getColorPreview = getProductColorPreview;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        sku: formData.sku || undefined,
        name: formData.name,
        description: formData.description,
        base_price: parseFloat(formData.basePrice),
        currency: MERCHANT_PRODUCT_CURRENCY,
        category_id: formData.categoryId || null,
        stock_quantity: parseInt(formData.stockQuantity || '0', 10),
        discount_pct: formData.discountPct ? parseFloat(formData.discountPct) : null,
        promo_code: formData.promoCode || null,
        minimum_order_qty: formData.minimumOrderQty ? parseInt(formData.minimumOrderQty, 10) : null,
        vat: formData.vatPct !== '' ? parseFloat(formData.vatPct) : null,
        condition: formData.condition || 'NEW',
        gender: formData.gender || null,
        free_delivery: formData.freeDelivery === 'yes',
        expected_delivery_time: formData.expectedDeliveryTime,
        bulk_tiers: formData.bulkTiers.filter((t) => t.min_quantity && t.discount_pct),
        available_sizes: formData.availableSizes.length > 0 ? formData.availableSizes : null,
        available_colors: formData.availableColors.length > 0 ? formData.availableColors : null,
        delivery_regions: formData.deliveryRegions.length > 0 ? formData.deliveryRegions : null,
      };

      await axios.post(`${API_BASE}/products/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Product published successfully!');
      window.location.href = '/dashboard/products';
    } catch (err) {
      alert('Failed to publish product: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="add-product-container animate-fade">
      <div className="page-header">
        <h1>Add New Product</h1>
        <p>List a new item on the Pakacha marketplace.</p>
      </div>

      <div className="form-card">
        <div className="section-title">
          <Package size={20} color="var(--primary)" />
          Basic Information
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-group full-width">
            <label>Product Name</label>
            <input name="name" placeholder="e.g. Premium Arabica Coffee Beans" value={formData.name} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>SKU (optional)</label>
            <input name="sku" placeholder="COF-ARB-001" value={formData.sku} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select name="categoryId" value={formData.categoryId} onChange={handleChange}>
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.channel})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Delivery</label>
            <select name="freeDelivery" value={formData.freeDelivery} onChange={handleChange} required>
              <option value="no">Delivery not included (buyer pays shipping)</option>
              <option value="yes">Free delivery</option>
            </select>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Card preview:{' '}
              {formData.freeDelivery === 'yes' && (
                <span style={{ color: '#7dd3a8' }}>Free delivery</span>
              )}
              {formData.freeDelivery === 'yes' && formData.expectedDeliveryTime && ' · '}
              {formData.expectedDeliveryTime && (
                <span>
                  Delivery: {DELIVERY_TIME_OPTIONS.find((o) => o.value === formData.expectedDeliveryTime)?.label}
                </span>
              )}
            </p>
          </div>

          <div className="form-group full-width">
            <label>Delivery Regions (optional)</label>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Where this product can be delivered
            </p>
            <div className="size-selector-grid">
              {DELIVERY_REGION_OPTIONS.map((region) => (
                <button
                  key={region.code}
                  type="button"
                  className={`size-option ${formData.deliveryRegions.includes(region.code) ? 'selected' : ''}`}
                  onClick={() => handleRegionToggle(region.code)}
                >
                  <span className="size-label">{region.flag} {region.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Expected Delivery Time</label>
            <select name="expectedDeliveryTime" value={formData.expectedDeliveryTime} onChange={handleChange} required>
              {DELIVERY_TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Shown on the product card when selected.
            </p>
          </div>

          <div className="form-group">
            <label>Stock Quantity</label>
            <input type="number" name="stockQuantity" min="0" value={formData.stockQuantity} onChange={handleChange} placeholder="e.g. 100" required />
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Required for Pochi app availability. 0 = Out of Stock.
            </p>
          </div>

          <div className="form-group">
            <label>Condition</label>
            <select name="condition" value={formData.condition} onChange={handleChange} required>
              <option value="NEW">New</option>
              <option value="USED">Used</option>
            </select>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Mark used items (e.g. second-hand phones). Shown as a badge on the product card.
            </p>
          </div>

          <div className="form-group full-width">
            <label>Description</label>
            <textarea name="description" rows="4" placeholder="Tell your customers about this product..." value={formData.description} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Gender (optional)</label>
            <select name="gender" value={formData.gender} onChange={handleChange}>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Optional for any product where it helps buyers.
            </p>
          </div>

          <div className="form-group full-width">
            <label>Sizes &amp; capacity (optional)</label>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Optional for any product. Use presets or type custom labels.
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Letter sizes</p>
            <div className="size-selector-grid">
              {LETTER_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`size-option ${hasOption(formData.availableSizes, size) ? 'selected' : ''}`}
                  onClick={() => handleSizeToggle(size)}
                >
                  <span className="size-label">{size}</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '12px 0 8px' }}>Numeric sizes</p>
            <div className="size-selector-grid">
              {NUMERIC_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`size-option ${hasOption(formData.availableSizes, size) ? 'selected' : ''}`}
                  onClick={() => handleSizeToggle(size)}
                >
                  <span className="size-label">{size}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                type="text"
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCustomSize(); } }}
                placeholder="Custom size (e.g. 13, 42 EU, One Size)"
              />
              <button type="button" onClick={submitCustomSize}>Add</button>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '12px 0 8px' }}>Capacity / volume</p>
            <div className="size-selector-grid">
              {CAPACITY_PRESETS.map((cap) => (
                <button
                  key={cap}
                  type="button"
                  className={`size-option ${hasOption(formData.availableSizes, cap) ? 'selected' : ''}`}
                  onClick={() => handleSizeToggle(cap)}
                >
                  <span className="size-label">{cap}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                type="text"
                value={customCapacityInput}
                onChange={(e) => setCustomCapacityInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCustomCapacity(); } }}
                placeholder="Custom capacity (e.g. 200ml, 1L, 500g)"
              />
              <button type="button" onClick={submitCustomCapacity}>Add</button>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Product Colors (optional)</label>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Select available colors for this product
            </p>
            <div className="color-selector-grid">
              {PRODUCT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${formData.availableColors.includes(color) ? 'selected' : ''}`}
                  onClick={() => handleColorToggle(color)}
                >
                  <div className="color-preview-wrapper">
                    <div 
                      className="color-preview" 
                      style={{ background: getColorPreview(color) }}
                    />
                  </div>
                  <span className="color-label">{color}</span>
                </button>
              ))}
            </div>
          </div>

          {showRetailFields && (
            <>
              <div className="form-group">
                <label>Retail Discount (%)</label>
                <input type="number" name="discountPct" min="0" max="100" value={formData.discountPct} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Promo Code</label>
                <input name="promoCode" value={formData.promoCode} onChange={handleChange} placeholder="Optional" />
              </div>
            </>
          )}

          {showWholesaleFields && (
            <>
              <div className="form-group">
                <label>Minimum Order Qty (MOQ)</label>
                <input type="number" name="minimumOrderQty" min="1" value={formData.minimumOrderQty} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Wholesale Promo Code</label>
                <input name="promoCode" value={formData.promoCode} onChange={handleChange} placeholder="BULK-SUMMER" />
              </div>
              <div className="form-group full-width">
                <label>Bulk Pricing Tiers</label>
                <p className="field-help" style={{ marginBottom: 8 }}>e.g. 50+ units → 10% off, 100+ units → 15% off</p>
                {formData.bulkTiers.map((tier, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="number"
                      placeholder="Min qty"
                      value={tier.min_quantity}
                      onChange={(e) => {
                        const tiers = [...formData.bulkTiers];
                        tiers[idx] = { ...tiers[idx], min_quantity: parseInt(e.target.value, 10) };
                        setFormData({ ...formData, bulkTiers: tiers });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Discount %"
                      value={tier.discount_pct}
                      onChange={(e) => {
                        const tiers = [...formData.bulkTiers];
                        tiers[idx] = { ...tiers[idx], discount_pct: parseFloat(e.target.value) };
                        setFormData({ ...formData, bulkTiers: tiers });
                      }}
                    />
                    <button type="button" onClick={() => setFormData({ ...formData, bulkTiers: formData.bulkTiers.filter((_, i) => i !== idx) })}>
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary-expert"
                  onClick={() => setFormData({ ...formData, bulkTiers: [...formData.bulkTiers, { min_quantity: '', discount_pct: '' }] })}
                >
                  Add Tier
                </button>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Base Price (USD — your revenue)</label>
            <div className="price-input-wrapper">
              <input type="number" name="basePrice" placeholder="0.00" value={formData.basePrice} onChange={handleChange} required />
            </div>
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              All product prices are stored in USD. Buyers see a local price converted to their region.
            </p>
          </div>

          <div className="form-group">
            <label>Tax / VAT (%)</label>
            <input
              type="number"
              name="vatPct"
              min="0"
              max="100"
              step="0.1"
              value={formData.vatPct}
              onChange={handleChange}
              placeholder="e.g. 18"
              required
            />
            <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Rate you remit to the tax authority. Added to the buyer price on top of platform fee.
            </p>
          </div>

          <div className="form-group">
            <label>Price Calculation</label>
            <div className="price-calculation-card">
              {pricePreview.previewUnavailable ? (
                <p style={{ fontSize: 13, color: 'var(--danger, #c0392b)' }}>
                  Price preview unavailable. Check your connection or try again.
                </p>
              ) : (
                <>
                  <div className="calc-row">
                    <span>Base Price (your revenue)</span>
                    <span>{formatMoney(formData.basePrice || 0, MERCHANT_PRODUCT_CURRENCY)}</span>
                  </div>
                  <div className="calc-row">
                    <span>Platform Fee ({pricePreview.platform_fee_pct ?? '—'}%)</span>
                    <span>{formatMoney(pricePreview.platform_fee_amount || 0, MERCHANT_PRODUCT_CURRENCY)}</span>
                  </div>
                  <div className="calc-row">
                    <span>Tax / VAT ({pricePreview.vat_pct ?? '—'}%)</span>
                    <span>{formatMoney(pricePreview.vat_amount || 0, MERCHANT_PRODUCT_CURRENCY)}</span>
                  </div>
                  <div className="calc-row total">
                    <span>Buyer Price (USD)</span>
                    <span>{formatMoney(pricePreview.listing_price || 0, MERCHANT_PRODUCT_CURRENCY)}</span>
                  </div>
                </>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Platform fee is set by Pochi. Tax rate is set by you per product.
              </p>
            </div>
          </div>

          <div className="form-group full-width">
            <button type="submit" className="btn-primary">
              <Plus size={18} /> Publish Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;
