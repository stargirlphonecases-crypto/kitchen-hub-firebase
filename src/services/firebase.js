import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "smart-kitchen-hub-26f94.firebaseapp.com",
  projectId: "smart-kitchen-hub-26f94",
  storageBucket: "smart-kitchen-hub-26f94.firebasestorage.app",
  messagingSenderId: "881105921492",
  appId: "1:881105921492:web:92537fd42f1c4f16666241"
};

// Inicializējam Firebase
const app = initializeApp(firebaseConfig);

// Ieslēdzam "Offline" (bezsaistes) režīmu
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const auth = getAuth(app);

// Eksportējam datubāzi un autorizāciju, lai citi faili tās var izmantot
export { db, auth };