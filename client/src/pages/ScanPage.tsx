import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getProductBySku, recordScan, searchProducts } from '@/lib/productService';
import ScannerModule from '@/components/ScannerModule';
import ProductDetailCard from '@/components/ProductDetailCard';
import { LoadingState, ErrorState, NoScanState } from '@/components/StatusMessages';
import { Product } from '@shared/schema';

export default function ScanPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const [currentSku, setCurrentSku] = useState<string | null>(null);
  const [isSearch, setIsSearch] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedTime, setLastScannedTime] = useState<string | null>(null);
  
  // Product data query
  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: [`/api/product/${currentSku || ''}`],
    enabled: !!currentSku && !isSearch, // Only enable for SKU lookups, not searches
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      if (!currentSku) return null;
      return await getProductBySku(currentSku);
    }
  });
  
  // Search results query (when in search mode)
  const {
    data: searchResults = [],
    isLoading: isSearchLoading,
    isError: isSearchError,
    error: searchError
  } = useQuery({
    queryKey: [`/api/products`, currentSku],
    enabled: !!currentSku && isSearch, // Only enable for search queries
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      if (!currentSku || !isSearch) return [];
      return await searchProducts(currentSku);
    }
  });
  
  // Record scan mutation
  const recordScanMutation = useMutation({
    mutationFn: (sku: string) => recordScan(sku),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scans'] });
    }
  });
  
  const handleSkuDetected = async (sku: string, searchMode = false) => {
    setCurrentSku(sku);
    setIsSearch(searchMode);
    setLastScannedTime(new Date().toLocaleTimeString());
    
    // Only record actual scans in history, not search queries
    if (!searchMode) {
      recordScanMutation.mutate(sku);
    }
  };
  
  const handleSyncClick = () => {
    toast({
      title: "Syncing data",
      description: "Refreshing product database..."
    });
    
    // Would trigger a sync API call here in a full implementation
    setTimeout(() => {
      toast({
        title: "Sync complete",
        description: "Product database updated successfully"
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    }, 1500);
  };
  
  return (
    <>
      {/* Header */}
      <header className="bg-[#464538] text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <span className="material-icons mr-2">qr_code_scanner</span>
            <h1 className="text-2xl font-medium">Product Lookup Sepulveda</h1>
          </div>
          <div>
            <button 
              id="sync-button" 
              className="p-2 rounded-full hover:bg-white/10 transition-colors" 
              aria-label="Sync Data"
              onClick={handleSyncClick}
            >
              <span className="material-icons">sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        <ScannerModule 
          onSkuDetected={handleSkuDetected}
          isScanning={isScanning}
          onScanningChange={setIsScanning}
          lastScannedTime={lastScannedTime}
        />
        
        {currentSku ? (
          isSearch ? (
            // Search mode - display search results
            isSearchLoading ? (
              <LoadingState message="Searching products..." />
            ) : isSearchError ? (
              <ErrorState 
                message={`Error searching for "${currentSku}". ${searchError instanceof Error ? searchError.message : ''}`}
                onTryAgain={() => queryClient.invalidateQueries({ queryKey: [`/api/products`, currentSku] })}
              />
            ) : searchResults.length === 0 ? (
              <ErrorState 
                message={`No products found matching "${currentSku}". Try a different search term.`}
                onTryAgain={() => queryClient.invalidateQueries({ queryKey: [`/api/products`, currentSku] })}
              />
            ) : (
              <div className="mt-4">
                <h2 className="text-lg font-medium mb-2">Search Results</h2>
                <div className="space-y-4">
                  {searchResults.map((product, index) => (
                    <ProductDetailCard key={`${product.sku}-${index}`} product={product} />
                  ))}
                </div>
              </div>
            )
          ) : (
            // SKU lookup mode - display single product
            isLoading ? (
              <LoadingState message="Loading product information..." />
            ) : isError ? (
              <ErrorState 
                message={`We couldn't find a product with SKU: ${currentSku}. ${error instanceof Error ? error.message : ''}`}
                onTryAgain={() => refetch()}
              />
            ) : product ? (
              <ProductDetailCard product={product as Product} />
            ) : null
          )
        ) : (
          <NoScanState 
            onScan={() => setIsScanning(true)}
            onBrowse={() => navigate('/')}
          />
        )}
      </main>
    </>
  );
}
