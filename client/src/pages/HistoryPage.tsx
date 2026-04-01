import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProductBySku } from '@/lib/productService';
import { LoadingState } from '@/components/StatusMessages';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
      <div className="container mx-auto px-4 py-6">
        <header className="bg-[#464538] text-white shadow-md mb-6">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center">
              <span className="material-icons mr-2">history</span>
              <h1 className="text-2xl font-medium">History</h1>
            </div>
          </div>
        </header>
        <LoadingState message="Loading scan history..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-[#464538] text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col">
            <div className="flex items-center mb-1">
              <span className="material-icons mr-2">history</span>
              <h1 className="text-2xl font-medium">Sepulveda Showroom</h1>
            </div>
            <p className="text-sm text-white/80 ml-8">Search History</p>
          </div>
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
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <span className="material-icons mr-2 text-primary">history</span>
                    Recently Viewed Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-neutral-200">
                    {scans.map((scan: { sku: string, timestamp: string }, index: number) => (
                      <div 
                        key={index} 
                        className="p-3 flex justify-between items-center cursor-pointer hover:bg-neutral-100 transition-colors"
                        onClick={() => {
                          setSelectedScan(scan.sku);
                          setViewingProduct(true);
                        }}
                      >
                        <div>
                          <div className="font-medium">?{scan.sku}</div>
                          <div className="text-xs text-neutral-500">{formatDate(scan.timestamp)}</div>
                        </div>
                        <span className="material-icons text-neutral-500">chevron_right</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-primary/10 rounded-full mb-4">
              <span className="material-icons text-primary text-3xl">history</span>
            </div>
            <h3 className="font-medium mb-2">No History Found</h3>
            <p className="text-neutral-500 text-sm mb-6">Your history will appear here when you view products.</p>
            <Button className="bg-primary text-white" onClick={() => window.location.href = '/'}>
              Browse Products
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}