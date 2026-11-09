import * as SQLite from 'expo-sqlite';
import * as crypto from 'crypto';
import { AttendanceEventType, AttendanceEventDto } from '@employee-tracking/contracts';
import { StorageService } from './storage.service';

let dbInstance: any = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('geotrack_events.db');
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS event_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE,
        organization_id TEXT,
        employee_profile_id TEXT,
        event_type TEXT,
        sequence_number INTEGER,
        client_timestamp INTEGER,
        elapsed_realtime_ms INTEGER,
        payload_json TEXT,
        signature TEXT,
        status TEXT DEFAULT 'PENDING',
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_status_seq ON event_journal (status, sequence_number);
    `);
  }
  return dbInstance;
}

export const EventJournalService = {
  async recordEvent(
    eventType: AttendanceEventType,
    payload: Record<string, any>,
  ): Promise<string> {
    const db = getDb();
    const eventId = crypto.randomUUID();
    const now = Date.now();
    const profileId = (await StorageService.getProfileId()) || 'anonymous';
    const deviceSecret = (await StorageService.getDeviceSecret()) || 'local-secret';

    // Monotonic sequence resolution
    const lastSeqRow: any = db.getFirstSync(
      'SELECT MAX(sequence_number) as maxSeq FROM event_journal WHERE employee_profile_id = ?',
      [profileId],
    );
    const sequenceNumber = (lastSeqRow?.maxSeq || 0) + 1;

    // HMAC signature to detect tampering
    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', deviceSecret)
      .update(`${eventId}:${eventType}:${sequenceNumber}:${now}:${payloadStr}`)
      .digest('hex');

    db.runSync(
      `INSERT INTO event_journal (
        event_id, organization_id, employee_profile_id, event_type,
        sequence_number, client_timestamp, elapsed_realtime_ms,
        payload_json, signature, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        eventId,
        payload.organizationId || 'default-org',
        profileId,
        eventType,
        sequenceNumber,
        now,
        now, // monotonic clock fallback in JS
        payloadStr,
        signature,
        now,
      ],
    );

    return eventId;
  },

  getPendingEvents(batchSize: number = 50): AttendanceEventDto[] {
    const db = getDb();
    const rows: any[] = db.getAllSync(
      `SELECT * FROM event_journal WHERE status = 'PENDING' ORDER BY sequence_number ASC LIMIT ?`,
      [batchSize],
    );

    return rows.map((r) => ({
      eventId: r.event_id,
      organizationId: r.organization_id,
      employeeProfileId: r.employee_profile_id,
      eventType: r.event_type as AttendanceEventType,
      sequenceNumber: r.sequence_number,
      clientTimestamp: new Date(r.client_timestamp).toISOString(),
      elapsedRealtimeMs: r.elapsed_realtime_ms,
      payload: JSON.parse(r.payload_json || '{}'),
      signature: r.signature,
    }));
  },

  markEventsSynced(eventIds: string[]): void {
    if (!eventIds || eventIds.length === 0) return;
    const db = getDb();
    const placeholders = eventIds.map(() => '?').join(',');
    db.runSync(
      `UPDATE event_journal SET status = 'SYNCED' WHERE event_id IN (${placeholders})`,
      eventIds,
    );
  },

  pruneOldSyncedEvents(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const db = getDb();
    const cutoff = Date.now() - maxAgeMs;
    db.runSync(
      `DELETE FROM event_journal WHERE status = 'SYNCED' AND created_at < ?`,
      [cutoff],
    );
  },
};
