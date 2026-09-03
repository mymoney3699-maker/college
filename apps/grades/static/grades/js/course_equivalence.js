// ============================================
// معادلة المواد - Course Equivalence Page Logic v1.0.3
// ============================================

console.log('✅ course_equivalence.js v1.0.3 loaded successfully');

let equivalences = [];
let editingIndex = -1;

function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 🔔 نظام الإشعارات العائمة الموحد (showNotification)
// ============================================================
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const iconCircle = document.getElementById('toastIconCircle');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    if (!toast || !icon || !msg) {
        console.warn('⚠️ Toast Notification elements not found:', type, message);
        return;
    }
    
    msg.innerText = message;
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    // ضبط لون وخلفية البطاقة حسب النمط الليلي / النهاري
    if (isDark) {
        toast.style.background = '#1e293b';
        toast.style.backgroundColor = '#1e293b';
        toast.style.boxShadow = '0 14px 45px rgba(0, 0, 0, 0.7)';
        msg.style.color = '#f8fafc';
    } else {
        toast.style.background = '#ffffff';
        toast.style.backgroundColor = '#ffffff';
        toast.style.boxShadow = '0 12px 35px -5px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)';
        msg.style.color = '#1e293b';
    }
    
    if (type === 'success') {
        toast.style.borderRight = '4.5px solid #10b981';
        toast.style.borderRightColor = '#10b981';
        icon.innerText = "check_circle";
        icon.style.color = '#10b981';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)';
        }
    } else if (type === 'warning') {
        toast.style.borderRight = '4.5px solid #f59e0b';
        toast.style.borderRightColor = '#f59e0b';
        icon.innerText = "warning";
        icon.style.color = '#f59e0b';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)';
        }
    } else if (type === 'info') {
        toast.style.borderRight = '4.5px solid #3b82f6';
        toast.style.borderRightColor = '#3b82f6';
        icon.innerText = "info";
        icon.style.color = '#3b82f6';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)';
        }
    } else {
        toast.style.borderRight = '4.5px solid #e11d48';
        toast.style.borderRightColor = '#e11d48';
        icon.innerText = "error";
        icon.style.color = '#e11d48';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(225, 29, 72, 0.2)' : 'rgba(225, 29, 72, 0.12)';
        }
    }
    
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    
    clearTimeout(window.notificationTimeout);
    window.notificationTimeout = setTimeout(() => {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
    }, 4000);
}

window.showNotification = showNotification;
window.toastSuccess = (msg) => showNotification('success', msg);
window.toastError = (msg) => showNotification('error', msg);
window.toastWarning = (msg) => showNotification('warning', msg);
window.toastInfo = (msg) => showNotification('info', msg);
window.showToastMessage = (message, isError = false, type = null) => {
    if (type) {
        showNotification(type, message);
    } else {
        showNotification(isError ? 'error' : 'success', message);
    }
};

// تفريغ المدخلات
function clearEquivalenceForm() {
    const sId = document.getElementById('studentId');
    if (sId) sId.value = '';
    const sName = document.getElementById('studentName');
    if (sName) sName.value = '';
    const eqDate = document.getElementById('equivalenceDate');
    if (eqDate) eqDate.value = '';
    const newMaj = document.getElementById('newMajor');
    if (newMaj) newMaj.value = '';
    const oldMaj = document.getElementById('oldMajor');
    if (oldMaj) oldMaj.value = '';
    const gr = document.getElementById('grade');
    if (gr) gr.value = '';
    const hrs = document.getElementById('hours');
    if (hrs) hrs.value = '';
    const newSub = document.getElementById('newSubject');
    if (newSub) newSub.value = '';
    const oldSub = document.getElementById('oldSubject');
    if (oldSub) oldSub.value = '';
    const nts = document.getElementById('notes');
    if (nts) nts.value = '';
    
    editingIndex = -1;
    
    // تغيير لون وحالة زر الإضافة
    const saveBtn = document.querySelector('.btn-save');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined">library_add</span> إضافة المعادلة';
    }
}

// إضافة أو تحديث معادلة
function addEquivalence() {
    const studentId = document.getElementById('studentId')?.value.trim() || '';
    const studentName = document.getElementById('studentName')?.value.trim() || '';
    const equivalenceDate = document.getElementById('equivalenceDate')?.value || '';
    const newMajor = document.getElementById('newMajor')?.value.trim() || '';
    const oldMajor = document.getElementById('oldMajor')?.value.trim() || '';
    const grade = document.getElementById('grade')?.value.trim() || '';
    const hours = document.getElementById('hours')?.value.trim() || '';
    const newSubject = document.getElementById('newSubject')?.value.trim() || '';
    const oldSubject = document.getElementById('oldSubject')?.value.trim() || '';
    const notes = document.getElementById('notes')?.value.trim() || '';

    if (!studentId || !studentName || !newMajor || !oldMajor || !newSubject || !oldSubject) {
        showNotification('warning', 'الرجاء إدخال الحقول الأساسية المطلوبة للمعادلة');
        return;
    }

    const item = {
        studentId,
        studentName,
        equivalenceDate,
        newMajor,
        oldMajor,
        grade,
        hours,
        newSubject,
        oldSubject,
        notes
    };

    if (editingIndex > -1) {
        // تحديث العنصر
        equivalences[editingIndex] = item;
        showNotification('success', 'تم تعديل التخصص والمعادلة بنجاح');
        editingIndex = -1;
        const saveBtn = document.querySelector('.btn-save');
        if (saveBtn) saveBtn.innerHTML = '<span class="material-symbols-outlined">library_add</span> إضافة المعادلة';
    } else {
        // إضافة عنصر جديد
        equivalences.push(item);
        showNotification('success', 'تمت المعادلة بنجاح وإضافتها للقائمة');
    }

    renderTable();
    clearEquivalenceForm();
}

// حذف معادلة
function deleteEquivalence(index) {
    if (confirm('هل أنت متأكد من حذف هذه المعادلة؟')) {
        equivalences.splice(index, 1);
        showNotification('success', 'تم حذف المعادلة من القائمة بنجاح');
        renderTable();
    }
}

// اختيار معادلة لتعديلها
function selectForEdit(index) {
    const item = equivalences[index];
    editingIndex = index;

    const sId = document.getElementById('studentId');
    if (sId) sId.value = item.studentId;
    const sName = document.getElementById('studentName');
    if (sName) sName.value = item.studentName;
    const eqDate = document.getElementById('equivalenceDate');
    if (eqDate) eqDate.value = item.equivalenceDate;
    const newMaj = document.getElementById('newMajor');
    if (newMaj) newMaj.value = item.newMajor;
    const oldMaj = document.getElementById('oldMajor');
    if (oldMaj) oldMaj.value = item.oldMajor;
    const gr = document.getElementById('grade');
    if (gr) gr.value = item.grade;
    const hrs = document.getElementById('hours');
    if (hrs) hrs.value = item.hours;
    const newSub = document.getElementById('newSubject');
    if (newSub) newSub.value = item.newSubject;
    const oldSub = document.getElementById('oldSubject');
    if (oldSub) oldSub.value = item.oldSubject;
    const nts = document.getElementById('notes');
    if (nts) nts.value = item.notes;

    const saveBtn = document.querySelector('.btn-save');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> حفظ التعديل';
    }
    
    showNotification('info', 'تم تحميل بيانات المعادلة والتخصص للتعديل');
}

// تعديل المعادلة (زر تعديل عام)
function editEquivalence() {
    if (equivalences.length === 0) {
        showNotification('warning', 'لا توجد معادلات لتعديلها');
        return;
    }
    // اختيار أول عنصر بشكل افتراضي
    selectForEdit(0);
}

// عرض الجدول
function renderTable() {
    const container = document.getElementById('equivalenceTableContainer');
    const tbody = document.getElementById('equivalenceTableBody');

    if (equivalences.length > 0) {
        if (container) container.style.display = 'block';
        tbody.innerHTML = equivalences.map((eq, index) => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onclick="selectForEdit(${index})">
                <td class="text-center font-bold px-3 py-2.5">${escapeHtml(eq.studentId)}</td>
                <td class="px-3 py-2.5 font-bold">${escapeHtml(eq.studentName)}</td>
                <td class="text-center px-3 py-2.5">${escapeHtml(eq.equivalenceDate)}</td>
                <td class="px-3 py-2.5">${escapeHtml(eq.oldMajor)}</td>
                <td class="px-3 py-2.5">${escapeHtml(eq.newMajor)}</td>
                <td class="text-center font-bold px-3 py-2.5">${escapeHtml(eq.grade)}</td>
                <td class="text-center px-3 py-2.5">${escapeHtml(eq.hours)}</td>
                <td class="px-3 py-2.5">${escapeHtml(eq.oldSubject)}</td>
                <td class="px-3 py-2.5 font-semibold text-primary">${escapeHtml(eq.newSubject)}</td>
                <td class="px-3 py-2.5 text-xs text-slate-500">${escapeHtml(eq.notes)}</td>
                <td class="text-center px-3 py-2.5" onclick="event.stopPropagation(); deleteEquivalence(${index})">
                    <button class="text-red-600 hover:text-red-800">
                        <span class="material-symbols-outlined text-[18px] align-middle">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');
    } else {
        if (container) container.style.display = 'none';
        tbody.innerHTML = '<tr class="empty-row"><td colspan="11" class="empty-cell">لا توجد معادلات</td></tr>';
    }
}

// ============================================================
// 🖨️ نظام طباعة تقرير المعادلة وتغيير المسار الرسمي A4 عبر Hidden iframe
// ============================================================
async function printEquivalenceReport() {
    const data = window.EQUIVALENCE_REPORT_DATA;
    if (!data) {
        window.print();
        return;
    }

    let regName = window.OFFICIAL_GENERAL_REGISTRAR || 'أ. أحمد محمد علي محمود';
    let admName = window.OFFICIAL_ADMISSION_HEAD || 'أ. أميرة الشلادي';
    let examsName = window.OFFICIAL_EXAMS_HEAD || 'أ. لبنى';

    if (window.OfficialsHelper) {
        const regOff = await window.OfficialsHelper.getOfficialAsync('registrar');
        if (regOff) regName = window.OfficialsHelper.buildName(regOff);
        const admOff = await window.OfficialsHelper.getOfficialAsync('admission');
        if (admOff) admName = window.OfficialsHelper.buildName(admOff);
        const coordOff = await window.OfficialsHelper.getOfficialAsync('exams_coordinator');
        if (coordOff) examsName = window.OfficialsHelper.buildName(coordOff);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const fullYear = now.getFullYear();
    const autoRefNumber = `ك.ط.ع.ت / م.م / ${fullYear} / ${data.student_id}`;
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // 1. بناء جدول المواد المعفاة / المعادلة
    let eqRowsHtml = '';
    if (data.equivalenced_courses && data.equivalenced_courses.length > 0) {
        data.equivalenced_courses.forEach((eq, idx) => {
            eqRowsHtml += `
                <tr style="background: #f7fee7; border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 6px 8px; text-align: center; font-weight: 800; border: 1px solid #334155;">${idx + 1}</td>
                    <td style="padding: 6px 10px; border: 1px solid #334155; text-align: right;">
                        <strong style="color: #0f172a; font-size: 12.5px;">${escapeHtml(eq.source_name)}</strong>
                        <div style="font-size: 11px; color: #475569; font-family: monospace;">رمز: ${escapeHtml(eq.source_code)}</div>
                    </td>
                    <td style="padding: 6px 8px; text-align: center; font-size: 14px; border: 1px solid #334155;">➡️</td>
                    <td style="padding: 6px 10px; border: 1px solid #334155; text-align: right;">
                        <strong style="color: #15803d; font-size: 12.5px;">${escapeHtml(eq.target_name)}</strong>
                        <div style="font-size: 11px; color: #475569; font-family: monospace;">رمز: ${escapeHtml(eq.target_code)}</div>
                    </td>
                    <td style="padding: 6px 10px; text-align: center; border: 1px solid #334155;">
                        <span style="font-weight: 800; color: #15803d; font-size: 11.5px;">مادة معفاة / معادلة</span>
                    </td>
                </tr>
            `;
        });
    } else {
        eqRowsHtml = `
            <tr>
                <td colspan="5" style="padding: 16px; text-align: center; color: #64748b; font-weight: 700; border: 1px solid #334155;">
                    لا توجد مواد معفاة / معادلة مسجلة للطالب.
                </td>
            </tr>
        `;
    }

    // 2. بناء جدول المواد المتبقية والملزم بدراستها
    let remRowsHtml = '';
    if (data.remaining_courses && data.remaining_courses.length > 0) {
        data.remaining_courses.forEach((crs, idx) => {
            remRowsHtml += `
                <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 5px 8px; text-align: center; font-weight: 800; border: 1px solid #334155;">${idx + 1}</td>
                    <td style="padding: 5px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #0369a1; border: 1px solid #334155;">${escapeHtml(crs.code)}</td>
                    <td style="padding: 5px 10px; text-align: right; font-weight: 700; font-size: 12px; border: 1px solid #334155;">${escapeHtml(crs.name)}</td>
                    <td style="padding: 5px 10px; text-align: center; color: #334155; font-size: 11.5px; border: 1px solid #334155;">${escapeHtml(crs.department || 'عام')}</td>
                    <td style="padding: 5px 8px; text-align: center; font-weight: 800; border: 1px solid #334155;">${escapeHtml(crs.credits)}</td>
                </tr>
            `;
        });
    } else {
        remRowsHtml = `
            <tr>
                <td colspan="5" style="padding: 16px; text-align: center; color: #64748b; font-weight: 700; border: 1px solid #334155;">
                    لا توجد مواد متبقية.
                </td>
            </tr>
        `;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير اعتماد معادلة المواد وتغيير المسار - ${escapeHtml(data.student_name)}</title>
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
                        <div>الفصل الدراسي: ${escapeHtml(data.semester)}</div>
                        <div>الرقم الإشاري: ${autoRefNumber}</div>
                    </td>
                </tr>
            </table>

            <div class="report-title">تقرير اعتماد معادلة المواد وتغيير المسار الأكاديمي</div>

            <!-- جدول البيانات الأكاديمية للطالب -->
            <table class="info-table">
                <tr>
                    <td class="lbl">اسم الطالب الكامل:</td>
                    <td class="val" style="font-weight: 900; font-size: 12px;">${escapeHtml(data.student_name)}</td>
                    <td class="lbl">رقم القيد:</td>
                    <td class="val" style="font-family: monospace; font-size: 12.5px; font-weight: 900;">${escapeHtml(data.student_id)}</td>
                </tr>
                <tr>
                    <td class="lbl">التخصص السابق:</td>
                    <td class="val" style="color: #0369a1;">${escapeHtml(data.old_dept)}</td>
                    <td class="lbl">التخصص المعتمد (الجديد):</td>
                    <td class="val" style="color: #15803d; font-weight: 900;">${escapeHtml(data.new_dept)}</td>
                </tr>
                <tr>
                    <td class="lbl">المستوى / الفصل الحالي:</td>
                    <td class="val">${escapeHtml(data.level)}</td>
                    <td class="lbl">الحالة الأكاديمية:</td>
                    <td class="val">${escapeHtml(data.status)}</td>
                </tr>
            </table>

            <!-- جدول المواد المعفاة / المعادلة -->
            <div class="section-head" style="color: #15803d;">🟢 المواد المعفاة والمعادلة بالقسم الجديد (${data.equivalenced_courses ? data.equivalenced_courses.length : 0})</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">#</th>
                        <th style="width: 42%;">المادة الأصلية (الناجح فيها)</th>
                        <th style="width: 35px;">⬅️</th>
                        <th style="width: 42%;">المادة المعفاة والمعادلة بالقسم الجديد</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${eqRowsHtml}
                </tbody>
            </table>

            <!-- جدول المواد المتبقية والملزم بدراستها -->
            <div class="section-head" style="color: #0369a1;">📘 المواد المطلوبة والملزم بدراستها في التخصص الجديد (${data.remaining_courses ? data.remaining_courses.length : 0})</div>
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
                    <div class="sig-name">${escapeHtml(admName)}</div>
                    <div class="sig-title">رئيس قسم التسجيل والقبول</div>
                    <div class="sig-line">التوقيع والختم: ....................................</div>
                </div>
                <div class="sig-box">
                    <div class="sig-name">${escapeHtml(examsName)}</div>
                    <div class="sig-title">منسق الدراسة والامتحانات</div>
                    <div class="sig-line">التوقيع والختم: ....................................</div>
                </div>
                <div class="sig-box">
                    <div class="sig-name">${escapeHtml(regName)}</div>
                    <div class="sig-title">المسجل العام بالكلية</div>
                    <div class="sig-line">التوقيع والختم: ....................................</div>
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
    let printIframe = document.getElementById('equivalenceHiddenPrintIframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'equivalenceHiddenPrintIframe';
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

function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// ربط المكونات للنطاق العام
window.showNotification = showNotification;
window.toastSuccess = toastSuccess;
window.toastError = toastError;
window.toastWarning = toastWarning;
window.toastInfo = toastInfo;
window.showToastMessage = showToastMessage;
window.clearEquivalenceForm = clearEquivalenceForm;
window.addEquivalence = addEquivalence;
window.deleteEquivalence = deleteEquivalence;
window.selectForEdit = selectForEdit;
window.editEquivalence = editEquivalence;
window.printEquivalenceTable = printEquivalenceReport;
window.printEquivalenceReport = printEquivalenceReport;
window.goBack = goBack;

// ============================================================
// 🔥 التحكم في حالة الأزرار والمدخلات بناءً على صلاحية معادلة المواد وتغيير المسار (Job Permission)
// ============================================================

function applyEquivalencePermissionUI(isOpen, message) {
    const btnSearch = document.getElementById('btnSearchEquivalence');
    const btnConfirm = document.getElementById('btnConfirmTransfer');
    const searchInput = document.getElementById('searchEquivalenceInput');
    const deptSelect = document.getElementById('newDepartmentSelect');

    const targetButtons = [btnSearch, btnConfirm];
    const targetInputs = [searchInput, deptSelect];

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    console.log(`🔐 Course Equivalence Job Permission State - Is Open: ${isOpen}`);

    const displayMsg = message || '⚠️ خدمة "معادلة المواد وتغيير المسار" غير مفعلة حالياً في إدارة الوظائف.';

    if (banner) {
        if (!isOpen) {
            if (bannerText) bannerText.textContent = displayMsg;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    targetButtons.forEach(btn => {
        if (btn) {
            if (!isOpen) {
                btn.disabled = true;
                btn.setAttribute('disabled', 'disabled');
                btn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btn.style.setProperty('opacity', '0.5', 'important');
                btn.style.setProperty('cursor', 'not-allowed', 'important');
                btn.style.setProperty('pointer-events', 'none', 'important');
                btn.style.setProperty('filter', 'grayscale(80%)', 'important');
                btn.title = displayMsg;
            } else {
                btn.disabled = false;
                btn.removeAttribute('disabled');
                btn.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btn.style.setProperty('opacity', '1', 'important');
                btn.style.setProperty('cursor', 'pointer', 'important');
                btn.style.setProperty('pointer-events', 'auto', 'important');
                btn.style.setProperty('filter', 'none', 'important');
                btn.title = '';
            }
        }
    });

    targetInputs.forEach(input => {
        if (input) {
            if (!isOpen) {
                input.disabled = true;
                input.setAttribute('disabled', 'disabled');
                input.classList.add('opacity-60', 'cursor-not-allowed');
                input.style.setProperty('opacity', '0.6', 'important');
                input.style.setProperty('cursor', 'not-allowed', 'important');
                input.title = displayMsg;
            } else {
                input.disabled = false;
                input.removeAttribute('disabled');
                input.classList.remove('opacity-60', 'cursor-not-allowed');
                input.style.setProperty('opacity', '1', 'important');
                input.style.setProperty('cursor', 'auto', 'important');
                input.title = '';
            }
        }
    });
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_EQUIVALENCE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_EQUIVALENCE_JOB_OPEN) : false;
    const message = window.EQUIVALENCE_JOB_MESSAGE || '';

    applyEquivalencePermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_EQUIVALENCE_JOB_OPEN = Boolean(data.is_equivalence_job_open);
            window.EQUIVALENCE_JOB_MESSAGE = data.equivalence_job_message || '';
            applyEquivalencePermissionUI(window.IS_EQUIVALENCE_JOB_OPEN, window.EQUIVALENCE_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic equivalence job permission check error:', err);
    });
}
window.updateJobPermissionState = updateJobPermissionState;

// ============================================================
// 🌟 تأكيد اعتماد تغيير المسار عبر مودال عصري SweetAlert2
// ============================================================

function initTransferConfirmation() {
    const btnConfirm = document.getElementById('btnConfirmTransfer');
    const form = document.getElementById('equivalenceTransferForm');

    if (!btnConfirm || !form) return;

    btnConfirm.addEventListener('click', function(e) {
        e.preventDefault();

        const isEquivalenceOpen = (typeof window.IS_EQUIVALENCE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_EQUIVALENCE_JOB_OPEN) : false;
        if (!isEquivalenceOpen) {
            showNotification('error', window.EQUIVALENCE_JOB_MESSAGE || '⚠️ عذراً، خدمة معادلة المواد وتغيير المسار غير مفعلة حالياً.');
            return;
        }

        const studentName = form.getAttribute('data-student-name') || 'التونسي';
        const deptName = form.getAttribute('data-department-name') || 'إدارة أعمال';

        const confirmationText = `هل أنت متأكد من رغبتك في اعتماد تغيير مسار الطالب ${studentName} إلى قسم [${deptName}] وتنزيل المعادلة؟`;
        const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '<div style="font-size: 1.35rem; font-weight: 900; margin-bottom: 0.25rem;">تأكيد اعتماد تغيير المسار</div>',
                html: `<div style="font-size: 1.05rem; line-height: 1.7; font-weight: 600; color: ${isDark ? '#e2e8f0' : '#1e293b'};">
                        ${confirmationText}
                       </div>`,
                icon: 'question',
                iconColor: '#10b981',
                showCancelButton: true,
                confirmButtonText: '<span style="display:inline-flex;align-items:center;gap:6px;"><i class="material-symbols-outlined" style="font-size:20px;vertical-align:middle;">check_circle</i> نعم، تأكيد الاعتماد</span>',
                cancelButtonText: '<span style="display:inline-flex;align-items:center;gap:6px;"><i class="material-symbols-outlined" style="font-size:20px;vertical-align:middle;">cancel</i> إلغاء الأمر</span>',
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#ef4444',
                buttonsStyling: true,
                customClass: {
                    popup: 'swal-custom-theme',
                    confirmButton: 'swal2-confirm-green',
                    cancelButton: 'swal2-cancel-red',
                },
                reverseButtons: true,
                focusConfirm: true,
                background: isDark ? '#1e293b' : '#ffffff',
                color: isDark ? '#f8fafc' : '#1e293b',
            }).then((result) => {
                if (result.isConfirmed) {
                    form.submit();
                }
            });
        } else {
            if (window.confirm(confirmationText)) {
                form.submit();
            }
        }
    });
}
window.initTransferConfirmation = initTransferConfirmation;

// ============================================================
// 🔍 نظام البحث التفاعلي الفوري للطلاب (Live Autocomplete Search)
// ============================================================
function initStudentSearchAutocomplete() {
    const searchInput = document.getElementById('searchEquivalenceInput');
    const dropdown = document.getElementById('studentSearchResultsDropdown');
    if (!searchInput || !dropdown) return;

    let debounceTimer = null;
    let selectedIndex = -1;
    let currentItems = [];

    function closeDropdown() {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        selectedIndex = -1;
        currentItems = [];
    }

    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        clearTimeout(debounceTimer);

        if (!query) {
            closeDropdown();
            return;
        }

        debounceTimer = setTimeout(() => {
            fetch(`/grades/api/search-students/?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.success || !data.students || data.students.length === 0) {
                        dropdown.innerHTML = `
                            <div style="padding: 12px 16px; text-align: center; color: #94a3b8; font-size: 0.9rem;">
                                <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 18px; margin-left: 4px;">search_off</span>
                                لا توجد نتائج مطابقة لـ "<strong>${escapeHtml(query)}</strong>"
                            </div>
                        `;
                        dropdown.style.display = 'block';
                        currentItems = [];
                        return;
                    }

                    currentItems = data.students;
                    selectedIndex = -1;

                    let html = `
                        <div style="padding: 6px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.8rem; font-weight: 700; color: #64748b; display: flex; justify-content: space-between;">
                            <span>النتائج المطابقة (${data.students.length})</span>
                            <span style="font-weight: 500;">اختر طالباً للعرض</span>
                        </div>
                        <div style="max-height: 240px; overflow-y: auto;">
                    `;

                    data.students.forEach((st, idx) => {
                        html += `
                            <div class="autocomplete-item equivalence-search-item" data-index="${idx}" data-student-id="${escapeHtml(st.student_id)}" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
                                <div>
                                    <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">
                                        ${escapeHtml(st.name || st.full_name)}
                                    </div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                                        <span style="color: #0284c7; font-weight: 700;">${escapeHtml(st.department || 'عام')}</span>
                                        ${st.level ? ` &bull; <span>${escapeHtml(st.level)}</span>` : ''}
                                        ${st.status ? ` &bull; <span style="color: #e11d48;">${escapeHtml(st.status)}</span>` : ''}
                                    </div>
                                </div>
                                <div>
                                    <span style="background: #e0f2fe; color: #0369a1; font-family: monospace; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-size: 0.85rem; border: 1px solid #bae6fd;">
                                        ${escapeHtml(st.student_id)}
                                    </span>
                                </div>
                            </div>
                        `;
                    });

                    html += `</div>`;
                    dropdown.innerHTML = html;
                    dropdown.style.display = 'block';

                    // ربط أحداث النقر على عناصر الاقتراحات
                    const items = dropdown.querySelectorAll('.equivalence-search-item');
                    items.forEach(item => {
                        item.addEventListener('mouseenter', function() {
                            items.forEach(i => i.style.background = '#ffffff');
                            this.style.background = '#f0f9fa';
                            selectedIndex = parseInt(this.getAttribute('data-index'), 10);
                        });

                        item.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            const stId = this.getAttribute('data-student-id');
                            if (stId) {
                                window.location.href = `/grades/course-equivalence/?student_id=${encodeURIComponent(stId)}&search=${encodeURIComponent(stId)}`;
                            }
                        });
                    });
                })
                .catch(err => {
                    console.error('Error fetching student suggestions:', err);
                });
        }, 220);
    });

    // التنقل بالأسهم والزر Enter
    searchInput.addEventListener('keydown', function(e) {
        if (dropdown.style.display !== 'block' || currentItems.length === 0) return;

        const items = dropdown.querySelectorAll('.equivalence-search-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            highlightItem(items, selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            highlightItem(items, selectedIndex);
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && selectedIndex < items.length) {
                e.preventDefault();
                items[selectedIndex].click();
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    function highlightItem(items, idx) {
        items.forEach((item, i) => {
            if (i === idx) {
                item.style.background = '#e0f2fe';
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.style.background = '#ffffff';
            }
        });
    }

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            closeDropdown();
        }
    });
}
window.initStudentSearchAutocomplete = initStudentSearchAutocomplete;

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Course Equivalence Permissions, Autocomplete & Confirmation...');
    updateJobPermissionState();
    initTransferConfirmation();
    initStudentSearchAutocomplete();

    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            const isEquivalenceOpen = (typeof window.IS_EQUIVALENCE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_EQUIVALENCE_JOB_OPEN) : false;
            if (!isEquivalenceOpen) {
                e.preventDefault();
                showNotification('error', window.EQUIVALENCE_JOB_MESSAGE || '⚠️ عذراً، خدمة معادلة المواد وتغيير المسار غير مفعلة حالياً.');
                return;
            }
            const input = document.getElementById('searchEquivalenceInput');
            if (input && !input.value.trim()) {
                e.preventDefault();
                showNotification('warning', '⚠️ الرجاء إدخال رقم القيد أو اسم الطالب للبحث');
                input.focus();
            }
        });
    }
});

// تطبيق أولي مباشر
updateJobPermissionState();
initTransferConfirmation();
initStudentSearchAutocomplete();
