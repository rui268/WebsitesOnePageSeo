/* ============================================================
   BudgetPal — Firebase Auth + Firestore
   設定說明：將下方 REPLACE_ME 換成你的 Firebase 專案資訊
============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_ME",
  authDomain:        "REPLACE_ME.firebaseapp.com",
  projectId:         "REPLACE_ME",
  storageBucket:     "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId:             "REPLACE_ME"
};

// ── 檢查是否已設定 ────────────────────────────────────────
const FB_READY = FIREBASE_CONFIG.apiKey !== "REPLACE_ME";

let fbAuth, fbDb, googleProvider;

if (FB_READY) {
  firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth          = firebase.auth();
  fbDb            = firebase.firestore();
  googleProvider  = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

// ── Auth helpers ──────────────────────────────────────────
function fbSignIn()  {
  return fbAuth.signInWithPopup(googleProvider);
}
function fbSignOut() {
  return fbAuth.signOut();
}

// ── Firestore helpers ─────────────────────────────────────
function fbSave(data) {
  if (!FB_READY || !fbAuth.currentUser) return;
  fbDb.collection('users')
    .doc(fbAuth.currentUser.uid)
    .set({ budgetpal_v1: data })
    .catch(e => console.warn('[Firebase] save failed', e));
}

async function fbLoad() {
  if (!FB_READY || !fbAuth.currentUser) return null;
  try {
    const doc = await fbDb.collection('users').doc(fbAuth.currentUser.uid).get();
    return doc.exists ? (doc.data().budgetpal_v1 || null) : null;
  } catch(e) {
    console.warn('[Firebase] load failed', e);
    return null;
  }
}
