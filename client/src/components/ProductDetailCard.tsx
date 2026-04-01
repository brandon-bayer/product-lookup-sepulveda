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
  
  return (
    <div className="mb-6 bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-primary text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-medium flex items-center text-left">
          <span className="material-icons mr-2">inventory_2</span>
          Product Data
        </h2>
        {product.sku ? (
          <span className="text-sm bg-white/20 px-2 py-1 rounded">{product.sku}</span>
        ) : (
          <span className="text-sm bg-white/20 px-2 py-1 rounded">No SKU</span>
        )}
      </div>
      
      <div className="divide-y divide-neutral-200">
        {/* Main Product Info Section - with updated labels */}
        <div className="p-4">
          <div className="space-y-4">
            {/* Style Name → P Style */}
            <div>
              <p className="text-sm text-[#575757] font-medium mb-1">P Style</p>
              <p className="font-medium text-base">{product.styleName || 'N/A'}</p>
            </div>
            
            {/* Color Name → P Color */}
            <div>
              <p className="text-sm text-[#575757] font-medium mb-1">P Color</p>
              <p className="font-medium text-base">{product.colorName || 'N/A'}</p>
            </div>
            
            {/* Style Number → Style (Private Label Name) */}
            <div>
              <p className="text-sm text-[#575757] font-medium mb-1">Style</p>
              <p className="font-medium text-base">{product.styleNumber || 'N/A'}</p>
            </div>
            
            {/* Color Number → Color (Private Label Color) */}
            <div>
              <p className="text-sm text-[#575757] font-medium mb-1">Color</p>
              <p className="font-medium text-base">{product.colorNumber || 'N/A'}</p>
            </div>
            
            {/* Manufacturer → Manufacturer */}
            <div>
              <p className="text-sm text-[#575757] font-medium mb-1">Manufacturer</p>
              <p className="font-medium text-base">{cleanManufacturer}</p>
            </div>
            
            {/* Cost and Price */}
            <div className="grid grid-cols-2 gap-4">
              {/* Roll Costs → Cost */}
              <div>
                <p className="text-sm text-[#575757] font-medium mb-1">Cost</p>
                <p className="font-medium text-base">{formatCost(product.cost)}</p>
              </div>
              
              {/* Retail Price → Retail */}
              <div>
                <p className="text-sm text-[#575757] font-medium mb-1">Retail</p>
                <p className="font-medium text-base">{formatPrice(product.price)}</p>
              </div>
            </div>
            
            {/* Optional fields that may not be directly in our schema but are in the CSV */}
            <div className="grid grid-cols-2 gap-4">
              {/* Width/Quant-Carton → Width/Qty */}
              <div>
                <p className="text-sm text-[#575757] font-medium mb-1">Width/Qty</p>
                <p className="font-medium text-base">{product.width || 'N/A'}</p>
              </div>
              
              {/* Backing → Date */}
              <div>
                <p className="text-sm text-[#575757] font-medium mb-1">Date</p>
                <p className="font-medium text-base">{product.backing || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
