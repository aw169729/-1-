import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { VatProvider } from "@/contexts/vat-context";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthGate } from "@/components/auth/AuthGate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ניהול נסיעות" },
      { name: "description", content: "מערכת לניהול נסיעות עבור עסק הסעות" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "ניהול נסיעות" },
      { property: "og:description", content: "מערכת לניהול נסיעות עבור עסק הסעות" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "ניהול נסיעות" },
      { name: "twitter:description", content: "מערכת לניהול נסיעות עבור עסק הסעות" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/52b59395-ec09-468b-a9e3-fc42871ec183/id-preview-0652d3ea--8802d5b1-db24-476b-babe-a17d8c0a0d2f.lovable.app-1776856188898.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/52b59395-ec09-468b-a9e3-fc42871ec183/id-preview-0652d3ea--8802d5b1-db24-476b-babe-a17d8c0a0d2f.lovable.app-1776856188898.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <VatProvider>
        <AuthGate>
          <main>
            <Outlet />
          </main>
        </AuthGate>
      </VatProvider>
    </AuthProvider>
  );
}
