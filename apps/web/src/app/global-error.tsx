'use client';

import React from 'react';
import { ErrorState } from '../components/error-state';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen flex items-center justify-center p-6 bg-white">
        <ErrorState
          variant="kids"
          onRetry={() => reset()}
        />
      </body>
    </html>
  );
}
