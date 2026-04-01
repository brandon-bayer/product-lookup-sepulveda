import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HistoryPage from "@/pages/HistoryPage";
import NewBrowsePage from "@/pages/NewBrowsePage";
import SettingsPage from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import Navigation from "@/components/Navigation";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  const [location] = useLocation();

  const hasNavBar = ["/", "/history", "/settings"].includes(location);
  
  return (
    <div className="flex flex-col min-h-screen">
      <div className={`flex-grow ${hasNavBar ? 'pb-16' : ''}`}>
        <Switch>
          <ProtectedRoute path="/" component={NewBrowsePage} />
          <ProtectedRoute path="/history" component={HistoryPage} />
          <ProtectedRoute path="/settings" component={SettingsPage} />
          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
      
      {/* Only show navigation on main app pages */}
      {hasNavBar && <Navigation currentPath={location} />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
