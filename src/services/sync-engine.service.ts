import { EventJournalService } from './event-journal.service';
import { ApiClient } from './api-client.service';

export interface SyncResult {
  syncedCount: number;
  rejectedCount: number;
  backoffMs: number;
}

export const SyncEngine = {
  attemptCount: 0,
  maxBackoffMs: 60000, // 60 seconds
  baseBackoffMs: 2000, // 2 seconds

  /**
   * Computes exponential backoff with full randomized jitter:
   * T_wait = random(0, min(T_max, T_base * 2^attempt))
   */
  calculateBackoffWithJitter(attempt: number): number {
    const exponential = Math.min(
      this.maxBackoffMs,
      this.baseBackoffMs * Math.pow(2, attempt),
    );
    return Math.floor(Math.random() * exponential);
  },

  /**
   * Attempts to transmit pending offline events to the backend.
   */
  async syncPendingEvents(batchSize: number = 50): Promise<SyncResult> {
    const pending = EventJournalService.getPendingEvents(batchSize);

    if (pending.length === 0) {
      this.attemptCount = 0;
      return { syncedCount: 0, rejectedCount: 0, backoffMs: 0 };
    }

    try {
      const response = await ApiClient.syncBatch(pending);

      if (response.acknowledgedEventIds.length > 0) {
        EventJournalService.markEventsSynced(response.acknowledgedEventIds);
      }

      // Prune synced records older than 24 hours to prevent SQLite bloating
      EventJournalService.pruneOldSyncedEvents();

      // Reset exponential counter on successful transmission
      this.attemptCount = 0;

      return {
        syncedCount: response.acknowledgedEventIds.length,
        rejectedCount: response.rejectedEvents.length,
        backoffMs: 0,
      };
    } catch (error) {
      this.attemptCount++;
      const backoffMs = this.calculateBackoffWithJitter(this.attemptCount);
      console.warn(`[SyncEngine] Batch sync failed. Attempt: ${this.attemptCount}, Backing off: ${backoffMs}ms`);
      return {
        syncedCount: 0,
        rejectedCount: 0,
        backoffMs,
      };
    }
  },
};
