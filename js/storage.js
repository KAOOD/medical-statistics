import {validateRecord,newId} from './utils.js';
// No upload, cookies, Firestore or localStorage. Medical data is tab-scoped only.
const PREFIX='medical-statistics:v1:';
let activeUid=null;
export function setActiveUser(uid){if(!uid)throw new Error('UID required');activeUid=uid;for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(PREFIX)&&k!==PREFIX+uid)sessionStorage.removeItem(k);}}
function key(){if(!activeUid)throw new Error('User was not initialized');return PREFIX+activeUid;}
export function getRows(){try{const raw=sessionStorage.getItem(key());if(!raw)return [];const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error('Invalid saved data');return parsed.map(row=>({...validateRecord(row),id:String(row.id||newId())}));}catch(error){console.warn('Invalid or inaccessible session data:',error.message);throw new Error('تعذر قراءة بيانات الجلسة. يمكن مسحها وإعادة استيراد Excel.');}}
export function saveRows(rows){const cleaned=rows.map(row=>({id:String(row.id||newId()),...validateRecord(row)}));try{sessionStorage.setItem(key(),JSON.stringify(cleaned));}catch{throw new Error('امتلأت مساحة الجلسة في المتصفح؛ تعذر حفظ التعديلات. صدّر نسخة واحذف بعض السجلات أو استخدم ملفاً أصغر.');}return cleaned;}
export function clearRows(){if(activeUid)sessionStorage.removeItem(key());}
export function clearAllMedicalSessionData(){for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(PREFIX))sessionStorage.removeItem(k);}activeUid=null;}
