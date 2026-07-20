import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
const app = initializeApp({});
const db = getFirestore(app, "ai-studio-c6876d47-c5ba-4626-b78d-f50ad982f364");
