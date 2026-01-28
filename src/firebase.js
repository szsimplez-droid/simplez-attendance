import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 🔹 Paste your Firebase project config here:
const firebaseConfig = {
  apiKey: "AIzaSyAQQg6k9TD2EatKcoqT5ZddPgjE-gdnphw",
  authDomain: "naychi-c41b9.firebaseapp.com",
  projectId: "naychi-c41b9",
  storageBucket: "naychi-c41b9.firebasestorage.app",
  messagingSenderId: "775682452070",
  appId: "1:775682452070:web:1efafb62b97280a7ae9ba7",
  measurementId: "G-4Z1K64BQ60"
};

// Initialize Firebase app first
const app = initializeApp(firebaseConfig);

// Then initialize Firestore and Auth using the app instance
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };