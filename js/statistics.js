import { cleanString, degreesOrder, normalizeDegree } from './utils.js';

// One unified aggregation method is used by all three reports and the audit.
// Legacy 'نسائية وتوليد' is normalized consistently in every report:
// cesareans -> توليد, all other records -> نسائية.
export function effectiveSpecialty(row) {
  const spec = cleanString(row.specialty);
  if (spec !== 'نسائية وتوليد') return spec;
  return /(قيصري|قيصريه|caesarean|cesarean|c.section|\bc\s*\/\s*s\b|\bo82\b)/i.test(row.operation || '') ? 'توليد' : 'نسائية';
}

// دالة مضافة لدمج اختصاص النسائية والتوليد في التقارير العامة
export function summarySpecialty(detailSpecialty) {
  return detailSpecialty === 'توليد' || detailSpecialty === 'نسائية'
    ? 'نسائية'
    : detailSpecialty;
}

function emptyGroup(label, specialty = '') {
  return { label, specialty, counts: Object.fromEntries(degreesOrder.map(d => [d, 0])), total: 0 };
}

const sorted = obj => Object.values(obj).sort((a, b) => new Intl.Collator('ar', { sensitivity: 'base' }).compare(a.label, b.label));

export function calculateStatistics(records) {
  const bySpecialty = new Map(), byDoctor = new Map(), byDetails = new Map(), errors = [];
  let validCount = 0;

  records.forEach((row, index) => {
    // حساب الاختصاص المفصل والاختصاص المدمج
    const detailSpec = effectiveSpecialty(row);
    const summarySpec = summarySpecialty(detailSpec);
    
    const doc = cleanString(row.doctor);
    const degree = normalizeDegree(row.degree);
    
    // التحقق من صحة السجل بناءً على التفاصيل
    if (!detailSpec || !doc || !cleanString(row.operation) || !degreesOrder.includes(degree)) {
      errors.push(index + 1);
      return;
    }
    validCount++;

    // 1. التقرير الأول: إحصائيات الاختصاصات (استخدام summarySpec للدمج)
    if (!bySpecialty.has(summarySpec)) bySpecialty.set(summarySpec, emptyGroup(summarySpec));
    const g = bySpecialty.get(summarySpec);
    g.counts[degree]++;
    g.total++;

    // 2. التقرير الثاني: إحصائيات الأطباء (استخدام summarySpec للدمج)
    const dk = JSON.stringify([doc, summarySpec]);
    if (!byDoctor.has(dk)) byDoctor.set(dk, emptyGroup(doc, summarySpec));
    const d = byDoctor.get(dk);
    d.counts[degree]++;
    d.total++;

    // 3. التقرير الثالث: تفاصيل الأطباء حسب الاختصاص (استخدام detailSpec للفصل)
    if (!byDetails.has(detailSpec)) byDetails.set(detailSpec, new Map());
    const group = byDetails.get(detailSpec);
    if (!group.has(doc)) group.set(doc, emptyGroup(doc, detailSpec));
    const det = group.get(doc);
    det.counts[degree]++;
    det.total++;
  });

  const specialities = sorted(Object.fromEntries([...bySpecialty].map(([name, item]) => [name, item])));
  const doctors = [...byDoctor.values()].sort((a, b) => new Intl.Collator('ar').compare(a.label, b.label) || new Intl.Collator('ar').compare(a.specialty, b.specialty));
  const details = [...byDetails.entries()].sort((a, b) => new Intl.Collator('ar').compare(a[0], b[0])).map(([specialty, group]) => ({ specialty, doctors: [...group.values()].sort((a, b) => new Intl.Collator('ar').compare(a.label, b.label)) }));

  const tally = arr => arr.reduce((n, r) => n + r.total, 0);
  const totals = { 
    records: records.length, 
    valid: validCount, 
    specialties: tally(specialities), 
    doctors: tally(doctors), 
    details: details.reduce((n, s) => n + tally(s.doctors), 0) 
  };
  
  const auditOK = errors.length === 0 && [totals.specialties, totals.doctors, totals.details].every(n => n === totals.records);
  
  return { specialties: specialities, doctors, details, totals, errors, auditOK };
}
