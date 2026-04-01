import { BrowserMultiFormatReader, NotFoundException, ChecksumException, FormatException } from '@zxing/library';

let reader: BrowserMultiFormatReader | null = null;
let canvasElement: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;
let videoElement: HTMLVideoElement | null = null;
let animationFrameId: number | null = null;
let onDetectedCallback: ((sku: string) => void) | null = null;
let lastDetectionTime = 0;
let scanningActive = true; // Flag to control whether scanning should continue
const DETECTION_COOLDOWN = 200; // 0.2 seconds cooldown - much faster detection time

export async function scanBarcode(
  video: HTMLVideoElement,
  onDetected: (sku: string) => void
): Promise<void> {
  try {
    // Stop any existing scanner first
    stopScanner();
    
    // Initialize with performance-focused configuration
    const hints = new Map();
    // Try to scan multiple formats to increase chances of detection
    reader = new BrowserMultiFormatReader(hints, 500); // Set timeout to 500ms for faster processing
    videoElement = video;
    onDetectedCallback = onDetected;
    scanningActive = true; // Reset scanning flag to active
    
    // Create canvas for processing frames
    canvasElement = document.createElement('canvas');
    canvasContext = canvasElement.getContext('2d');
    
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support camera access');
    }
    
    // Using try-catch for better error handling across browsers
    try {
      // Enhanced constraints for better barcode scanning performance
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Request higher frame rate for faster scanning
          frameRate: { ideal: 30 }
          // Advanced constraints removed to avoid compatibility issues
        },
        audio: false
      };
      
      console.log('Attempting to access camera with constraints:', JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!stream) {
        throw new Error("Failed to get camera stream");
      }
      
      videoElement.srcObject = stream;
      
      // Try to optimize camera track settings if supported
      try {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const track = videoTracks[0];
          
          // Cast capabilities to any for browser-specific extensions
          // TypeScript definitions don't include all browser-specific capabilities
          try {
            // Safely access capabilities that might be browser-specific
            const capabilities = track.getCapabilities() as any;
            
            // Only proceed if we have capabilities
            if (capabilities) {
              console.log('Camera capabilities:', JSON.stringify(capabilities));
              
              // Create constraints object as any type to bypass TypeScript checks
              // for browser-specific capabilities
              const advancedConstraints = {} as any;
              
              // Check for additional camera features (these are non-standard but widely supported)
              // The browser will ignore constraints it doesn't support
              
              // Note: Removed focus mode handling as it is not a standard constraint

              // Set zoom level if available
              if (typeof capabilities.zoom === 'object' && 
                  'min' in capabilities.zoom && 
                  'max' in capabilities.zoom) {
                // Slight zoom can help with barcode focus
                const minZoom = capabilities.zoom.min || 1;
                const maxZoom = capabilities.zoom.max || 1;
                const zoomValue = minZoom + (maxZoom - minZoom) * 0.1; // 10% zoom
                
                if (zoomValue > minZoom) {
                  advancedConstraints.zoom = zoomValue;
                }
              }
              
              // Enable torch for low-light environments if available
              if (typeof capabilities.torch === 'boolean' || 
                  (typeof capabilities.torch === 'object' && capabilities.torch === true)) {
                advancedConstraints.torch = true;
              }
              
              // Apply advanced constraints if we have any
              if (Object.keys(advancedConstraints).length > 0) {
                console.log('Applying advanced camera constraints:', advancedConstraints);
                track.applyConstraints(advancedConstraints)
                  .then(() => console.log('Camera optimizations applied successfully'))
                  .catch(err => console.log('Could not apply camera optimizations:', err));
              }
            }
          } catch (err) {
            console.log('Error accessing camera capabilities:', err);
          }
        }
      } catch (err) {
        // Non-critical error, just log it
        console.log('Camera optimization not supported:', err);
      }
      
      // Handle orientation changes
      window.addEventListener('resize', adjustCanvasSize);
      
      // Start scanning once the video is ready
      videoElement.addEventListener('loadedmetadata', () => {
        console.log('Video loaded, starting scanner');
        adjustCanvasSize();
        startScanning();
      });
      
      // iOS specific - also listen for canplay event
      videoElement.addEventListener('canplay', () => {
        console.log('Video canplay event triggered');
        adjustCanvasSize();
        
        // iOS Safari optimization - adding play promise for better video handling
        try {
          const playPromise = videoElement?.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => console.log('Autoplay started successfully'))
              .catch(err => {
                console.warn('Autoplay was prevented:', err);
                // Show a play button or message if autoplay is prevented
                if (videoElement) {
                  // Add a message over the video for iOS users
                  const message = document.createElement('div');
                  message.style.position = 'absolute';
                  message.style.top = '50%';
                  message.style.left = '50%';
                  message.style.transform = 'translate(-50%, -50%)';
                  message.style.backgroundColor = 'rgba(0,0,0,0.7)';
                  message.style.color = 'white';
                  message.style.padding = '1rem';
                  message.style.borderRadius = '0.5rem';
                  message.style.fontWeight = 'bold';
                  message.style.zIndex = '100';
                  message.textContent = 'Tap to activate camera';
                  
                  // Add the message near the video element
                  videoElement.parentElement?.appendChild(message);
                  
                  // Listen for tap event to retry playing
                  message.addEventListener('click', () => {
                    videoElement?.play()
                      .then(() => {
                        // Remove the message on successful play
                        message.remove();
                      })
                      .catch(playErr => {
                        console.error('Play failed after tap:', playErr);
                      });
                  });
                }
              });
          }
        } catch (e) {
          console.warn('Error handling play promise:', e);
        }
      }, { once: true });
      
      // Return true if setup was successful
      return Promise.resolve();
    } catch (error: unknown) {
      console.error('Camera access failed:', error);
      
      // Special handling based on error types
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Camera access denied by user or system. Please check permissions.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new Error('No camera found on this device.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          throw new Error('Camera is already in use by another application.');
        } else if (error.name === 'OverconstrainedError') {
          throw new Error('Camera constraints not supported on this device.');
        } else if (error.name === 'SecurityError') {
          throw new Error('Camera access blocked due to security restrictions.');
        }
      }
      
      // Generic fallback error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error('Failed to access camera: ' + errorMessage);
    }
  } catch (error: unknown) {
    console.error('Error initializing camera:', error);
    stopScanner();
    return Promise.reject(error);
  }
}

export function stopScanner(): void {
  // Set scanning flag to false to stop scanning
  scanningActive = false;
  
  // Detect iOS to apply specific cleanup
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  console.log(`Stopping scanner (iOS: ${isIOS})`);
  
  if (reader) {
    reader.reset();
    reader = null;
  }
  
  // Stop video element first
  if (videoElement) {
    try {
      // Pause the video element before stopping tracks - helps with iOS Safari 
      // which can sometimes freeze on track stop if video is still playing
      videoElement.pause();
      
      // iOS-specific cleanup
      if (isIOS) {
        // Allow time for video pausing before we stop tracks - helps prevent iOS lockups
        setTimeout(() => {
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
              try {
                track.stop();
                console.log("Stopped track:", track.kind, track.label);
              } catch (e) {
                console.warn("Error stopping track:", e);
              }
            });
            
            // Clear source object after a slight delay on iOS
            setTimeout(() => {
              if (videoElement) {
                videoElement.srcObject = null;
              }
            }, 50);
          }
        }, 100);
      } else {
        // Non-iOS cleanup - can be done synchronously
        if (videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoElement.srcObject = null;
        }
      }
      
      // Remove any tap-to-start overlays that might have been added
      if (videoElement.parentElement) {
        const overlays = videoElement.parentElement.querySelectorAll('div[style*="position: absolute"]');
        overlays.forEach(overlay => overlay.remove());
      }
      
    } catch (e) {
      console.error("Error while cleaning up video element:", e);
    }
  }
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  window.removeEventListener('resize', adjustCanvasSize);
  
  // On iOS, we need a more thorough cleanup to prevent memory leaks
  if (isIOS && canvasElement) {
    try {
      // Force canvas cleanup
      canvasElement.width = 1;
      canvasElement.height = 1;
      if (canvasContext) {
        canvasContext.clearRect(0, 0, 1, 1);
      }
    } catch (e) {
      console.warn("Error cleaning up canvas:", e);
    }
  }
  
  // Clear all references
  videoElement = null;
  canvasElement = null;
  canvasContext = null;
  onDetectedCallback = null;
  
  // Force garbage collection hint
  if (isIOS && typeof window.gc === 'function') {
    try {
      window.gc();
    } catch (e) {
      // gc() might not be available in all browsers
    }
  }
}

function startScanning(): void {
  if (!videoElement || !canvasElement || !canvasContext) {
    console.error("Cannot start scanning: missing required elements");
    return;
  }
  
  const scanFrame = () => {
    if (!videoElement || !canvasElement || !canvasContext) {
      console.error("Scanning stopped: required elements no longer available");
      return;
    }
    
    // Only scan if video is playing and ready
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
      try {
        // Draw the video frame to the canvas
        canvasContext.drawImage(
          videoElement,
          0, 0,
          canvasElement.width,
          canvasElement.height
        );
      } catch (err) {
        console.error("Error drawing video to canvas:", err);
        return; // Skip this frame if we can't draw it
      }
      
      const now = Date.now();
      if (now - lastDetectionTime > DETECTION_COOLDOWN) {
        try {
          // Get the image data from canvas
          const imageData = canvasContext.getImageData(
            0, 0,
            canvasElement.width,
            canvasElement.height
          );
          
          // Try to decode
          if (reader) {
            // Convert ImageData to HTMLImageElement using canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.putImageData(imageData, 0, 0);
              
              // Use a more direct approach for faster processing
              try {
                // Try to decode directly from the canvas
                if (reader) {
                  try {
                    // Convert canvas to an image with JPEG format (faster than PNG)
                    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8); // 80% quality for speed
                    const img = new Image();
                    
                    // Optimize image loading with decode() promise for better performance
                    img.onload = () => {
                      // Use decode() to make sure the image is fully decoded before processing
                      img.decode().then(() => {
                        try {
                          if (reader) {
                            // Use the synchronous decode method with the loaded image
                            const result = reader.decode(img);
                            if (result && onDetectedCallback) {
                              const text = result.getText();
                              console.log('Barcode detected:', text);
                              lastDetectionTime = now;
                              
                              // Stop scanning active flag after a barcode is detected
                              scanningActive = false;
                              
                              // Call the callback with the detected barcode
                              onDetectedCallback(text);
                            }
                          }
                        } catch (decodeError) {
                          // Ignore specific expected exceptions when no barcode is found
                          if (!(decodeError instanceof NotFoundException) && 
                              !(decodeError instanceof ChecksumException) && 
                              !(decodeError instanceof FormatException)) {
                            console.error('Decoding error:', decodeError);
                          }
                        }
                      }).catch(err => {
                        // Silently handle decode errors
                      });
                    };
                    
                    // Set the image source to start loading
                    img.src = dataUrl;
                  } catch (directDecodeError) {
                    // Ignore expected exceptions
                    if (!(directDecodeError instanceof NotFoundException) && 
                        !(directDecodeError instanceof ChecksumException) && 
                        !(directDecodeError instanceof FormatException)) {
                      console.error('Direct decode error:', directDecodeError);
                    }
                  }
                }
              } catch (error: unknown) {
                // Ignore not found exceptions which are expected when no barcode is present
                if (!(error instanceof NotFoundException) && 
                    !(error instanceof ChecksumException) && 
                    !(error instanceof FormatException)) {
                  console.error('Scanning error:', error);
                }
              }
            }
          }
        } catch (error: unknown) {
          // Ignore not found exceptions which are expected when no barcode is present
          if (!(error instanceof NotFoundException) && 
              !(error instanceof ChecksumException) && 
              !(error instanceof FormatException)) {
            console.error('Scanning error:', error);
          }
        }
      }
    }
    
    // Only continue scanning if scanning is still active
    if (scanningActive) {
      animationFrameId = requestAnimationFrame(scanFrame);
    } else {
      console.log('Scanning stopped due to barcode detection');
      // Explicitly stop the scanner to release camera resources
      stopScanner();
    }
  };
  
  // Start the scanning loop
  animationFrameId = requestAnimationFrame(scanFrame);
}

function adjustCanvasSize(): void {
  try {
    if (!videoElement || !canvasElement || !canvasContext) {
      console.warn("Cannot adjust canvas size: missing required elements");
      return;
    }
    
    // Detect iOS to apply specific optimizations
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Get the video dimensions with fallbacks
    const videoWidth = videoElement.videoWidth || videoElement.clientWidth || 640;
    const videoHeight = videoElement.videoHeight || videoElement.clientHeight || 480;
    
    // Log video dimensions for debugging
    console.log(`Video dimensions: ${videoWidth}x${videoHeight} (iOS: ${isIOS})`);
    
    // Ensure we have valid dimensions
    if (videoWidth <= 0 || videoHeight <= 0) {
      console.warn("Invalid video dimensions:", videoWidth, videoHeight);
      return;
    }
    
    // On iOS, use a smaller processing size for better performance
    // On other devices, we can use a higher resolution
    const scaleFactor = isIOS ? 0.65 : 0.75;
    
    // Use a slightly smaller canvas size for faster processing while maintaining quality
    const processingWidth = Math.round(videoWidth * scaleFactor);
    const processingHeight = Math.round(videoHeight * scaleFactor);
    
    // Set canvas size to this optimized size
    canvasElement.width = processingWidth;
    canvasElement.height = processingHeight;
    
    // Set canvas rendering properties for faster processing
    if (canvasContext) {
      // Set image smoothing to false for faster rendering
      canvasContext.imageSmoothingEnabled = false;
      
      // iOS-specific optimizations
      if (isIOS) {
        // Create an offshore canvas to improve iOS performance
        try {
          // Set willReadFrequently attribute for better iOS performance
          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = processingWidth;
          offscreenCanvas.height = processingHeight;
          
          const offscreenCtx = offscreenCanvas.getContext('2d', { 
            willReadFrequently: true,  // Optimize for frequent pixel reads
            alpha: false               // Disable alpha channel for performance
          });
          
          if (offscreenCtx) {
            // Keep using the original canvas reference, but with optimized context
            canvasContext = offscreenCtx;
            console.log("Created optimized offscreen context for iOS");
          }
        } catch (e) {
          console.warn("Could not create optimized context:", e);
        }
      }
    }
    
    console.log(`Canvas size optimized to ${processingWidth}x${processingHeight} with scale factor ${scaleFactor}`);
  } catch (error) {
    console.error("Error adjusting canvas size:", error);
  }
}

// For manual barcode input
export function validateBarcode(barcode: string): boolean {
  // SKUs must start with a question mark and have at least one character after it
  const trimmedBarcode = barcode.trim();
  return trimmedBarcode.length > 1 && trimmedBarcode.startsWith('?');
}

// Helper function to ensure barcode starts with a question mark
export function ensureValidSku(sku: string): string {
  const trimmed = sku.trim();
  
  // If already valid, return as is
  if (validateBarcode(trimmed)) {
    return trimmed;
  }
  
  // If missing question mark at start, add it
  if (!trimmed.startsWith('?')) {
    return `?${trimmed}`;
  }
  
  return trimmed;
}
