import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <header className="bg-[#1d4ed8] text-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight">Product Catalog</h1>
          <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Settings</span>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center">
              <span className="material-icons text-[#1d4ed8] mr-2 text-lg">info</span>
              About
            </CardTitle>
            <CardDescription>Application information and version details</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium" style={{ color: 'var(--text-head)' }}>
              Sepulveda Showroom · Product Catalog v1.0.0
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Product inventory search application for the Sepulveda showroom location, developed by Contempo Floor Coverings.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
