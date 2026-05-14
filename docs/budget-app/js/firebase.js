/* ============================================================
   BudgetPal — Firebase Auth + Firestore
   設定說明：將下方 REPLACE_ME 換成你的 Firebase 專案資訊
============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC-offXMoJPGio-3O7S1ERUB4GRUUuhJD0",
  authDomain:        "budget-2-25f9d.firebaseapp.com",
  projectId:         "budget-2-25f9d",
  storageBucket:     "budget-2-25f9d.firebasestorage.app",
  messagingSenderId: "200690061808",
  appId:             "1:200690061808:web:f95ee55ddbeb5499f48d35"
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
