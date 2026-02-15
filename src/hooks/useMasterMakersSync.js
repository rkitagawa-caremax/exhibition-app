import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';

export function useMasterMakersSync({ db, appId, view }) {
  const [masterMakers, setMasterMakers] = useState([]);
  const [masterMakersLoaded, setMasterMakersLoaded] = useState(false);
  const masterMakersRef = useRef([]);

  const applyMasterMakersData = useCallback((data) => {
    setMasterMakers(data);
    masterMakersRef.current = data;
    setMasterMakersLoaded(true);
  }, []);

  // One-shot fetch with retry on transient failure.
  useEffect(() => {
    if (!db || !appId) return;

    let isActive = true;
    let retryTimer = null;

    const fetchMasterMakers = async () => {
      try {
        const makersRef = collection(db, 'artifacts', appId, 'public', 'data', 'masterMakers');
        const snapshot = await getDocs(makersRef);
        if (!isActive) return;
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyMasterMakersData(data);
      } catch (error) {
        console.error('[Firebase] Failed to load masterMakers:', error);
        if (!isActive) return;
        retryTimer = setTimeout(fetchMasterMakers, 3000);
      }
    };

    fetchMasterMakers();

    return () => {
      isActive = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [db, appId, applyMasterMakersData]);

  // Keep enterprise console in sync while editing master makers.
  useEffect(() => {
    if (!db || !appId || view !== 'enterprise') return;

    const makersRef = collection(db, 'artifacts', appId, 'public', 'data', 'masterMakers');
    const unsubscribe = onSnapshot(
      makersRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyMasterMakersData(data);
      },
      (error) => {
        console.error('[Firebase] masterMakers onSnapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [db, appId, view, applyMasterMakersData]);

  return {
    masterMakers,
    setMasterMakers,
    masterMakersLoaded,
    masterMakersRef
  };
}