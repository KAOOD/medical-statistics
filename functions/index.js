'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
initializeApp();
const opts={region:'us-central1',maxInstances:10,timeoutSeconds:30,memory:'256MiB'};
function fail(code,message){throw new HttpsError(code,message);}
async function requireAdmin(request){if(!request.auth?.uid)fail('unauthenticated','يجب تسجيل الدخول.');
// Read *current* server-side claims rather than relying only on a potentially stale ID token.
const actor=await getAuth().getUser(request.auth.uid).catch(()=>null);
if(!actor||actor.disabled||actor.customClaims?.role!=='admin')fail('permission-denied','هذه العملية مخصصة للمدير فقط.');return actor;}
function roleOf(v){if(v!=='user'&&v!=='admin')fail('invalid-argument','صلاحية غير معروفة.');return v;}
function emailOf(v){if(typeof v!=='string'||v.length>254||!/^\S+@\S+\.\S+$/.test(v.trim()))fail('invalid-argument','البريد الإلكتروني غير صالح.');return v.trim().toLowerCase();}
function uidOf(v){if(typeof v!=='string'||!v||v.length>128)fail('invalid-argument','معرّف المستخدم غير صالح.');return v;}
function sanitized(u){return {uid:u.uid,email:u.email||'',role:u.customClaims?.role||'none',disabled:!!u.disabled,createdAt:u.metadata?.creationTime||''};}
exports.listUsers=onCall(opts,async request=>{await requireAdmin(request);const token=request.data?.pageToken;if(token!==undefined&&(typeof token!=='string'||token.length>4000))fail('invalid-argument','رمز الصفحة غير صالح.');const page=await getAuth().listUsers(100,token||undefined);return {users:page.users.map(sanitized),nextPageToken:page.pageToken||null};});
exports.createUser=onCall(opts,async request=>{await requireAdmin(request);const email=emailOf(request.data?.email),role=roleOf(request.data?.role);const password=request.data?.password;if(typeof password!=='string'||password.length<8||password.length>128)fail('invalid-argument','كلمة المرور يجب أن تكون من 8 إلى 128 حرفاً.');let created;try{created=await getAuth().createUser({email,password,emailVerified:false,disabled:false});await getAuth().setCustomUserClaims(created.uid,{role});return {user:sanitized({...created,customClaims:{role}})};}catch(e){if(created)await getAuth().deleteUser(created.uid).catch(()=>{});if(e?.code==='auth/email-already-exists')fail('already-exists','هذا البريد مسجل مسبقاً.');console.error('createUser:',e.code||e.message);fail('internal','تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور.');}});
exports.setUserRole=onCall(opts,async request=>{const actor=await requireAdmin(request),uid=uidOf(request.data?.uid),role=roleOf(request.data?.role);if(uid===actor.uid)fail('failed-precondition','لا يمكنك تغيير صلاحية حسابك الحالي.');const user=await getAuth().getUser(uid).catch(()=>null);if(!user)fail('not-found','الحساب غير موجود.');await getAuth().setCustomUserClaims(uid,{...(user.customClaims||{}),role});await getAuth().revokeRefreshTokens(uid);return {ok:true};});
exports.deleteUser=onCall(opts,async request=>{const actor=await requireAdmin(request),uid=uidOf(request.data?.uid);if(uid===actor.uid)fail('failed-precondition','لا يمكنك حذف حسابك الحالي.');await getAuth().deleteUser(uid).catch(e=>{if(e.code==='auth/user-not-found')fail('not-found','الحساب غير موجود.');throw e;});return {ok:true};});
exports.setUserDisabled=onCall(opts,async request=>{const actor=await requireAdmin(request),uid=uidOf(request.data?.uid),disabled=request.data?.disabled;if(typeof disabled!=='boolean')fail('invalid-argument','الحالة غير صالحة.');if(uid===actor.uid)fail('failed-precondition','لا يمكنك تعطيل حسابك الحالي.');await getAuth().updateUser(uid,{disabled});if(disabled)await getAuth().revokeRefreshTokens(uid);return {ok:true};});
