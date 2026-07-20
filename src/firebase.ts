import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "landguard-backend",
  appId: "1:384833098566:web:cb0bd64486bad9628d0b47",
  apiKey: "AIzaSyCTn9ldnG8mxU0KABOzcKv6dfREZz03ZSU",
  authDomain: "landguard-backend.firebaseapp.com",
  storageBucket: "landguard-backend.firebasestorage.app",
  messagingSenderId: "384833098566",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-c6876d47-c5ba-4626-b78d-f50ad982f364");
export const auth = getAuth(app);
