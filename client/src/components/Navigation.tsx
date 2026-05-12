import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, User } from "lucide-react";

interface NavigationProps {
  currentPath: string;
}

export default function Navigation({ currentPath }: NavigationProps) {
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <footer className="shadow-md fixed bottom-0 left-0 right-0 z-50" style={{ backgroundColor: '#B9AC96' }}>
      <div className="container mx-auto">
        <nav className="flex justify-around items-center">
          <Link href="/">
            <div className={`flex flex-col items-center py-3 px-5 ${currentPath === '/' ? 'text-white font-medium' : 'text-white/60'}`}>
              <span className="material-icons">search</span>
              <span className="text-xs mt-1">Search</span>
            </div>
          </Link>
          <Link href="/history">
            <div className={`flex flex-col items-center py-3 px-5 ${currentPath === '/history' ? 'text-white font-medium' : 'text-white/60'}`}>
              <span className="material-icons">history</span>
              <span className="text-xs mt-1">History</span>
            </div>
          </Link>
          <Link href="/settings">
            <div className={`flex flex-col items-center py-3 px-5 ${currentPath === '/settings' ? 'text-white font-medium' : 'text-white/60'}`}>
              <span className="material-icons">settings</span>
              <span className="text-xs mt-1">Settings</span>
            </div>
          </Link>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className={`flex flex-col items-center py-3 px-5 text-white/60 focus:outline-none`}>
              <span className="material-icons">account_circle</span>
              <span className="text-xs mt-1">{user?.displayName || user?.username}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white">
              <DropdownMenuItem className="cursor-pointer flex items-center" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </footer>
  );
}
