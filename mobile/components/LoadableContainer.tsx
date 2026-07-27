import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import type { LoadableStatus } from '@/hooks/useLoadableData';

interface LoadableContainerProps {
  status: LoadableStatus;
  loadingMessage?: string;
  emptyIcon?: string;
  emptyTitle: string;
  emptySubtitle?: string;
  error?: string | null;
  children: React.ReactNode;
}

export function LoadableContainer({
  status,
  loadingMessage,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  error,
  children,
}: LoadableContainerProps) {
  if (status === 'loading') {
    return <LoadingState message={loadingMessage} />;
  }

  if (status === 'empty') {
    return (
      <EmptyState
        icon={emptyIcon}
        title={error || emptyTitle}
        subtitle={error ? undefined : emptySubtitle}
      />
    );
  }

  return <>{children}</>;
}
