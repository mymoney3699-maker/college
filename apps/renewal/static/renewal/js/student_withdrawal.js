/**
 * apps/renewal/static/renewal/js/student_withdrawal.js
 * ميزة وواجهة استمارة سحب الملف (Student Withdrawal) - Single Action Button & Identical Floating Toast v2.0.6
 */

let currentStudent = null;

function escapeHtml(text) {
    if (!text && text !== 0) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

// ============================================================
// 🔔 نظام الإشعارات العائمة الموحد (showNotification)
// ============================================================
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const iconCircle = document.getElementById('toastIconCircle') || document.getElementById('toastIconContainer');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');

    if (!toast || !icon || !msg) {
        console.warn('⚠️ Toast Notification elements not found in DOM:', type, message);
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
window.showToastMessage = function (message, isError = false, type = null) {
    if (type) {
        showNotification(type, message);
    } else {
        showNotification(isError ? 'error' : 'success', message);
    }
};
window.showToast = function (message, type = 'info') {
    showNotification(type, message);
};

document.addEventListener('DOMContentLoaded', function () {
    // 1. التفاعل مع القائمة المنسدلة للأسباب عند اختيار "أخرى"
    const reasonSelect = document.getElementById('withdrawalReasonSelect');
    if (reasonSelect) {
        reasonSelect.addEventListener('change', function () {
            const customContainer = document.getElementById('customReasonContainer');
            if (this.value === 'أخرى') {
                if (customContainer) customContainer.classList.remove('hidden');
            } else {
                if (customContainer) customContainer.classList.add('hidden');
            }
            this.style.borderColor = '';
            this.style.boxShadow = '';
        });
    }

    // 2. تفعيل التفاعل عند الضغط على Enter في حقل البحث
    const searchInput = document.getElementById('searchStudentId');
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchStudentForWithdrawal();
            }
        });
    }

    // 3. ربط نموذج السحب والزر بالتحقق التلقائي
    const withdrawalForm = document.getElementById('withdrawalForm');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleWithdrawalButtonClick(e);
        });
    }

    const actionBtn = document.getElementById('btnWithdrawalAction');
    if (actionBtn) {
        actionBtn.addEventListener('click', function (e) {
            e.preventDefault();
            handleWithdrawalButtonClick(e);
        });
    }
});

/**
 * 1. البحث عن الطالبة في قاعدة البيانات
 */
function searchStudentForWithdrawal() {
    const isWithdrawalOpen = (typeof window.IS_WITHDRAWAL_JOB_OPEN !== 'undefined') ? Boolean(window.IS_WITHDRAWAL_JOB_OPEN) : false;
    if (!isWithdrawalOpen) {
        showNotification('error', window.WITHDRAWAL_JOB_MESSAGE || '⚠️ عذراً، خدمة سحب الملف موقوفة حالياً حسب جدول إدارة الوظائف.');
        return;
    }

    const studentIdInput = document.getElementById('searchStudentId');
    const studentId = studentIdInput ? studentIdInput.value.trim() : '';

    if (!studentId) {
        showNotification('warning', 'يرجى إدخال رقم القيد للبحث عن الطالبة في قاعدة البيانات');
        return;
    }

    const loader = document.getElementById('searchLoader');
    const detailsContainer = document.getElementById('studentDetailsContainer');

    if (loader) loader.classList.remove('hidden');
    if (detailsContainer) detailsContainer.classList.add('hidden');

    fetch(`/renewal/api/student-withdrawal/?student_id=${encodeURIComponent(studentId)}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            if (loader) loader.classList.add('hidden');

            if (data.success && data.student) {
                currentStudent = data.student;
                renderStudentCard(data.student);
                if (detailsContainer) detailsContainer.classList.remove('hidden');
                showNotification('info', `تم جلب بيانات الطالبة: ${data.student.full_name}`);
            } else {
                currentStudent = null;
                showNotification('error', data.message || 'لم يتم العثور على الطالبة في قاعدة البيانات');
            }
        })
        .catch(error => {
            if (loader) loader.classList.add('hidden');
            console.error('Error fetching student withdrawal data:', error);
            showNotification('error', 'حدث خطأ في الاتصال بالسيرفر أثناء جلب بيانات الطالبة');
        });
}

/**
 * 2. عرض بيانات الطالبة وتحديث بطاقة العرض والزر التفاعلي بالأسفل
 */
function renderStudentCard(student) {
    document.getElementById('cardStudentName').textContent = student.full_name || '---';
    document.getElementById('cardStudentId').textContent = student.student_id || '---';
    document.getElementById('cardDepartment').textContent = student.department || '---';
    document.getElementById('cardLevel').textContent = student.level || '---';
    document.getElementById('cardSemester').textContent = student.semester || '---';
    document.getElementById('cardNationalId').textContent = student.national_id || '---';

    const statusBadge = document.getElementById('cardStatusBadge');
    const warningBanner = document.getElementById('alreadyWithdrawnWarning');
    const actionBtn = document.getElementById('btnWithdrawalAction');
    const reasonSelect = document.getElementById('withdrawalReasonSelect');
    const customReasonInput = document.getElementById('customReasonInput');
    const customReasonContainer = document.getElementById('customReasonContainer');
    const adminNotes = document.getElementById('adminNotes');

    if (student.is_withdrawn) {
        // حالة الطالبة: مسحوبة ملف
        if (statusBadge) {
            statusBadge.textContent = 'مسحوبة ملف';
            statusBadge.className = 'status-badge status-withdrawn';
        }
        if (warningBanner) warningBanner.classList.remove('hidden');

        // قفل حقول النموذج وتعبئتها بالبيانات المحفوظة
        if (reasonSelect) {
            reasonSelect.value = student.withdrawal_reason || 'ظروف شخصية';
            reasonSelect.disabled = true;
        }
        if (adminNotes) {
            adminNotes.value = student.withdrawal_notes || '';
            adminNotes.disabled = true;
        }
        if (customReasonInput) {
            customReasonInput.disabled = true;
        }

        // تحويل الزر الوحيد بالأسفل إلى زر "طباعة"
        if (actionBtn) {
            actionBtn.setAttribute('data-mode', 'print');
            actionBtn.className = 'btn-action btn-print-archive';
            actionBtn.innerHTML = '<span class="material-symbols-outlined">print</span> <span>طباعة</span>';
            actionBtn.disabled = false;
        }
    } else {
        // حالة الطالبة: نشطة / منتظمة
        if (statusBadge) {
            statusBadge.textContent = student.status || 'منتظم';
            statusBadge.className = (student.status && student.status.includes('موقوف')) ? 'status-badge status-suspended' : 'status-badge status-active';
        }
        if (warningBanner) warningBanner.classList.add('hidden');

        // فتح حقول النموذج لإدخال السحب
        if (reasonSelect) {
            reasonSelect.value = '';
            reasonSelect.disabled = false;
            reasonSelect.style.borderColor = '';
            reasonSelect.style.boxShadow = '';
        }
        if (customReasonInput) {
            customReasonInput.value = '';
            customReasonInput.disabled = false;
            customReasonInput.style.borderColor = '';
            customReasonInput.style.boxShadow = '';
        }
        if (customReasonContainer) {
            customReasonContainer.classList.add('hidden');
        }
        if (adminNotes) {
            adminNotes.value = '';
            adminNotes.disabled = false;
        }

        // تحويل الزر الوحيد بالأسفل إلى زر "سحب الملف"
        if (actionBtn) {
            actionBtn.setAttribute('data-mode', 'withdraw');
            actionBtn.className = 'btn-primary-red';
            actionBtn.innerHTML = '<span class="material-symbols-outlined">person_remove</span> <span>سحب الملف</span>';
            actionBtn.disabled = false;
        }
    }
}

/**
 * 3. التفاعل مع الزر الوحيد بالأسفل: التحقق، إظهار التنبيه، أو التنفيذ والطباعة
 */
function handleWithdrawalButtonClick(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const actionBtn = document.getElementById('btnWithdrawalAction');
    if (!actionBtn) return;

    if (!currentStudent) {
        showNotification('warning', '⚠️ يرجى البحث عن الطالبة أولاً برقم القيد من قاعدة البيانات');
        return;
    }

    const mode = actionBtn.getAttribute('data-mode');

    // إذا كان الزر في وضع الطباعة
    if (mode === 'print') {
        printWithdrawalForm();
        return;
    }

    // التحقق من صلاحية الوظيفة
    const isWithdrawalOpen = (typeof window.IS_WITHDRAWAL_JOB_OPEN !== 'undefined') ? Boolean(window.IS_WITHDRAWAL_JOB_OPEN) : false;
    if (!isWithdrawalOpen) {
        showNotification('error', window.WITHDRAWAL_JOB_MESSAGE || '⚠️ عذراً، خدمة سحب الملف موقوفة حالياً حسب جدول إدارة الوظائف.');
        return;
    }

    // 1. التحقق من اختيار سبب السحب في القائمة المنسدلة
    const reasonSelect = document.getElementById('withdrawalReasonSelect');
    const selectedReason = reasonSelect ? reasonSelect.value.trim() : '';

    if (!selectedReason || selectedReason === '') {
        showNotification('warning', '⚠️ الرجاء اختيار سبب سحب الملف أولاً');
        if (reasonSelect) {
            reasonSelect.focus();
            reasonSelect.style.borderColor = '#ef4444';
            reasonSelect.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.35)';
            setTimeout(() => {
                reasonSelect.style.borderColor = '';
                reasonSelect.style.boxShadow = '';
            }, 3500);
        }
        return; // منع الإرسال
    }

    // 2. التحقق عند اختيار "أخرى" وتوضيح السبب
    if (selectedReason === 'أخرى') {
        const customInput = document.getElementById('customReasonInput');
        const customVal = customInput ? customInput.value.trim() : '';
        if (!customVal) {
            showNotification('warning', '⚠️ يرجى كتابة توضيح السبب الآخر أولاً');
            if (customInput) {
                customInput.focus();
                customInput.style.borderColor = '#ef4444';
                customInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.35)';
                setTimeout(() => {
                    customInput.style.borderColor = '';
                    customInput.style.boxShadow = '';
                }, 3500);
            }
            return; // منع الإرسال
        }
    }

    const fullReason = (selectedReason === 'أخرى') ? `أخرى: ${document.getElementById('customReasonInput').value.trim()}` : selectedReason;
    const adminNotesInput = document.getElementById('adminNotes');
    const adminNotes = adminNotesInput ? adminNotesInput.value.trim() : '';

    // تغيير حالة الزر إلى جاري التنفيذ
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> <span>جاري تنفيذ سحب الملف...</span>';

    const payload = {
        student_id: currentStudent.student_id,
        reason: fullReason,
        notes: adminNotes
    };

    fetch('/renewal/api/student-withdrawal/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const studentName = currentStudent?.full_name ? ` (${currentStudent.full_name})` : '';
                showNotification('success', data.message || `✅ تم سحب ملف الطالبة${studentName} بنجاح وتحديث الحالة في المنظومة`);

                // تحديث بيانات الطالبة في الذاكرة لتكون (مسحوبة ملف)
                currentStudent.status = 'مسحوبة ملف';
                currentStudent.is_withdrawn = true;
                currentStudent.withdrawal_reason = data.withdrawal_reason || fullReason;
                currentStudent.withdrawal_notes = data.withdrawal_notes || adminNotes;
                currentStudent.withdrawal_date = data.withdrawal_date || new Date().toISOString().split('T')[0];

                // 1. تحديث شارة الحالة فورياً في أعلى البطاقة
                const statusBadge = document.getElementById('cardStatusBadge');
                if (statusBadge) {
                    statusBadge.textContent = 'مسحوبة ملف';
                    statusBadge.className = 'status-badge status-withdrawn';
                }

                // 2. تحديث الزر فورياً إلى زر "طباعة" دون إعادة تحميل الصفحة
                actionBtn.disabled = false;
                actionBtn.setAttribute('data-mode', 'print');
                actionBtn.className = 'btn-action btn-print-archive';
                actionBtn.innerHTML = '<span class="material-symbols-outlined">print</span> <span>طباعة</span>';

                // قفل حقول النموذج
                if (reasonSelect) reasonSelect.disabled = true;
                if (adminNotesInput) adminNotesInput.disabled = true;
                const customReasonInput = document.getElementById('customReasonInput');
                if (customReasonInput) customReasonInput.disabled = true;

                // إظهار تنبيه السحب
                const warningBanner = document.getElementById('alreadyWithdrawnWarning');
                if (warningBanner) warningBanner.classList.remove('hidden');
            } else {
                actionBtn.disabled = false;
                actionBtn.innerHTML = '<span class="material-symbols-outlined">person_remove</span> <span>سحب الملف</span>';
                showNotification('error', data.message || '❌ فشلت عملية سحب الملف');
            }
        })
        .catch(error => {
            actionBtn.disabled = false;
            actionBtn.innerHTML = '<span class="material-symbols-outlined">person_remove</span> <span>سحب الملف</span>';
            console.error('Error in withdrawal submission:', error);
            showNotification('error', '❌ حدث خطأ في الاتصال بالخادم أثناء تنفيذ العملية');
        });
}

let cachedRegistrarName = '';
let cachedAdmissionHeadName = '';

async function fetchActiveOfficials() {
    if (window.OFFICIAL_GENERAL_REGISTRAR) {
        cachedRegistrarName = window.OFFICIAL_GENERAL_REGISTRAR;
    }
    if (window.OFFICIAL_ADMISSION_HEAD) {
        cachedAdmissionHeadName = window.OFFICIAL_ADMISSION_HEAD;
    }

    if (cachedRegistrarName && cachedAdmissionHeadName && cachedRegistrarName !== 'أ. أحمد محمد علي محمود' && cachedAdmissionHeadName !== 'أ. محمد علي عمر') {
        return { registrar: cachedRegistrarName, admissionHead: cachedAdmissionHeadName };
    }

    try {
        if (window.OfficialsHelper && typeof window.OfficialsHelper.fetchOfficials === 'function') {
            const list = await window.OfficialsHelper.fetchOfficials();
            if (Array.isArray(list) && list.length > 0) {
                const reg = list.find(o => (
                    (o.position && (o.position.includes('المسجل العام') || (o.position.includes('مسجل') && !o.position.includes('رئيس قسم')))) ||
                    o.position_key === 'registrar' || o.role === 'general_registrar'
                ));
                if (reg) {
                    cachedRegistrarName = `${(reg.title || 'أ.').trim()} ${(reg.name || '').trim()}`.trim();
                }

                const adm = list.find(o => (
                    (o.position && (o.position.includes('تسجيل') || o.position.includes('قبول') || o.position.includes('القبول والتسجيل') || o.position.includes('التسجيل والقبول'))) ||
                    o.position_key === 'admission' || o.role === 'admission'
                ));
                if (adm) {
                    cachedAdmissionHeadName = `${(adm.title || 'أ.').trim()} ${(adm.name || '').trim()}`.trim();
                }
            }
        } else {
            const res = await fetch('/users/api/officials/');
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.officials)) {
                    const reg = data.officials.find(o => o.status === 'active' && (
                        (o.position && (o.position.includes('المسجل العام') || (o.position.includes('مسجل') && !o.position.includes('رئيس قسم')))) ||
                        o.position_key === 'registrar' || o.role === 'general_registrar'
                    ));
                    if (reg) {
                        cachedRegistrarName = `${(reg.title || 'أ.').trim()} ${(reg.name || '').trim()}`.trim();
                    }

                    const adm = data.officials.find(o => o.status === 'active' && (
                        (o.position && (o.position.includes('تسجيل') || o.position.includes('قبول') || o.position.includes('القبول والتسجيل') || o.position.includes('التسجيل والقبول'))) ||
                        o.position_key === 'admission' || o.role === 'admission'
                    ));
                    if (adm) {
                        cachedAdmissionHeadName = `${(adm.title || 'أ.').trim()} ${(adm.name || '').trim()}`.trim();
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Could not fetch officials from API:', e);
    }

    if (!cachedRegistrarName) cachedRegistrarName = window.OFFICIAL_GENERAL_REGISTRAR || 'أ. أحمد محمد علي محمود';
    if (!cachedAdmissionHeadName) cachedAdmissionHeadName = window.OFFICIAL_ADMISSION_HEAD || 'أ. محمد علي عمر';

    return { registrar: cachedRegistrarName, admissionHead: cachedAdmissionHeadName };
}

function fillRegistrarName() {
    return cachedRegistrarName || window.OFFICIAL_GENERAL_REGISTRAR || 'أ. أحمد محمد علي محمود';
}

function fillAdmissionHeadName() {
    return cachedAdmissionHeadName || window.OFFICIAL_ADMISSION_HEAD || 'أ. محمد علي عمر';
}

/**
 * 4. طباعة استمارة سحب الملف الرسمية بتنسيق الكلية المعتمد A4 عبر iframe خفي
 */
async function printWithdrawalForm() {
    if (!currentStudent) {
        showNotification('warning', '⚠️ لا توجد طالبة محددة للطباعة');
        return;
    }

    await fetchActiveOfficials();
    const registrarName = fillRegistrarName();
    const admissionHeadName = fillAdmissionHeadName();

    const reason = currentStudent.withdrawal_reason || (document.getElementById('withdrawalReasonSelect') ? document.getElementById('withdrawalReasonSelect').value : 'ظروف شخصية');
    const notes = currentStudent.withdrawal_notes || (document.getElementById('adminNotes') ? document.getElementById('adminNotes').value : 'لا توجد ملاحظات إضافية');

    // احتساب التاريخ التلقائي لليوم
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const fullYear = now.getFullYear();

    // توليد رقم الإشارة التلقائي من النظام
    const studentIdVal = currentStudent.student_id || currentStudent.id || '---';
    const autoRefNumber = `ك.ط.ع.ت / ${fullYear} / ${studentIdVal}`;
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>إفادة سحب ملف - ${currentStudent.full_name || currentStudent.name || ''}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    @page {
        size: A4 portrait;
        margin: 5mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        direction: rtl;
        font-size: 13px;
    }
    .print-page-frame {
        width: 100%;
        min-height: 275mm;
        margin: 0 auto;
        padding: 24px 30px;
        border: 2px solid #000000;
        background: #ffffff;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .bf-header-3col {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
    }
    .bf-header-right {
        text-align: right;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
        color: #000;
    }
    .bf-header-right .gov-title {
        font-size: 15px;
        font-weight: 900;
    }
    .bf-header-center {
        text-align: center;
    }
    .bf-logo {
        width: 75px;
        height: 75px;
        object-fit: contain;
        margin: 0 auto;
        display: block;
    }
    .bf-header-left {
        text-align: left;
        font-size: 10.5px;
        font-weight: 700;
        line-height: 1.35;
        color: #000;
        direction: ltr;
    }
    .bf-header-left .gov-title-en {
        font-size: 12.5px;
        font-weight: 900;
    }
    .bf-line {
        border-top: 1.5px solid #000000;
        margin: 6px 0;
        width: 100%;
        display: block;
    }
    .meta-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 6px 0 14px 0;
        font-size: 12.5px;
        font-weight: 800;
    }
    .bf-title {
        font-size: 20px;
        font-weight: 900;
        margin: 6px 0 2px 0;
        text-align: center;
        color: #000000;
    }
    .bf-subtitle {
        font-size: 13.5px;
        font-weight: 800;
        text-align: center;
        color: #222;
        margin-bottom: 16px;
    }
    .student-data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 18px;
    }
    .student-data-table td {
        padding: 9px 12px;
        border: 1.5px solid #000000;
        font-size: 13px;
    }
    .lbl-cell {
        background-color: #f1f5f9;
        font-weight: 800;
        width: 24%;
        color: #000000;
    }
    .val-cell {
        font-weight: 700;
        width: 26%;
        color: #000000;
    }
    .val-cell.highlight {
        font-weight: 900;
        font-size: 14px;
    }
    .official-pledge-box {
        margin: 18px 0;
        padding: 14px 18px;
        border: 1.5px solid #000000;
        background: #ffffff;
        font-size: 13.5px;
        font-weight: 700;
        line-height: 1.9;
        text-align: justify;
    }
    .signatures-grid {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 25px;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    .sig-block {
        text-align: center;
        width: 30%;
        font-size: 12.5px;
        font-weight: 800;
    }
    .sig-dots {
        margin-top: 28px;
        white-space: nowrap;
    }
    .bf-signatures-container {
        display: flex !important;
        justify-content: flex-end !important;
        margin-top: 20px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    .bf-sig-col {
        text-align: center !important;
        width: 270px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        display: block !important;
    }
    .off-name {
        font-size: 13.5px !important;
        font-weight: 900 !important;
        margin-bottom: 3px !important;
        min-height: 18px !important;
        color: #000 !important;
    }
    .off-pos {
        font-size: 12.5px !important;
        font-weight: 800 !important;
        color: #111 !important;
        margin-bottom: 16px !important;
    }
    .off-sig {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #000 !important;
        white-space: nowrap !important;
    }
    @media print {
        @page { size: A4 portrait; margin: 4mm; }
        html, body { width: 100%; height: 100%; }
        .print-page-frame { min-height: 275mm; border: 2px solid #000000; }
        .signatures-grid, .bf-signatures-container, .bf-sig-col {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
        }
    }
</style>
</head>
<body>
    <div class="print-page-frame">
        <div>
            <!-- 1. الترويسة الرسمية ثنائية اللغة المعتمدة -->
            <div class="print-header-section" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;direction:rtl;">
                <!-- اليمين: العربية -->
                <div class="print-header-ar" style="flex:1;text-align:center;font-size:11.5px;line-height:1.45;color:#000;">
                    <div style="font-size:13.5px;font-weight:900;margin-bottom:2px;">دولة ليبيا</div>
                    <div style="font-size:11px;font-weight:800;margin-bottom:1px;">حكومة الوحدة الوطنية</div>
                    <div style="font-size:11px;font-weight:800;margin-bottom:1px;">وزارة التعليم التقني والفني</div>
                    <div style="font-size:12px;font-weight:900;margin-top:2px;">كلية طرابلس للعلوم والتقنية</div>
                </div>

                <!-- الوسط: الشعار الدائري -->
                <div class="print-header-logo-box" style="flex:0 0 95px;text-align:center;display:flex;justify-content:center;align-items:center;padding:0 10px;">
                    <img class="bf-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.onerror=null; this.style.display='none';">
                </div>

                <!-- اليسار: الإنجليزية -->
                <div class="print-header-en" style="flex:1;text-align:center;font-size:10px;line-height:1.35;color:#000;direction:ltr;font-family:Arial,'Segoe UI',Tahoma,sans-serif;">
                    <div style="font-size:11.5px;font-weight:bold;margin-bottom:1px;">state of Libya</div>
                    <div style="font-weight:600;margin-bottom:1px;">government National Unity</div>
                    <div style="font-weight:600;margin-bottom:1px;">Ministry of Technical and Technical Education</div>
                    <div style="font-weight:600;margin-bottom:1px;">department of Technical</div>
                    <div style="font-size:10.5px;font-weight:bold;margin-top:2px;letter-spacing:0.5px;">TRIPOLI COLLAGE AND TECHNOLOGY</div>
                </div>
            </div>

            <div class="print-header-line" style="border-top: 1.5px solid #000; margin: 6px 0 10px; width: 100%; display: block;"></div>

            <!-- شريط التاريخ ورقم الإشارة التلقائي -->
            <div class="meta-bar">
                <div>
                    <span style="font-weight: 900;">التاريخ:</span>
                    <span style="font-family: monospace; font-size: 13px; font-weight: 800;">${dateStr}</span>
                </div>
                <div>
                    <span style="font-weight: 900;">الرقم الإشاري:</span>
                    <span style="font-family: monospace; font-size: 13px; font-weight: 800;">${autoRefNumber}</span>
                </div>
            </div>

            <!-- عنوان الإفادة الرسمي -->
            <div class="bf-title">استمارة سحب ملف طالبة</div>
            <div class="bf-subtitle">قسم القبول والتسجيل وشؤون الطلاب</div>

            <!-- جدول البيانات الأكاديمية للطالبة -->
            <table class="student-data-table">
                <tr>
                    <td class="lbl-cell">اسم الطالبة الكامل:</td>
                    <td class="val-cell highlight" colspan="3" style="font-size: 14.5px;">${escapeHtml(currentStudent.full_name || currentStudent.name || '---')}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">رقم القيد:</td>
                    <td class="val-cell highlight" style="font-family: monospace; font-size: 14.5px;">${escapeHtml(currentStudent.student_id || '---')}</td>
                    <td class="lbl-cell">الرقم الوطني:</td>
                    <td class="val-cell" style="font-family: monospace;">${escapeHtml(currentStudent.national_id || 'غير مسجل')}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">القسم / التخصص:</td>
                    <td class="val-cell highlight">${escapeHtml(currentStudent.department || '---')}</td>
                    <td class="lbl-cell">المستوى / الفصل:</td>
                    <td class="val-cell">${escapeHtml(currentStudent.level || '---')}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">سبب سحب الملف:</td>
                    <td class="val-cell" colspan="3" style="font-weight: 800; color: #991b1b;">${escapeHtml(reason)}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">ملاحظات الإدارة:</td>
                    <td class="val-cell" colspan="3">${escapeHtml(notes)}</td>
                </tr>
            </table>

            <!-- نص الإقرار والتعهد الرسمي -->
            <div class="official-pledge-box">
                بناءً على طلب الطالبة المذكورة بياناتها أعلاه برغبتها في إنهاء دراستها وسحب ملفها، تم استكمال كافة إجراءات سحب الملف الأكاديمي، وتسليمها ملفها ومستنداتها الأصلية المودعة لدى مكتب المسجل العام بالكلية وتوثيق سحب الملف رسمياً بالمنظومة.
            </div>

            <!-- تواقيع الاستلام والمسؤول المختص -->
            <div class="signatures-grid">
                <div class="sig-block">
                    <div style="font-size: 13px; font-weight: 800; margin-bottom: 2px;">توقيع واستلام الطالبة</div>
                    <div class="sig-dots" style="margin-top: 36px;">...........................................</div>
                </div>
                <div class="sig-block">
                    <div class="off-name">${escapeHtml(admissionHeadName)}</div>
                    <div class="off-pos">رئيس قسم التسجيل والقبول</div>
                    <div class="sig-dots">التوقيع: ....................................</div>
                </div>
            </div>
        </div>

        <!-- اعتماد التوقيع والختم للمسجل العام في أقصى اليسار -->
        <div class="bf-signatures-container">
            <div class="bf-sig-col">
                <div class="off-name">${escapeHtml(registrarName)}</div>
                <div class="off-pos">المسجل العام بالكلية</div>
                <div class="off-sig">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // إنشاء iframe خفي وطباعة التقرير من خلاله
    let printIframe = document.getElementById('withdrawalHiddenPrintIframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'withdrawalHiddenPrintIframe';
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
            console.error('Print frame error:', e);
            const w = window.open('', '_blank');
            w.document.write(printHtml);
            w.document.close();
            w.focus();
            w.print();
        }
    }, 400);
}

/**
 * إعادة ضبط واجهة البحث والنموذج
 */
function resetWithdrawalForm() {
    currentStudent = null;
    document.getElementById('searchStudentId').value = '';
    document.getElementById('withdrawalForm').reset();
    document.getElementById('customReasonContainer').classList.add('hidden');
    document.getElementById('studentDetailsContainer').classList.add('hidden');
    document.getElementById('alreadyWithdrawnWarning').classList.add('hidden');

    const actionBtn = document.getElementById('btnWithdrawalAction');
    if (actionBtn) {
        actionBtn.setAttribute('data-mode', 'withdraw');
        actionBtn.className = 'btn-primary-red';
        actionBtn.innerHTML = '<span class="material-symbols-outlined">person_remove</span> <span>سحب الملف</span>';
    }

    showNotification('info', '🧹 تم تفريغ الحقول وإعادة ضبط النموذج');
}

window.searchStudentForWithdrawal = searchStudentForWithdrawal;
window.handleWithdrawalButtonClick = handleWithdrawalButtonClick;
window.printWithdrawalForm = printWithdrawalForm;
window.resetWithdrawalForm = resetWithdrawalForm;

/**
 * الحصول على CSRF Token من الـ Cookie
 */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// ============================================================
// 🔥 التحكم في حالة الأزرار بناءً على صلاحية سحب الملف (Student Withdrawal Job Permission)
// ============================================================

function applyWithdrawalPermissionUI(isOpen, message) {
    const btnSearch = document.getElementById('btnSearchWithdrawal');
    const btnReset = document.getElementById('btnResetWithdrawal');
    const actionBtn = document.getElementById('btnWithdrawalAction');

    const searchInput = document.getElementById('searchStudentId');
    const reasonSelect = document.getElementById('withdrawalReasonSelect');
    const customReasonInput = document.getElementById('customReasonInput');
    const adminNotes = document.getElementById('adminNotes');

    const targetButtons = [btnSearch, btnReset, actionBtn];
    const targetInputs = [searchInput, reasonSelect, customReasonInput, adminNotes];

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    const displayMsg = message || '⚠️ خدمة "سحب الملف" غير مفعلة حالياً في إدارة الوظائف.';

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
        if (input && (!currentStudent || !currentStudent.is_withdrawn)) {
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
    const isOpen = (typeof window.IS_WITHDRAWAL_JOB_OPEN !== 'undefined') ? Boolean(window.IS_WITHDRAWAL_JOB_OPEN) : false;
    const message = window.WITHDRAWAL_JOB_MESSAGE || '';

    applyWithdrawalPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                window.IS_WITHDRAWAL_JOB_OPEN = Boolean(data.is_withdrawal_job_open);
                window.WITHDRAWAL_JOB_MESSAGE = data.withdrawal_job_message || '';
                applyWithdrawalPermissionUI(window.IS_WITHDRAWAL_JOB_OPEN, window.WITHDRAWAL_JOB_MESSAGE);
            }
        })
        .catch(err => {
            console.warn('⚠️ Dynamic withdrawal job permission check error:', err);
        });
}
window.updateJobPermissionState = updateJobPermissionState;

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function () {
    updateJobPermissionState();
});

// تطبيق أولي مباشر
updateJobPermissionState();
