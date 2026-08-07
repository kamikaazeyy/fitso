import React from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import type { LoadableStatus } from '@/hooks/useLoadableData';

interface LoadableContainerProps {
  status: LoadableStatus;
  loadingMessage?: string;
  emptyIcon?: string;
  emptyTitle: string;
  emptySubtitle?: string;
  error?: string | null;
  errorTitle?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export function LoadableContainer({
  status,
  loadingMessage,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  error,
  errorTitle,
  onRetry,
  children,
}: LoadableContainerProps) {
  if (status === 'loading') {
    return <LoadingState message={loadingMessage} />;
  }

  if (status === 'error') {
    return <ErrorState title={errorTitle} message={error} onRetry={onRetry} />;
  }

  if (status === 'empty') {
    return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return <>{children}</>;
}
