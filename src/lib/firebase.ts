import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, runTransaction } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// 若環境變數有設定 NEXT_PUBLIC_RECAPTCHA_SITE_KEY，自動於瀏覽器端啟用 Firebase App Check 防護
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn("Firebase App Check initialization skipped:", e);
  }
}

const ALLOWED_SERIAL_TYPES = new Set(["REQ", "PROC"]);

export async function getNextSerial(type: "REQ" | "PROC"): Promise<string> {
  if (!ALLOWED_SERIAL_TYPES.has(type)) {
    throw new Error("不合法的單據序號類型");
  }

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
      const currentCount = Number(counterDoc.data().count) || 0;
      nextNum = currentCount + 1;
      transaction.update(counterRef, { count: nextNum });
    }
  });
  
  return `${type}${datePrefix}${String(nextNum).padStart(4, '0')}`;
}

export { app, db, auth };
