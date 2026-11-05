'use strict';
// Usage: GOOGLE_APPLICATION_CREDENTIALS=/secure/private-service-account.json npm run bootstrap -- admin@example.com
// NEVER commit service-account files, and NEVER use this script in the browser.
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const email=process.argv[2];
if(!email||!email.includes('@')||!process.env.GOOGLE_APPLICATION_CREDENTIALS){console.error('Usage: GOOGLE_APPLICATION_CREDENTIALS=/secure/service-account.json npm run bootstrap -- admin@example.com');process.exit(2);}
initializeApp({credential:applicationDefault()});
(async()=>{const user=await getAuth().getUserByEmail(email);await getAuth().setCustomUserClaims(user.uid,{...(user.customClaims||{}),role:'admin'});await getAuth().revokeRefreshTokens(user.uid);console.log(`Administrator role set for ${user.email}. Sign out and sign in again to refresh claims.`);})().catch(e=>{console.error('Bootstrap failed:',e.message);process.exitCode=1;});
