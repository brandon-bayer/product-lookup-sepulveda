import { Product } from "@shared/schema";
import { getToken } from "./queryClient";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getProductBySku(sku: string): Promise<Product | null> {
  try {
    const normalizedSku = sku.startsWith('?') ? sku.slice(1) : sku;

    const res = await fetch(`/api/product?sku=${encodeURIComponent(normalizedSku)}`, {
      headers: authHeaders(),
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error(`Error fetching product: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error(`Error fetching product with SKU "${sku}":`, error);
    return null;
  }
}

async function searchProducts(query: string): Promise<Product[]> {
  try {
    console.log(`Making search request for query: ${query}`);
    
    const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`, {
      headers: authHeaders()
    });
    
    console.log(`Search response status: ${res.status}`);
    
    if (!res.ok) {
      throw new Error(`Error searching products: ${res.statusText}`);
    }
    
    const products = await res.json();
    console.log(`Search returned ${products.length} results for query "${query}"`);
    
    return products;
  } catch (error) {
    console.error(`Error searching products with query "${query}":`, error);
    return [];
  }
}

async function recordScan(sku: string): Promise<void> {
  try {
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku }),
    });
    
    if (!res.ok) {
      throw new Error(`Error recording product view: ${res.statusText}`);
    }
  } catch (error) {
    console.error(`Error recording scan for SKU "${sku}":`, error);
  }
}

async function getProductHistory(): Promise<any[]> {
  try {
    const res = await fetch('/api/scans', {
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Error fetching product history: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error fetching product history:', error);
    return [];
  }
}

// Admin functions
async function refreshProducts(): Promise<{ message: string, count: number }> {
  try {
    const res = await fetch('/api/refresh-products', { 
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Error refreshing products: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error refreshing products:', error);
    throw error;
  }
}

async function clearProducts(): Promise<{ message: string }> {
  try {
    const res = await fetch('/api/clear-products', { 
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Error clearing products: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error clearing products:', error);
    throw error;
  }
}

async function listDataFiles(): Promise<{name: string, size: number, date: string}[]> {
  try {
    const res = await fetch('/api/data-files', {
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Error listing data files: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error listing data files:', error);
    return [];
  }
}

async function deleteDataFile(filename: string): Promise<{ message: string }> {
  try {
    const res = await fetch(`/api/data-files/${encodeURIComponent(filename)}`, { 
      method: 'DELETE',
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Error deleting file: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error(`Error deleting data file ${filename}:`, error);
    throw error;
  }
}

async function uploadProductsCSV(file: File): Promise<{
  message: string;
  productsCount: number;
  processed?: number;
  skipped?: number;
  totalFiles?: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch('/api/upload-products', {
      method: 'POST',
      body: formData,
      headers: authHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`Error uploading product data: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error uploading products:', error);
    throw error;
  }
}

// Export all functions
export {
  getProductBySku,
  searchProducts,
  recordScan,
  getProductHistory,
  refreshProducts,
  clearProducts,
  listDataFiles,
  deleteDataFile,
  uploadProductsCSV
};