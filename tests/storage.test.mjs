import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {setActiveUser,getRows,saveRows,clearRows,clearAllMedicalSessionData} from '../js/storage.js';
const memory=new Map();
globalThis.sessionStorage={get length(){return memory.size;},key(i){return [...memory.keys()][i]??null;},getItem(k){return memory.get(k)??null;},setItem(k,v){memory.set(k,String(v));},removeItem(k){memory.delete(k);}};
const sample={patient:'اسم تجريبي',admissionDate:'',initialDiagnosis:'',specialty:'جراحة عامة',operation:'عملية',degree:'خاصة',doctor:'د. تجريبي'};
test('Data remains between page module calls for same UID',()=>{setActiveUser('user-A');saveRows([sample]);assert.equal(getRows().length,1);assert.equal(getRows()[0].doctor,'د. تجريبي');});
test('Switching users purges the previous users medical data',()=>{setActiveUser('user-B');assert.equal(getRows().length,0);assert.equal(memory.size,0);saveRows([{...sample,patient:'آخر'}]);clearAllMedicalSessionData();assert.equal(memory.size,0);setActiveUser('user-B');assert.deepEqual(getRows(),[]);});
test('Clear removes medical rows',()=>{saveRows([sample]);clearRows();assert.deepEqual(getRows(),[]);});
