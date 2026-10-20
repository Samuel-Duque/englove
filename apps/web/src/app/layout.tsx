import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Englove — Plataforma en preparación',
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
        {children}
      </body>
    </html>
  );
}
