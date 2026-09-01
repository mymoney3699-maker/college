'use strict';

/**
 * equivalent_students.js – v1.0.0
 * ملف جافاسكربت خاص بصفحة كشف الطلبة المعادَلين ومتغيري المسار الأكاديمي
 * يتضمن: عرض التفاصيل، تعبئة جدول التقرير الرسمي، طباعة A4 Portrait
 */

// =====================================================================
// ① أدوات مساعدة
// =====================================================================

/**
 * إلغاء الطابع الخاص بـ HTML لتجنب XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text == null ? '' : text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * بناء الاسم الرباعي للطالب
 * @param {Object} st - كائن بيانات الطالب
 * @returns {string}
 */
function buildQuadName(st) {
    const parts = [st.name, st.father_name, st.grandfather_name, st.last_name]
        .map(p => (p || '').trim())
        .filter(Boolean);
    return parts.join(' ') || '—';
}

// =====================================================================
// ② تحميل بيانات الطلبة من JSON المدمج في الصفحة
// =====================================================================

/** @type {Array<Object>} */
let studentsData = [];

function loadStudentsData() {
    try {
        const raw = document.getElementById('studentsJsonData');
        if (raw && raw.textContent.trim()) {
            studentsData = JSON.parse(raw.textContent.trim());
        }
    } catch (e) {
        console.error('[equivalent_students.js] خطأ في تحميل بيانات الطلبة:', e);
        studentsData = [];
    }
}

// =====================================================================
// ②.1 نظام البحث الذكي وقائمة النتائج المطابق لشاشة بيانات الطالب
// =====================================================================

let searchDebounceTimer = null;

window.searchStudent = function() {
    const regNum = document.getElementById('searchRegNum')?.value.trim() || '';
    const name = document.getElementById('searchName')?.value.trim() || '';
    const resultsDiv = document.getElementById('searchResults');

    if (!regNum && !name) {
        window.filterEquivalentTable();
        if (resultsDiv) {
            resultsDiv.innerHTML = '';
            resultsDiv.classList.add('hidden');
        }
        return;
    }

    // تصفية الجدول المباشر أولاً
    window.filterEquivalentTable();

    // جلب الطلاب من الـ API لعرض قائمة الاقتراحات
    fetch(`/renewal/search-student-api/?reg_num=${encodeURIComponent(regNum)}&name=${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(response => response.json())
    .then(data => {
        if (!resultsDiv) return;

        if (data.success && data.students && data.students.length > 0) {
            let html = '<div class="border rounded-lg overflow-hidden" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">';
            data.students.forEach(student => {
                const fullName = `${student.name || ''} ${student.father_name || ''} ${student.grandfather_name || ''} ${student.last_name || ''}`.trim();
                html += `
                    <div class="p-3 border-b hover:bg-gray-100 cursor-pointer flex justify-between items-center search-result-item"
                         style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.15s ease;"
                         onclick="window.selectStudent(${JSON.stringify(student).replace(/"/g, '&quot;')})">
                        <div>
                            <div class="font-bold" style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">${escapeHtml(fullName)}</div>
                            <div class="text-sm text-gray-500" style="font-size: 0.85rem; color: #64748b;">رقم القيد: ${escapeHtml(student.student_id)}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            resultsDiv.innerHTML = html;
            resultsDiv.classList.remove('hidden');
        } else {
            resultsDiv.innerHTML = '<div class="text-center text-red-600 p-3 border rounded-lg" style="color: #dc2626; padding: 0.75rem; text-align: center; font-weight: 600;">❌ لا توجد نتائج مطابقة</div>';
            resultsDiv.classList.remove('hidden');
        }
    })
    .catch(error => {
        console.error('❌ Error searching student in equivalent:', error);
    });
};

window.selectStudent = function(student) {
    const regInput = document.getElementById('searchRegNum');
    const nameInput = document.getElementById('searchName');
    const resultsDiv = document.getElementById('searchResults');

    if (regInput) regInput.value = student.student_id || '';
    if (nameInput) nameInput.value = `${student.name || ''} ${student.father_name || ''}`.trim();

    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
    }

    window.filterEquivalentTable();
};

window.clearSearchResults = function() {
    const regInput = document.getElementById('searchRegNum');
    const nameInput = document.getElementById('searchName');
    const resultsDiv = document.getElementById('searchResults');
    const deptSelect = document.getElementById('filterDept');
    const yearInput = document.getElementById('filterYear');

    if (regInput) regInput.value = '';
    if (nameInput) nameInput.value = '';
    if (deptSelect) deptSelect.value = 'الكل';
    if (yearInput) yearInput.value = '';

    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
    }

    window.filterEquivalentTable();
};

window.filterEquivalentTable = function() {
    const regQuery = (document.getElementById('searchRegNum')?.value || '').trim().toLowerCase();
    const nameQuery = (document.getElementById('searchName')?.value || '').trim().toLowerCase();
    const deptQuery = (document.getElementById('filterDept')?.value || 'الكل').trim();
    const yearQuery = (document.getElementById('filterYear')?.value || '').trim();

    const tbody = document.getElementById('equivalentStudentsTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    let visibleCount = 0;

    rows.forEach(row => {
        // تجاهل صف "لا توجد سجلات" إذا وجد
        if (row.querySelector('td[colspan]')) return;

        const rowReg = (row.children[1]?.textContent || '').trim().toLowerCase();
        const rowName = (row.children[2]?.textContent || '').trim().toLowerCase();
        const rowDept = (row.children[3]?.textContent || '').trim();
        const rowDate = (row.children[6]?.textContent || '').trim();

        let matches = true;

        if (regQuery && !rowReg.includes(regQuery)) matches = false;
        if (nameQuery && !rowName.includes(nameQuery)) matches = false;
        if (deptQuery && deptQuery !== 'الكل' && rowDept !== deptQuery) matches = false;
        if (yearQuery && !rowDate.includes(yearQuery)) matches = false;

        if (matches) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const totalCountDisplay = document.getElementById('totalCountDisplay');
    if (totalCountDisplay) totalCountDisplay.textContent = visibleCount;
};


// =====================================================================
// ③ Modal – عرض تفاصيل مواد الطالب المعادَل
// =====================================================================

/**
 * عرض نافذة التفاصيل للطالب المحدد
 * @param {number} index - مؤشر الطالب في المصفوفة
 */
function showStudentDetails(index) {
    const st = studentsData[index];
    if (!st) {
        alert('لم يُعثر على بيانات هذا الطالب.');
        return;
    }

    const modal = document.getElementById('detailsModal');
    const nameEl = document.getElementById('modalStudentName');
    const bodyEl = document.getElementById('modalBodyContent');

    if (!modal || !nameEl || !bodyEl) return;

    const fullName = buildQuadName(st);
    nameEl.textContent = `تفاصيل معادلة الطالب: ${fullName}`;

    // بناء جدول المواد المعفاة
    let coursesHtml = '';
    const courses = Array.isArray(st.exempted_courses) ? st.exempted_courses : [];

    if (courses.length > 0) {
        coursesHtml = `
        <table style="width:100%; border-collapse:collapse; font-size: 0.9rem; margin-top: 0.75rem;">
            <thead>
                <tr style="background:#f1f5f9; text-align:right;">
                    <th style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0;">#</th>
                    <th style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0;">رمز المادة</th>
                    <th style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0;">اسم المادة</th>
                    <th style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0; text-align:center;">الساعات</th>
                </tr>
            </thead>
            <tbody>
                ${courses.map((c, i) => `
                <tr>
                    <td style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0; text-align:center; font-weight:700;">${i + 1}</td>
                    <td style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0; font-family:monospace; color:#0284c7; font-weight:700;">${escapeHtml(c.code || '—')}</td>
                    <td style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0; font-weight:700;">${escapeHtml(c.name || '—')}</td>
                    <td style="padding:0.5rem 0.75rem; border:1px solid #e2e8f0; text-align:center;">${escapeHtml(c.hours != null ? String(c.hours) : '—')}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    } else {
        coursesHtml = `<p style="padding: 1rem; text-align:center; color:#64748b; font-weight:700;">لا توجد مواد معفاة مسجّلة لهذا الطالب.</p>`;
    }

    // ملخص بيانات الطالب
    bodyEl.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem 1.5rem; margin-bottom:1rem; font-size:0.92rem;">
        <div><strong>رقم القيد:</strong> <span style="color:#0284c7; font-family:monospace; font-weight:700;">${escapeHtml(String(st.id || '—'))}</span></div>
        <div><strong>الاسم الرباعي:</strong> ${escapeHtml(fullName)}</div>
        <div><strong>التخصص الحالي:</strong> <span style="color:#0f766e; font-weight:700;">${escapeHtml(st.current_dept || '—')}</span></div>
        <div><strong>المستوى:</strong> ${escapeHtml(st.level || '—')}</div>
        <div><strong>تاريخ المعادلة:</strong> ${escapeHtml(st.date || '—')}</div>
        <div><strong>عدد المواد المعفاة:</strong> <span style="color:#15803d; font-weight:700;">${escapeHtml(String(courses.length))}</span></div>
    </div>
    <div style="margin-top:0.5rem;">
        <p style="font-weight:800; color:#1e293b; margin-bottom:0.25rem;">📋 قائمة المواد المعفاة:</p>
        ${coursesHtml}
    </div>`;

    modal.style.display = 'flex';
}

/** إغلاق النافذة */
function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.style.display = 'none';
}

// =====================================================================
// ④ بناء جدول التقرير الرسمي للطباعة
// =====================================================================

function buildPrintReport() {
    // قراءة قيم الفلاتر الحالية من الواجهة
    const deptSelect = document.getElementById('filterDept');
    const yearInput  = document.getElementById('filterYear');
    const totalSpan  = document.getElementById('totalCountDisplay');

    const deptText  = deptSelect
        ? (deptSelect.options[deptSelect.selectedIndex]?.text || 'كافة الأقسام والتخصصات')
        : 'كافة الأقسام والتخصصات';

    const yearText  = yearInput && yearInput.value.trim()
        ? yearInput.value.trim()
        : 'جميع السنين';

    const totalText = totalSpan ? (totalSpan.textContent.trim() + ' طالب') : `${studentsData.length} طالب`;

    // تعبئة معلومات رأس التقرير
    const rptDeptEl  = document.getElementById('rptPrintDept');
    const rptYearEl  = document.getElementById('rptPrintYear');
    const rptTotalEl = document.getElementById('rptPrintTotal');

    if (rptDeptEl)  rptDeptEl.textContent  = deptText;
    if (rptYearEl)  rptYearEl.textContent  = yearText;
    if (rptTotalEl) rptTotalEl.textContent = totalText;

    // بناء صفوف الجدول من البيانات
    const tbody = document.getElementById('rptPrintTableBody');
    if (!tbody) return;

    if (!studentsData || studentsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="rpt-empty-cell">لا توجد سجلات مطابقة لمعايير البحث.</td></tr>`;
        return;
    }

    tbody.innerHTML = studentsData.map((st, idx) => {
        const fullName    = escapeHtml(buildQuadName(st));
        const regNum      = escapeHtml(String(st.id || '—'));
        const dept        = escapeHtml(st.current_dept || '—');
        const level       = escapeHtml(st.level || '—');
        const courses     = Array.isArray(st.exempted_courses) ? st.exempted_courses.length : (st.exempted_count || 0);
        const date        = escapeHtml(st.date || '—');

        return `
        <tr>
            <td style="text-align:center; font-weight:700;">${idx + 1}</td>
            <td style="text-align:center; font-weight:700;">${regNum}</td>
            <td style="text-align:right;">${fullName}</td>
            <td style="text-align:right;">${dept}</td>
            <td style="text-align:center;">${level}</td>
            <td style="text-align:center; font-weight:700;">${courses} مواد</td>
            <td style="text-align:center;">${date}</td>
        </tr>`;
    }).join('');
}

// =====================================================================
// ⑤ طباعة التقرير الرسمي
// =====================================================================

function printOfficialReport() {
    // ① تعبئة جدول التقرير أولاً
    buildPrintReport();

    // ② نقل حاوية التقرير لـ body لضمان الطباعة الكاملة بدون قطع
    const container = document.getElementById('reportPrintContainer');
    if (container && container.parentElement !== document.body) {
        document.body.appendChild(container);
    }

    // ③ دالة الطباعة الفعلية (تُستدعى بعد اكتمال OfficialsHelper)
    const doPrint = () => window.print();

    // ④ تشغيل OfficialsHelper مع دعم async/Promise
    //    autoFill() قد يُعيد Promise (جلب البيانات من API)
    //    يجب انتظار اكتماله قبل استدعاء window.print()
    if (typeof OfficialsHelper !== 'undefined' && OfficialsHelper.autoFill) {
        try {
            const result = OfficialsHelper.autoFill();
            if (result && typeof result.then === 'function') {
                // autoFill() أعاد Promise → ننتظره
                result.then(doPrint).catch(() => {
                    // حتى لو فشل، نطبع مع الاسم الفارغ
                    doPrint();
                });
            } else {
                // autoFill() متزامن (sync) أو لا يُعيد شيئاً
                // نضيف تأخير بسيط كضمان إضافي
                setTimeout(doPrint, 400);
            }
        } catch (e) {
            console.warn('[equivalent_students.js] OfficialsHelper.autoFill() error:', e);
            doPrint();
        }
    } else {
        // OfficialsHelper غير متاح — اطبع مباشرة
        doPrint();
    }
}

// =====================================================================
// ⑥ تهيئة الصفحة عند التحميل
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // تحميل بيانات الطلبة
    loadStudentsData();

    // ① ربط زر الطباعة
    const printBtn = document.getElementById('printReportBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printOfficialReport);
    }

    // ② Event Delegation لأزرار "عرض التفاصيل" (data-student-index)
    document.addEventListener('click', (e) => {
        const detailsBtn = e.target.closest('.js-show-details');
        if (detailsBtn) {
            const idx = parseInt(detailsBtn.dataset.studentIndex, 10);
            if (!isNaN(idx)) showStudentDetails(idx);
            return;
        }

        const printBtn = e.target.closest('.js-print-single-student');
        if (printBtn) {
            const idx = parseInt(printBtn.dataset.studentIndex, 10);
            if (!isNaN(idx)) printSingleStudentEquivalenceReport(idx);
            return;
        }
    });

    // ③ ربط أزرار إغلاق Modal
    const closeBtn1 = document.getElementById('closeModalBtn');
    const closeBtn2 = document.getElementById('closeModalFooterBtn');

    if (closeBtn1) closeBtn1.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

    // ④ إغلاق Modal بالنقر خارجها
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // ⑥ ربط حقول البحث للبحث المباشر عند الكتابة
    const regInput = document.getElementById('searchRegNum');
    const nameInput = document.getElementById('searchName');

    const handleSearchInput = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            window.searchStudent();
        }, 300);
    };

    if (regInput) regInput.addEventListener('input', handleSearchInput);
    if (nameInput) nameInput.addEventListener('input', handleSearchInput);
});

// =====================================================================
// ⑦ طباعة التقرير الفردي الشامل لمعادلة الطالب وتغيير المسار
// =====================================================================
function printSingleStudentEquivalenceReport(index) {
    const st = studentsData[index];
    if (!st) {
        alert('لم يُعثر على بيانات هذا الطالب.');
        return;
    }

    const regName = window.OFFICIAL_GENERAL_REGISTRAR || 'أ. أحمد محمد علي محمود';
    const admName = window.OFFICIAL_ADMISSION_HEAD || 'أ. محمد علي عمر';
    const examsName = window.OFFICIAL_EXAMS_HEAD || '....................................';

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const fullYear = now.getFullYear();
    const studentId = st.student_id || st.id || '—';
    const autoRefNumber = `ك.ط.ع.ت / م.م / ${fullYear} / ${studentId}`;
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';
    const fullName = buildQuadName(st);

    const courses = Array.isArray(st.exempted_courses) ? st.exempted_courses : (Array.isArray(st.exempted_details) ? st.exempted_details : []);
    const remaining = Array.isArray(st.remaining_details) ? st.remaining_details : [];

    // 1. بناء صفوف المواد المعفاة / المعادلة
    let eqRowsHtml = '';
    if (courses.length > 0) {
        courses.forEach((c, idx) => {
            const srcCode = c.source_code || (c.source ? c.source.split('-')[0].trim() : '—');
            const srcName = c.source_name || (c.source ? c.source.replace(/^[^-]+-\s*/, '').trim() : (c.name || '—'));
            const trgCode = c.target_code || (c.target ? c.target.split('-')[0].trim() : (c.code || '—'));
            const trgName = c.target_name || (c.target ? c.target.replace(/^[^-]+-\s*/, '').trim() : (c.name || '—'));
            const notes = c.notes || 'مادة معفاة / معادلة';

            eqRowsHtml += `
                <tr style="background: #f7fee7; border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 8px; text-align: center; font-weight: 800; border: 1px solid #334155;">${idx + 1}</td>
                    <td style="padding: 6px 10px; border: 1px solid #334155; text-align: right;">
                        <strong style="color: #0f172a; font-size: 12.5px;">${escapeHtml(srcName)}</strong>
                        <div style="font-size: 11px; color: #475569; font-family: monospace;">رمز: ${escapeHtml(srcCode)}</div>
                    </td>
                    <td style="padding: 6px 8px; text-align: center; font-size: 14px; border: 1px solid #334155;">➡️</td>
                    <td style="padding: 6px 10px; border: 1px solid #334155; text-align: right;">
                        <strong style="color: #15803d; font-size: 12.5px;">${escapeHtml(trgName)}</strong>
                        <div style="font-size: 11px; color: #475569; font-family: monospace;">رمز: ${escapeHtml(trgCode)}</div>
                    </td>
                    <td style="padding: 6px 10px; text-align: center; border: 1px solid #334155;">
                        <span style="font-weight: 800; color: #15803d; font-size: 11.5px;">${escapeHtml(notes)}</span>
                    </td>
                </tr>
            `;
        });
    } else {
        eqRowsHtml = `
            <tr>
                <td colspan="5" style="padding: 16px; text-align: center; color: #64748b; font-weight: 700; border: 1px solid #334155;">
                    لا توجد مواد معفاة / معادلة مسجلة لهذا الطالب.
                </td>
            </tr>
        `;
    }

    // 2. بناء صفوف المواد المتبقية
    let remRowsHtml = '';
    if (remaining.length > 0) {
        remaining.forEach((r, idx) => {
            const rCode = typeof r === 'object' ? (r.code || '—') : (r.split('-')[0]?.trim() || '—');
            const rName = typeof r === 'object' ? (r.name || '—') : (r.replace(/^[^-]+-\s*/, '')?.trim() || r);
            const rDept = typeof r === 'object' ? (r.department || 'عام') : (st.current_dept || 'عام');
            const rCredits = typeof r === 'object' ? (r.credits || 3) : 3;

            remRowsHtml += `
                <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 5px 8px; text-align: center; font-weight: 800; border: 1px solid #334155;">${idx + 1}</td>
                    <td style="padding: 5px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #0369a1; border: 1px solid #334155;">${escapeHtml(rCode)}</td>
                    <td style="padding: 5px 10px; text-align: right; font-weight: 700; font-size: 12px; border: 1px solid #334155;">${escapeHtml(rName)}</td>
                    <td style="padding: 5px 10px; text-align: center; color: #334155; font-size: 11.5px; border: 1px solid #334155;">${escapeHtml(rDept)}</td>
                    <td style="padding: 5px 8px; text-align: center; font-weight: 800; border: 1px solid #334155;">${escapeHtml(String(rCredits))}</td>
                </tr>
            `;
        });
    } else {
        remRowsHtml = `
            <tr>
                <td colspan="5" style="padding: 14px; text-align: center; color: #64748b; font-weight: 700; border: 1px solid #334155;">
                    لا توجد مواد متبقية.
                </td>
            </tr>
        `;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير اعتماد معادلة المواد وتغيير المسار - ${escapeHtml(fullName)}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 6mm 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
        background: #fff;
        color: #000;
        direction: rtl;
        font-size: 11px;
        line-height: 1.38;
        padding: 4px;
    }
    .print-frame {
        border: 2px solid #000;
        padding: 10px 12px;
        border-radius: 6px;
        min-height: 275mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .header-table {
        width: 100%;
        border-bottom: 2px solid #000;
        padding-bottom: 6px;
        margin-bottom: 8px;
    }
    .report-title {
        text-align: center;
        font-size: 13.5pt;
        font-weight: 900;
        margin: 4px 0 8px;
        text-decoration: underline;
        color: #0f172a;
    }
    .info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
    }
    .info-table td {
        padding: 4px 6px;
        border: 1px solid #334155;
        font-size: 11px;
    }
    .info-table .lbl {
        font-weight: 800;
        background: #f1f5f9;
        width: 18%;
        color: #1e293b;
    }
    .info-table .val {
        font-weight: 700;
        color: #000;
        width: 32%;
    }
    .section-head {
        font-size: 11.5px;
        font-weight: 900;
        padding: 3px 6px;
        background: #f1f5f9;
        border: 1px solid #334155;
        border-bottom: none;
        margin-top: 8px;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
    }
    .data-table th {
        background: #e2e8f0;
        border: 1px solid #334155;
        padding: 5px 6px;
        font-size: 11px;
        font-weight: 900;
        text-align: center;
    }
    .signatures-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-top: 14px;
        page-break-inside: avoid;
        break-inside: avoid;
    }
    .sig-box {
        border: 1.5px solid #000;
        padding: 6px 4px;
        text-align: center;
        border-radius: 6px;
        background: #fff;
    }
    .sig-title {
        font-size: 11px;
        font-weight: 900;
        margin-bottom: 3px;
        color: #000;
    }
    .sig-name {
        font-size: 10px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 22px;
    }
    .sig-line {
        font-size: 9.5px;
        font-weight: 700;
    }
    .footer-note {
        text-align: center;
        margin-top: 8px;
        font-size: 8.5px;
        color: #475569;
        border-top: 1px dashed #64748b;
        padding-top: 4px;
    }
</style>
</head>
<body>
    <div class="print-frame">
        <div>
            <!-- الترويسة الرسمية -->
            <table class="header-table">
                <tr>
                    <td style="text-align: right; width: 35%; font-size: 10.5px; line-height: 1.4; font-weight: 800;">
                        <div>دولة ليبيا</div>
                        <div>وزارة التعليم العالي والبحث العلمي</div>
                        <div>كلية العلوم والتقنية</div>
                        <div style="color: #334155;">إدارة الشؤون العلمية / مكتب الدراسة والامتحانات</div>
                    </td>
                    <td style="text-align: center; width: 30%;">
                        <img src="${logoUrl}" alt="شعار الكلية" style="height: 65px; width: auto; object-fit: contain;" />
                    </td>
                    <td style="text-align: left; width: 35%; font-size: 10px; line-height: 1.5; font-weight: 800;">
                        <div>التاريخ: ${dateStr}</div>
                        <div>تاريخ المعادلة: ${escapeHtml(st.date || '—')}</div>
                        <div>الرقم الإشاري: ${autoRefNumber}</div>
                    </td>
                </tr>
            </table>

            <div class="report-title">تقرير اعتماد معادلة المواد وتغيير المسار الأكاديمي</div>

            <!-- جدول البيانات الأكاديمية للطالب -->
            <table class="info-table">
                <tr>
                    <td class="lbl">اسم الطالب الكامل:</td>
                    <td class="val" style="font-weight: 900; font-size: 12px;">${escapeHtml(fullName)}</td>
                    <td class="lbl">رقم القيد:</td>
                    <td class="val" style="font-family: monospace; font-size: 12.5px; font-weight: 900;">${escapeHtml(studentId)}</td>
                </tr>
                <tr>
                    <td class="lbl">التخصص الحالي المعتمد:</td>
                    <td class="val" style="color: #15803d; font-weight: 900;">${escapeHtml(st.current_dept || '—')}</td>
                    <td class="lbl">المستوى الأكاديمي:</td>
                    <td class="val">${escapeHtml(st.level || '—')}</td>
                </tr>
                <tr>
                    <td class="lbl">الحالة الأكاديمية:</td>
                    <td class="val">${escapeHtml(st.status || 'منتظم')}</td>
                    <td class="lbl">إجمالي المواد المعفاة:</td>
                    <td class="val" style="font-weight: 900; color: #15803d;">${courses.length} مواد</td>
                </tr>
            </table>

            <!-- جدول المواد المعفاة / المعادلة -->
            <div class="section-head" style="color: #15803d;">🟢 المواد المعفاة والمعادلة بالتخصص (${courses.length})</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">#</th>
                        <th style="width: 42%;">المادة الأصلية (الناجح فيها)</th>
                        <th style="width: 35px;">⬅️</th>
                        <th style="width: 42%;">المادة المعفاة والمعادلة</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${eqRowsHtml}
                </tbody>
            </table>

            <!-- جدول المواد المتبقية والملزم بدراستها -->
            <div class="section-head" style="color: #0369a1;">📘 المواد المطلوبة والملزم بدراستها في التخصص (${remaining.length})</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">#</th>
                        <th style="width: 15%;">رمز المادة</th>
                        <th style="width: 50%;">اسم المادة الدراسية</th>
                        <th style="width: 22%;">القسم الدراسي</th>
                        <th style="width: 13%;">الساعات</th>
                    </tr>
                </thead>
                <tbody>
                    ${remRowsHtml}
                </tbody>
            </table>
        </div>

        <!-- صناديق التوقيع والاعتماد الرسمية الثلاثية -->
        <div>
            <div class="signatures-row">
                <div class="sig-box">
                    <div class="sig-title">رئيس قسم التسجيل والقبول</div>
                    <div class="sig-name">${escapeHtml(admName)}</div>
                    <div class="sig-line">التوقيع والختم: ..........................</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">الشؤون العلمية والدراسة والامتحانات</div>
                    <div class="sig-name">${escapeHtml(examsName)}</div>
                    <div class="sig-line">التوقيع والختم: ..........................</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">المسجل العام بالكلية</div>
                    <div class="sig-name">${escapeHtml(regName)}</div>
                    <div class="sig-line">التوقيع والختم: ..........................</div>
                </div>
            </div>

            <div class="footer-note">
                ملاحظة: يعتبر هذا التقرير وثيقة رسمية معتمدة لمعادلة المواد وتغيير المسار ولا يعتد به دون التواقيع والأختام الرسمية المعتمدة.
            </div>
        </div>
    </div>
</body>
</html>`;

    // إنشاء وتفعيل iframe خفي للطباعة الفورية
    let printIframe = document.getElementById('singleStudentHiddenPrintIframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'singleStudentHiddenPrintIframe';
        printIframe.style.position = 'fixed';
        printIframe.style.top = '-9999px';
        printIframe.style.left = '-9999px';
        printIframe.style.width = '0px';
        printIframe.style.height = '0px';
        printIframe.style.border = 'none';
        document.body.appendChild(printIframe);
    }

    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
        try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        } catch (e) {
            console.error('Print iframe error:', e);
            const w = window.open('', '_blank');
            w.document.write(printHtml);
            w.document.close();
            w.focus();
            w.print();
        }
    }, 350);
}

window.printSingleStudentEquivalenceReport = printSingleStudentEquivalenceReport;