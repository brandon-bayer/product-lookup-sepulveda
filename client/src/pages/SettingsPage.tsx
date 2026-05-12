import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { getToken } from '@/lib/queryClient';

declare const __BUILD_TIME__: string;

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SettingsPage() {
  const [lastDbUpdate, setLastDbUpdate] = useState<string | null>(null);

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

      <main className="flex-grow container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center">
              <span className="material-icons text-white mr-2 text-lg">info</span>
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
