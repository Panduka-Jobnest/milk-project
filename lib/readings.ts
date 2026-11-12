// lib/readings.ts
// Live sensor readings, optionally for one container and a time window.
import { useEffect, useState } from 'react';
import {
  and,
  collection,
  limit as limitQuery,
  onSnapshot,
  or,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Reading = {
  id: string;
  container?: string; // e.g. "Container 001"
  temperature: number;
  ph?: number | null;
  deviceId: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
};

// Which container a reading belongs to; older readings without "container" use their deviceId
export function containerOf(r: Pick<Reading, 'container' | 'deviceId'>) {
  return r.container || r.deviceId || 'unknown';
}

type Options = {
  container: string | null; // null = every container
  sinceMs?: number; // only readings from the last N milliseconds
  max: number;
};

// Filtering by container and sorting by timestamp needs Firestore composite indexes
// (readings: container ASC + timestamp DESC, and deviceId ASC + timestamp DESC).
// Until they exist, fall back to fetching recent readings for everything and filtering here.
const FALLBACK_FACTOR = 10;

export function useReadings({ container, sinceMs, max }: Options) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setReadings([]);
    const since = sinceMs ? new Date(Date.now() - sinceMs).toISOString() : null;
    let unsubscribe = () => {};

    const listen = (useIndex: boolean) => {
      const byContainer = container && useIndex
        ? or(where('container', '==', container), where('deviceId', '==', container))
        : null;
      const byTime = since ? where('timestamp', '>=', since) : null;
      const order = orderBy('timestamp', 'desc');
      const cap = limitQuery(container && !useIndex ? max * FALLBACK_FACTOR : max);

      const base = collection(db, 'readings');
      const q = byContainer
        ? query(base, byTime ? and(byContainer, byTime) : byContainer, order, cap)
        : byTime
          ? query(base, byTime, order, cap)
          : query(base, order, cap);

      unsubscribe = onSnapshot(q, (snap) => {
        let data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reading, 'id'>) }));
        if (container) data = data.filter((r) => containerOf(r) === container).slice(0, max);
        setReadings(data);
        setLoading(false);
      }, (err) => {
        if (err.code === 'failed-precondition' && useIndex) {
          // The error message contains a link that creates the missing index in one click
          console.log('⚠️ Firestore index needed for per-container queries:', err.message);
          listen(false);
        } else {
          console.log('⚠️ readings listener error:', err.code);
          setLoading(false);
        }
      });
    };

    listen(true);
    return () => unsubscribe();
  }, [container, sinceMs, max]);

  return { readings, loading };
}
