import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { refreshProducts, clearProducts, listDataFiles, deleteDataFile, uploadProductsCSV } from '@/lib/productService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enableCamera, setEnableCamera] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [syncIntervalHours, setSyncIntervalHours] = useState('24');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Fetch data files
  const { 
    data: dataFiles = [], 
    isLoading: isLoadingFiles,
    refetch: refetchFiles
  } = useQuery({
    queryKey: ['/api/data-files'],
    queryFn: listDataFiles
  });

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const result = await refreshProducts();

      // Invalidate products cache to ensure the latest data is displayed
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });

      toast({
        title: "Sync complete",
        description: `Product database updated successfully. Total products: ${result.count}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "There was an error syncing the product database."
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear products database
  const handleClearProducts = async () => {
    try {
      await clearProducts();

      // Invalidate products cache
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });

      toast({
        title: "Products cleared",
        description: "All products have been removed from the database."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Clear failed",
        description: "There was an error clearing the products database."
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
    const isZIP = file.type === 'application/zip' || file.name.endsWith('.zip');

    if (!isCSV && !isZIP) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select a CSV or ZIP file for product data."
      });
      return;
    }

    setIsUploading(true);

    try {
      // Use the uploadProductsCSV function from productService (handles both CSV and ZIP)
      const result = await uploadProductsCSV(file);

      // Invalidate products cache and refresh file list
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      refetchFiles();

      // Create appropriate success message based on file type
      let successMessage = `Product data updated successfully with ${result.productsCount} products.`;

      if (isZIP && result.totalFiles) {
        successMessage = `ZIP file processed: ${result.processed} files imported, ${result.skipped} skipped. Total ${result.productsCount} products now in database.`;
      }

      toast({
        title: "Upload successful",
        description: successMessage
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading the product data."
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Function to handle file deletion
  const handleDeleteFile = async (filename: string) => {
    setIsDeleting(true);

    try {
      await deleteDataFile(filename);

      // Refresh file list
      refetchFiles();

      toast({
        title: "File deleted",
        description: `${filename} has been deleted successfully.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "There was an error deleting the file."
      });
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-[#464538] text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col">
            <div className="flex items-center mb-1">
              <span className="material-icons mr-2">settings</span>
              <h1 className="text-2xl font-medium">Sepulveda Showroom</h1>
            </div>
            <p className="text-sm text-white/80 ml-8">Settings</p>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* About Card */}
          <Card>
            <CardHeader className="flex flex-col space-y-1.5 p-6 pb-2">
              <CardTitle className="text-2xl font-semibold leading-none tracking-tight flex items-center text-left">
                <span className="material-icons text-[#464538] mr-2">info</span>
                About
              </CardTitle>
              <CardDescription className="text-sm text-neutral-600">
                Application information and version details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Sepulveda Showroom Inventory v1.1
              </p>
              <p className="text-xs text-neutral-600 mt-1">
                Product inventory search application for the Sepulveda showroom location, developed by Contempo Floor Coverings.
              </p>
            </CardContent>
          </Card>

          {/* Scanner Settings Card */}
          <Card>
            <CardHeader className="flex flex-col space-y-1.5 p-6 pb-2">
              <CardTitle className="text-2xl font-semibold leading-none tracking-tight flex items-center text-left">
                <span className="material-icons text-[#464538] mr-2">qr_code_scanner</span>
                Scanner Settings
              </CardTitle>
              <CardDescription className="text-sm text-neutral-600">
                Configure how the barcode scanner works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="camera-access" className="font-medium">Enable Camera Access</Label>
                  <p className="text-sm text-neutral-600">Allow the app to use your device's camera</p>
                </div>
                <Switch 
                  id="camera-access" 
                  checked={enableCamera} 
                  onCheckedChange={setEnableCamera} 
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="save-history" className="font-medium">Save Scan History</Label>
                  <p className="text-sm text-neutral-600">Keep a record of scanned products</p>
                </div>
                <Switch 
                  id="save-history" 
                  checked={saveHistory} 
                  onCheckedChange={setSaveHistory} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Data Card */}
          <Card>
            <CardHeader className="flex flex-col space-y-1.5 p-6 pb-2">
              <CardTitle className="text-2xl font-semibold leading-none tracking-tight flex items-center text-left">
                <span className="material-icons text-[#464538] mr-2">database</span>
                Product Data
              </CardTitle>
              <CardDescription className="text-sm text-neutral-600">
                Upload or update product information from CSV or ZIP files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="product-file" className="font-medium">Upload Product Files</Label>
                <p className="text-sm text-neutral-600 mb-2">
                  Upload CSV files or a ZIP file containing multiple CSVs
                </p>
                <div className="flex items-center gap-2">
                  <Input 
                    id="product-file"
                    ref={fileInputRef}
                    type="file" 
                    accept=".csv,.zip"
                    disabled={isUploading}
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  {isUploading && (
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Supported file formats:</p>
                  <ul className="text-xs text-neutral-600 list-disc pl-4 space-y-1">
                    <li>Standard CSV files (single supplier)</li>
                    <li>ZIP files containing multiple CSV files (multiple suppliers)</li>
                    <li>Supported suppliers: Stanton, Allwood, Villagio</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-800">
                <h4 className="text-sm font-medium mb-2">Database Management</h4>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <span className="material-icons text-sm">lock</span>
                      Clear All Products (Admin Only)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Administrator Authentication Required</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action is restricted to administrators only. Please enter the admin password to proceed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="admin-password" className="mb-2">Admin Password</Label>
                      <Input 
                        id="admin-password" 
                        type="password" 
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setAdminPassword("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => {
                          // Simple password check - you can change this to any password you prefer
                          if (adminPassword === "contempo2025") {
                            handleClearProducts();
                            setAdminPassword("");
                          } else {
                            toast({
                              title: "Authentication Failed",
                              description: "Incorrect password. Please try again or contact the administrator.",
                              variant: "destructive"
                            });
                            setAdminPassword("");
                          }
                        }}
                      >
                        Authenticate & Clear
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Data Synchronization Card */}
          <Card>
            <CardHeader className="flex flex-col space-y-1.5 p-6 pb-2">
              <CardTitle className="text-2xl font-semibold leading-none tracking-tight flex items-center text-left">
                <span className="material-icons text-[#464538] mr-2">sync</span>
                Data Synchronization
              </CardTitle>
              <CardDescription className="text-sm text-neutral-600">
                Configure how the app syncs with the product database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sync-interval" className="font-medium">Sync Interval (hours)</Label>
                <Input 
                  id="sync-interval" 
                  type="number" 
                  min="1" 
                  max="168"
                  value={syncIntervalHours}
                  onChange={(e) => setSyncIntervalHours(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-neutral-600 mt-1">
                  How often the app should automatically refresh the product data
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <div className="space-y-2">
                <Button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-sm">sync</span>
                      Refresh Products
                    </>
                  )}
                </Button>

                <p className="text-xs text-neutral-600 mt-1 text-center">
                  Process all CSV files in the data folder
                </p>
              </div>
            </CardFooter>
          </Card>

          {/* Data File Management Card */}
          <Card>
            <CardHeader className="flex flex-col space-y-1.5 p-6 pb-2">
              <CardTitle className="text-2xl font-semibold leading-none tracking-tight flex items-center text-left">
                <span className="material-icons text-[#464538] mr-2">folder</span>
                Data File Management
              </CardTitle>
              <CardDescription className="text-sm text-neutral-600">
                View and manage your data files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingFiles ? (
                <div className="py-8 flex justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : dataFiles.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-neutral-500">No data files found</p>
                  <p className="text-xs text-neutral-400 mt-1">Upload CSV or ZIP files to get started</p>
                </div>
              ) : (
                <div className="border rounded-md">
                  <div className="grid grid-cols-12 bg-neutral-100 py-2 px-3 border-b text-sm font-medium">
                    <div className="col-span-6">File Name</div>
                    <div className="col-span-3 text-center">Size</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  <div className="divide-y">
                    {dataFiles.map((file) => (
                      <div key={file.name} className="grid grid-cols-12 py-2 px-3 items-center">
                        <div className="col-span-6 truncate" title={file.name}>
                          <span className="material-icons text-xs mr-1 align-middle">
                            {file.name.endsWith('.csv') ? 'table_chart' : 'folder_zip'}
                          </span>
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <div className="col-span-3 text-center text-xs">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                        <div className="col-span-3 text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <span className="material-icons text-sm">delete</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{file.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteFile(file.name)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchFiles()}
                className="mt-2 text-xs"
                disabled={isLoadingFiles}
              >
                <span className="material-icons text-xs mr-1">refresh</span>
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}