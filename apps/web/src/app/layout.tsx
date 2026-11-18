import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Upward English — Aprende inglés jugando",
    template: "%s | Upward English",
  },
  description:
    "Plataforma web gamificada para enseñar inglés a niños y adolescentes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff1d6" },
    { media: "(prefers-color-scheme: dark)", color: "#241b16" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Sin async/defer: aplica la elección de la pestaña antes de pintar. */}
        <script src="/origami-appearance.js" />
      </head>
      <body className="origami-shell antialiased min-h-screen">
        <a
          href="#main-content"
          className="origami-skip-link sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          Saltar al contenido principal
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
