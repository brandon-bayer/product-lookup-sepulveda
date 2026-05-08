import { Product } from '@shared/schema';
import { useEffect } from 'react';
import { recordScan } from '@/lib/productService';

/**
 * Field Mappings:
 * - Style Number = Private Label Name
 * - Color Number = Private Label Color
 * - Width/Quant-Carton = Width/Quantity
 * - Roll Costs = Cost
 * - Retail Price = Retail
 * - Backing = Date (shows "N/A" if no data)
 * - SKU = SKU
 * - Manufacturing = Manufacturer
 * - Style Name = Style Name
 * - Color Name = Color
 */

interface ProductDetailCardProps {
  product: Product;
  saveToHistory?: boolean;
}

export default function ProductDetailCard({ product, saveToHistory = true }: ProductDetailCardProps) {
  // Log to history when product is viewed (only for products with SKUs)
  useEffect(() => {
    if (saveToHistory && product && product.sku && product.sku.trim() !== '') {
      // Record this product view in scan history
      recordScan(product.sku).catch(error => {
        console.error('Failed to record product view in history:', error);
      });
    }
  }, [product, saveToHistory]);
  // Safety check - ensure product is defined
  if (!product) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center text-red-600 mb-2">
          <span className="material-icons mr-2">error</span>
          <h3 className="font-medium">Data Error</h3>
        </div>
        <p className="text-red-700">The product information is not available.</p>
      </div>
    );
  }
  
  // Format cost for display
  const formatCost = (costValue: any): string => {
    if (!costValue) return '$0.00';
    
    try {
      const costStr = String(costValue).replace('$', '').trim();
      const numCost = parseFloat(costStr);
      return !isNaN(numCost) ? `$${numCost.toFixed(2)}` : `$${costStr}`;
    } catch (e) {
      return `$${costValue}`;
    }
  };
  
  // Remove mill code (everything in parentheses) from the manufacturer
  const cleanManufacturer = product.manufacturer ? product.manufacturer.replace(/\s*\([^)]*\)\s*/g, '').trim() : 'N/A';
  
  // Format price for display
  const formatPrice = (priceValue: any): string => {
    if (!priceValue) return 'N/A';
    
    try {
      const priceStr = String(priceValue).replace('$', '').trim();
      const numPrice = parseFloat(priceStr);
      return !isNaN(numPrice) ? `$${numPrice.toFixed(2)}` : `$${priceStr}`;
    } catch (e) {
      return `$${priceValue}`;
    }
  };
  
  const label = "text-[10px] uppercase tracking-wide font-semibold mb-0.5";

  return (
    <div className="mb-6 bg-white rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
      {/* Card header: SKU + Manufacturer */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <span className="font-bold text-sm" style={{ color: 'var(--text-head)' }}>
          {product.sku || 'No SKU'}
        </span>
        <span className="text-xs truncate ml-4 max-w-[55%] text-right" style={{ color: 'var(--text-muted)' }}>
          {cleanManufacturer}
        </span>
      </div>

      {/* Fields: 2×2 grid — P.Style/Style | P.Color/Color */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
        <div className="p-4 space-y-4">
          <div>
            <p className={`${label}`} style={{ color: 'var(--text-muted)' }}>P. Style</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.styleName || 'N/A'}</p>
          </div>
          <div>
            <p className={`${label}`} style={{ color: 'var(--text-muted)' }}>Style</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.styleNumber || 'N/A'}</p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className={`${label}`} style={{ color: 'var(--text-muted)' }}>P. Color</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.colorName || 'N/A'}</p>
          </div>
          <div>
            <p className={`${label}`} style={{ color: 'var(--text-muted)' }}>Color</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.colorNumber || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Footer strip: Cost, Retail, Width/Qty, Date */}
      <div className="grid grid-cols-4 divide-x divide-gray-100">
        <div className="px-4 py-3" style={{ background: 'var(--sell-bg)' }}>
          <p className={`${label}`} style={{ color: 'var(--sell)' }}>Cost</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--sell)' }}>{formatCost(product.cost)}</p>
        </div>
        <div className="px-4 py-3" style={{ background: 'var(--sell-bg)' }}>
          <p className={`${label}`} style={{ color: 'var(--sell)' }}>Retail</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--sell)' }}>{formatPrice(product.price)}</p>
        </div>
        <div className="px-4 py-3 bg-gray-50">
          <p className={`${label}`} style={{ color: 'var(--text-muted)' }}>Width/Qty</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.width || 'N/A'}</p>
        </div>
        <div className="px-4 py-3 bg-gray-50">
          <p className={`${label}`} style={{ color: 'var(--text-muted)' }}>Date</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.backing || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
