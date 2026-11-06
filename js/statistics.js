
import { cleanString, degreesOrder, normalizeDegree } from './utils.js';

// تصنيف الولادات حسب رمز التشخيص الأولي ICD-10
const OBSTETRICS_CODES = Object.freeze({
  O80: 'توليد (طبيعية)',
  O82: 'توليد (قيصرية)',
  O84: 'توليد (قيصرية)',
  O63: 'توليد (قيصرية)'
});

// التحقق من أن الاختصاص تابع للنسائية والتوليد
function isGynecologyOrObstetrics(specialty) {
  const normalized = cleanString(specialty)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, '');

  return [
    'نسائية',
    'توليد',
    'نسائيةوتوليد',
    'نسائيةوالتوليد'
  ].includes(normalized);
}

// استخراج رمز التشخيص الأولي من بداية النص
export function primaryDiagnosisCode(value) {
  const text = cleanString(value)
    .normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, digit =>
      String(digit.charCodeAt(0) - 0x660))
    .replace(/[\u06F0-\u06F9]/g, digit =>
      String(digit.charCodeAt(0) - 0x6F0))
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .trim();

  const match = text.match(
    /^(?:ICD\s*[-–]?\s*10\s*[:：-]?\s*)?(O\d{2})(?=$|[\s.\/:،؛,()\-–—])/i
  );

  return match ? match[1].toUpperCase() : '';
}

// تحديد الاختصاص المستخدم في كل تقرير
export function classifyReportSpecialties(row) {

  const original = cleanString(row.specialty);

  // الاختصاصات الأخرى تبقى كما هي دون أي تغيير
  if (!isGynecologyOrObstetrics(original)) {
    return {
      specialtyReport: original,
      doctorReport: original,
      detailSpecialty: original
    };
  }

  // قراءة رمز التشخيص الأولي
  const diagnosisCode = primaryDiagnosisCode(
    row.initialDiagnosis
  );

  const birthGroup = OBSTETRICS_CODES[diagnosisCode];

  // الولادات الطبيعية والقيصرية
  if (birthGroup) {
    return {
      specialtyReport: birthGroup,
      doctorReport: birthGroup,
      detailSpecialty: 'توليد'
    };
  }

  // بقية عمليات النسائية والتوليد
  return {
    specialtyReport: 'نسائية وتوليد',
    doctorReport: 'نسائية',
    detailSpecialty: 'نسائية'
  };
}

// الاختصاص المفصل
export function effectiveSpecialty(row) {
  return classifyReportSpecialties(row).detailSpecialty;
}

// إنشاء مجموعة إحصائية فارغة
function emptyGroup(label, specialty = '') {
  return {
    label,
    specialty,
    counts: Object.fromEntries(
      degreesOrder.map(d => [d, 0])
    ),
    total: 0
  };
}

// ترتيب النتائج أبجدياً
const collator = new Intl.Collator('ar', {
  sensitivity: 'base'
});

const sorted = obj =>
  [...obj.values()].sort(
    (a, b) => collator.compare(a.label, b.label)
  );

// الدالة الرئيسية لحساب الإحصائيات
export function calculateStatistics(records) {

  const bySpecialty = new Map();
  const byDoctor = new Map();
  const byDetails = new Map();
  const errors = [];

  let validCount = 0;

  records.forEach((row, index) => {

    // تحديد التصنيف الخاص بكل تقرير
    const {
      specialtyReport,
      doctorReport,
      detailSpecialty
    } = classifyReportSpecialties(row);

    const doc = cleanString(row.doctor);
    const degree = normalizeDegree(row.degree);

    // التحقق من صحة البيانات
    if (
      !cleanString(row.specialty) ||
      !doc ||
      !cleanString(row.operation) ||
      !degreesOrder.includes(degree)
    ) {
      errors.push(index + 1);
      return;
    }

    validCount++;

    // --------------------------------
    // 1- إحصائيات الاختصاصات
    // --------------------------------

    if (!bySpecialty.has(specialtyReport)) {
      bySpecialty.set(
        specialtyReport,
        emptyGroup(specialtyReport)
      );
    }

    const specialtyGroup = bySpecialty.get(specialtyReport);

    specialtyGroup.counts[degree]++;
    specialtyGroup.total++;

    // --------------------------------
    // 2- إحصائيات الأطباء
    // --------------------------------

    // يسمح بتكرار اسم الطبيب عند اختلاف نوع الاختصاص
    const doctorKey = JSON.stringify([
      doc,
      doctorReport
    ]);

    if (!byDoctor.has(doctorKey)) {
      byDoctor.set(
        doctorKey,
        emptyGroup(doc, doctorReport)
      );
    }

    const doctorGroup = byDoctor.get(doctorKey);

    doctorGroup.counts[degree]++;
    doctorGroup.total++;

    // --------------------------------
    // 3- تفاصيل الأطباء حسب الاختصاص
    // --------------------------------

    if (!byDetails.has(detailSpecialty)) {
      byDetails.set(
        detailSpecialty,
        new Map()
      );
    }

    const detailsGroup = byDetails.get(detailSpecialty);

    if (!detailsGroup.has(doc)) {
      detailsGroup.set(
        doc,
        emptyGroup(doc, detailSpecialty)
      );
    }

    const doctorDetail = detailsGroup.get(doc);

    doctorDetail.counts[degree]++;
    doctorDetail.total++;

  });

  // ترتيب إحصائيات الاختصاصات
  const specialties = sorted(bySpecialty);

  // ترتيب إحصائيات الأطباء
  const doctors = [...byDoctor.values()].sort(
    (a, b) =>
      collator.compare(a.label, b.label) ||
      collator.compare(a.specialty, b.specialty)
  );

  // ترتيب تفاصيل الأطباء حسب الاختصاص
  const details = [...byDetails.entries()]
    .sort((a, b) => collator.compare(a[0], b[0]))
    .map(([specialty, group]) => ({
      specialty,
      doctors: [...group.values()].sort(
        (a, b) => collator.compare(a.label, b.label)
      )
    }));

  // --------------------------------
  // مطابقة المجاميع
  // --------------------------------

  const tally = arr =>
    arr.reduce((n, item) => n + item.total, 0);

  const totals = {
    records: records.length,
    valid: validCount,
    specialties: tally(specialties),
    doctors: tally(doctors),
    details: details.reduce(
      (n, item) => n + tally(item.doctors),
      0
    )
  };

  const auditOK =
    errors.length === 0 &&
    [
      totals.specialties,
      totals.doctors,
      totals.details
    ].every(total => total === totals.records);

  return {
    specialties,
    doctors,
    details,
    totals,
    errors,
    auditOK
  };
}
