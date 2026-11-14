'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from '../lib/query-client';
import { PwaUpdateBanner } from '../components/pwa-update-banner';
import { SessionSyncListener } from '../components/session-sync-listener';

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionSyncListener>{children}</SessionSyncListener>
      <PwaUpdateBanner />
    </QueryClientProvider>
  );
}

