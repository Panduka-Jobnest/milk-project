// lib/containers.tsx
// Milk containers and which one is selected.
// Containers come only from the readings: each reading names its container in a "container"
// field (e.g. "Container 001"); older readings without it are grouped by their deviceId.
// Containers seen once are remembered in settings/{uid}.containers so they stay listed when quiet.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { containerOf, useReadings } from '@/lib/readings';

type ContainersValue = {
  containers: string[];
  selected: string | null; // null = no readings yet
  select: (container: string) => void;
};

const SELECTED_KEY = 'selectedContainer';

const ContainersContext = createContext<ContainersValue | null>(null);

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function ContainersProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Remember the last selected container on this phone
  useEffect(() => {
    AsyncStorage.getItem(SELECTED_KEY).then((id) => id && setSelectedId(id)).catch(() => {});
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'settings', user.uid), (snap) => {
      // Only plain names; ignore anything else an earlier app version stored here
      const list = (snap.data()?.containers ?? []).filter((c: unknown) => typeof c === 'string');
      setSaved(list);
      setSettingsLoaded(true);
    }, (err) => {
      console.log('⚠️ containers listener error:', err.code);
    });

    return unsubscribe;
  }, []);

  // Containers seen in recent readings (live, so a new container appears as soon as it reports)
  const { readings: recent } = useReadings({ container: null, max: 300 });
  const discovered = [...new Set(recent.map(containerOf))];

  // Remember newly seen named containers so they stay in the list after they go quiet
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !settingsLoaded) return;
    const fresh = [...new Set(recent.filter((r) => r.container).map((r) => r.container!))].filter(
      (c) => !saved.includes(c)
    );
    if (fresh.length > 0) {
      setDoc(doc(db, 'settings', user.uid), { containers: arrayUnion(...fresh) }, { merge: true }).catch(() => {});
    }
  }, [recent, saved, settingsLoaded]);

  const containers = [...new Set([...saved, ...discovered])].sort(byName);

  const select = (container: string) => {
    setSelectedId(container);
    AsyncStorage.setItem(SELECTED_KEY, container).catch(() => {});
  };

  const selected = selectedId && containers.includes(selectedId) ? selectedId : containers[0] ?? null;

  return (
    <ContainersContext.Provider value={{ containers, selected, select }}>
      {children}
    </ContainersContext.Provider>
  );
}

export function useContainers() {
  const value = useContext(ContainersContext);
  if (!value) throw new Error('useContainers must be used inside ContainersProvider');
  return value;
}
