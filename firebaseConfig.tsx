import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from 'firebase/database';
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB-UiIh9A47FPLDeRzQ37AifSHytFt8vSY",
  authDomain: "todo-app-84a1e.firebaseapp.com",
  projectId: "todo-app-84a1e",
  storageBucket: "todo-app-84a1e.appspot.com", 
  messagingSenderId: "430930909457",
  appId: "1:430930909457:web:e361899f041f20df6954b0",
  databaseURL: "https://todo-app-84a1e-default-rtdb.firebaseio.com/" // Add this line properly
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Realtime Database
const realtimeDb = getDatabase(app);

// Initialize Storage
const storage = getStorage(app);

export { auth, db, realtimeDb, storage };
export default app;