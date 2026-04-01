import { useState, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Field mappings for display
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

export default function BrowsePage() {
  // State management
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Toast notifications
  const { toast } = useToast();
  
  // Query key for products
  const allProductsKey = '/api/products';
  const searchProductsKey = `/api/products?q=${encodeURIComponent(searchInput.trim())}`;
  
  // Get all products initially
  const {
    data: products = [] as Product[],
    isLoading,
    isError,
    error,
  } = useQuery<Product[]>({
    queryKey: [hasSearched && searchInput.trim() ? searchProductsKey : allProductsKey],
    enabled: true, // Always fetch on component mount
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };
  
  // Reset search to show all products
  const handleResetSearch = async () => {
    if (isLoading) return;
    
    setIsSearching(false);
    setHasSearched(false);
    setSearchInput('');
    
    queryClient.removeQueries({ queryKey: [searchProductsKey] });
    
    // Refetch all products if we don't have them
    if (!queryClient.getQueryData([allProductsKey])) {
      await queryClient.fetchQuery({
        queryKey: [allProductsKey]
      });
    }
  };
  
  // Handle search submission
  const handleSubmitSearch = async (e: FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return;
    
    // Trim search query
    const query = searchInput.trim();
    
    // If empty search, reset to all products
    if (query === '') {
      return handleResetSearch();
    }
    
    // Remove minimum length requirement
    // if (query.length < 3) {
    //   toast({
    //     title: 'Search too short',
    //     description: 'Please enter at least 3 characters to search.',
    //   });
    //   return;
    // }
    
    // Set search flags
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      console.log(`Making search request for query: ${query}`);
      
      // Use the search query key to trigger a new fetch
      await queryClient.fetchQuery({
        queryKey: [searchProductsKey],
        staleTime: 0, // Always fetch fresh data for searches
      });
      
      const results = queryClient.getQueryData<Product[]>([searchProductsKey]) || [];
      console.log(`Search returned ${results.length} results for query "${query}"`);
      
      if (results.length === 0) {
        // Try to refresh products if we get no results
        toast({
          title: 'No results found',
          description: `No products matching "${query}". Refreshing products...`,
        });
        
        // Attempt a product refresh to ensure database is up to date
        try {
          const refreshResponse = await fetch('/api/refresh-products', {
            method: 'POST'
          });
          
          if (refreshResponse.ok) {
            console.log('Products refreshed successfully');
            // Retry the search after refresh
            await queryClient.fetchQuery({
              queryKey: [searchProductsKey],
              staleTime: 0, // Always fetch fresh data for searches
            });
            
            const retryResults = queryClient.getQueryData<Product[]>([searchProductsKey]) || [];
            console.log(`Retry search returned ${retryResults.length} results`);
          }
        } catch (refreshError) {
          console.error('Failed to refresh products:', refreshError);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      toast({
        title: 'Search failed',
        description: 'Unable to complete search. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Format cost for display
  const formatCost = (cost: string | null | undefined): string => {
    if (!cost) return 'N/A';
    
    try {
      if (cost.startsWith('$')) return cost;
      const numCost = parseFloat(cost);
      return !isNaN(numCost) ? `$${numCost.toFixed(2)}` : cost;
    } catch (e) {
      return cost;
    }
  };
  
  // Format price for display
  const formatPrice = (price: string | null | undefined): string => {
    if (!price) return 'N/A';
    
    try {
      if (price.startsWith('$')) return price;
      return `$${price}`;
    } catch (e) {
      return price;
    }
  };
  
  // Clean manufacturer text by removing parentheses content
  const cleanManufacturer = (manufacturer: string | null | undefined): string => {
    if (!manufacturer) return 'N/A';
    return manufacturer.replace(/\s*\([^)]*\)\s*/g, '').trim();
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-primary text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            <span className="material-icons mr-2">search</span>
            <h1 className="text-xl font-medium">Sepulveda Showroom</h1>
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* Search form */}
        <form onSubmit={handleSubmitSearch} className="mb-6">
          <div className="flex">
            <div className="relative flex-grow">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-icons text-neutral-300">search</span>
              </span>
              <Input
                type="search"
                inputMode="search"
                placeholder="Search by SKU, style, color, etc."
                className="pl-10"
                style={{ 
                  fontSize: '16px',
                  WebkitAppearance: 'none',
                  height: '48px' // Taller input for better touch target
                }}
                enterKeyHint="search"
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                value={searchInput}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitSearch(e as unknown as FormEvent);
                  }
                }}
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="ml-2 bg-[#464538] hover:bg-[#3c3b30] h-12 px-6"
              disabled={isLoading}
            >
              Search
            </Button>
          </div>
        </form>
        
        {/* Search status indicators */}
        {isLoading ? (
          <div className="w-full flex justify-center items-center py-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-primary">
                {isSearching ? 'Searching...' : 'Loading products...'}
              </p>
            </div>
          </div>
        ) : isError ? (
          <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-red-100 rounded-full mb-4">
              <span className="material-icons text-red-500 text-3xl">error</span>
            </div>
            <h3 className="font-medium mb-2">Error</h3>
            <p className="text-neutral-500 text-sm">
              {error instanceof Error ? error.message : 'Failed to load products. Please try again later.'}
            </p>
            <Button
              variant="outline"
              className="mt-4" 
              onClick={handleResetSearch}
            >
              Try Again
            </Button>
          </div>
        ) : products.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="grid divide-y divide-neutral-200">
              {products.map((product: Product, index: number) => (
                <div key={`product-${index}-${product.sku || index}`} className="p-4 hover:bg-neutral-100 transition-colors">
                  {/* SKU=SKU at the top with price */}
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-primary">
                      {product.sku 
                        ? `SKU: ?${product.sku}` 
                        : 'SKU: No SKU'}
                    </h3>
                    <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                      Retail: {formatPrice(product.price)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    {/* Style Name = Style Name */}
                    <div>
                      <p className="text-xs text-[#575757]">Style Name</p>
                      <p className="text-sm">{product.styleName || "N/A"}</p>
                    </div>
                    
                    {/* Style Number = Private Label Name */}
                    <div>
                      <p className="text-xs text-[#575757]">Private Label Name</p>
                      <p className="text-sm">{product.styleNumber || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    {/* Color Name = Color */}
                    <div>
                      <p className="text-xs text-[#575757]">Color</p>
                      <p className="text-sm">{product.colorName || "N/A"}</p>
                    </div>
                    
                    {/* Color Number = Private Label Color */}
                    <div>
                      <p className="text-xs text-[#575757]">Private Label Color</p>
                      <p className="text-sm">{product.colorNumber || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-2">
                    {/* Manufacturing = Manufacturer */}
                    <div>
                      <p className="text-xs text-[#575757]">Manufacturer</p>
                      <p className="text-sm">{cleanManufacturer(product.manufacturer)}</p>
                    </div>
                    
                    {/* Roll Costs = Cost */}
                    <div>
                      <p className="text-xs text-[#575757]">Cost</p>
                      <p className="text-sm">{formatCost(product.cost)}</p>
                    </div>
                    
                    {/* Width/Quant-Carton = Width/Quantity */}
                    <div>
                      <p className="text-xs text-[#575757]">Width/Quantity</p>
                      <p className="text-sm">{product.width || "N/A"}</p>
                    </div>
                  </div>
                  
                  {/* Backing = Date (shows "N/A" if no data) */}
                  <div>
                    <p className="text-xs text-[#575757]">Date</p>
                    <p className="text-sm">{product.backing || "N/A"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-primary/10 rounded-full mb-4">
              <span className="material-icons text-primary text-3xl">search_off</span>
            </div>
            <h3 className="font-medium mb-2">No Products Found</h3>
            <p className="text-neutral-500 text-sm">
              {hasSearched
                ? `No products matching "${searchInput}"`
                : "No products available in the database."
              }
            </p>
            {hasSearched && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleResetSearch}
              >
                Show All Products
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
