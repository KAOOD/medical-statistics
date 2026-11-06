// Extracted/refactored from the provided original HTML. JSZip is bundled locally.
import '../vendor/jszip.min.js';
import {cleanString,normalizeDegree,degreesOrder,normalizeAdmissionDate} from './utils.js';
export const EXCEL_HEADERS=['المريض','الدخول','التشخيص الأولي','تصنيف العملية','اسم العملية','درجة العملية','الطبيب المعالج'];
const JSZip=globalThis.JSZip;
if(!JSZip)throw new Error('تعذر تحميل مكتبة Excel المحلية.');
        function cleanHeader(value) {
            return cleanString(value).replace(/[\u064B-\u065F\u0670\u0640\u200e\u200f]/g, '').replace(/\s+/g, '').replace(/أ|إ|آ/g, 'ا');
        }
        function toLatinNumbers(value) {
            return String(value).replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x0660))
                .replace(/[\u06F0-\u06F9]/g, digit => String(digit.charCodeAt(0) - 0x06F0));
        }
        function xmlDocument(xml) {
            const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
            if (documentXml.getElementsByTagName('parsererror').length) throw new Error('تعذرت قراءة محتويات ملف Excel (XML غير صالح).');
            return documentXml;
        }
        function nodes(parent, localName) {
            return Array.from(parent.getElementsByTagNameNS('*', localName));
        }
        function firstNode(parent, localName) {
            return nodes(parent, localName)[0];
        }
        function zipTarget(target) {
            let parts = (target.startsWith('/') ? target.slice(1) : 'xl/' + target).replace(/\\/g, '/').split('/');
            const normalized = [];
            for (const p of parts) {
                if (p === '..') normalized.pop();
                else if (p && p !== '.') normalized.push(p);
            }
            return normalized.join('/');
        }
        function getStringText(element) {
            return nodes(element, 't').map(t => t.textContent).join('');
        }
        function excelCellValue(cell, sharedStrings) {
            const type = cell.getAttribute('t') || '';
            if (type === 'inlineStr') return getStringText(firstNode(cell, 'is') || cell);
            const val = firstNode(cell, 'v');
            if (!val) return '';
            const raw = val.textContent || '';
            if (type === 's') return sharedStrings[Number(raw)] ?? '';
            if (type === 'e') return '';
            if (type === 'b') return raw === '1' ? 'نعم' : 'لا';
            if (type === 'str') return raw;
            if (raw.trim() && !isNaN(Number(raw))) return Number(raw);
            return raw;
        }
        export async function parseFixedExcel(file) {
            if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('يرجى اختيار ملف Excel من نوع .xlsx فقط.');
            if (file.size > 15 * 1024 * 1024) throw new Error('حجم الملف أكبر من 15 ميغابايت.');
            let zip;
            try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
            catch { throw new Error('الملف ليس .xlsx صالحاً، أو أنه تالف أو محمي بكلمة مرور.'); }
            const wbPart = zip.file('xl/workbook.xml');
            const relsPart = zip.file('xl/_rels/workbook.xml.rels');
            if (!wbPart || !relsPart) throw new Error('بنية Excel غير مكتملة. تأكد أن الملف بصيغة xlsx.');
            const workbook = xmlDocument(await wbPart.async('string'));
            const rels = xmlDocument(await relsPart.async('string'));
            const date1904 = ['1', 'true'].includes(firstNode(workbook, 'workbookPr')?.getAttribute('date1904'));
            const relationshipMap = new Map(nodes(rels, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
            let strings = [];
            const stringsPart = zip.file('xl/sharedStrings.xml');
            if (stringsPart) {
                const ss = xmlDocument(await stringsPart.async('string'));
                strings = nodes(ss, 'si').map(getStringText);
            }
            const worksheets = nodes(workbook, 'sheet');
            if (!worksheets.length) throw new Error('لا توجد أوراق عمل داخل ملف Excel.');
            const valid = [], wrong = [];
            for (const sheet of worksheets) {
                const rid = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
                const target = relationshipMap.get(rid);
                if (!target || !target.endsWith('.xml')) continue;
                const name = sheet.getAttribute('name') || 'Sheet';
                const part = zip.file(zipTarget(target));
                if (!part) continue;
                if (part._data?.uncompressedSize > 35 * 1024 * 1024) throw new Error('حجم بيانات ورقة العمل كبير جداً.');
                const xml = xmlDocument(await part.async('string'));
                const parsedRows = [];
                for (const row of nodes(xml, 'row')) {
                    const rowNumber = Number(row.getAttribute('r'));
                    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
                    const columns = Array(7).fill('');
                    for (const cell of nodes(row, 'c')) {
                        const columnLetters = (cell.getAttribute('r') || '').match(/^([A-Z]+)\d+$/)?.[1] || '';
                        let col = 0;
                        for (const ch of columnLetters) col = col * 26 + ch.charCodeAt(0) - 64;
                        if (col >= 1 && col <= 7) columns[col - 1] = excelCellValue(cell, strings);
                    }
                    parsedRows.push({ rowNumber, columns });
                }
                const header = parsedRows.find(row => row.rowNumber === 1)?.columns || [];
                if (!EXCEL_HEADERS.every((title, i) => cleanHeader(header[i]) === cleanHeader(title))) {
                    wrong.push(name); continue;
                }
                const records = [];
                const errors = [];
                for (const row of parsedRows.filter(r => r.rowNumber > 1)) {
                    const fields = row.columns;
                    if (fields.every(v => cleanString(v) === '')) continue;
                    const [patient, admission, diagnosis, specialty, operation, degreeVal, doctor] = fields;
                    const date = normalizeAdmissionDate(admission, date1904);
                    const degree = normalizeDegree(degreeVal);
                    const problem = [];
                    if (date === null) problem.push('تاريخ الدخول غير صالح');
                    if (!cleanString(specialty)) problem.push('الاختصاص فارغ');
                    if (!cleanString(operation)) problem.push('اسم العملية فارغ');
                    if (!degreesOrder.includes(degree)) problem.push('درجة العملية غير معروفة');
                    if (!cleanString(doctor)) problem.push('اسم الطبيب فارغ');
                    if (problem.length) errors.push(`الصف ${row.rowNumber}: ${problem.join('، ')}`);
                    else records.push({ patient: cleanString(patient), admissionDate: date, initialDiagnosis: cleanString(diagnosis), specialty: cleanString(specialty), operation: cleanString(operation), degree, doctor: cleanString(doctor) });
                }
                valid.push({ name, records, errors });
            }
            if (!valid.length) throw new Error('لم أجد ورقة بالأعمدة السبعة المطلوبة بالترتيب الصحيح: ' + EXCEL_HEADERS.join(' | '));
            const errors = valid.flatMap(sheet => sheet.errors.map(err => `${sheet.name} — ${err}`));
            if (errors.length) throw new Error(`يوجد ${errors.length} صفاً يحتاج إلى تصحيح في Excel قبل الاستيراد:\n${errors.slice(0, 8).join('\n')}${errors.length > 8 ? '\n...وبقية الصفوف' : ''}`);
            return { rows: valid.flatMap(sheet => sheet.records), sheetCount: valid.length };
        }
        export async function downloadExcelTemplate() {
            const xmlEscape = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const files = new JSZip();
            files.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
            files.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
            files.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
            files.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
            const cells = EXCEL_HEADERS.map((name, i) => `<c r="${String.fromCharCode(65 + i)}1" t="inlineStr"><is><t>${xmlEscape(name)}</t></is></c>`).join('');
            files.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="49" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="5" width="32" customWidth="1"/><col min="6" max="6" width="18" customWidth="1"/><col min="7" max="7" width="26" customWidth="1"/></cols><sheetData><row r="1">${cells}</row></sheetData></worksheet>`);
            const content = await files.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'قالب_الاحصاء_الطبي.xlsx';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 15000);
        }

// Export current (possibly edited) records using the same seven-column template.
export async function exportEditedExcel(rows){
    const xmlEscape=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    const files=new JSZip();
    files.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    files.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    files.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="العمليات" sheetId="1" r:id="rId1"/></sheets></workbook>');
    files.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    const valueCols=row=>[row.patient,row.admissionDate,row.initialDiagnosis,row.specialty,row.operation,row.degree,row.doctor];
    const cell=(v,r,c)=>`<c r="${String.fromCharCode(65+c)}${r}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
    const data=[EXCEL_HEADERS,...rows.map(valueCols)];
    const sheetRows=data.map((values,i)=>`<row r="${i+1}">${values.map((v,col)=>cell(v,i+1,col)).join('')}</row>`).join('');
    files.file('xl/worksheets/sheet1.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetData>${sheetRows}</sheetData></worksheet>`);
    const blob=await files.generateAsync({type:'blob',compression:'DEFLATE'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='عمليات_طبية_معدلة.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
