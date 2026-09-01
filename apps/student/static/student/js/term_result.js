/**
 * ============================================================
 * نتيجة الفصل الحالي - Current Semester Result
 * term_result.js  v2.0.0 (Connected to Database Context)
 * ============================================================
 */

console.log('✅ term_result.js v2.0.0 loaded with Database Integration');

// ============================================================
// دالة طباعة النتيجة
// ============================================================
function printResult() {
    window.print();
}

// ============================================================
// تهيئة الصفحة
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Current Semester Result page ready with dynamic Django database rendering');
});

// تصدير الدوال للنافذة
window.printResult = printResult;