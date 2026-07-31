import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import {
  useCategories,
  useProducts,
  useGeoCurrency,
  useFxRates,
} from '../hooks/queries';
import { 
  Package, Plus, X, ArrowRight, ArrowLeft, Check, Tag, 
  Search, Filter, ChevronRight, MoreVertical, Eye, 
  Trash2, Edit3, ShoppingCart, Activity, Layers, Upload, Image as ImageIcon, ChevronDown, DollarSign,
  Info, Calendar, BarChart, Percent, AlertCircle, HelpCircle, Loader2
} from 'lucide-react';
import './ProductList.css';
import { useNavigate } from 'react-router-dom';
import { alertSuccess, alertError, confirmDelete } from '../utils/swal';
import { compressImageFile, MAX_PRODUCT_IMAGES } from '../utils/compressImage';
import {
  MERCHANT_PRODUCT_CURRENCY,
  DEFAULT_PREVIEW_CURRENCY,
  normalizeCurrency,
  formatMoney,
  getPublicPriceDisplay,
  enrichProductForViewer,
  formatPublicLocalPrice,
  formatPublicUsdPrice,
  getProductDeliveryDisplay,
  isFreeDelivery,
  getProductPromotionDisplay,
} from '../utils/currency';
import { DELIVERY_TIME_OPTIONS, DEFAULT_DELIVERY_TIME } from '../utils/deliveryTime';
import { PRODUCT_COLORS, getProductColorPreview } from '../constants/productColors';
import { DELIVERY_REGION_OPTIONS, formatDeliveryRegions } from '../constants/deliveryRegions';
import {
  LETTER_SIZES,
  NUMERIC_SIZES,
  CAPACITY_PRESETS,
  GENDER_OPTIONS,
  formatGender,
  hasOption,
  toggleOption,
  addCustomOption,
} from '../constants/productOptions';

const getStockLabel = (product) => {
  const qty = product?.stock_quantity ?? 0;
  if (qty <= 0) return { text: 'Out of Stock', className: 'hidden' };
  return { text: `${qty} in stock`, className: 'active' };
};

const PublicCardPrice = ({ display, size = 'local', style, className }) => {
  const isLocal = size === 'local';
  const resolvedClass = className || (isLocal ? 'card-price-local' : 'card-price-usd');
  const format = isLocal
    ? (amount) => formatPublicLocalPrice(amount, display.localCurrency)
    : formatPublicUsdPrice;
  const original = isLocal ? display.localAmount : display.usdAmount;
  const current = isLocal
    ? (display.localDiscountedAmount ?? display.localAmount)
    : (display.usdDiscountedAmount ?? display.usdAmount);

  if (display.hasDiscount) {
    return (
      <p className={resolvedClass} style={style}>
        <span className="price-original">{format(original)}</span>
        <span className="price-discounted">{format(current)}</span>
        <span className="price-tax"> + tax</span>
      </p>
    );
  }

  return (
    <p className={resolvedClass} style={style}>
      {format(current)}<span className="price-tax"> + tax</span>
    </p>
  );
};

const ProductList = () => {
  const queryClient = useQueryClient();
  const { data: geoData, isSuccess: geoReady } = useGeoCurrency();
  const { data: fxRates = {} } = useFxRates();
  const { data: categories = [] } = useCategories();

  const viewerCurrency = useMemo(() => {
    if (geoReady && geoData?.currency && !geoData?.error) {
      return normalizeCurrency(geoData.currency);
    }
    return DEFAULT_PREVIEW_CURRENCY;
  }, [geoData, geoReady]);

  const { data: rawProducts = [] } = useProducts(viewerCurrency, geoReady);

  const refreshProducts = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.stats });
  };

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('ADD'); // ADD, EDIT, VIEW
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [menuOpenSku, setMenuOpenSku] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [viewImageIndex, setViewImageIndex] = useState(0);
  
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brand: '',
    basePrice: '',
    categoryId: '',
    saleChannel: 'RETAIL',
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

  const products = useMemo(
    () => rawProducts.map((p) => enrichProductForViewer(p, viewerCurrency, fxRates)),
    [rawProducts, viewerCurrency, fxRates]
  );

  const [productImages, setProductImages] = useState([]);
  const navigate = useNavigate();

  const showRetailFields = formData.saleChannel === 'RETAIL';
  const showWholesaleFields = formData.saleChannel === 'WHOLESALE';

  const emptyForm = () => ({
    name: '',
    description: '',
    brand: '',
    basePrice: '',
    categoryId: '',
    saleChannel: 'RETAIL',
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

  const setSaleChannel = (channel) => {
    setFormData((prev) => {
      if (channel === 'WHOLESALE') {
        return {
          ...prev,
          saleChannel: 'WHOLESALE',
          discountPct: '',
          bulkTiers: prev.bulkTiers?.length ? prev.bulkTiers : [{ min_quantity: '', discount_pct: '' }],
        };
      }
      return {
        ...prev,
        saleChannel: 'RETAIL',
        minimumOrderQty: '',
        bulkTiers: [],
      };
    });
  };

  const fetchPricePreview = async (basePrice, vatPct, viewerCcy) => {
    const price = parseFloat(basePrice);
    const vat = parseFloat(vatPct);
    if (!price || price <= 0) {
      setPricePreview({
        base_price: 0,
        platform_fee_pct: null,
        vat_pct: vat || null,
        platform_fee_amount: 0,
        vat_amount: 0,
        listing_price: 0,
        previewUnavailable: false,
      });
      return;
    }
    try {
      const res = await api.post('/pricing/preview', {
        base_price: price,
        vat_pct: Number.isFinite(vat) ? vat : undefined,
        currency: MERCHANT_PRODUCT_CURRENCY,
        viewer_currency: viewerCcy ? normalizeCurrency(viewerCcy) : undefined,
      });
      setPricePreview({ ...res.data, previewUnavailable: false });
    } catch {
      setPricePreview({
        base_price: price,
        platform_fee_pct: null,
        vat_pct: null,
        platform_fee_amount: 0,
        vat_amount: 0,
        listing_price: 0,
        previewUnavailable: true,
      });
    }
  };

  useEffect(() => {
    if (formData.basePrice) {
      fetchPricePreview(formData.basePrice, formData.vatPct, viewerCurrency);
    }
  }, [formData.basePrice, formData.vatPct, viewerCurrency]);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenSku(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getColorPreview = getProductColorPreview;

  const openDrawer = (mode, product = null) => {
    setDrawerMode(mode);
    setSelectedProduct(product);
    setViewImageIndex(0);
    if (product) {
      const channel = (product.sale_channel || 'RETAIL').toUpperCase() === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      setFormData({
        name: product.name,
        description: product.description || '',
        brand: product.brand || '',
        basePrice: product.base_price.toString(),
        categoryId: product.category_id || '',
        saleChannel: channel,
        stockQuantity: product.stock_quantity?.toString() || '',
        discountPct: product.discount_pct?.toString() || '',
        promoCode: product.promo_code || '',
        minimumOrderQty: product.minimum_order_qty?.toString() || '',
        vatPct: (product.vat ?? 18).toString(),
        condition: product.condition || 'NEW',
        gender: product.gender || '',
        freeDelivery: isFreeDelivery(product) ? 'yes' : 'no',
        expectedDeliveryTime: product.expected_delivery_time || DEFAULT_DELIVERY_TIME,
        bulkTiers: product.bulk_tiers || [],
        availableSizes: product.available_sizes || [],
        availableColors: product.available_colors || [],
        deliveryRegions: product.delivery_regions || [],
      });
      setProductImages(product.images ? product.images.map(img => img.base64_content) : []);
    } else {
      setFormData(emptyForm());
      setProductImages([]);
    }
    setCustomSizeInput('');
    setCustomCapacityInput('');
    setStep(1);
    setIsDrawerOpen(true);
    setMenuOpenSku(null);
  };

  const toggleSizeOption = (value) => {
    setFormData((prev) => ({
      ...prev,
      availableSizes: toggleOption(prev.availableSizes, value),
    }));
  };

  const submitCustomSize = () => {
    const { list, added } = addCustomOption(formData.availableSizes, customSizeInput);
    if (!added) return;
    setFormData((prev) => ({ ...prev, availableSizes: list }));
    setCustomSizeInput('');
  };

  const submitCustomCapacity = () => {
    const { list, added } = addCustomOption(formData.availableSizes, customCapacityInput);
    if (!added) return;
    setFormData((prev) => ({ ...prev, availableSizes: list }));
    setCustomCapacityInput('');
  };

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      const isWholesale = formData.saleChannel === 'WHOLESALE';
      const payload = {
        name: formData.name,
        description: formData.description,
        brand: formData.brand?.trim() || null,
        base_price: parseFloat(formData.basePrice),
        category_id: formData.categoryId || null,
        sale_channel: formData.saleChannel,
        stock_quantity: parseInt(formData.stockQuantity || '0', 10),
        discount_pct: !isWholesale && formData.discountPct ? parseFloat(formData.discountPct) : null,
        promo_code: formData.promoCode || null,
        minimum_order_qty: isWholesale && formData.minimumOrderQty
          ? parseInt(formData.minimumOrderQty, 10)
          : null,
        vat: formData.vatPct !== '' ? parseFloat(formData.vatPct) : null,
        condition: formData.condition || 'NEW',
        gender: formData.gender || null,
        currency: MERCHANT_PRODUCT_CURRENCY,
        free_delivery: formData.freeDelivery === 'yes',
        expected_delivery_time: formData.expectedDeliveryTime,
        bulk_tiers: isWholesale
          ? formData.bulkTiers.filter((t) => t.min_quantity && t.discount_pct !== '' && t.discount_pct != null)
          : [],
        images: productImages.map((img, idx) => ({ base64_content: img, sort_order: idx })),
        available_sizes: formData.availableSizes.length > 0 ? formData.availableSizes : null,
        available_colors: formData.availableColors.length > 0 ? formData.availableColors : null,
        delivery_regions: formData.deliveryRegions.length > 0 ? formData.deliveryRegions : null,
      };

      if (drawerMode === 'EDIT') {
        await api.patch(`/products/${selectedProduct.sku}`, payload);
      } else {
        await api.post('/products/', payload);
      }
      
      refreshProducts();
      setIsDrawerOpen(false);
      alertSuccess('Product Saved', 'Your product has been saved successfully.');
    } catch (err) {
      const status = err.response?.status;
      let message;
      if (!err.response) {
        message =
          'Could not reach the server — often caused by photos that are too large. Try fewer or smaller images, then save again.';
      } else if (status === 413) {
        message =
          'Product data is too large (usually photos). Remove some images or use smaller files, then try again.';
      } else {
        const detail = err.response?.data?.detail;
        message = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((e) => e.msg).join(', ')
            : 'Could not save the product. Please try again.';
      }
      alertError('Operation Failed', message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteProduct = async (sku) => {
    const result = await confirmDelete({
      title: 'Delete Product?',
      text: 'This action cannot be undone.',
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/products/${sku}`);
        alertSuccess('Deleted', 'Product removed successfully.');
        refreshProducts();
      } catch (err) {
        alertError('Delete Failed', 'Failed to delete product. Please try again.');
      }
    }
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'General';
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'All' || getCategoryName(p.category_id) === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const toggleMenu = (e, sku) => {
    e.stopPropagation();
    setMenuOpenSku(menuOpenSku === sku ? null : sku);
  };

  return (
    <div className="product-list-container animate-fade">
      <div className="page-header-refined">
        <div className="title-group">
          <h1>Product Inventory</h1>
          <p>You have {products.length} active listings.</p>
        </div>
        <div className="header-actions">
           <button className="btn-secondary-expert" onClick={() => navigate('/dashboard/categories')}>
             <Layers size={18} /> Categories
          </button>
          <button className="btn-add-product" onClick={() => openDrawer('ADD')}>
            <div className="icon-box"><Plus size={20} /></div>
            <span>New Product</span>
          </button>
        </div>
      </div>

      <div className="stats-grid-compact">
        <div className="stat-card-refined glass">
          <div className="icon indigo"><Layers size={20} /></div>
          <div className="info">
            <span className="lbl">Total Items</span>
            <span className="val">{products.length}</span>
          </div>
        </div>
        <div className="stat-card-refined glass">
          <div className="icon emerald"><Check size={20} /></div>
          <div className="info">
            <span className="lbl">Public</span>
            <span className="val">{products.filter(p => p.is_active).length}</span>
          </div>
        </div>
        <div className="stat-card-refined glass">
          <div className="icon amber"><BarChart size={20} /></div>
          <div className="info">
            <span className="lbl">Categories</span>
            <span className="val">{categories.length}</span>
          </div>
        </div>
      </div>

      <div className="inventory-controls glass">
        <div className="search-box-refined">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by name or SKU..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-chips">
          <button 
            className={`chip ${activeFilter === 'All' ? 'active' : ''}`}
            onClick={() => setActiveFilter('All')}
          >
            All
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id} 
              className={`chip ${activeFilter === cat.name ? 'active' : ''}`}
              onClick={() => setActiveFilter(cat.name)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="product-grid-refined">
        {filteredProducts.map(product => {
          const display = getPublicPriceDisplay(product, viewerCurrency, fxRates);
          const delivery = getProductDeliveryDisplay(product);
          const promo = getProductPromotionDisplay(product);
          return (
            <div key={product.sku} className="product-card-public animate-fade">
              <div className="card-media">
                <div className="media-placeholder">
                  {product.images?.[0] ? (
                    <img src={product.images[0].base64_content} alt={product.name} className="product-main-img" />
                  ) : <Package size={48} strokeWidth={1} />}
                </div>
                <div className={`badge ${product.is_active ? 'active' : 'hidden'}`}>
                  {product.is_active ? 'Live' : 'Draft'}
                </div>
                {promo?.badge && (
                  <div className="card-promo-badge">{promo.badge}</div>
                )}
                {product.condition === 'USED' && (
                  <div className="card-condition-badge">Used</div>
                )}
                <div className="card-menu-container">
                   <button className="menu-trigger-btn public-card-menu" onClick={(e) => toggleMenu(e, product.sku)}>
                      <MoreVertical size={18} />
                   </button>
                   {menuOpenSku === product.sku && (
                     <div className="card-dropdown glass animate-slide-up" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openDrawer('VIEW', product)}><Eye size={16} /> View Details</button>
                        <button onClick={() => openDrawer('EDIT', product)}><Edit3 size={16} /> Edit Product</button>
                        <hr />
                        <button className="danger" onClick={() => handleDeleteProduct(product.sku)}><Trash2 size={16} /> Delete</button>
                     </div>
                   )}
                </div>
              </div>
              <div className="card-content-public">
                <h3 className="card-title-public" title={product.name}>{product.name}</h3>
                {(product.brand || product.sale_channel) && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 6px' }}>
                    {[
                      product.brand,
                      (product.sale_channel || 'RETAIL').toUpperCase() === 'WHOLESALE' ? 'Wholesale' : 'Retail',
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                <PublicCardPrice
                  display={display}
                  size={display.showBoth ? 'local' : 'usd'}
                  className="card-price-local"
                />
                <p className="card-source">Pochi</p>
                {delivery.lines.length > 0 && (
                  <div className="card-delivery-group">
                    {delivery.lines.map((line) => (
                      <p
                        key={line.key}
                        className={`card-delivery ${line.isFree ? 'is-free' : line.isRegions ? 'is-regions' : 'is-time'}`}
                      >
                        {line.key === 'time'
                          ? `Delivery: ${line.text}`
                          : line.key === 'regions'
                            ? `Delivers to: ${formatDeliveryRegions(line.text).join(' · ')}`
                            : line.text}
                      </p>
                    ))}
                  </div>
                )}
                {promo?.code && (
                  <p className="card-promo-code">
                    <Tag size={12} /> Code <strong>{promo.code}</strong>
                    {promo.endsLabel ? ` · ends ${promo.endsLabel}` : ''}
                  </p>
                )}
                {display.showBoth && (
                  <PublicCardPrice display={display} size="usd" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Professional Drawer */}
      <div className={`expert-drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={() => setIsDrawerOpen(false)}>
        <div className="expert-drawer" onClick={e => e.stopPropagation()}>
          <div className="drawer-nav">
            <div className="nav-header">
              <div className="icon-badge">
                {drawerMode === 'VIEW' ? <Eye size={24} /> : drawerMode === 'EDIT' ? <Edit3 size={24} /> : <Plus size={24} />}
              </div>
              <div className="text">
                <h2>{drawerMode === 'VIEW' ? 'Product Inspection' : drawerMode === 'EDIT' ? 'Edit Listing' : 'New Product Listing'}</h2>
                <p>{drawerMode === 'VIEW' ? selectedProduct?.sku : `Configure your catalog item`}</p>
              </div>
            </div>
            <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}><X /></button>
          </div>

          <div className="drawer-main">
            {drawerMode !== 'VIEW' && (
              <div className="expert-stepper">
                <div className={`step-pill ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}></div>
                <div className={`step-pill ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}></div>
                <div className={`step-pill ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}></div>
              </div>
            )}

            {drawerMode === 'VIEW' ? (
              <div className="view-panel animate-fade">
                 <div className="view-visual glass">
                    {productImages[viewImageIndex] ? (
                      <img src={productImages[viewImageIndex]} alt="Main" className="main-view-img" />
                    ) : <Package size={64} />}
                    
                    {productImages.length > 1 && (
                      <div className="view-thumbnails">
                        {productImages.map((img, idx) => (
                          <div 
                            key={idx} 
                            className={`thumb-card ${viewImageIndex === idx ? 'active' : ''}`}
                            onClick={() => setViewImageIndex(idx)}
                          >
                            <img src={img} alt="Thumb" />
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
                 <div className="view-details-grid">
                    <div className="detail-box">
                       <label>Name</label>
                       <p>{selectedProduct?.name}</p>
                    </div>
                    <div className="detail-box">
                       <label>Brand</label>
                       <p>{selectedProduct?.brand || '—'}</p>
                    </div>
                    <div className="detail-box">
                       <label>Sale Type</label>
                       <p>{(selectedProduct?.sale_channel || 'RETAIL').toUpperCase() === 'WHOLESALE' ? 'Wholesale' : 'Retail'}</p>
                    </div>
                    <div className="detail-box">
                       <label>Category</label>
                       <p>{getCategoryName(selectedProduct?.category_id)}</p>
                    </div>
                    <div className="detail-box">
                       <label>Condition</label>
                       <p>{selectedProduct?.condition === 'USED' ? 'Used' : 'New'}</p>
                    </div>
                    {selectedProduct?.gender && (
                      <div className="detail-box">
                         <label>Gender</label>
                         <p>{formatGender(selectedProduct.gender)}</p>
                      </div>
                    )}
                    <div className="detail-box">
                       <label>Stock Quantity</label>
                       <p>{selectedProduct?.stock_quantity > 0 ? `${selectedProduct.stock_quantity} units available` : 'Out of stock — edit product and set Stock Quantity on step 1'}</p>
                    </div>
                    {(selectedProduct?.sale_channel || 'RETAIL').toUpperCase() === 'WHOLESALE' ? (
                      <>
                        <div className="detail-box">
                          <label>Minimum Order Qty (MOQ)</label>
                          <p>{selectedProduct?.minimum_order_qty != null ? selectedProduct.minimum_order_qty : '—'}</p>
                        </div>
                        <div className="detail-box">
                          <label>Promo Code</label>
                          <p>{selectedProduct?.promo_code || '—'}</p>
                        </div>
                        {(selectedProduct?.bulk_tiers || []).length > 0 && (
                          <div className="detail-box full">
                            <label>Bulk Pricing Tiers</label>
                            <div className="detail-chips-container" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                              {selectedProduct.bulk_tiers.map((tier, i) => (
                                <span key={tier.id || i} className="detail-chip" style={{ justifyContent: 'space-between' }}>
                                  <span>{tier.min_quantity}+ units</span>
                                  <strong>{tier.discount_pct}% off</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="detail-box">
                          <label>Retail Discount</label>
                          <p>
                            {selectedProduct?.effective_discount_pct != null || selectedProduct?.discount_pct != null
                              ? `${selectedProduct.effective_discount_pct ?? selectedProduct.discount_pct}%`
                              : '—'}
                            {selectedProduct?.promotion_badge ? ` · ${selectedProduct.promotion_badge}` : ''}
                          </p>
                        </div>
                        <div className="detail-box">
                          <label>Promo Code</label>
                          <p>{selectedProduct?.promo_code || '—'}</p>
                        </div>
                      </>
                    )}
                    <div className="detail-box full">
                       <label>Description</label>
                       <p>{selectedProduct?.description || 'No description provided.'}</p>
                    </div>
                    <div className="detail-box">
                       <label>Base Price (your revenue)</label>
                       <p>{formatMoney(selectedProduct?.base_price, MERCHANT_PRODUCT_CURRENCY)}</p>
                    </div>
                    <div className="detail-box">
                       <label>Selling Price (buyer listing)</label>
                       <p>
                         {formatMoney(
                           selectedProduct?.discounted_listing_price
                             ?? selectedProduct?.listing_price
                             ?? selectedProduct?.base_price,
                           MERCHANT_PRODUCT_CURRENCY
                         )}
                         {selectedProduct?.discounted_listing_price != null
                           && selectedProduct?.listing_price != null
                           && Number(selectedProduct.discounted_listing_price) !== Number(selectedProduct.listing_price)
                           ? (
                             <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                               Full listing: {formatMoney(selectedProduct.listing_price, MERCHANT_PRODUCT_CURRENCY)}
                               {selectedProduct?.discount_pct != null || selectedProduct?.effective_discount_pct != null
                                 ? ` · ${selectedProduct.effective_discount_pct ?? selectedProduct.discount_pct}% off`
                                 : ''}
                             </span>
                           )
                           : null}
                       </p>
                    </div>
                    <div className="detail-box">
                       <label>Platform Fee</label>
                       <p>{selectedProduct?.platform_fee != null ? `${selectedProduct.platform_fee}%` : '—'}</p>
                    </div>
                    <div className="detail-box">
                       <label>Tax / VAT</label>
                       <p>{selectedProduct?.vat != null ? `${selectedProduct.vat}%` : '—'}</p>
                    </div>
                    <div className="detail-box highlight public-price-detail full">
                       <label>How buyers see this price</label>
                       {selectedProduct && (() => {
                         const enriched = enrichProductForViewer(selectedProduct, viewerCurrency, fxRates);
                         const display = getPublicPriceDisplay(enriched, viewerCurrency, fxRates);
                         return (
                           <div className="public-price-detail-ebay">
                             <PublicCardPrice
                               display={display}
                               size={display.showBoth ? 'local' : 'usd'}
                               className="card-price-local"
                               style={{ color: 'inherit' }}
                             />
                             {display.showBoth && (
                               <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                 USD listing: {formatPublicUsdPrice(display.usdDiscountedAmount ?? display.usdAmount)}
                               </p>
                             )}
                             <p className="card-source" style={{ color: 'inherit' }}>Pochi</p>
                             {(() => {
                               const delivery = getProductDeliveryDisplay(selectedProduct);
                               if (!delivery.lines.length) return null;
                               return (
                                 <div className="card-delivery-group">
                                   {delivery.lines.map((line) => (
                                     <p
                                       key={line.key}
                                       className={`card-delivery ${line.isFree ? 'is-free' : line.isRegions ? 'is-regions' : 'is-time'}`}
                                       style={{ color: line.isFree ? undefined : 'inherit' }}
                                     >
                                       {line.key === 'time'
                                         ? `Delivery: ${line.text}`
                                         : line.key === 'regions'
                                           ? `Delivers to: ${formatDeliveryRegions(line.text).join(' · ')}`
                                           : line.text}
                                     </p>
                                   ))}
                                 </div>
                               );
                             })()}
                           </div>
                         );
                       })()}
                    </div>
                    {selectedProduct?.available_sizes && selectedProduct.available_sizes.length > 0 && (
                      <div className="detail-box full">
                        <label>Available Options (sizes / capacity)</label>
                        <div className="detail-chips-container">
                          {selectedProduct.available_sizes.map((size, i) => (
                            <span key={i} className="detail-chip detail-chip-size">
                              {size}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedProduct?.available_colors && selectedProduct.available_colors.length > 0 && (
                      <div className="detail-box full">
                        <label>Available Colors</label>
                        <div className="detail-chips-container">
                          {selectedProduct.available_colors.map((color, i) => (
                            <span key={i} className="detail-chip detail-chip-color">
                              <span 
                                className="detail-color-dot" 
                                style={{ background: getColorPreview(color) }}
                              />
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedProduct?.delivery_regions && selectedProduct.delivery_regions.length > 0 && (
                      <div className="detail-box full">
                        <label>Delivery Regions</label>
                        <div className="detail-chips-container">
                          {formatDeliveryRegions(selectedProduct.delivery_regions).map((label, i) => (
                            <span key={i} className="detail-chip detail-chip-size">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            ) : step === 1 ? (
              <div className="form-card animate-fade">
                <div className="form-card-header">
                  <div className="icon"><Info size={20} /></div>
                  <h3>General Information</h3>
                </div>
                <div className="expert-form">
                  <div className="form-field">
                    <label>Product Title <HelpCircle size={14} className="label-tip" /></label>
                    <div className="input-wrapper">
                      <ShoppingCart size={18} className="field-icon" />
                      <input 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="e.g. Premium Arabica Coffee" 
                      />
                    </div>
                    <p className="field-help">Keep it short and descriptive (max 60 chars).</p>
                  </div>
                  <div className="form-field">
                    <label>Brand</label>
                    <div className="input-wrapper">
                      <Tag size={18} className="field-icon" />
                      <input
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="e.g. Samsung, Nike"
                      />
                    </div>
                    <p className="field-help">Manufacturer or label shown to buyers.</p>
                  </div>
                  <div className="form-field">
                    <label>Sale Type</label>
                    <div className="sale-channel-toggle" role="group" aria-label="Sale type">
                      <button
                        type="button"
                        className={`sale-channel-btn ${formData.saleChannel === 'RETAIL' ? 'active' : ''}`}
                        onClick={() => setSaleChannel('RETAIL')}
                      >
                        Retail
                      </button>
                      <button
                        type="button"
                        className={`sale-channel-btn ${formData.saleChannel === 'WHOLESALE' ? 'active' : ''}`}
                        onClick={() => setSaleChannel('WHOLESALE')}
                      >
                        Wholesale
                      </button>
                    </div>
                    <p className="field-help">
                      {showRetailFields
                        ? 'Retail: set a discount % and optional promo code.'
                        : 'Wholesale: set MOQ and bulk quantity tiers.'}
                    </p>
                  </div>
                  <div className="form-field">
                    <label>Stock Quantity <HelpCircle size={14} className="label-tip" /></label>
                    <div className="input-wrapper">
                      <Package size={18} className="field-icon" />
                      <input
                        type="number"
                        min="0"
                        value={formData.stockQuantity}
                        onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                        placeholder="e.g. 100"
                      />
                    </div>
                    <p className="field-help">Units available for sale. Products with 0 stock show as Out of Stock in the Pochi app.</p>
                  </div>
                  <div className="form-field">
                    <label>Market Category</label>
                    <div className="input-wrapper">
                      <Layers size={18} className="field-icon" />
                      <select 
                        value={formData.categoryId} 
                        onChange={e => setFormData({...formData, categoryId: e.target.value})}
                      >
                        <option value="">Choose a category...</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Condition</label>
                    <div className="input-wrapper">
                      <Tag size={18} className="field-icon" />
                      <select
                        value={formData.condition}
                        onChange={e => setFormData({ ...formData, condition: e.target.value })}
                      >
                        <option value="NEW">New</option>
                        <option value="USED">Used</option>
                      </select>
                    </div>
                    <p className="field-help">Mark used items (e.g. second-hand phones). Shown as a badge on the product card.</p>
                  </div>
                  <div className="form-field">
                    <label>Gender (optional)</label>
                    <div className="input-wrapper">
                      <Tag size={18} className="field-icon" />
                      <select
                        value={formData.gender}
                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      >
                        {GENDER_OPTIONS.map((opt) => (
                          <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="field-help">Optional. Use for clothing, cosmetics, accessories, or any product where it helps buyers.</p>
                  </div>
                  <div className="form-field full">
                    <label>Sizes &amp; capacity (optional)</label>
                    <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Optional for any product. Pick presets and/or type your own labels (e.g. 42, 200ml, One Size).
                    </p>

                    <p className="option-group-label">Letter sizes</p>
                    <div className="size-selector-grid">
                      {LETTER_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-option ${hasOption(formData.availableSizes, size) ? 'selected' : ''}`}
                          onClick={() => toggleSizeOption(size)}
                        >
                          <span className="size-label">{size}</span>
                        </button>
                      ))}
                    </div>

                    <p className="option-group-label">Numeric sizes</p>
                    <div className="size-selector-grid">
                      {NUMERIC_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-option ${hasOption(formData.availableSizes, size) ? 'selected' : ''}`}
                          onClick={() => toggleSizeOption(size)}
                        >
                          <span className="size-label">{size}</span>
                        </button>
                      ))}
                    </div>
                    <div className="custom-option-row">
                      <input
                        type="text"
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitCustomSize();
                          }
                        }}
                        placeholder="Custom size (e.g. 13, 42 EU, One Size)"
                      />
                      <button type="button" className="btn-add-option" onClick={submitCustomSize}>Add</button>
                    </div>

                    <p className="option-group-label">Capacity / volume</p>
                    <div className="size-selector-grid">
                      {CAPACITY_PRESETS.map((cap) => (
                        <button
                          key={cap}
                          type="button"
                          className={`size-option ${hasOption(formData.availableSizes, cap) ? 'selected' : ''}`}
                          onClick={() => toggleSizeOption(cap)}
                        >
                          <span className="size-label">{cap}</span>
                        </button>
                      ))}
                    </div>
                    <div className="custom-option-row">
                      <input
                        type="text"
                        value={customCapacityInput}
                        onChange={(e) => setCustomCapacityInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitCustomCapacity();
                          }
                        }}
                        placeholder="Custom capacity (e.g. 200ml, 1L, 500g)"
                      />
                      <button type="button" className="btn-add-option" onClick={submitCustomCapacity}>Add</button>
                    </div>

                    {formData.availableSizes.length > 0 && (
                      <div className="selected-options-row">
                        <span className="option-group-label" style={{ marginTop: 0 }}>Selected</span>
                        <div className="detail-chips-container">
                          {formData.availableSizes.map((size) => (
                            <button
                              key={size}
                              type="button"
                              className="detail-chip detail-chip-size selected-option-chip"
                              onClick={() => toggleSizeOption(size)}
                              title="Remove"
                            >
                              {size} ×
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="form-field full">
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
                          onClick={() => setFormData({
                            ...formData,
                            availableColors: formData.availableColors.includes(color)
                              ? formData.availableColors.filter(c => c !== color)
                              : [...formData.availableColors, color]
                          })}
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
                </div>
              </div>
            ) : step === 2 ? (
              <div className="form-card animate-fade">
                <div className="form-card-header">
                  <div className="icon"><ImageIcon size={20} /></div>
                  <h3>Product Media</h3>
                </div>
                <div className="expert-form">
                  <input type="file" id="p-img" multiple accept="image/*" onChange={async (e) => {
                     const files = Array.from(e.target.files || []);
                     e.target.value = '';
                     if (!files.length) return;
                     const slotsLeft = MAX_PRODUCT_IMAGES - productImages.length;
                     if (slotsLeft <= 0) {
                       alertError('Image limit', `You can upload up to ${MAX_PRODUCT_IMAGES} images per product.`);
                       return;
                     }
                     const toAdd = files.slice(0, slotsLeft);
                     try {
                       const compressed = await Promise.all(toAdd.map((file) => compressImageFile(file)));
                       setProductImages((prev) => [...prev, ...compressed]);
                     } catch (imgErr) {
                       alertError('Upload failed', imgErr.message || 'Could not process image.');
                     }
                  }} hidden />
                  <label htmlFor="p-img" className="modern-upload-zone glass">
                    <Upload size={32} />
                    <h4>Click to upload photos</h4>
                    <p>Up to {MAX_PRODUCT_IMAGES} images · auto-compressed for upload</p>
                  </label>
                  <div className="gallery-preview-grid">
                    {productImages.map((img, idx) => (
                      <div key={idx} className="modern-preview-card">
                        <img src={img} alt="Preview" />
                        <button className="remove-badge" onClick={() => setProductImages(prev => prev.filter((_, i) => i !== idx))}><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-card animate-fade">
                <div className="form-card-header">
                  <div className="icon"><DollarSign size={20} /></div>
                  <h3>Pricing & Description</h3>
                </div>
                <div className="expert-form">
                  <div className="form-field">
                    <label>Base Price (USD — your revenue)</label>
                    <div className="input-wrapper">
                      <DollarSign size={18} className="field-icon" />
                      <input 
                        type="number" 
                        value={formData.basePrice} 
                        onChange={e => setFormData({...formData, basePrice: e.target.value})} 
                      />
                    </div>
                    <p className="field-help">Prices are stored in USD. Buyers see a local price in their region.</p>
                  </div>
                  <div className="form-field">
                    <label>Tax / VAT (%)</label>
                    <div className="input-wrapper">
                      <Percent size={18} className="field-icon" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.vatPct}
                        onChange={(e) => setFormData({ ...formData, vatPct: e.target.value })}
                        placeholder="e.g. 18"
                      />
                    </div>
                    <p className="field-help">Enter the tax rate you pay to the tax authority. This is added to the buyer price.</p>
                  </div>
                  <div className="form-field">
                    <label>Expected Delivery Time</label>
                    <div className="input-wrapper">
                      <select
                        value={formData.expectedDeliveryTime}
                        onChange={(e) => setFormData({ ...formData, expectedDeliveryTime: e.target.value })}
                        required
                      >
                        {DELIVERY_TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="field-help">When buyers can expect to receive this product after ordering.</p>
                  </div>
                  <div className="form-field">
                    <label>Delivery</label>
                    <div className="input-wrapper">
                      <select
                        value={formData.freeDelivery}
                        onChange={(e) => setFormData({ ...formData, freeDelivery: e.target.value })}
                      >
                        <option value="no">Delivery not included (buyer pays shipping)</option>
                        <option value="yes">Free delivery</option>
                      </select>
                    </div>
                    <p className="field-help">
                      Card preview:{' '}
                      {formData.freeDelivery === 'yes' && (
                        <span className="delivery-preview-free">Free delivery</span>
                      )}
                      {formData.freeDelivery === 'yes' && formData.expectedDeliveryTime && (
                        <span className="delivery-preview-sep"> · </span>
                      )}
                      {formData.expectedDeliveryTime && (
                        <span className={formData.freeDelivery === 'yes' ? 'delivery-preview-time' : 'delivery-preview-paid'}>
                          Delivery: {DELIVERY_TIME_OPTIONS.find((o) => o.value === formData.expectedDeliveryTime)?.label}
                        </span>
                      )}
                      {formData.freeDelivery !== 'yes' && !formData.expectedDeliveryTime && (
                        <span className="delivery-preview-paid">Nothing shown on card</span>
                      )}
                    </p>
                  </div>
                  <div className="form-field full">
                    <label>Delivery Regions (optional)</label>
                    <p className="field-help" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Where this product can be delivered. Shown on the product card and details when selected.
                    </p>
                    <div className="region-selector-grid">
                      {DELIVERY_REGION_OPTIONS.map((region) => {
                        const selected = formData.deliveryRegions.includes(region.code);
                        return (
                          <button
                            key={region.code}
                            type="button"
                            className={`region-option ${selected ? 'selected' : ''}`}
                            onClick={() => setFormData({
                              ...formData,
                              deliveryRegions: selected
                                ? formData.deliveryRegions.filter((c) => c !== region.code)
                                : [...formData.deliveryRegions, region.code],
                            })}
                            aria-pressed={selected}
                          >
                            <span className="region-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                            <span className="region-flag">{region.flag}</span>
                            <span className="region-label">{region.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {showRetailFields && (
                    <div className="channel-pricing-panel retail">
                      <div className="channel-pricing-header">
                        <div className="channel-pricing-icon"><Percent size={18} /></div>
                        <div>
                          <h4>Retail pricing</h4>
                          <p>Discount applies to the public listing price. Promo code is optional.</p>
                        </div>
                      </div>
                      <div className="channel-pricing-grid">
                        <div className="form-field">
                          <label>Retail Discount (%)</label>
                          <div className="input-wrapper">
                            <Percent size={18} className="field-icon" />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.discountPct}
                              onChange={(e) => setFormData({ ...formData, discountPct: e.target.value })}
                              placeholder="e.g. 10"
                            />
                          </div>
                        </div>
                        <div className="form-field">
                          <label>Promo Code (optional)</label>
                          <div className="input-wrapper">
                            <Tag size={18} className="field-icon" />
                            <input
                              value={formData.promoCode}
                              onChange={(e) => setFormData({ ...formData, promoCode: e.target.value })}
                              placeholder="SUMMER10"
                            />
                          </div>
                          <p className="field-help">Shown on cards — the discount % sets the price buyers see.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {showWholesaleFields && (
                    <div className="channel-pricing-panel wholesale">
                      <div className="channel-pricing-header">
                        <div className="channel-pricing-icon"><Layers size={18} /></div>
                        <div>
                          <h4>Wholesale pricing</h4>
                          <p>Set a minimum order quantity and optional bulk tiers (e.g. 50+ units → 10% off).</p>
                        </div>
                      </div>
                      <div className="channel-pricing-grid">
                        <div className="form-field">
                          <label>Minimum Order Quantity (MOQ)</label>
                          <div className="input-wrapper">
                            <Package size={18} className="field-icon" />
                            <input
                              type="number"
                              min="1"
                              value={formData.minimumOrderQty}
                              onChange={(e) => setFormData({ ...formData, minimumOrderQty: e.target.value })}
                              placeholder="e.g. 10"
                            />
                          </div>
                        </div>
                        <div className="form-field">
                          <label>Wholesale Promo Code (optional)</label>
                          <div className="input-wrapper">
                            <Tag size={18} className="field-icon" />
                            <input
                              value={formData.promoCode}
                              onChange={(e) => setFormData({ ...formData, promoCode: e.target.value })}
                              placeholder="BULK-SUMMER"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="bulk-tiers-block">
                        <div className="bulk-tiers-title-row">
                          <label>Bulk Pricing Tiers</label>
                          <span className="bulk-tiers-hint">Higher qty → bigger discount</span>
                        </div>
                        {formData.bulkTiers.length === 0 && (
                          <p className="bulk-tiers-empty">No tiers yet. Add one to offer volume discounts.</p>
                        )}
                        <div className="bulk-tiers-list">
                          {formData.bulkTiers.map((tier, idx) => (
                            <div key={idx} className="bulk-tier-card">
                              <span className="bulk-tier-index">{idx + 1}</span>
                              <div className="bulk-tier-fields">
                                <div className="bulk-tier-field">
                                  <span className="bulk-tier-label">Min quantity</span>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="50"
                                    value={tier.min_quantity === '' || Number.isNaN(tier.min_quantity) ? '' : tier.min_quantity}
                                    onChange={(e) => {
                                      const tiers = [...formData.bulkTiers];
                                      const raw = e.target.value;
                                      tiers[idx] = {
                                        ...tiers[idx],
                                        min_quantity: raw === '' ? '' : parseInt(raw, 10),
                                      };
                                      setFormData({ ...formData, bulkTiers: tiers });
                                    }}
                                  />
                                </div>
                                <div className="bulk-tier-arrow" aria-hidden>→</div>
                                <div className="bulk-tier-field">
                                  <span className="bulk-tier-label">Discount %</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    placeholder="10"
                                    value={tier.discount_pct === '' || Number.isNaN(tier.discount_pct) ? '' : tier.discount_pct}
                                    onChange={(e) => {
                                      const tiers = [...formData.bulkTiers];
                                      const raw = e.target.value;
                                      tiers[idx] = {
                                        ...tiers[idx],
                                        discount_pct: raw === '' ? '' : parseFloat(raw),
                                      };
                                      setFormData({ ...formData, bulkTiers: tiers });
                                    }}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="bulk-tier-remove"
                                title="Remove tier"
                                onClick={() => setFormData({
                                  ...formData,
                                  bulkTiers: formData.bulkTiers.filter((_, i) => i !== idx),
                                })}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="bulk-tier-add"
                          onClick={() => setFormData({
                            ...formData,
                            bulkTiers: [...formData.bulkTiers, { min_quantity: '', discount_pct: '' }],
                          })}
                        >
                          <Plus size={16} />
                          Add volume tier
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="pricing-calculator-card">
                    {pricePreview.previewUnavailable ? (
                      <p style={{ fontSize: 13, color: 'var(--danger, #c0392b)' }}>
                        Price preview unavailable. Check your connection or try again.
                      </p>
                    ) : (
                      <>
                        <div className="calc-row"><span>Base Price (your revenue)</span><span>{formatMoney(parseFloat(formData.basePrice || 0), MERCHANT_PRODUCT_CURRENCY)}</span></div>
                        <div className="calc-row"><span>Platform Fee ({pricePreview.platform_fee_pct ?? '—'}%)</span><span>{formatMoney(pricePreview.platform_fee_amount || 0, MERCHANT_PRODUCT_CURRENCY)}</span></div>
                        <div className="calc-row"><span>Tax / VAT ({pricePreview.vat_pct ?? '—'}%)</span><span>{formatMoney(pricePreview.vat_amount || 0, MERCHANT_PRODUCT_CURRENCY)}</span></div>
                        <div className="calc-row total"><span>Buyer Price (USD)</span><span className="final-price">{formatMoney(pricePreview.listing_price || 0, MERCHANT_PRODUCT_CURRENCY)}</span></div>
                        {pricePreview.display_listing_price != null && pricePreview.display_currency && (
                          <div className="calc-row"><span>Local estimate</span><span>≈ {formatMoney(pricePreview.display_listing_price, pricePreview.display_currency)}</span></div>
                        )}
                      </>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                      Platform fee is set by Pochi. Tax rate is set by you per product.
                    </p>
                  </div>
                  <div className="form-field">
                    <label>Full Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      rows="5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {drawerMode !== 'VIEW' && (
            <div className="drawer-footer">
              {step > 1 && (
                <button className="btn-secondary-expert" onClick={() => setStep(step - 1)} disabled={isPublishing}>
                  <ArrowLeft size={18} /> Previous
                </button>
              )}
              <button 
                className="btn-primary-expert" 
                onClick={() => step < 3 ? setStep(step + 1) : handlePublish()}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="spinner-icon animate-spin" size={18} />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    {step === 3 ? 'Publish Listing' : 'Continue'} <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductList;
