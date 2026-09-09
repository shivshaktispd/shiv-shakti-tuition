import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { getAuth }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getStorage }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyChngdg-ORRgMQmGButSA4n_GXIhuD3G84",
  authDomain: "shiv-shakti-student-management.firebaseapp.com",
  projectId: "shiv-shakti-student-management",
  storageBucket: "shiv-shakti-student-management.firebasestorage.app",
  messagingSenderId: "238922960335",
  appId: "1:238922960335:web:4318a6b58d7bfbe853d6ba"
};


const app =
  initializeApp(firebaseConfig);


const db =
  getFirestore(app);


const auth =
  getAuth(app);


const storage =
  getStorage(app);


export {
  app,
  db,
  auth,
  storage
};