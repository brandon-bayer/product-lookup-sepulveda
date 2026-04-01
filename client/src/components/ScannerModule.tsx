import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { scanBarcode, stopScanner, validateBarcode, ensureValidSku } from '@/lib/barcodeScanner';

interface ScannerModuleProps {
  onSkuDetected: (sku: string, isSearch?: boolean) => void;
  isScanning: boolean;
  onScanningChange: (scanning: boolean) => void;
  lastScannedTime: string | null;
}

export default function ScannerModule({ 
  onSkuDetected, 
  isScanning, 
  onScanningChange,
  lastScannedTime 
}: ScannerModuleProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualSku, setManualSku] = useState('');
  
  // Setup camera when scanning is enabled
  useEffect(() => {
    if (isScanning) {
      const setupScanner = async () => {
        const videoElement = videoRef.current;
        if (!videoElement) {
          console.error("Video element not available");
          toast({
            variant: "destructive",
            title: "Camera Access Error",
            description: "Video element not available. Please try again.",
            duration: 10000
          });
          onScanningChange(false);
          return;
        }
        
        try {
          // For Replit preview environment, recommend using manual entry
          const isReplitDomain = window.location.hostname.includes('replit');
          const isFramedEnvironment = window !== window.top;
          
          if (isReplitDomain && isFramedEnvironment) {
            console.log("Detected Replit preview environment, suggesting manual entry");
            toast({
              title: "Camera access limited",
              description: "Camera access may be restricted in this preview. Please use manual search instead.",
              duration: 5000,
            });
          }
          
          // Enhanced device detection for Safari on iOS
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent.toString());
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent.toString()) || 
                          (isIOS && navigator.vendor.indexOf('Apple') > -1);
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent.toString());
          
          // For iOS Safari, we need special handling
          const setupDelay = (isIOS && isSafari) ? 1500 : 500; // Increased delay for iOS Safari
          console.log(`Using camera setup delay of ${setupDelay}ms (iOS: ${isIOS}, Safari: ${isSafari}, Mobile: ${isMobile})`);
          
          // iOS-specific optimizations
          if (isIOS) {
            // Set playsinline attribute to prevent fullscreen video on iOS
            videoElement.setAttribute('playsinline', 'true');
            videoElement.setAttribute('webkit-playsinline', 'true');
            
            // Request full screen if possible to improve camera access on iOS
            document.documentElement.style.height = '100%';
            document.body.style.height = '100%';
            document.body.style.overflow = 'hidden';
          }
          
          // Add a small delay before starting the camera to ensure DOM is fully ready
          setTimeout(async () => {
            try {
              // Special iOS Safari handling - try to request permissions explicitly first
              if (isIOS && isSafari) {
                try {
                  console.log("iOS Safari detected, requesting permissions explicitly");
                  // This simple getUserMedia call might trigger the permission prompt before actual setup
                  const constraints = {
                    video: {
                      facingMode: 'environment',
                      width: { ideal: 1280 },
                      height: { ideal: 720 }
                    },
                    audio: false
                  };
                  
                  console.log("Initial iOS permission request with constraints:", JSON.stringify(constraints));
                  await navigator.mediaDevices.getUserMedia(constraints);
                  console.log("Initial permission request successful");
                  
                  // Add a short delay after permission to ensure camera is ready
                  await new Promise(resolve => setTimeout(resolve, 500));
                } catch (permErr) {
                  console.log("Initial permission request failed (this may be normal):", permErr);
                  // Not throwing an error here, just continuing with normal flow
                }
              }
              
              await scanBarcode(videoElement, (sku) => {
                // Ensure the SKU is valid with question mark prefix
                const validSku = ensureValidSku(sku);
                
                console.log(`Barcode detected: ${sku} → ${validSku}`);
                onSkuDetected(validSku);
                onScanningChange(false);
                toast({
                  title: "Barcode detected",
                  description: `Scanned SKU: ${validSku}`
                });
              });
              console.log("Scanner initialized successfully");
            } catch (error) {
              console.error("Camera setup failed with delay:", error);
              
              // Show appropriate message based on error and environment
              let errorMessage = "Please check camera permissions and try again or use manual entry.";
              
              // Environment detection for better error messaging
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent.toString());
              const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent.toString());
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent.toString());
              const isReplit = window.location.hostname.includes('replit');
              const isFramed = window !== window.top;
              const isReplitPreview = isReplit && isFramed;
              const isDevelopmentHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              
              // Log environment details for debugging
              console.log('Camera error context:', {
                isIOS,
                isSafari,
                isMobile,
                isReplitPreview,
                isDevelopmentHost,
                hostname: window.location.hostname,
                userAgent: navigator.userAgent.substring(0, 50) + '...',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              
              // Special handling for different environments
              if (isReplitPreview) {
                errorMessage = "Camera access is typically restricted in this preview environment. Please use manual search by entering a SKU or product name.";
              } 
              else if (isIOS) {
                // iOS-specific messages
                if (isSafari) {
                  errorMessage = "On iOS Safari, camera access may require allowing camera access in Settings. Try tapping the camera button again after granting permissions.";
                } else {
                  errorMessage = "For best camera support on iOS, please try opening this app in Safari browser instead.";
                }
              } 
              else if (isMobile) {
                // Android or other mobile devices
                errorMessage = "Mobile browsers may restrict camera access. Please check permissions or try using manual search instead.";
              }
              
              // Error-specific messages (will override environment-specific messages if matched)
              if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('denied') || msg.includes('permission')) {
                  errorMessage = "Camera access was denied. Please check your device settings and browser permissions.";
                } else if (msg.includes('security') || msg.includes('secure')) {
                  errorMessage = "Camera access blocked due to security restrictions. This app may require HTTPS to access your camera.";
                } else if (msg.includes('in use') || msg.includes('busy')) {
                  errorMessage = "Your camera is already in use by another application. Please close other apps using your camera.";
                } else if (msg.includes('constraint') || msg.includes('overconstrained')) {
                  errorMessage = "Your device doesn't support the requested camera settings. Try using manual search instead.";
                } else if (msg.includes('not found') || msg.includes('no camera')) {
                  errorMessage = "No camera detected on your device. Please use manual search instead.";
                }
              }
              
              toast({
                variant: "destructive",
                title: "Camera access failed",
                description: errorMessage,
                duration: 5000, // Longer display time for error messages
              });
              
              onScanningChange(false);
            }
          }, setupDelay); // Using dynamic delay based on device
        } catch (error) {
          console.error("Initial camera setup failed:", error);
          toast({
            variant: "destructive",
            title: "Camera initialization failed",
            description: "Your device may not support camera access or permissions are denied. Please use manual entry instead.",
            duration: 5000,
          });
          onScanningChange(false);
        }
      };
      
      setupScanner();
    }
    
    // Cleanup when component unmounts or scanning stops
    return () => {
      if (isScanning) {
        stopScanner();
      }
    };
  }, [isScanning, onSkuDetected, onScanningChange, toast]);
  
  const handleManualSearch = () => {
    const trimmedInput = manualSku.trim();
    
    if (!trimmedInput) {
      toast({
        variant: "destructive",
        title: "Empty Input",
        description: "Please enter a search term or SKU number."
      });
      return;
    }
    
    // Check if this looks like an SKU input (vs. a search term)
    const isSkuSearch = /^\??\d+$/.test(trimmedInput); // Digits with optional leading ?
    
    if (isSkuSearch) {
      // For SKU searches, ensure question mark is present
      const validSku = ensureValidSku(trimmedInput);
      console.log(`Processing SKU: ${trimmedInput} → ${validSku}`);
      
      // Pass true as second parameter to indicate this is a search query
      onSkuDetected(validSku, true);
      
      // Show a hint toast if we had to add a question mark
      if (validSku !== trimmedInput) {
        toast({
          title: "SKU Format",
          description: "Added ? prefix to your SKU for proper format",
          duration: 3000,
        });
      }
    } else {
      // For non-SKU searches (product names, descriptions, etc.)
      onSkuDetected(trimmedInput, true);
    }
    
    setManualSku('');
  };
  
  // Track environment type to show UI elements differently
  const [isReplitPreview, setIsReplitPreview] = useState(false);
  
  useEffect(() => {
    // Only detect Replit development environment to show a warning
    const isReplitDomain = window.location.hostname.includes('replit');
    const isFramed = window !== window.top;
    
    // We only show a warning in the Replit preview iframe
    setIsReplitPreview(isReplitDomain && isFramed);
  }, []);
  
  const toggleCamera = () => {
    // Try to activate camera, with error handling for permissions or availability issues
    onScanningChange(!isScanning);
  };
  
  return (
    <div className="mb-6 bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4">
        {/* Scanner UI */}
        <div className="flex flex-col">
          <div id="scanner-container" className="mb-4">
            {/* Camera Feed (Hidden until activated) */}
            <div className={`camera-container relative rounded-lg bg-black ${isScanning ? 'active' : ''}`}
                style={{ height: isScanning ? '400px' : '0px', overflow: 'hidden', transition: 'height 0.3s ease' }}>
              <video 
                ref={videoRef}
                id="camera-view" 
                autoPlay 
                playsInline 
                muted // Required for autoplay to work in iOS Safari
                controls={false} // Hide controls
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                // Add iOS Safari specific attributes
                {...{ "webkit-playsinline": "true" }} // Use spread for non-standard attributes
              />
              {isScanning && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div 
                    className="w-[300px] h-[150px] border-4 border-[#464538] rounded-lg flex items-center justify-center relative overflow-hidden"
                    style={{ animation: 'border-pulse 2s ease-in-out infinite' }}
                  >
                    {/* Add scanning animation for better visual feedback */}
                    <div 
                      className="h-6 w-6 rounded-full bg-[#464538] opacity-75"
                      style={{ animation: 'scanner-pulse 1.5s ease-in-out infinite' }}
                    ></div>
                    <div className="absolute inset-0 flex items-center">
                      <div className="h-1 w-full bg-green-500 opacity-80" style={{ animation: 'scanline 2s ease-in-out infinite' }}></div>
                    </div>
                  </div>
                  <div className="text-white text-center mt-2 font-bold text-lg shadow-black drop-shadow-md" style={{ textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    Center barcode in box
                  </div>
                  <div className="text-white text-sm text-center mt-1 opacity-75 shadow-black drop-shadow-md" style={{ textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                    Hold still for faster detection
                  </div>
                </div>
              )}
              
              {/* iOS Safari specific loading indicator */}
              {isScanning && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <div className="bg-black bg-opacity-70 text-white px-5 py-2 rounded-full text-sm animate-pulse flex items-center">
                    <span className="mr-2 material-icons text-xs" style={{ fontSize: '16px' }}>sensors</span>
                    <span className="font-medium">Initializing camera...</span>
                  </div>
                </div>
              )}
            </div>
          
            {/* Camera Controls */}
            {isReplitPreview ? (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <div className="flex items-start">
                  <span className="material-icons text-amber-500 mr-2 text-lg">info</span>
                  <div>
                    <p className="font-medium">Note: Camera may not work in this preview</p>
                    <p className="mt-1">Camera access is limited in the Replit preview. The camera will work normally when deployed.</p>
                  </div>
                </div>
              </div>
            ) : null}
            
            {/* Scan Button with Improved Spacing */}
            <div className="mt-6 mb-6">
              <button 
                onClick={toggleCamera}
                className="bg-[#464538] text-white w-full py-4 rounded-lg shadow-md hover:bg-[#3c3b30] transition-colors flex items-center justify-center"
              >
                {isScanning ? (
                  <>
                    <span className="material-icons mr-2">close</span>
                    Cancel
                  </>
                ) : (
                  <>
                    <span className="material-icons mr-2">camera_alt</span>
                    Scan Barcode
                  </>
                )}
              </button>
            </div>
            
            {/* Search Option */}
            <div className="mb-4">
              {/* Desktop and tablet search layout */}
              <div className="hidden sm:flex items-center space-x-2">
                <input 
                  type="text" 
                  id="manual-sku-desktop" 
                  placeholder="SKUs start with ? (e.g., ?12345) or search by name" 
                  className="flex-grow p-3 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#464538] focus:border-transparent"
                  style={{ 
                    fontSize: '16px',
                    WebkitAppearance: 'none',
                    borderRadius: '8px'
                  }}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                />
                <button 
                  onClick={handleManualSearch}
                  className="bg-[#464538] text-white px-6 py-3 rounded-lg shadow-md hover:bg-[#3c3b30] transition-colors font-medium flex items-center"
                  style={{ height: '48px' }}
                >
                  <span className="material-icons mr-2">search</span>
                  Search
                </button>
              </div>
              
              {/* Mobile search layout - stacked for better mobile experience */}
              <div className="flex flex-col sm:hidden space-y-2">
                <input 
                  type="text" 
                  id="manual-sku-mobile" 
                  placeholder="Enter ?SKU or product name" 
                  className="w-full p-4 border border-neutral-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#464538] focus:border-transparent"
                  style={{ 
                    fontSize: '16px',
                    WebkitAppearance: 'none',
                    borderRadius: '8px',
                    height: '56px' // Larger touch target for mobile
                  }}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  inputMode="text"
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                />
                <button 
                  onClick={handleManualSearch}
                  className="w-full bg-[#464538] text-white py-4 rounded-lg shadow-md hover:bg-[#3c3b30] transition-colors font-medium text-lg flex items-center justify-center"
                  style={{ height: '56px' }} // Match input height for visual consistency
                >
                  <span className="material-icons mr-2">search</span>
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}