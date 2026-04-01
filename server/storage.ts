import { 
  users, type User, type InsertUser, 
  products, type Product, type InsertProduct,
  scans, type Scan, type InsertScan
} from "@shared/schema";
import csvParser from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { eq, desc, sql } from 'drizzle-orm';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product related methods
  getProduct(sku: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  refreshProducts(): Promise<void>;
  uploadProducts(filePath: string): Promise<void>;
  clearProducts(): Promise<void>; // Add this method to clear all products from the database
  
  // File management methods
  listDataFiles(): Promise<{name: string, size: number, date: Date}[]>;
  deleteDataFile(filename: string): Promise<void>;
  
  // Scan history methods
  recordScan(scan: InsertScan): Promise<Scan>;
  getScansByUser(userId: number | undefined): Promise<Scan[]>;
}

export class DatabaseStorage implements IStorage {
  private colorToHex: Record<string, string>;
  private productsCsvPath: string;
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.productsCsvPath = path.join(this.dataDir, 'products.csv');
    
    this.colorToHex = {
      'Blue': '#0a4b8c',
      'White': '#ffffff',
      'Black': '#000000',
      'Gray': '#808080',
      'Beige': '#f5f5dc',
      'Tan': '#d2b48c',
      'Red': '#ff0000',
      'Navy': '#000080',
      'Green': '#008000',
      'Brown': '#a52a2a',
      'Purple': '#800080',
      'Pink': '#ffc0cb',
      'Indigo': '#4b0082',
      'Light Blue': '#add8e6',
      'Olive': '#808000',
      'Cream': '#fffdd0',
      'Burgundy': '#800020',
      'Charcoal': '#36454f'
    };
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize with sample products if no CSV files exist
    this.initializeProductsIfNeeded();
  }

  private async initializeProductsIfNeeded() {
    try {
      // Check if products exist in database
      const productCount = await db.select({ count: sql`count(*)` }).from(products);
      
      if (productCount.length === 0 || productCount[0].count === 0) {
        // Check if any CSV files exist in the data directory
        const dataFiles = fs.readdirSync(this.dataDir);
        const csvFiles = dataFiles.filter(file => file.toLowerCase().endsWith('.csv'));
        
        if (csvFiles.length > 0) {
          // Load from existing CSV files in data directory
          console.log(`Found ${csvFiles.length} CSV files in data directory, loading products...`);
          await this.loadProductsFromCsv();
        } else {
          // Copy sample CSV files from attached_assets if they exist
          console.log('No CSV files found in data directory, checking for attached assets...');
          
          // Look for CSV files in attached_assets directory
          const attachedDir = path.join(process.cwd(), 'attached_assets');
          if (fs.existsSync(attachedDir)) {
            const attachedFiles = fs.readdirSync(attachedDir);
            const attachedCsvFiles = attachedFiles.filter(file => file.toLowerCase().endsWith('.csv'));
            
            if (attachedCsvFiles.length > 0) {
              console.log(`Found ${attachedCsvFiles.length} CSV files in attached_assets, copying to data directory...`);
              
              // Copy CSV files to data directory
              for (const csvFile of attachedCsvFiles) {
                const sourcePath = path.join(attachedDir, csvFile);
                const targetPath = path.join(this.dataDir, csvFile);
                
                console.log(`Copying ${csvFile} to data directory...`);
                fs.copyFileSync(sourcePath, targetPath);
              }
              
              // Load products from the copied CSV files
              await this.loadProductsFromCsv();
            } else {
              console.log('No CSV files found in attached_assets, loading sample products...');
              await this.loadSampleProducts();
            }
          } else {
            console.log('No attached_assets directory found, loading sample products...');
            await this.loadSampleProducts();
          }
        }
      } else {
        console.log(`Database already contains ${productCount[0].count} products, skipping initialization.`);
      }
    } catch (error) {
      console.error("Failed to initialize products:", error);
      await this.loadSampleProducts();
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Product methods
  async getProduct(sku: string): Promise<Product | undefined> {
    await this.initializeProductsIfNeeded();
    
    // Remove question mark if present (since database SKUs don't have it)
    const normalizedSku = sku.startsWith('?') ? sku.substring(1) : sku;
    
    // First try exact match
    let [product] = await db.select().from(products).where(eq(products.sku, normalizedSku));
    
    // If not found, try case-insensitive match
    if (!product) {
      // Convert both the database SKU and input SKU to lowercase for comparison
      [product] = await db.select()
        .from(products)
        .where(sql`LOWER(${products.sku}) = LOWER(${normalizedSku})`);
    }
    
    return product;
  }
  
  async searchProducts(query: string, limit: number = 200): Promise<Product[]> {
    // Normalize query: remove '?' prefix and trim whitespace
    const trimmedQuery = (query.startsWith('?') ? query.substring(1) : query).trim();
    
    // Handle empty queries by returning most recent products
    if (!trimmedQuery) {
      return this.getAllProducts(limit);
    }
    
    console.log(`Searching products with query: "${trimmedQuery}"`);
    
    try {
      // Special case for "The Fixer"
      if (trimmedQuery.toLowerCase() === 'the fixer') {
        console.log('Special case search for "The Fixer"');
        const fixerResults = await db.select()
          .from(products)
          .where(sql`LOWER(${products.styleName}) ILIKE ${'%fixer%'}`)
          .limit(limit);
          
        if (fixerResults.length > 0) {
          console.log(`Found ${fixerResults.length} results for special case "The Fixer"`);
          return fixerResults;
        }
      }
      
      // Try exact SKU match first (highest priority)
      const exactSkuResults = await db.select()
        .from(products)
        .where(sql`${products.sku} = ${trimmedQuery}`)
        .limit(1);
      
      if (exactSkuResults.length > 0) {
        console.log(`Found exact SKU match for "${trimmedQuery}"`);
        return exactSkuResults;
      }
      
      // Try exact phrase match in any field
      const exactPhraseResults = await db.select()
        .from(products)
        .where(
          sql`
            LOWER(${products.styleName}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.styleNumber}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.colorName}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.colorNumber}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.manufacturer}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.sku}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'}
          `
        )
        .limit(limit);
      
      if (exactPhraseResults.length > 0) {
        console.log(`Found ${exactPhraseResults.length} results with exact phrase match`);
        return exactPhraseResults;
      }
      
      // For multi-word searches, we'll query each term separately and then combine the results
      const searchTerms = trimmedQuery.split(/\s+/).filter(term => term.length > 0);
      
      if (searchTerms.length > 1) {
        console.log(`Multi-word search with ${searchTerms.length} terms: ${searchTerms.join(', ')}`);
        
        // Get all products that might match any of our search terms
        let allMatchingProducts: Product[] = [];
        
        // For each search term, get matching products
        for (const term of searchTerms) {
          const termResults = await db.select()
            .from(products)
            .where(
              sql`
                LOWER(${products.styleName}) ILIKE ${'%' + term.toLowerCase() + '%'} OR
                LOWER(${products.styleNumber}) ILIKE ${'%' + term.toLowerCase() + '%'} OR
                LOWER(${products.colorName}) ILIKE ${'%' + term.toLowerCase() + '%'} OR
                LOWER(${products.colorNumber}) ILIKE ${'%' + term.toLowerCase() + '%'} OR
                LOWER(${products.manufacturer}) ILIKE ${'%' + term.toLowerCase() + '%'} OR
                LOWER(${products.sku}) ILIKE ${'%' + term.toLowerCase() + '%'}
              `
            )
            .limit(500); // Set a higher limit for individual terms
          
          allMatchingProducts = [...allMatchingProducts, ...termResults];
        }
        
        // Create a map to deduplicate products (by id)
        const productsMap = new Map<number, Product>();
        allMatchingProducts.forEach(product => {
          productsMap.set(product.id, product);
        });
        
        // Convert back to array
        const uniqueProducts = Array.from(productsMap.values());
        
        // If we found any products, return them
        if (uniqueProducts.length > 0) {
          console.log(`Found ${uniqueProducts.length} products matching at least one search term`);
          
          // Sort by relevance (how many search terms match the product)
          const productsByRelevance = uniqueProducts.map(product => {
            let matchCount = 0;
            const allFields = [
              product.styleName.toLowerCase(),
              product.styleNumber.toLowerCase(),
              product.colorName.toLowerCase(),
              product.colorNumber.toLowerCase(),
              product.manufacturer.toLowerCase(),
              product.sku?.toLowerCase() || ''
            ].join(' ');
            
            // Count how many search terms are found in the product
            for (const term of searchTerms) {
              if (allFields.includes(term.toLowerCase())) {
                matchCount++;
              }
            }
            
            return { product, matchCount };
          })
          .sort((a, b) => b.matchCount - a.matchCount) // Sort by match count (descending)
          .map(item => item.product);  // Extract just the product
          
          // Return sorted products limited to requested limit
          return productsByRelevance.slice(0, limit);
        }
      }
      
      // As a last resort, try a partial match on any field with the full query
      const fallbackResults = await db.select()
        .from(products)
        .where(
          sql`
            LOWER(${products.styleName}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.styleNumber}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.colorName}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.colorNumber}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.manufacturer}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'} OR
            LOWER(${products.sku}) ILIKE ${'%' + trimmedQuery.toLowerCase() + '%'}
          `
        )
        .limit(limit);
      
      console.log(`Found ${fallbackResults.length} results with fallback search`);
      return fallbackResults;
    } catch (error) {
      console.error('Error in product search:', error);
      return []; // Return empty array on error
    }
  }
  
  async getAllProducts(limit: number = 200): Promise<Product[]> {
    return await db.select()
      .from(products)
      .limit(limit)
      .orderBy(desc(products.id));
  }
  
  async refreshProducts(): Promise<void> {
    try {
      console.log('Refreshing products from all CSV files in the data directory...');
      
      // First, clear all existing products to start fresh
      await this.clearProducts();
      console.log('Cleared existing products to start fresh import');
      
      // Get all CSV files in the data directory
      const dataFiles = fs.readdirSync(this.dataDir);
      
      // Only process CSV files (ignore sample/backup files)
      const csvFiles = dataFiles.filter(file => 
        file.toLowerCase().endsWith('.csv')
      );
      
      console.log(`Found ${csvFiles.length} CSV files to process in data directory`);
      
      // Create a temporary map of all products for deduplication
      let uniqueProducts = new Map<string, InsertProduct>();
      let totalFilesProcessed = 0;
      let totalProductsLoaded = 0;
      let errorCount = 0;
      
      // Process each CSV file
      for (const csvFile of csvFiles) {
        try {
          const filePath = path.join(this.dataDir, csvFile);
          console.log(`Processing CSV file: ${csvFile}`);
          
          // Try to use default processing for all files
          const fileProducts = await this.processDefaultCsvFile(filePath);
          
          // If we got products, add them to the uniqueProducts map
          if (fileProducts.length > 0) {
            console.log(`Processed ${fileProducts.length} products from ${csvFile}`);
            totalFilesProcessed++;
            
            // Add products to the uniqueProducts map
            for (const product of fileProducts) {
              if (product.sku && product.sku.trim() !== '') {
                uniqueProducts.set(product.sku, product);
              } else if (product.styleName && product.manufacturer) {
                // Generate a temporary key for products without SKU
                const tempKey = `${product.manufacturer}-${product.styleNumber}-${product.colorName}`;
                uniqueProducts.set(tempKey, product);
              }
            }
          } else {
            console.warn(`No valid products extracted from ${csvFile}`);
          }
          
          // If we have a lot of products, insert them in batches to avoid memory issues
          if (uniqueProducts.size > 5000) {
            console.log(`Inserting batch of ${uniqueProducts.size} products...`);
            const products = Array.from(uniqueProducts.values());
            await this.insertProductBatch(products);
            totalProductsLoaded += products.length;
            uniqueProducts.clear(); // Clear the map after insertion
          }
        } catch (error) {
          console.error(`Error processing file ${csvFile}:`, error);
          errorCount++;
          // Continue with next file even if there's an error
        }
      }
      
      // Insert any remaining products
      if (uniqueProducts.size > 0) {
        console.log(`Inserting final batch of ${uniqueProducts.size} products...`);
        const products = Array.from(uniqueProducts.values());
        await this.insertProductBatch(products);
        totalProductsLoaded += products.length;
      }
      
      console.log(`Product refresh completed successfully. Processed ${totalFilesProcessed} files, loaded ${totalProductsLoaded} products, encountered ${errorCount} errors.`);
    } catch (error) {
      console.error("Failed to refresh products:", error);
      throw error;
    }
  }
  
  async uploadProducts(filePath: string): Promise<void> {
    try {
      // Get original file name from path
      const fileName = path.basename(filePath);
      
      // Determine a suitable destination name to avoid overwrites
      const destFileName = this.getUniqueFileName(fileName);
      const targetPath = path.join(this.dataDir, destFileName);
      
      console.log(`Uploading product file ${fileName} to ${targetPath}`);
      
      // Copy the uploaded file to the data directory with the unique name
      fs.copyFileSync(filePath, targetPath);
      
      // Reload products from all CSV files
      await this.refreshProducts();
    } catch (error) {
      console.error("Error uploading products:", error);
      throw error;
    }
  }
  
  /**
   * Generate a unique filename to avoid overwriting existing files
   */
  private getUniqueFileName(originalName: string): string {
    // Check if file exists
    const baseName = path.basename(originalName, path.extname(originalName));
    const extension = path.extname(originalName);
    let newFileName = originalName;
    let counter = 1;
    
    while (fs.existsSync(path.join(this.dataDir, newFileName))) {
      // File exists, create a new name with counter
      newFileName = `${baseName}_${counter}${extension}`;
      counter++;
    }
    
    return newFileName;
  }
  
  /**
   * Clear all products from the database
   * This is used before bulk imports to ensure a clean state
   */
  async clearProducts(): Promise<void> {
    try {
      console.log('Clearing all products from database...');
      await db.delete(products);
      console.log('All products cleared successfully');
    } catch (error) {
      console.error('Error clearing products:', error);
      throw error;
    }
  }
  
  private async loadProductsFromCsv(): Promise<void> {
    try {
      // Get all CSV files in the data directory
      const files = fs.readdirSync(this.dataDir);
      const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));
      
      console.log(`Found ${csvFiles.length} CSV files in the data directory`);
      
      if (csvFiles.length === 0) {
        console.warn('No product CSV files found');
        throw new Error('No product CSV files found');
      }
      
      // Clear existing products first
      await db.delete(products);
      
      // Map to store unique products to avoid duplicates
      const uniqueProducts = new Map<string, InsertProduct>();
      const invalidSkus = ['WOO', 'EA', 'SF'];
      let totalProductsLoaded = 0;
      
      // Process each CSV file
      for (const csvFile of csvFiles) {
        const filePath = path.join(this.dataDir, csvFile);
        console.log(`Processing file: ${csvFile}`);
        
        try {
          // Determine the type of file based on name or content
          const fileName = csvFile.toLowerCase();
          let fileProducts: InsertProduct[] = [];
          
          if (fileName.includes('stanton') || csvFile === 'stanton_products.csv') {
            fileProducts = await this.processStantonCsvFile(filePath);
            console.log(`Added ${fileProducts.length} Stanton products from ${csvFile}`);
          } 
          else if (fileName.includes('allwood') || csvFile === 'allwood_products.csv') {
            fileProducts = await this.processAllwoodCsvFile(filePath);
            console.log(`Added ${fileProducts.length} Allwood products from ${csvFile}`);
          }
          else if (fileName.includes('villagio') || csvFile === 'villagio_products.csv') {
            fileProducts = await this.processVillagioCsvFile(filePath);
            console.log(`Added ${fileProducts.length} Villagio products from ${csvFile}`);
          }
          else {
            // For other files, try to detect the format from content
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const firstLine = fileContent.split('\n')[0].toLowerCase();
            
            if (firstLine.includes('stanton') || firstLine.includes('s1800')) {
              fileProducts = await this.processStantonCsvFile(filePath);
              console.log(`Detected and added ${fileProducts.length} Stanton products from ${csvFile}`);
            }
            else if (firstLine.includes('allwood') || firstLine.includes('a140')) {
              fileProducts = await this.processAllwoodCsvFile(filePath);
              console.log(`Detected and added ${fileProducts.length} Allwood products from ${csvFile}`);
            }
            else if (firstLine.includes('villagio') || firstLine.includes('v2109')) {
              fileProducts = await this.processVillagioCsvFile(filePath);
              console.log(`Detected and added ${fileProducts.length} Villagio products from ${csvFile}`);
            }
            else {
              // Default processing for unknown formats
              fileProducts = await this.processDefaultCsvFile(filePath);
              console.log(`Processed ${fileProducts.length} products from ${csvFile} using default format`);
            }
          }
          
          // Add products to the uniqueProducts map, filtering out invalid SKUs
          for (const product of fileProducts) {
            // Skip products with known invalid SKUs if SKU is defined
            if (product.sku && invalidSkus.includes(product.sku)) {
              console.log(`Skipping product with invalid SKU: ${product.sku}`);
              continue;
            }
            
            // For products with SKU, use it as key
            if (product.sku && product.sku.trim() !== '') {
              uniqueProducts.set(product.sku, product);
            } 
            // For products without SKU, use a composite key from other fields
            else if (product.manufacturer && (product.styleName || product.styleNumber || product.colorName)) {
              // Create a more robust composite key with all available identifiers
              const tempKey = `${product.manufacturer}-${product.styleNumber || ''}-${product.styleName || ''}-${product.colorName || ''}-${product.colorNumber || ''}`;
              uniqueProducts.set(tempKey, product);
            }
          }
          
          // Insert products in batches after each file to avoid stack overflow
          if (uniqueProducts.size >= 1000) {
            console.log(`Inserting batch of ${uniqueProducts.size} products...`);
            const batchProducts = Array.from(uniqueProducts.values());
            await this.insertProductBatch(batchProducts);
            totalProductsLoaded += batchProducts.length;
            uniqueProducts.clear(); // Clear the map for the next batch
          }
          
        } catch (error) {
          console.error(`Error processing file ${csvFile}:`, error);
          // Continue with next file even if there's an error
        }
      }
      
      // Insert any remaining products
      if (uniqueProducts.size > 0) {
        console.log(`Inserting final batch of ${uniqueProducts.size} products...`);
        const remainingProducts = Array.from(uniqueProducts.values());
        await this.insertProductBatch(remainingProducts);
        totalProductsLoaded += remainingProducts.length;
      }
      
      console.log(`Loaded ${totalProductsLoaded} total products from CSV files`);
    } catch (error) {
      console.error('Error processing CSV data:', error);
      throw error;
    }
  }
  
  /**
   * Insert products in batches to avoid stack overflow errors
   */
  private async insertProductBatch(productBatch: InsertProduct[]): Promise<void> {
    try {
      const BATCH_SIZE = 500; // Adjust this based on performance testing
      
      for (let i = 0; i < productBatch.length; i += BATCH_SIZE) {
        const batch = productBatch.slice(i, i + BATCH_SIZE);
        await db.insert(products).values(batch);
        console.log(`Inserted batch of ${batch.length} products (${i+batch.length}/${productBatch.length})`);
      }
    } catch (error) {
      console.error('Error inserting product batch:', error);
      throw error;
    }
  }
  
  private processStantonCsvFile(filePath: string): Promise<InsertProduct[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const validProducts: InsertProduct[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          try {
            for (const row of results) {
              // Process all rows, even those without SKU
              
              // Debug the row to see what columns are available
              console.log('Processing Stanton row:', JSON.stringify(row));
              
              // Remove mill code from manufacturer (text in parentheses)
              let manufacturerName = row['Manufacturer'] || '';
              manufacturerName = manufacturerName.replace(/\s*\([^)]*\)\s*/g, '').trim();
              
              const productData: InsertProduct = {
                sku: row.SKU || row.sku || '',
                styleName: row['Style Name'] || '',
                styleNumber: row['Style Number'] || '',
                colorName: row['Color Name'] || '',
                colorNumber: row['Color Number'] || '',
                cost: row['Roll Costs'] || '0.00',
                price: row['Retail Price'] ? 
                  (row['Retail Price'].toString().startsWith('$') ? row['Retail Price'].toString() : `$${row['Retail Price']}`) : 
                  '$0.00',
                manufacturer: manufacturerName || 'STANTON',
                width: row['Width/Quant-Carton'] || row['Width'] || '',
                backing: row['Backing'] || ''
              };
              
              // Add all products, including those without SKUs
              validProducts.push(productData);
            }
            
            console.log(`Processed ${validProducts.length} Stanton products`);
            resolve(validProducts);
          } catch (error) {
            console.error('Error processing Stanton CSV data:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading Stanton CSV file:', error);
          reject(error);
        });
    });
  }
  
  private processAllwoodCsvFile(filePath: string): Promise<InsertProduct[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const validProducts: InsertProduct[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          try {
            for (const row of results) {
              // Process all rows, even those without SKU
              
              // Debug row to see what columns are available
              console.log('Processing Allwood row:', JSON.stringify(row));
              
              // Remove mill code from manufacturer (text in parentheses)
              let manufacturerName = row['Manufacturer'] || '';
              manufacturerName = manufacturerName.replace(/\s*\([^)]*\)\s*/g, '').trim();
              
              const productData: InsertProduct = {
                sku: row.SKU || row.sku || '',
                styleName: row['Style Name'] || '',
                styleNumber: row['Style Number'] || '',
                // Allwood uses 'Color' instead of 'Color Name'
                colorName: row['Color Name'] || row['Color'] || '',
                colorNumber: row['Color Number'] || '',
                // Allwood uses 'Roll' or 'Roll Cost' for costs
                cost: row['Roll'] || row['Roll Cost'] || row['Cut'] || '0.00',
                // Allwood uses 'Retail' for price 
                price: row['Retail'] ? 
                  (row['Retail'].toString().startsWith('$') ? row['Retail'].toString() : `$${row['Retail']}`) : 
                  '$0.00',
                manufacturer: manufacturerName || 'ALLWOOD',
                width: row['Width/Quant-Carton'] || row['Width'] || '',
                backing: row['Backing'] || ''
              };
              
              // Add all products, including those without SKUs
              validProducts.push(productData);
            }
            
            console.log(`Processed ${validProducts.length} Allwood products`);
            resolve(validProducts);
          } catch (error) {
            console.error('Error processing Allwood CSV data:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading Allwood CSV file:', error);
          reject(error);
        });
    });
  }
  
  private processVillagioCsvFile(filePath: string): Promise<InsertProduct[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const validProducts: InsertProduct[] = [];
      let manufacturerValue = 'VILLAGIO'; // Default manufacturer if not found in file
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => {
          // Store the data row for processing
          results.push(data);
          
          // If the row has a manufacturer value, capture it for later rows
          if (data['Manufacturer'] && data['Manufacturer'].trim() !== '') {
            // Remove mill code from manufacturer (text in parentheses)
            let manufacturerName = data['Manufacturer'];
            manufacturerName = manufacturerName.replace(/\s*\([^)]*\)\s*/g, '').trim();
            if (manufacturerName) {
              manufacturerValue = manufacturerName;
            }
          }
        })
        .on('end', () => {
          try {
            // Skip the first row if it starts with ~~ (it's a header row)
            const startIndex = results.length > 0 && JSON.stringify(results[0]).includes('~~') ? 1 : 0;
            
            // Process each row
            for (let i = startIndex; i < results.length; i++) {
              const row = results[i];
              
              // Debug row to see what columns are available
              console.log('Processing Villagio row:', JSON.stringify(row));
              
              // Extract SKU and do additional validation
              let sku = row['SKU'] || row.sku || '';
              
              // Skip rows with invalid SKUs like "WOO" (product type) only if they have a SKU
              if (sku && (sku === 'WOO' || sku.length < 3)) {
                console.log(`Skipping row with invalid SKU: "${sku}"`);
                continue;
              }
              
              // For rows with SKUs, check if it looks like a valid Villagio SKU
              if (sku && sku.trim() !== '' && !sku.includes('V2109')) {
                console.log(`Adding non-standard SKU: "${sku}"`);
              }
              
              // Skip rows where product type is used as SKU (common in Villagio CSV)
              const productType = row['Product Type'] || '';
              if (sku === productType) {
                console.log(`Skipping row where SKU equals Product Type: "${sku}"`);
                continue;
              }
              
              // Clean numeric values that may have spaces
              const cleanNumericValue = (val: string) => {
                if (!val) return '0.00';
                return val.toString().trim().replace(/\s+/g, '');
              };
              
              const retailPrice = row['Retail Price'] || row['Retail'];
              let formattedPrice = '$0.00';
              if (retailPrice) {
                const price = cleanNumericValue(retailPrice);
                formattedPrice = price.startsWith('$') ? price : `$${price}`;
              }
              
              const productData: InsertProduct = {
                sku: sku,
                styleName: row['Style Name'] || '',
                styleNumber: row['Style Number'] || '',
                colorName: row['Color Name'] || row['Color'] || '',
                colorNumber: row['Color Number'] || '',
                cost: cleanNumericValue(row['Roll Costs'] || row['Cut Costs'] || row['Roll'] || row['Cut'] || '0.00'),
                price: formattedPrice,
                manufacturer: manufacturerValue,
                width: row['Width/Quant-Carton'] || '',
                backing: row['Backing'] || ''
              };
              
              console.log(`Found valid Villagio product with SKU: ${productData.sku}`);
              validProducts.push(productData);
            }
            
            console.log(`Processed ${validProducts.length} Villagio products`);
            resolve(validProducts);
          } catch (error) {
            console.error('Error processing Villagio CSV data:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading Villagio CSV file:', error);
          reject(error);
        });
    });
  }
  
  /**
   * Helper function to find field names across different CSV formats
   * @param row CSV row data
   * @param possibleNames Array of possible field names
   * @returns Found field name or undefined
   */
  private findFieldByNames(row: any, possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      if (row.hasOwnProperty(name)) {
        return name;
      }
    }
    return undefined;
  }
  
  private processDefaultCsvFile(filePath: string): Promise<InsertProduct[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const validProducts: InsertProduct[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser({ 
          skipLines: 0,
          headers: undefined // Let the parser try to auto-detect
        }))
        .on('data', (data) => {
          // Skip empty records
          if (data && Object.keys(data).length > 1) {
            results.push(data);
          }
        })
        .on('end', () => {
          try {
            // Try to determine the manufacturer from the file name
            const fileName = path.basename(filePath);
            let defaultManufacturer = 'UNKNOWN';
            
            // Determine manufacturer using multiple methods
            
            // Method 1: Extract from filename pattern like 'ManufacturerName_date.csv'
            let nameMatch = fileName.split('_')[0];
            
            // Clean up manufacturer name (remove numbers, file extensions, etc.)
            if (nameMatch) {
              // Convert to uppercase for consistency
              defaultManufacturer = nameMatch.replace(/\d+/g, '').replace(/\.csv$/i, '').trim().toUpperCase();
            }
            
            // Method 2: Check for manufacturer name in file contents
            // Read first few lines of file for potential manufacturer information
            if (results.length > 0) {
              // Check first row for manufacturer info
              const firstRow = results[0];
              let possibleManufacturerField = this.findFieldByNames(firstRow, ['Manufacturer', 'manufacturer', 'Company', 'company', 'Brand', 'Supplier', 'Vendor', 'Mill', 'Source']);
              
              if (possibleManufacturerField && firstRow[possibleManufacturerField]) {
                const mfrFromFile = firstRow[possibleManufacturerField].toString().trim();
                if (mfrFromFile.length > 0) {
                  defaultManufacturer = mfrFromFile.toUpperCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
                }
              }
            }
            
            // Method 3: Look for company name in file path
            const filePath1 = filePath.toUpperCase();
            if (filePath1.includes('STANTON')) {
              defaultManufacturer = 'STANTON';
            } else if (filePath1.includes('ALLWOOD')) {
              defaultManufacturer = 'ALLWOOD';
            } else if (filePath1.includes('VILLAGIO')) {
              defaultManufacturer = 'VILLAGIO';
            }
            
            // Standardize common manufacturer names/abbreviations
            const manufacturerMap: Record<string, string> = {
              'STANTON': 'STANTON',
              'ALLWOOD': 'ALLWOOD',
              'VILLAGIO': 'VILLAGIO',
              'AHF': 'ARMSTRONG',
              'ATS': 'ATLAS',
              'BW': 'BROADWAY',
              'AITA': 'AITA',
              'AAMARCO': 'AMARCO',
              'APCARPET': 'APC',
              'AFCARPET': 'AMERICAN FIBER',
              'ANDERSONMOULDING': 'ANDERSON',
              'ANDERSONPLYWOOD': 'ANDERSON',
              'ANDERSONTUFTEX': 'TUFTEX',
              'ACTIVARUBBER': 'ACTIVA',
              'AMERICANWINDOW': 'AMERICAN WINDOW',
              'AITAWINDOW': 'AITA WINDOW',
              'AMAZONWOOD': 'AMAZON WOOD',
              'ARTISTICFINISH': 'ARTISTIC FINISH',
              'ARTISTRYHARDWOOD': 'ARTISTRY HARDWOOD',
              'CARLOSDRAPERY': 'CARLOS DRAPERY',
              'BESTFABRIC': 'BEST FABRIC'
            };
            
            // Check if we have a mapping for this manufacturer
            for (const [abbr, fullName] of Object.entries(manufacturerMap)) {
              if (defaultManufacturer.includes(abbr)) {
                defaultManufacturer = fullName;
                break;
              }
            }
            
            // Skip empty result sets
            if (results.length === 0) {
              console.log(`No data found in file: ${fileName}`);
              return resolve([]);
            }
            
            // Sample the first few rows to determine field names
            const sampleSize = Math.min(results.length, 5);
            const sampleRows = results.slice(0, sampleSize);
            
            // Collect all possible field names from the sample
            let fieldNames = new Set<string>();
            for (const row of sampleRows) {
              Object.keys(row).forEach(key => fieldNames.add(key));
            }
            
            console.log(`Found ${fieldNames.size} unique fields in the CSV file: ${fileName}`);
            
            // Expanded list of possible field names for better matching
            const skuFieldNames = ['SKU', 'sku', 'Sku', 'Item', 'item', 'Item Number', 'item_number', 'Product ID', 'product_id', 'Product Code', 'Code', 'Style ID', 'Pattern ID', 'Item #', 'Item No', 'Product SKU', 'Part Number', 'part number', 'part_number', 'ID'];
            const styleNameFieldNames = ['Style Name', 'Style_Name', 'style name', 'style_name', 'Product Name', 'product_name', 'Name', 'Product', 'Description', 'Style Description', 'Pattern Name', 'Item Name', 'Item Description', 'Product Description', 'Name/Description', 'Desc'];
            const styleNumberFieldNames = ['Style Number', 'Style_Number', 'style number', 'style_number', 'Style#', 'Style ID', 'Pattern', 'Pattern Number', 'Item Number', 'Product Number', 'Item Style', 'Style', 'Style No', 'Pattern ID', 'Pattern Code'];
            const colorNameFieldNames = ['Color Name', 'Color_Name', 'color name', 'color_name', 'Color', 'Colour', 'Color Description', 'ColorName', 'Color Description', 'Color Desc', 'Colour Name', 'Color Name/Description'];
            const colorNumberFieldNames = ['Color Number', 'Color_Number', 'color number', 'color_number', 'Color#', 'Color No', 'Color Code', 'Color ID', 'Dye Lot', 'Color No.', 'Colour Number', 'Color #', 'ColorNo'];
            const costFieldNames = ['Cost', 'cost', 'Wholesale', 'wholesale', 'Wholesale Price', 'Roll Cost', 'roll cost', 'Roll', 'Cut', 'Dealer Cost', 'Dealer Price', 'Net Price', 'FOB', 'Roll Costs', 'Cost Price', 'Your Cost', 'Your Price', 'NET', 'Cost Per Roll', 'Cost/Roll', 'Cost Per Unit'];
            const priceFieldNames = ['Price', 'price', 'Retail', 'retail', 'Retail Price', 'retail price', 'MSRP', 'List Price', 'Suggested Retail', 'SRP', 'Retail Per Unit', 'Retail/Roll', 'Retail Per Roll', 'List', 'Customer Price', 'Sale Price'];
            const manufacturerFieldNames = ['Manufacturer', 'manufacturer', 'Company', 'company', 'Brand', 'Supplier', 'Vendor', 'Mill', 'Source', 'Manufacturer Name', 'Mfr', 'Maker', 'Producer'];
            const widthFieldNames = ['Width', 'width', 'Size', 'Dimensions', 'Roll Width', 'Width/Quant-Carton', 'Product Width', 'Item Width', 'Size Width', 'Width (In.)', 'Width Inches'];
            const backingFieldNames = ['Backing', 'backing', 'Back', 'back', 'Date', 'Backing Material', 'Base', 'Date Code', 'Production Date', 'Backing Type', 'Material'];
            
            for (const row of results) {
              // Skip rows without identifiable data
              if (Object.keys(row).length < 2) continue;
              
              // Find field names for each data point 
              const skuField = this.findFieldByNames(row, skuFieldNames);
              let sku = '';
              
              // Get the other fields regardless of whether we have a SKU
              const styleNameField = this.findFieldByNames(row, styleNameFieldNames);
              const styleNumberField = this.findFieldByNames(row, styleNumberFieldNames);
              const colorNameField = this.findFieldByNames(row, colorNameFieldNames);
              const colorNumberField = this.findFieldByNames(row, colorNumberFieldNames);
              const costField = this.findFieldByNames(row, costFieldNames);
              const priceField = this.findFieldByNames(row, priceFieldNames);
              const manufacturerField = this.findFieldByNames(row, manufacturerFieldNames);
              const widthField = this.findFieldByNames(row, widthFieldNames);
              const backingField = this.findFieldByNames(row, backingFieldNames);
              
              // Extract and clean manufacturer name from the row
              let manufacturerName = '';
              if (manufacturerField && row[manufacturerField]) {
                // Remove mill code from manufacturer (text in parentheses)
                manufacturerName = row[manufacturerField].toString()
                  .replace(/\s*\([^)]*\)\s*/g, '')  // Remove anything in parentheses
                  .trim()
                  .toUpperCase();  // Convert to uppercase for consistency
              }
              
              // If no manufacturer in the row, check if we can infer it from the SKU
              if ((!manufacturerName || manufacturerName === '') && skuField && typeof row[skuField] !== 'undefined' && row[skuField] !== null) {
                const skuValue = row[skuField].toString().toUpperCase();
                
                // Check for manufacturer prefixes in SKU
                if (skuValue.startsWith('S1800') || skuValue.startsWith('LS1800') || skuValue.includes('STANT')) {
                  manufacturerName = 'STANTON';
                } else if (skuValue.startsWith('A140') || skuValue.includes('ALLW')) {
                  manufacturerName = 'ALLWOOD';
                } else if (skuValue.includes('V2109') || skuValue.includes('VILLA')) {
                  manufacturerName = 'VILLAGIO';
                } else if (skuValue.startsWith('ATS') || skuValue.includes('ATLAS')) {
                  manufacturerName = 'ATLAS';
                } else if (skuValue.startsWith('TUF') || skuValue.includes('TUFTX')) {
                  manufacturerName = 'TUFTEX';
                }
              }
              
              // Extract and format price correctly
              let priceValue = '$0.00';
              if (priceField && row[priceField]) {
                const price = row[priceField].toString().trim();
                if (price !== '') {
                  // Remove any non-numeric characters except decimal point
                  const numericPrice = price.replace(/[^\d.]/g, '');
                  if (numericPrice !== '') {
                    priceValue = price.startsWith('$') ? price : `$${price}`;
                  }
                }
              }
              
              // Format cost correctly - handling different formats
              let costValue = '0.00';
              if (costField && row[costField]) {
                const cost = row[costField].toString().trim();
                if (cost !== '') {
                  // Remove any $ sign and non-numeric characters except decimal
                  costValue = cost.replace(/[^\d.]/g, '');
                }
              }
              
              // For style number, use SKU as fallback if no style number found
              let styleNumberValue = '';
              if (styleNumberField && typeof row[styleNumberField] !== 'undefined' && row[styleNumberField] !== null) {
                styleNumberValue = row[styleNumberField].toString();
              } else if (skuField && typeof row[skuField] !== 'undefined' && row[skuField] !== null) {
                // Extract potential style number from SKU (first part before any delimiter)
                const skuParts = row[skuField].toString().split(/[-_]/);
                if (skuParts.length > 0) {
                  styleNumberValue = skuParts[0];
                }
              }
              
              // Generate a SKU if one doesn't exist
              if (skuField && typeof row[skuField] !== 'undefined' && row[skuField] !== null && row[skuField].toString().trim() !== '') {
                sku = row[skuField].toString().trim();
              } else {
                // Create synthetic SKU from manufacturer, style number, and color
                let skuParts = [];
                
                // Add manufacturer abbreviation
                if (manufacturerName) {
                  // Use first 3 letters of manufacturer name (or the whole name if shorter)
                  const mfrAbbr = manufacturerName.substring(0, Math.min(3, manufacturerName.length));
                  skuParts.push(mfrAbbr);
                } else if (defaultManufacturer) {
                  const defaultMfrAbbr = defaultManufacturer.substring(0, Math.min(3, defaultManufacturer.length));
                  skuParts.push(defaultMfrAbbr);
                }
                
                // Add style number (clean it up, remove spaces)
                if (styleNumberValue) {
                  const cleanStyleNumber = styleNumberValue.replace(/\s+/g, '').substring(0, 10);
                  skuParts.push(cleanStyleNumber);
                }
                
                // Add color information
                if (colorNameField && row[colorNameField]) {
                  const colorAbbr = row[colorNameField].toString()
                    .replace(/\s+/g, '')
                    .substring(0, 5);
                  skuParts.push(colorAbbr);
                } else if (colorNumberField && row[colorNumberField]) {
                  const colorNumAbbr = row[colorNumberField].toString()
                    .replace(/\s+/g, '')
                    .substring(0, 5);
                  skuParts.push(colorNumAbbr);
                }
                
                // Create final SKU with randomness to ensure uniqueness
                const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                sku = skuParts.join('-') + '-' + randomSuffix;
                
                console.log(`Generated SKU: ${sku} for product with manufacturer: ${manufacturerName || defaultManufacturer}, style: ${styleNumberValue}`);
              }
              
              // Build the product object
              const productData: InsertProduct = {
                sku: sku,
                styleName: styleNameField && row[styleNameField] ? row[styleNameField].toString() : '',
                styleNumber: styleNumberValue,
                colorName: colorNameField && row[colorNameField] ? row[colorNameField].toString() : '',
                colorNumber: colorNumberField && row[colorNumberField] ? row[colorNumberField].toString() : '',
                cost: costValue,
                price: priceValue,
                manufacturer: manufacturerName || defaultManufacturer,
                width: widthField && row[widthField] ? row[widthField].toString() : '',
                backing: backingField && row[backingField] ? row[backingField].toString() : ''
              };
              
              // Add all products, including those without SKUs
              // Must have at least some style information though
              if (productData.styleName || productData.styleNumber || productData.manufacturer) {
                validProducts.push(productData);
              }
            }
            
            console.log(`Processed ${validProducts.length} products using default format from ${fileName}`);
            resolve(validProducts);
          } catch (error) {
            console.error('Error processing CSV data with default format:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading CSV file with default format:', error);
          reject(error);
        });
    });
  }
  
  private async loadSampleProducts(): Promise<void> {
    try {
      const sampleProducts: InsertProduct[] = [
        {
          sku: 'S1800ANSE132CLA',
          styleName: 'Anse',
          styleNumber: 'ST. LUCIA (TROPIX COLLECTION)',
          colorName: 'Clay',
          colorNumber: '73432 CLAY',
          cost: '30.59',
          price: '$55.50',
          manufacturer: 'STANTON (S1800)',
          width: '13.2',
          backing: 'LEP 8.8.2024'
        },
        {
          sku: 'S1800AME136DENIM',
          styleName: 'Amelie',
          styleNumber: 'BARRIER (IDG)',
          colorName: 'Denim',
          colorNumber: 'DENIM',
          cost: '32.63',
          price: '$59.00',
          manufacturer: 'STANTON (S1800)',
          width: '13.6',
          backing: 'LEP 8.8.2024'
        },
        {
          sku: 'LS1800PANASAZI132RAVEN',
          styleName: 'Anasazi',
          styleNumber: 'BARONE',
          colorName: 'Raven',
          colorNumber: '',
          cost: '90.77',
          price: '$158.00',
          manufacturer: 'STANTON (S1800)',
          width: '13.2',
          backing: 'LEP 8.8.2024'
        }
      ];
      
      // Insert sample products into database
      await db.insert(products).values(sampleProducts);
      
      // Also create a sample CSV file for future reference
      const csvContent = 'Manufacturer,Style Name,Style Number,Color Name,Color Number,SKU,Roll Costs,Retail Price\n' +
        'STANTON (S1800),Anse,ST. LUCIA (TROPIX COLLECTION),Clay,73432 CLAY,S1800ANSE132CLA,30.59,55.50\n' +
        'STANTON (S1800),Amelie,BARRIER (IDG),Denim,DENIM,S1800AME136DENIM,32.63,59.00\n' +
        'STANTON (S1800),Anasazi,BARONE,Raven,,LS1800PANASAZI132RAVEN,90.77,158.00';
      
      fs.writeFileSync(this.productsCsvPath, csvContent);
      
      console.log('Sample products loaded');
    } catch (error) {
      console.error('Error loading sample products:', error);
      throw error;
    }
  }
  
  // Scan history methods
  async recordScan(insertScan: InsertScan): Promise<Scan> {
    // Normalize the SKU by removing the ? prefix if present
    const normalizedScan = {
      ...insertScan,
      sku: insertScan.sku.startsWith('?') ? insertScan.sku.substring(1) : insertScan.sku
    };
    
    const [scan] = await db.insert(scans).values(normalizedScan).returning();
    return scan;
  }
  
  async getScansByUser(userId: number | undefined): Promise<Scan[]> {
    if (userId) {
      return await db.select().from(scans)
        .where(eq(scans.userId, userId))
        .orderBy(desc(scans.timestamp));
    }
    return await db.select().from(scans).orderBy(desc(scans.timestamp));
  }
  
  // File management methods
  async listDataFiles(): Promise<{name: string, size: number, date: Date}[]> {
    try {
      // Ensure the data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        return [];
      }
      
      // Read all files in the data directory
      const files = fs.readdirSync(this.dataDir);
      
      // Only include .csv and .zip files
      const dataFiles = files
        .filter(file => file.toLowerCase().endsWith('.csv') || file.toLowerCase().endsWith('.zip'))
        .map(file => {
          const filePath = path.join(this.dataDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            date: stats.mtime
          };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date (newest first)
      
      return dataFiles;
    } catch (error) {
      console.error('Error listing data files:', error);
      throw error;
    }
  }
  
  async deleteDataFile(filename: string): Promise<void> {
    try {
      // Validate filename to prevent directory traversal attacks
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(this.dataDir, sanitizedFilename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${sanitizedFilename} not found`);
      }
      
      // Validate that it's a CSV or ZIP file
      if (!sanitizedFilename.toLowerCase().endsWith('.csv') && !sanitizedFilename.toLowerCase().endsWith('.zip')) {
        throw new Error('Only CSV and ZIP files can be deleted');
      }
      
      // Delete the file
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${sanitizedFilename}`);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
