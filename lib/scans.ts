import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";

export const SCANS_COLLECTION = "rfid_scans";

export type ScanRecord = {
  epc: string;
  scanCount: number;
  lastSeenAt: string;
};

function normalizeEpc(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  return String(raw).trim().toUpperCase();
}

/** Accepts `epc` (reader) or `ep` (common typo in test curls). */
export function extractEpcFromBody(body: Record<string, unknown>): string {
  const fromEpc = body.epc;
  const fromEp = body.ep;
  const epc = normalizeEpc(fromEpc !== undefined ? fromEpc : fromEp);
  return epc;
}

export async function recordScan(epc: string): Promise<{ success: true } | { success: false }> {
  if (!epc) {
    return { success: false };
  }

  const db = getAdminDb();
  const ref = db.collection(SCANS_COLLECTION).doc(epc);
  const now = new Date();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.data();
    const scanCount = typeof prev?.scanCount === "number" ? prev.scanCount + 1 : 1;
    tx.set(
      ref,
      {
        epc,
        scanCount,
        lastSeenAt: Timestamp.fromDate(now),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { success: true };
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(0).toISOString();
}

export async function listScansOrdered(): Promise<ScanRecord[]> {
  const db = getAdminDb();
  const snap = await db.collection(SCANS_COLLECTION).get();
  const rows: ScanRecord[] = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      epc: typeof d.epc === "string" ? d.epc : doc.id,
      scanCount: typeof d.scanCount === "number" ? d.scanCount : 0,
      lastSeenAt: timestampToIso(d.lastSeenAt),
    };
  });
  rows.sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : a.lastSeenAt > b.lastSeenAt ? -1 : 0));
  return rows;
}

export function latestScanIso(scans: ScanRecord[]): string | null {
  if (scans.length === 0) return null;
  return scans[0]!.lastSeenAt;
}
