import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { InsertUser } from "@shared/schema";
import { queryClient, getToken, setToken, clearToken } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UserData = {
  id: number;
  username: string;
  displayName?: string;
};

type AuthContextType = {
  user: UserData | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserData, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserData, Error, InsertUser>;
};

type LoginData = {
  username: string;
  password?: string;
  noPasswordLogin?: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const { data: user, error, isLoading } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      try {
        const res = await fetch("/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { clearToken(); return null; }
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      const data = await res.json();
      setToken(data.token);
      return data;
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({ title: "Login successful", description: `Welcome, ${userData.displayName || userData.username}!` });
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { clearToken(); },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/scans"] });
      toast({ title: "Logged out successfully" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      const data = await res.json();
      setToken(data.token);
      return data;
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
    },
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, error, loginMutation, logoutMutation, registerMutation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
