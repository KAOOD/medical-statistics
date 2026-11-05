import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJkIaq5SqHS8CFhc3kOkLC2nJRpND2QpM",
  authDomain: "medical-statistics-cfa91.firebaseapp.com",
  projectId: "medical-statistics-cfa91",
  storageBucket: "medical-statistics-cfa91.firebasestorage.app",
  messagingSenderId: "161860865147",
  appId: "1:161860865147:web:e03dcfc29d5c07728926de",
  measurementId: "G-R057SG4YVB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
