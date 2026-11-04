import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Englove — Aprende inglés jugando',
    template: '%s | Englove',
  },
  description: 'Plataforma web gamificada para enseñar inglés a niños y adolescentes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-white text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
