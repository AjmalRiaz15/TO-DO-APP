// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';



const firebaseConfig = {
  apiKey: "AIzaSyB-UiIh9A47FPLDeRzQ37AifSHytFt8vSY",
  authDomain: "todo-app-84a1e.firebaseapp.com",
  projectId: "todo-app-84a1e",
  storageBucket: "todo-app-84a1e.appspot.com", 
  messagingSenderId: "430930909457",
  appId: "1:430930909457:web:e361899f041f20df6954b0",
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Authentication
const auth = getAuth(app);

export { auth, db, getStorage };

