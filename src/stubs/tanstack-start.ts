// Stub for @tanstack/react-start server functions — not used in static SPA build
export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}

export function createServerFn(..._args: any[]) {
  return (...args: any[]) => Promise.resolve(null);
}

export function createMiddleware(..._args: any[]) {
  return {
    server: (_fn: any) => null,
    client: (_fn: any) => null,
  };
}
