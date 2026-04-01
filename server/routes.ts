import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processZipFile } from './utils/zipProcessor';
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  // Configure multer for CSV file uploads
  const upload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
      },
      filename: function (req, file, cb) {
        // Create a unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    }),
    fileFilter: function (req, file, cb) {
      // Accept both CSV and ZIP files
      const filetypes = /csv|zip/;
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = file.mimetype === 'application/zip' || 
                       file.mimetype === 'application/x-zip-compressed' || 
                       file.mimetype === 'application/octet-stream' || 
                       file.mimetype === 'text/csv';
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only CSV or ZIP files are allowed'));
      }
    }
  });

  // API Routes
  app.get('/api/products', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.q as string;
      const limit = Number(req.query.limit) || 200;
      
      if (searchQuery && searchQuery.trim()) {
        // If we have a search query, use the optimized search endpoint
        const products = await storage.searchProducts(searchQuery, limit);
        res.json(products);
      } else {
        // If no search query, return latest products with limit
        const products = await storage.getAllProducts(limit);
        res.json(products);
      }
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch products: ${error.message}` });
    }
  });
  
  // Specific SKU lookup endpoint
  app.get('/api/product/:sku', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sku = req.params.sku;
      console.log(`Looking up product with SKU: ${sku}`);
      
      // Handle SKUs with question mark prefix
      const normalizedSku = sku.startsWith('?') ? sku.substring(1) : sku;
      
      const product = await storage.getProduct(normalizedSku);
      if (!product) {
        return res.status(404).json({ message: `Product with SKU ${sku} not found` });
      }
      
      res.json(product);
    } catch (error: any) {
      console.error('Product lookup error:', error);
      res.status(500).json({ message: `Failed to fetch product: ${error.message}` });
    }
  });

  app.get('/api/products/:query', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const query = req.params.query;
      console.log(`API search request for query: ${query}`);
      
      // This is always a search query now (specific product lookups use sku endpoint)
      const products = await storage.searchProducts(query);
      
      console.log(`Found ${products.length} products matching query: ${query}`);
      
      // Return array of products (even if empty)
      return res.json(products);
    } catch (error: any) {
      console.error('Search API error:', error);
      res.status(500).json({ message: `Failed to search products: ${error.message}` });
    }
  });

  // Scan recording endpoint for product view history
  app.post('/api/scans', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { sku } = req.body;
      
      if (!sku || typeof sku !== 'string') {
        return res.status(400).json({ message: 'Invalid SKU provided' });
      }
      
      // Get user ID from the authenticated session or fall back to undefined
      const userId = req.isAuthenticated() ? (req.user as any).id : undefined;
      
      // Record the product view in history with the authenticated user's ID
      const scan = await storage.recordScan({ 
        sku,
        userId
      });
      
      res.json(scan);
    } catch (error: any) {
      console.error('Failed to record product view:', error);
      res.status(500).json({ message: `Failed to record product view: ${error.message}` });
    }
  });

  // Get user's scan history - requires authentication
  app.get('/api/scans', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const scans = await storage.getScansByUser(userId);
      res.json(scans);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch scans: ${error.message}` });
    }
  });

  app.post('/api/refresh-products', isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.refreshProducts();
      
      // Get count of products after refresh
      const products = await storage.getAllProducts();
      
      res.json({ 
        message: 'Products refreshed successfully',
        count: products.length
      });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to refresh products: ${error.message}` });
    }
  });
  
  // Endpoint to clear all products before a large import
  app.post('/api/clear-products', isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.clearProducts();
      res.json({ message: 'All products cleared successfully' });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to clear products: ${error.message}` });
    }
  });
  
  // Endpoint to list data files
  app.get('/api/data-files', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const files = await storage.listDataFiles();
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to list data files: ${error.message}` });
    }
  });
  
  // Endpoint to delete a data file
  app.delete('/api/data-files/:filename', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      await storage.deleteDataFile(filename);
      res.json({ message: `File ${filename} deleted successfully` });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to delete file: ${error.message}` });
    }
  });

  // File upload endpoint for product data (handles both CSV and ZIP files)
  app.post('/api/upload-products', isAuthenticated, upload.single('products'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      
      // Check if this is a ZIP file
      if (fileExt === '.zip') {
        // Process the ZIP file
        const result = await processZipFile(req.file.path);
        
        // Return the processing results
        return res.json({
          message: 'ZIP file processed successfully',
          totalFiles: result.totalFiles,
          processed: result.processed,
          skipped: result.skipped,
          errors: result.errors,
          productsCount: (await storage.getAllProducts()).length
        });
      } else {
        // Process as a regular CSV file
        await storage.uploadProducts(req.file.path);
        
        // Clean up the temp file
        fs.unlinkSync(req.file.path);
        
        return res.json({ 
          message: 'Product data uploaded successfully',
          productsCount: (await storage.getAllProducts()).length
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: `Failed to upload product data: ${error.message}` });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
