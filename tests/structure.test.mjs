import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync,existsSync} from 'node:fs';
const base=new URL('../',import.meta.url);
const pages=['index.html','pages/login.html','pages/dashboard.html','pages/specialties.html','pages/doctors.html','pages/doctor-details.html','pages/admin.html'];
test('Every requested page and shared component exists',()=>{for(const p of [...pages,'components/header.html','components/sidebar.html','components/footer.html','css/style.css','js/excel.js','js/statistics.js','js/storage.js'])assert.equal(existsSync(new URL(p,base)),true,p);});
test('No Firebase service key bundled into the frontend and no old Cloudflare/Gemini AI endpoints',()=>{const files=['js/firebase-config.js','js/excel.js','js/dashboard.js'];for(const file of files){const src=readFileSync(new URL(file,base),'utf8');assert.doesNotMatch(src,/-----BEGIN PRIVATE KEY-----/);assert.doesNotMatch(src,/aistudio\.google|api\.gemini|cloudflare\.workers\.dev/i);} });
test('Client uses shared calculator and tab-only sessionStorage',()=>{assert.match(readFileSync(new URL('js/reports.js',base),'utf8'),/calculateStatistics/);assert.match(readFileSync(new URL('js/dashboard.js',base),'utf8'),/calculateStatistics/);assert.match(readFileSync(new URL('js/storage.js',base),'utf8'),/sessionStorage/);});
