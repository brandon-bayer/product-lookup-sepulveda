import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductBySku } from '@/lib/productService';
import { LoadingState } from '@/components/StatusMessages';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Product } from '@shared/schema';
import ProductDetailCard from '@/components/ProductDetailCard';
import { useAuth } from '@/hooks/use-auth';

export default function HistoryPage() {
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState(false);

  // Get authenticated user
  const { user } = useAuth();

  // Get scan history for the authenticated user
  const { 
    data: scans = [],
    isLoading: isLoadingScans,
  } = useQuery<Array<{ sku: string, timestamp: string }>>({
    queryKey: ['/api/scans'],
    // Only fetch when user is authenticated
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Get product details for selected scan
  const {
    data: selectedProduct,
    isLoading: isLoadingProduct,
    error: productError
  } = useQuery<Product | null>({
    queryKey: ['/api/product', selectedScan],
    enabled: !!selectedScan,
    queryFn: async () => {
      if (!selectedScan) throw new Error('No SKU selected');
      const product = await getProductBySku(selectedScan);
      return product;
    }
  });

  // Debug logging
  console.log('Selected SKU:', selectedScan);
  console.log('Product data:', selectedProduct);
  console.log('Product error:', productError);

  const formatDate = (isoDate: string) => {
    try {
      return format(new Date(isoDate), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return isoDate;
    }
  };

  if (isLoadingScans) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--app-bg)' }}>
        <header className="bg-[#988B73] mb-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-base font-semibold tracking-tight text-white">Product Catalog</h1>
            <span className="text-xs text-white/60 font-medium uppercase tracking-wider">History</span>
          </div>
        </header>
        <div className="container mx-auto px-4">
          <LoadingState message="Loading scan history..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <header className="bg-[#988B73]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight text-white">Product Catalog</h1>
          <span className="text-xs text-white/60 font-medium uppercase tracking-wider">History</span>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        {scans && Array.isArray(scans) && scans.length > 0 ? (
          viewingProduct && selectedScan ? (
            <div>
              <Button 
                variant="outline" 
                className="mb-4 flex items-center" 
                onClick={() => setViewingProduct(false)}
              >
                <span className="material-icons mr-1">arrow_back</span>
                Back to History
              </Button>

              {isLoadingProduct ? (
                <LoadingState message="Loading product details..." />
              ) : productError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center text-red-600 mb-2">
                    <span className="material-icons mr-2">error</span>
                    <h3 className="font-medium">Error Loading Product</h3>
                  </div>
                  <p className="text-red-700">The product could not be loaded. Please try again.</p>
                  <Button 
                    onClick={() => setViewingProduct(false)} 
                    className="mt-4 bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Return to History
                  </Button>
                </div>
              ) : selectedProduct ? (
                <ProductDetailCard product={selectedProduct as Product} />
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center text-orange-600 mb-2">
                    <span className="material-icons mr-2">warning</span>
                    <h3 className="font-medium">Product Not Found</h3>
                  </div>
                  <p className="text-orange-700">The product with SKU "?{selectedScan}" could not be found.</p>
                  <Button 
                    onClick={() => setViewingProduct(false)} 
                    className="mt-4 bg-orange-100 text-orange-700 hover:bg-orange-200"
                  >
                    Return to History
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              {/* List header */}
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recently Viewed</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {scans.map((scan: { sku: string, timestamp: string }, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setSelectedScan(scan.sku);
                      setViewingProduct(true);
                    }}
                  >
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-head)' }}>{scan.sku}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatDate(scan.timestamp)}</div>
                    </div>
                    <span className="material-icons text-gray-300 text-lg">chevron_right</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center text-center" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mb-4">
              <span className="material-icons text-gray-400 text-2xl">history</span>
            </div>
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-head)' }}>No History Yet</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Products you view will appear here.</p>
            <Button className="bg-[#988B73] hover:bg-[#887D67] text-white text-sm font-semibold" onClick={() => window.location.href = '/'}>
              Browse Products
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}