'use client';

import React from 'react';
import { ErrorState } from '../components/error-state';

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <ErrorState
        variant="kids"
        onRetry={() => reset()}
      />
    </div>
  );
}
