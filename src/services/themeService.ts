// Firestore utility for global theme settings
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const THEME_DOC_ID = "global";
const THEME_COLLECTION = "theme_settings";

export async function getGlobalThemeSettings() {
  const docRef = doc(db, THEME_COLLECTION, THEME_DOC_ID);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : {};
}

export async function setGlobalThemeSettings(settings: any) {
  const docRef = doc(db, THEME_COLLECTION, THEME_DOC_ID);
  await setDoc(docRef, settings, { merge: true });
}

export function subscribeToGlobalThemeSettings(callback: (settings: any) => void) {
  const docRef = doc(db, THEME_COLLECTION, THEME_DOC_ID);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}
