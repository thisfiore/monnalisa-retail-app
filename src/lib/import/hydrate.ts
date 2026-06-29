/**
 * Read-through hydration: when the durable (`http`) backend is active, pull the
 * customers system from Mongo into the local IndexedDB working copy once per
 * app load, so a fresh browser (e.g. prod) shows the migrated data instead of
 * an empty list. No-op in `local` mode.
 *
 * Runs at most once per page load and de-dupes concurrent callers (the import
 * list, review queue and dashboard all await it on mount).
 */
import { activeRecoveryBackend } from './recovery-store';
import { recoverFromBackend, type SyncProgress } from './staging-sync';

let done = false;
let inflight: Promise<void> | null = null;

export async function ensureHydrated(
  getToken: () => Promise<string>,
  onProgress?: (p: SyncProgress) => void,
): Promise<void> {
  if (activeRecoveryBackend() !== 'http') return;
  if (done) return;
  if (!inflight) {
    inflight = recoverFromBackend(getToken, onProgress)
      .then(() => {
        done = true;
      })
      .catch((e) => {
        inflight = null; // allow a retry on the next mount
        throw e;
      });
  }
  return inflight;
}

/** Force a re-hydrate on the next `ensureHydrated` (e.g. after a manual refresh). */
export function resetHydration(): void {
  done = false;
  inflight = null;
}
