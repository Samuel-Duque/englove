import type { Metadata, Viewport } from 'next';
import {
  Bricolage_Grotesque,
  Nunito,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-upward-display',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-upward-body',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-upward-ui',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Upward English — Aprende inglés jugando, hablando y explorando',
    template: '%s | Upward English',
  },
  description:
    'Plataforma web educativa para que niños y jóvenes de 7 a 14 años aprendan inglés jugando, practicando con su propia voz y con acompañamiento real de su profesora.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#FFF9EC',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${bricolageGrotesque.variable} ${nunito.variable} ${plusJakartaSans.variable}`}
    >
      <body className="antialiased min-h-screen bg-white text-zinc-900">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:inline-flex focus:min-h-12 focus:items-center focus:rounded-xl focus:bg-[#2B150A] focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-[#FFF9EC] focus:shadow-lg"
        >
          Saltar al contenido principal
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
