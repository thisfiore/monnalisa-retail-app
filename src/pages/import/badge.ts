import type { StagingStatus } from '../../lib/import/types';

export function badgeColor(status: StagingStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'review':
      return 'bg-amber-100 text-amber-800';
    case 'blocked':
      return 'bg-red-100 text-red-700';
    case 'duplicate':
      return 'bg-blue-100 text-blue-700';
    case 'created':
      return 'bg-emerald-200 text-emerald-900';
    case 'failed':
      return 'bg-red-200 text-red-900';
    case 'skipped':
      return 'bg-gray-100 text-gray-500';
  }
}
