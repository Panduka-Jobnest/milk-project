// lib/thresholds.ts
// Decides whether a reading is abnormal from the signed-in user's Settings,
// so the sensor never has to send a status itself.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_PH_MAX, DEFAULT_PH_MIN, DEFAULT_TEMP_LIMIT } from '@/constants/Thresholds';

export type Thresholds = {
  tempLimit: number;
  phMin: number;
  phMax: number;
};

export type ReadingCheck = {
  tempHigh: boolean;
  phLow: boolean;
  phHigh: boolean;
  phBad: boolean;
  abnormal: boolean;
};

const DEFAULTS: Thresholds = {
  tempLimit: DEFAULT_TEMP_LIMIT,
  phMin: DEFAULT_PH_MIN,
  phMax: DEFAULT_PH_MAX,
};

// Live copy of the user's thresholds from settings/{uid}
export function useThresholds(): Thresholds {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULTS);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'settings', user.uid), (snap) => {
      const data = snap.data() ?? {};
      setThresholds({
        tempLimit: data.temperatureLimit ?? DEFAULT_TEMP_LIMIT,
        phMin: data.phMin ?? DEFAULT_PH_MIN,
        phMax: data.phMax ?? DEFAULT_PH_MAX,
      });
    }, (err) => {
      console.log('⚠️ settings listener error:', err.code);
    });

    return unsubscribe;
  }, []);

  return thresholds;
}

export function checkReading(
  reading: { temperature?: number | null; ph?: number | null },
  t: Thresholds
): ReadingCheck {
  const tempHigh = reading.temperature != null && reading.temperature > t.tempLimit;
  const phLow = reading.ph != null && reading.ph < t.phMin;
  const phHigh = reading.ph != null && reading.ph > t.phMax;
  const phBad = phLow || phHigh;
  return { tempHigh, phLow, phHigh, phBad, abnormal: tempHigh || phBad };
}
