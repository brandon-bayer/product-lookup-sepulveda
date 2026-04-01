import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { recordScan } from '@/lib/productService';

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

export default function NewBrowsePage() {
  // State management
  const [searchInput, setSearchInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast notifications
  const { toast } = useToast();

  // Load products without useEffect or React Query
  const loadProducts = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products. Please try again later.');

      toast({
        title: 'Error',
        description: 'Failed to load products. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Reset search to show all products
  const handleResetSearch = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setIsSearching(false);
    setHasSearched(false);
    setError(null);

    try {
      await loadProducts();
      setSearchInput('');
    } catch (err) {
      console.error('Failed to reset products:', err);
      setError('Failed to reset products. Please try again later.');
      toast({
        title: 'Error',
        description: 'Failed to reset products. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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

    // Set loading state
    setIsLoading(true);
    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      console.log(`Making search request for query: ${query}`);
      // Direct API call with appropriate debugging
      const response = await fetch(`/api/products?q=${encodeURIComponent(query)}`);

      console.log(`Search response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const results = await response.json();
      console.log(`Search returned ${results.length} results for query "${query}"`);

      setProducts(results);

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
            const retryResponse = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
            if (retryResponse.ok) {
              const retryResults = await retryResponse.json();
              console.log(`Retry search returned ${retryResults.length} results`);
              setProducts(retryResults);
            }
          }
        } catch (refreshError) {
          console.error('Failed to refresh products:', refreshError);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again later.');
      toast({
        title: 'Search failed',
        description: 'Unable to complete search. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      <header className="bg-[#464538] text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col">
            <div className="flex items-center mb-1">
              <span className="material-icons mr-2">search</span>
              <h1 className="text-xl font-medium">Sepulveda Showroom</h1>
            </div>
            <p className="text-sm text-white/80 ml-8">Product Inventory Search</p>
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
                className="pl-10 pr-10"
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
              {/* Clear button (X) that appears when there's text */}
              {searchInput && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => {
                    setSearchInput('');
                    if (hasSearched) {
                      handleResetSearch();
                    }
                  }}
                  aria-label="Clear search"
                >
                  <span className="material-icons text-neutral-400 hover:text-neutral-700">close</span>
                </button>
              )}
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

        <div className="mb-4 flex justify-between items-center">
          <div>
            {!isLoading && products.length > 0 && (
              <p className="text-sm text-neutral-600">
                {products.length} {products.length === 1 ? 'product' : 'products'} found
              </p>
            )}
          </div>
          <div>
            {products.length === 0 && !isLoading && !error && !hasSearched && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadProducts}
                className="text-sm"
              >
                Load Products
              </Button>
            )}
          </div>
        </div>

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
        ) : error ? (
          <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-red-100 rounded-full mb-4">
              <span className="material-icons text-red-500 text-3xl">error</span>
            </div>
            <h3 className="font-medium mb-2">Error</h3>
            <p className="text-neutral-500 text-sm">{error}</p>
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
              {products.map((product, index) => (
                <div 
                  key={`product-${index}-${product.sku}`} 
                  className="p-4 hover:bg-neutral-100 transition-colors cursor-pointer"
                  onClick={() => {
                    // Record viewed product in history if SKU exists
                    if (product.sku) {
                      recordScan(product.sku).catch(error => {
                        console.error('Failed to record product view in history:', error);
                      });
                    }

                    // Could expand this to show a detailed view in the future
                    toast({
                      description: product.sku 
                        ? `Product details for ${product.sku} logged to history.`
                        : `Product details viewed.`,
                      duration: 2000,
                    });
                  }}
                >
                  {/* SKU at the top */}
                  <div className="mb-4">
                    <h3 className="font-medium text-base" style={{ color: 'rgb(12, 10, 9)' }}>
                      {product.sku ? product.sku : 'No SKU'}
                    </h3>
                  </div>

                  {/* First row: P Style and Style */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {/* Style Name → P Style */}
                    <div>
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>P. Style</p>
                      <p className="font-medium text-base">{product.styleName || "N/A"}</p>
                    </div>

                    {/* Style Number → Style */}
                    <div>
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Style</p>
                      <p className="font-medium text-base">{product.styleNumber || "N/A"}</p>
                    </div>
                  </div>

                  {/* Second row: P Color and Color */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {/* Color Name → P Color */}
                    <div>
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>P. Color</p>
                      <p className="font-medium text-base">{product.colorName || "N/A"}</p>
                    </div>

                    {/* Color Number → Color */}
                    <div>
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Color</p>
                      <p className="font-medium text-base">{product.colorNumber || "N/A"}</p>
                    </div>
                  </div>

                  {/* Third row: Manufacturer full width */}
                  <div className="mb-3">
                    <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Manufacturer</p>
                    <p className="font-medium text-base">{cleanManufacturer(product.manufacturer)}</p>
                  </div>

                  {/* Fourth row: Date, Width/Qty, Cost, Retail */}
                  <div className="flex justify-between items-start">
                    {/* Date (Backing) */}
                    <div className="flex-1">
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Date</p>
                      <p className="font-medium text-base">{product.backing || "N/A"}</p>
                    </div>

                    {/* Width/Qty */}
                    <div className="flex-1">
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Width/Qty</p>
                      <p className="font-medium text-base">{product.width || "N/A"}</p>
                    </div>

                    {/* Cost */}
                    <div className="flex-1">
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Cost</p>
                      <p className="font-medium text-base">{formatCost(product.cost)}</p>
                    </div>

                    {/* Retail */}
                    <div className="flex-1">
                      <p className="text-[#575757] font-medium" style={{ fontSize: '0.8rem', marginBottom: '0.05rem' }}>Retail</p>
                      <p className="font-medium text-base">{formatPrice(product.price)}</p>
                    </div>
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
                : "Click 'Load Products' to view product database."
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