interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Looking up product information..." }: LoadingStateProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-neutral-200 border-t-[#464538] rounded-full animate-spin mb-4"></div>
      <p className="text-neutral-300">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onTryAgain: () => void;
}

export function ErrorState({ message, onTryAgain }: ErrorStateProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-status-error">
      <div className="flex items-start">
        <span className="material-icons text-[#f44336] mr-3">error_outline</span>
        <div>
          <h3 className="font-medium mb-1">Product Not Found</h3>
          <p className="text-sm text-neutral-300 mb-3">{message}</p>
          <button 
            className="text-[#464538] text-sm flex items-center"
            onClick={onTryAgain}
          >
            <span className="material-icons mr-1 text-sm">refresh</span>
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

interface NoScanStateProps {
  onScan: () => void;
  onBrowse: () => void;
}

export function NoScanState({ onScan, onBrowse }: NoScanStateProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center text-center">
      <span className="material-icons text-[#464538] text-4xl mb-4">qr_code_scanner</span>
      <h3 className="font-medium mb-2">No Product Scanned Yet</h3>
      <p className="text-neutral-300 text-sm mb-6">Scan a product barcode to view detailed information</p>
      <div className="flex justify-center">
        <button 
          className="bg-[#464538] text-white px-8 py-3 rounded-md shadow-sm hover:bg-[#3c3b30] transition-colors"
          onClick={onBrowse}
        >
          Browse Showroom
        </button>
      </div>
    </div>
  );
}
