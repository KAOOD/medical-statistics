import {getSignedInUser,login,friendlyAuthError,watchSignedOut} from './auth.js';
import {urlFor} from './routes.js';
import {mountShell} from './components.js';
import {setActiveUser,clearAllMedicalSessionData} from './storage.js';
import {showMessage} from './utils.js';
async function init(){const page=document.body.dataset.page;
if(page==='login'){const {isFirebaseConfigured}=await import('./firebase-config.js');if(!isFirebaseConfigured())showMessage('أدخل إعدادات تطبيق Firebase أولاً في ملف js/firebase-config.js.','warning','config-notice');const form=document.getElementById('login-form');form.addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('login-submit');btn.disabled=true;try{const fd=new FormData(form);await login(String(fd.get('email')).trim(),String(fd.get('password')));location.replace(urlFor('dashboard'));}catch(err){showMessage(friendlyAuthError(err),'error','login-error');btn.disabled=false;}});try{const signed=await getSignedInUser();if(signed?.role)location.replace(urlFor('dashboard'));}catch(err){console.warn(err.message);}document.body.dataset.auth='ready';return;}
try{const signed=await getSignedInUser();if(!signed?.role){clearAllMedicalSessionData();location.replace(urlFor('login'));return;}if(page==='index'){location.replace(urlFor('dashboard'));return;}if(page==='admin'&&signed.role!=='admin'){location.replace(urlFor('dashboard'));return;}
setActiveUser(signed.user.uid);watchSignedOut(()=>{clearAllMedicalSessionData();location.replace(urlFor('login'));});await mountShell(signed.role,signed.user.email,page);document.body.dataset.auth='ready';
if(page==='dashboard'){const {initDashboard}=await import('./dashboard.js');initDashboard();}
else if(['specialties','doctors','doctor-details'].includes(page)){const {initReport}=await import('./reports.js');initReport(page);}
else if(page==='admin'){const {initAdmin}=await import('./admin.js');initAdmin(signed.user.uid);}
}catch(error){console.error(error);document.body.dataset.auth='ready';const main=document.getElementById('main-content')||document.querySelector('main')||document.body;main.replaceChildren();const el=document.createElement('div');el.className='alert error';el.textContent='فشل بدء التطبيق: '+friendlyAuthError(error);main.append(el);}}
init();
