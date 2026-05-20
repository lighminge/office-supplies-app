import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, runTransaction } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if there's a valid project ID, otherwise it will crash.
// To allow the app to build/start without credentials initially, we add a check.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export async function getNextSerial(type: string): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear().toString();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${yyyy}${mm}${dd}`;
  
  // Use a special document to keep track of counters
  const counterRef = doc(db, 'counters', `${type}_${datePrefix}`);
  
  let nextNum = 1;
  await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    if (!counterDoc.exists()) {
      transaction.set(counterRef, { count: 1 });
      nextNum = 1;
    } else {
      nextNum = counterDoc.data().count + 1;
      transaction.update(counterRef, { count: nextNum });
    }
  });
  
  return `${type}${datePrefix}${String(nextNum).padStart(4, '0')}`;
}

export { app, db };
