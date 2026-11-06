export const firebaseConfig = {
  apiKey: 'AIzaSyBJkIaq5SqHS8CFhc3kOkLC2nJRpND2QpM',
  authDomain: 'medical-statistics-cfa91.firebaseapp.com',
  projectId: 'medical-statistics-cfa91',
  appId: '1:161860865147:web:e03dcfc29d5c07728926de',
  messagingSenderId: '161860865147'
};

export const functionRegion = 'us-central1';

export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.messagingSenderId
  );
};