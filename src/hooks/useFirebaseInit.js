import { useEffect, useState } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDsIpXihZp7hQE2yeNcGxgPH-2iU-Obt-s',
  authDomain: 'exhibition-app-891e0.firebaseapp.com',
  projectId: 'exhibition-app-891e0',
  storageBucket: 'exhibition-app-891e0.firebasestorage.app',
  messagingSenderId: '374193547856',
  appId: '1:374193547856:web:1e71260bfe402d626cbf55'
};

export function useFirebaseInit() {
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [storage, setStorage] = useState(null);
  const [appId, setAppId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeAuth = null;

    const init = async () => {
      try {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        const storageInstance = getStorage(app);

        if (!isMounted) return;

        setAppId('default-app');
        setDb(firestore);
        setStorage(storageInstance);
        await signInAnonymously(auth);

        unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
          if (!isMounted) return;
          setUser(nextUser);
        });
      } catch (error) {
        console.error('Firebase init failed:', error);
      }
    };

    init();
    return () => {
      isMounted = false;
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  return { user, db, storage, appId };
}
