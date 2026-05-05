import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token storage
export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

export function clearToken() {
  localStorage.removeItem("auth_token");
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

export async function apiRequest(
  url: string,
  options: RequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else if (typeof options.body === "string") {
      init.body = options.body;
      headers["Content-Type"] = "application/json";
    } else {
      init.body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }
    init.headers = headers;
  }

  const res = await fetch(url, init);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
