import { useState, FormEvent, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { recordScan } from '@/lib/productService';
import { getToken } from '@/lib/queryClient';
import { format } from 'date-fns';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Toast notifications
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/data-files', { headers })
      .then(r => r.ok ? r.json() : null)
      .then((files: Array<{ name: string; size: number; date: string }> | null) => {
        if (!files || files.length === 0) return;
        const latest = files.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
        setLastUpdated(format(new Date(latest.date), 'MMM d, yyyy · h:mm a'));
      })
      .catch(() => {});
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Reset search
  const handleResetSearch = () => {
    setProducts([]);
    setSearchInput('');
    setIsSearching(false);
    setHasSearched(false);
    setError(null);
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
      const response = await fetch(`/api/products?q=${encodeURIComponent(query)}`, { headers: authHeaders() });

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
            method: 'POST',
            headers: authHeaders(),
          });

          if (refreshResponse.ok) {
            console.log('Products refreshed successfully');
            // Retry the search after refresh
            const retryResponse = await fetch(`/api/products?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
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
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <header className="bg-[#988B73]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">Product Catalog</h1>
            {lastUpdated && (
              <p className="text-[10px] text-white/55 mt-0.5">Updated {lastUpdated}</p>
            )}
          </div>
          <span className="text-xs text-white/50 font-medium">v2.0</span>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        {/* Search form */}
        <form onSubmit={handleSubmitSearch} className="mb-5">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="material-icons text-gray-300 text-lg">search</span>
              </span>
              <Input
                type="search"
                inputMode="search"
                placeholder="Search by SKU, style, color…"
                className="pl-9 pr-9 border-[#e2e5ea] rounded-md focus-visible:ring-[rgba(152,139,115,.2)] focus-visible:border-[#988B73]"
                style={{
                  fontSize: '16px',
                  WebkitAppearance: 'none',
                  height: '44px',
                  background: '#fff',
                  color: '#374151',
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
              {searchInput && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => {
                    setSearchInput('');
                    if (hasSearched) handleResetSearch();
                  }}
                  aria-label="Clear search"
                >
                  <span className="material-icons text-gray-300 hover:text-gray-500 text-lg">close</span>
                </button>
              )}
            </div>
            <Button
              type="submit"
              className="bg-[#988B73] hover:bg-[#887D67] text-white text-sm font-semibold px-5 rounded-md"
              style={{ height: '44px' }}
              disabled={isLoading}
            >
              Search
            </Button>
          </div>
        </form>

        {!isLoading && products.length > 0 && (
          <p className="text-sm text-neutral-600 mb-4">
            {products.length} {products.length === 1 ? 'product' : 'products'} found
          </p>
        )}

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
          <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center text-center" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
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
          <div className="flex flex-col gap-2">
            {products.map((product, index) => (
              <div
                key={`product-${index}-${product.sku}`}
                className="bg-white rounded-lg overflow-hidden cursor-pointer hover:brightness-[0.98] transition-all"
                style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
                onClick={() => {
                  if (product.sku) {
                    recordScan(product.sku)
                      .then(() => queryClient.invalidateQueries({ queryKey: ['/api/scans'] }))
                      .catch(err => console.error('Failed to record view:', err));
                  }
                  toast({
                    description: product.sku ? `${product.sku} logged to history.` : 'Product viewed.',
                    duration: 2000,
                  });
                }}
              >
                {/* Card header: SKU + Manufacturer */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-head)' }}>
                    {product.sku || 'No SKU'}
                  </span>
                  <span className="text-xs truncate ml-4 max-w-[50%] text-right" style={{ color: 'var(--text-muted)' }}>
                    {cleanManufacturer(product.manufacturer)}
                  </span>
                </div>

                {/* Fields: 2×2 grid */}
                <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>P. Style</p>
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-head)' }}>{product.styleName || 'N/A'}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Style</p>
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-head)' }}>{product.styleNumber || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>P. Color</p>
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-head)' }}>{product.colorName || 'N/A'}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Color</p>
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-head)' }}>{product.colorNumber || 'N/A'}</p>
                  </div>
                </div>

                {/* Footer: Cost, Retail, Width/Qty, Date */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                  <div className="px-3 py-2" style={{ background: 'var(--sell-bg)' }}>
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--sell)' }}>Cost</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--sell)' }}>{formatCost(product.cost)}</p>
                  </div>
                  <div className="px-3 py-2" style={{ background: 'var(--sell-bg)' }}>
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--sell)' }}>Retail</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--sell)' }}>{formatPrice(product.price)}</p>
                  </div>
                  <div className="px-3 py-2 bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Width/Qty</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.width || 'N/A'}</p>
                  </div>
                  <div className="px-3 py-2 bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Date</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>{product.backing || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center text-center" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mb-4">
              <span className="material-icons text-gray-400 text-2xl">search_off</span>
            </div>
            <h3 className="font-medium mb-2">No Products Found</h3>
            <p className="text-neutral-500 text-sm">No products matching "{searchInput}"</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleResetSearch}
            >
              Clear Search
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}