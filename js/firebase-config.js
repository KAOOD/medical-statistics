// Firebase project WEB CONFIG (public identifiers, NOT admin secrets).
// Replace these values in Firebase Console -> Project settings -> Your apps -> Web.
// NEVER place a service account JSON, private key or Admin SDK credential here.
export const firebaseConfig = {
  apiKey: 'AIzaSyBJkIaq5SqHS8CFhc3kOkLC2nJRpND2QpM',
  authDomain: 'medical-statistics-cfa91.firebaseapp.com',
  projectId: 'medical-statistics-cfa91',
  appId: '1:161860865147:web:e03dcfc29d5c07728926de',
  messagingSenderId: '161860865147'
};
export const functionRegion='us-central1'; // Must match functions/index.js
export const isFirebaseConfigured=()=>firebaseConfig.apiKey!=='AIzaSyBJkIaq5SqHS8CFhc3kOkLC2nJRpND2QpM'&&firebaseConfig.projectId!=='medical-statistics-cfa91'&&firebaseConfig.appId!=='1:161860865147:web:e03dcfc29d5c07728926de';
