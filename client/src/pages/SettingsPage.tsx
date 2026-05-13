import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { getToken } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

declare const __BUILD_TIME__: string;

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseLocationCSV(text: string): Array<{ styleName: string; location: string }> {
  const lines = text.split(/\r?\n/);
  const rows: Array<{ styleName: string; location: string }> = [];
  // Skip header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV split — cols 1 (Style name) and 2 (Location) are safe from embedded commas
    const cols = line.split(',');
    const styleName = cols[1]?.trim().replace(/^"|"$/g, '');
    const location = cols[2]?.trim().replace(/^"|"$/g, '');
    if (styleName && location) rows.push({ styleName, location });
  }
  return rows;
}

export default function SettingsPage() {
  const [lastDbUpdate, setLastDbUpdate] = useState<string | null>(null);
  const [locUploadStatus, setLocUploadStatus] = useState<string | null>(null);
  const [locUploading, setLocUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocUploading(true);
    setLocUploadStatus(null);
    try {
      const text = await file.text();
      const rows = parseLocationCSV(text);
      if (rows.length === 0) {
        setLocUploadStatus('No valid rows found in file.');
        return;
      }
      const token = getToken();
      const res = await fetch('/api/upload-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocUploadStatus(`✓ ${data.count} locations uploaded successfully.`);
      } else {
        setLocUploadStatus(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setLocUploadStatus(`Error: ${err.message}`);
    } finally {
      setLocUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetch('/api/data-files', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((files: Array<{ name: string; size: number; date: string }> | null) => {
        if (!files || files.length === 0) return;
        const latest = files.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
        setLastDbUpdate(format(new Date(latest.date), 'MMM d, yyyy · h:mm a'));
      })
      .catch(() => {});
  }, []);

  const buildTime = (() => {
    try { return format(new Date(__BUILD_TIME__), 'MMM d, yyyy · h:mm a'); }
    catch { return 'Unknown'; }
  })();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <header className="bg-[#988B73]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight text-white">Product Catalog</h1>
          <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Settings</span>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6 space-y-4">
        {/* Showroom Locations Upload */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center">
              <span className="material-icons text-[#988B73] mr-2 text-lg">place</span>
              Showroom Locations
            </CardTitle>
            <CardDescription>Upload your showroom spreadsheet to show sample locations on search results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Upload <strong>CONTEMPOSHOWROOM.csv</strong> — the app will read the Style Name and Location columns and display a location badge on each matching product card.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleLocationUpload}
            />
            <Button
              className="bg-[#988B73] hover:bg-[#887D67] text-white text-sm font-semibold"
              style={{ height: '40px' }}
              disabled={locUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {locUploading ? 'Uploading…' : 'Choose CSV File'}
            </Button>
            {locUploadStatus && (
              <p className="text-sm font-medium" style={{ color: locUploadStatus.startsWith('✓') ? '#15803d' : '#dc2626' }}>
                {locUploadStatus}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center">
              <span className="material-icons text-[#988B73] mr-2 text-lg">info</span>
              About
            </CardTitle>
            <CardDescription>Application information and version details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>
                Sepulveda Showroom · Product Catalog v2.0
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Developed by Contempo Floor Coverings
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Last Deployed</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-head)' }}>{buildTime}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Last Database Update</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-head)' }}>
                  {lastDbUpdate ?? 'Not synced yet'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
