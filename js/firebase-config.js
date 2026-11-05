// Firebase project WEB CONFIG (public identifiers, NOT admin secrets).
// Replace these values in Firebase Console -> Project settings -> Your apps -> Web.
// NEVER place a service account JSON, private key or Admin SDK credential here.
export const firebaseConfig = {
  apiKey: 'PASTE_FIREBASE_WEB_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'PASTE_FIREBASE_WEB_APP_ID',
  messagingSenderId: 'PASTE_SENDER_ID'
};
export const functionRegion='us-central1'; // Must match functions/index.js
export const isFirebaseConfigured=()=>firebaseConfig.apiKey!=='PASTE_FIREBASE_WEB_API_KEY'&&firebaseConfig.projectId!=='YOUR_PROJECT_ID'&&firebaseConfig.appId!=='PASTE_FIREBASE_WEB_APP_ID';
