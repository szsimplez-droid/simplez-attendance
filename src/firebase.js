import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBGV3mlk-EOoqnGcQisesuCCDvCL_pkRq4",
  authDomain: "szattendance-test.firebaseapp.com",
  projectId: "szattendance-test",
  storageBucket: "szattendance-test.firebasestorage.app",
  messagingSenderId: "204404781192",
  appId: "1:204404781192:web:602910225a79429fbaef3d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Then initialize Firestore and Auth using the app instance
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };