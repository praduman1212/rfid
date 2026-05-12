"use client";

import { useCallback, useEffect, useState } from "react";

type ScanRow = {
  epc: string;
  scanCount: number;
  lastSeenAt: string;
};

type ScansPayload = {
  scans: ScanRow[];
  totalUniqueEpcs?: number;
  totalReads?: number;
  latestScanAt?: string | null;
};

const POLL_MS = 4000;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function LiveScanDashboard() {
  const [data, setData] = useState<ScansPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/scans", { cache: "no-store" });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as ScansPayload;
      setData(json);
      setError(null);
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const scans = data?.scans ?? [];
  const unique = data?.totalUniqueEpcs ?? scans.length;
  const latest = data?.latestScanAt ?? null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 bg-white px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Chainway C72
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Live RFID scan dashboard
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Scans are written by POST /api/scan or POST /api/scans. This page polls GET /api/scans every{" "}
          {POLL_MS / 1000}s.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Unique EPCs</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">
            {loading ? "…" : unique}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Latest scan</p>
          <p className="mt-2 text-lg font-medium text-zinc-900">
            {loading ? "…" : formatWhen(latest)}
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Scanned EPCs</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Refresh now
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">EPC</th>
                <th className="px-4 py-3">Scan count</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {scans.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    No scans yet. POST a JSON body to /api/scans to test.
                  </td>
                </tr>
              ) : (
                scans.map((row, i) => (
                  <tr key={row.epc} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 tabular-nums text-zinc-600">{i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-900">{row.epc}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700">{row.scanCount}</td>
                    <td className="px-4 py-3 text-zinc-700">{formatWhen(row.lastSeenAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
