// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Tumhara config (Firebase Console se copy kia hua)
const firebaseConfig = {
  apiKey: "AIzaSyB-UiIh9A47FPLDeRzQ37AifSHytFt8vSY",
  authDomain: "todo-app-84a1e.firebaseapp.com",
  projectId: "todo-app-84a1e",
  storageBucket: "todo-app-84a1e.appspot.com", // 👈 ".app" hatao, ye galat hai
  messagingSenderId: "430930909457",
  appId: "1:430930909457:web:e361899f041f20df6954b0",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Auth initialize
export const auth = getAuth(app);
