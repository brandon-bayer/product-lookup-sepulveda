import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { log } from '../vite';

/**
 * Process a ZIP file containing multiple CSV files
 * @param zipFilePath Path to the ZIP file
 * @returns Object containing import results
 */
export async function processZipFile(zipFilePath: string): Promise<{
  totalFiles: number;
  processed: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    totalFiles: 0,
    processed: 0,
    skipped: 0,
    errors: [] as string[]
  };
  
  try {
    // Read the ZIP file
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    
    // Count total CSV files in the ZIP
    result.totalFiles = zipEntries.filter(entry => entry.entryName.toLowerCase().endsWith('.csv')).length;
    
    // Create a temp directory for extracted files
    const tempDir = path.join(process.cwd(), 'tmp_csv_extract');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Process each CSV file in the ZIP
    for (const entry of zipEntries) {
      if (!entry.entryName.toLowerCase().endsWith('.csv')) {
        continue;
      }
      
      try {
        const tempFilePath = path.join(tempDir, entry.entryName.replace(/[^a-zA-Z0-9._-]/g, '_'));
        
        // Extract the file
        zip.extractEntryTo(entry, tempDir, false, true);
        
        // Rename if needed (AdmZip might use different name extraction logic)
        const extractedPath = path.join(tempDir, path.basename(entry.entryName));
        if (fs.existsSync(extractedPath) && extractedPath !== tempFilePath) {
          fs.renameSync(extractedPath, tempFilePath);
        }
        
        // Process the CSV file
        if (fs.existsSync(tempFilePath)) {
          await storage.uploadProducts(tempFilePath);
          result.processed++;
          
          // Clean up the temp file
          fs.unlinkSync(tempFilePath);
        } else {
          result.errors.push(`Failed to extract file: ${entry.entryName}`);
          result.skipped++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error processing ${entry.entryName}: ${errorMessage}`);
        result.skipped++;
      }
    }
    
    // Clean up the temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Clean up the original ZIP file
    if (fs.existsSync(zipFilePath)) {
      fs.unlinkSync(zipFilePath);
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Error processing ZIP file: ${errorMessage}`);
    
    // Clean up if there was an error
    const tempDir = path.join(process.cwd(), 'tmp_csv_extract');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    return result;
  }
}