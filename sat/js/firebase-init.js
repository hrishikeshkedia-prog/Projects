import { initializeApp } from "../vendor/firebase/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator
} from "../vendor/firebase/firebase-auth.js";
import {
  initializeFirestore,
  connectFirestoreEmulator
} from "../vendor/firebase/firebase-firestore.js";
import { firebaseConfig, USE_EMULATORS_ON_LOCALHOST } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Force long-polling instead of WebChannel streaming: many school/office
// networks sit behind proxies that break Firestore's default streaming
// transport, and long-polling works reliably everywhere at a small latency
// cost.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
if (USE_EMULATORS_ON_LOCALHOST && isLocalhost) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.info("[SAT Prep] Connected to local Firebase emulators.");
}
