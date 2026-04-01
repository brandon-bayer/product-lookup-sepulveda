import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  credentials?: RequestCredentials;
}

export async function apiRequest(
  url: string,
  options: RequestOptions = {}
): Promise<Response> {
  const defaultOptions: RequestInit = {
    method: options.method || 'GET',
    credentials: 'include'
  };

  // Handle different body types
  if (options.body) {
    if (options.body instanceof FormData) {
      // For FormData, let browser set the Content-Type header
      defaultOptions.body = options.body;
    } else if (typeof options.body === 'string') {
      // Body is already a string
      defaultOptions.body = options.body;
      
      // Set Content-Type header if not already a FormData
      if (!options.headers?.['Content-Type']) {
        defaultOptions.headers = {
          ...options.headers,
          'Content-Type': 'application/json'
        };
      }
    } else {
      // Convert object to JSON string
      defaultOptions.body = JSON.stringify(options.body);
      defaultOptions.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
    }
  } else if (options.headers) {
    defaultOptions.headers = options.headers;
  }
  
  const res = await fetch(url, defaultOptions);
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
      credentials: "include",
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
