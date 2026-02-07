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

  // 通常利用時は1回取得のみ（常時リアルタイム購読を避けて読取コストを抑制）
  useEffect(() => {
    if (!db || !appId) return;
    let isActive = true;

    const fetchMasterMakers = async () => {
      try {
        const makersRef = collection(db, 'artifacts', appId, 'public', 'data', 'masterMakers');
        const snapshot = await getDocs(makersRef);
        if (!isActive) return;
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyMasterMakersData(data);
      } catch (error) {
        console.error('[Firebase] Failed to load masterMakers:', error);
        if (isActive) setMasterMakersLoaded(true);
      }
    };

    fetchMasterMakers();
    return () => {
      isActive = false;
    };
  }, [db, appId, applyMasterMakersData]);

  // 企業管理画面のみリアルタイム同期を有効化（編集時の即時反映を維持）
  useEffect(() => {
    if (!db || !appId || view !== 'enterprise') return;
    const makersRef = collection(db, 'artifacts', appId, 'public', 'data', 'masterMakers');
    const unsubscribe = onSnapshot(makersRef, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      applyMasterMakersData(data);
    }, (error) => {
      console.error('[Firebase] masterMakers onSnapshot error:', error);
    });

    return () => unsubscribe();
  }, [db, appId, view, applyMasterMakersData]);

  return {
    masterMakers,
    setMasterMakers,
    masterMakersLoaded,
    masterMakersRef
  };
}
