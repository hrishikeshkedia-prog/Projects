// ---------------------------------------------------------------------------
// Firebase project configuration.
//
// Replace every value below with your own project's config, found at:
// Firebase Console -> Project settings -> General -> "Your apps" -> SDK setup
// (the "Config" object). These values are safe to expose in client code —
// access is controlled by the Firestore security rules in firestore.rules,
// not by hiding this object.
//
// As shipped, this points at a project ID ("demo-sat-prep") that only
// resolves against local Firebase Emulators — see USE_EMULATORS_ON_LOCALHOST
// below — so you can run the whole app with zero setup by running
// `firebase emulators:start` and seeding against that same project ID. It
// will not work against production until you replace these values.
//
// See ../SETUP.md for full step-by-step setup instructions.
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "demo-sat-prep.firebaseapp.com",
  projectId: "demo-sat-prep",
  storageBucket: "demo-sat-prep.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

// When true and running on localhost, the app connects to local Firebase
// Emulators (Auth on 9099, Firestore on 8080) instead of production. This
// lets you develop/test without touching real data. Leave as-is; it only
// activates automatically on localhost/127.0.0.1.
export const USE_EMULATORS_ON_LOCALHOST = true;

// Free Desmos API key from https://www.desmos.com/api — the demo key works
// for local development but is rate-limited; get your own for production.
export const DESMOS_API_KEY = "dcb31709b452b1cf9dc26972add0fda6";
