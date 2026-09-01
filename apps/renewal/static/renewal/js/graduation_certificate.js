/**
 * ============================================================
 * إفادة التخرج - Graduation Certificate
 * graduation_certificate.js v2.1.0 (مباشر بدون نوافذ منبثقة + ربط المسؤولين)
 * ============================================================
 */

console.log('✅ graduation_certificate.js loaded (Direct In-Page Print)');

// ============================================================
// 1. عناصر DOM والمتغيرات العامة
// ============================================================
const searchBtn = document.getElementById('searchBtn');
const idInput = document.getElementById('studentIdInput');
const nameInput = document.getElementById('studentNameInput');

const idSearchResults = document.getElementById('idSearchResults');
const nameSearchResults = document.getElementById('nameSearchResults');

const emptyState = document.getElementById('emptyState');
const studentProfile = document.getElementById('studentProfile');

const statusBadge = document.getElementById('statusBadge');
const sName = document.getElementById('sName');
const sId = document.getElementById('sId');
const sNational = document.getElementById('sNational');
const sDept = document.getElementById('sDept');
const sMajor = document.getElementById('sMajor');
const sLevel = document.getElementById('sLevel');
const sJoinYear = document.getElementById('sJoinYear');
const sGradYear = document.getElementById('sGradYear');
const sGpa = document.getElementById('sGpa');
const sGrade = document.getElementById('sGrade');
const sProjectGrade = document.getElementById('sProjectGrade');
const sClearanceDate = document.getElementById('sClearanceDate');

const kpiCardsRow = document.getElementById('kpiCardsRow');
const academicDetailsGrid = document.getElementById('academicDetailsGrid');
const certDataCard = document.getElementById('certDataCard');
const certNumber = document.getElementById('certNumber');
const certDate = document.getElementById('certDate');

const issueBtn = document.getElementById('issueBtn');
const printBtn = document.getElementById('printBtn');
const resetBtn = document.getElementById('resetBtn');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const printPreview = document.getElementById('printPreview');

let currentStudent = null;
let eligible = false;

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

function showToast(message, type = null) {
    if (!type) {
        if (message.includes('✅') || message.includes('نجاح')) type = 'success';
        else if (message.includes('❌') || message.includes('فشل') || message.includes('خطأ') || message.includes('تعذر')) type = 'error';
        else if (message.includes('⚠️') || message.includes('لا يمكن')) type = 'warning';
        else if (message.includes('⏳') || message.includes('جاري') || message.includes('🔄') || message.includes('ℹ️')) type = 'info';
        else type = 'info';
    }
    showNotification(type, message);
}

window.showNotification = showNotification;
window.showToast = showToast;
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

// 🔥 مصفوفة لتخزين أسماء المسؤولين النشطين ديناميكياً من قاعدة البيانات
let activeOfficials = {
    dean: '...........................',
    registrar: '...........................'
};

// ============================================================
// 🔥 0. التحكم في صلاحية وظيفة إفادة التخرج (Graduation Certificate Job Permission)
// ============================================================
function applyCertificatePermissionUI(isOpen, message) {
    const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : (typeof window.IS_CERTIFICATE_JOB_OPEN !== 'undefined' ? Boolean(window.IS_CERTIFICATE_JOB_OPEN) : true);
    const displayMsg = message || window.CERTIFICATE_JOB_MESSAGE || '⚠️ خدمة "إفادة التخرج" غير مفعلة حالياً في إدارة الوظائف.';

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    console.log(`🔐 Graduation Certificate Job Permission State - Is Open: ${isJobOpen}`);

    if (banner) {
        if (!isJobOpen) {
            if (bannerText) bannerText.textContent = displayMsg;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    // تعطيل وتظليل زر الإصدار وزر الطباعة فقط (مع الإبقاء على حقول وأزرار البحث مفعلة)
    if (issueBtn) {
        if (!isJobOpen) {
            issueBtn.disabled = true;
            issueBtn.setAttribute('disabled', 'disabled');
            issueBtn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            issueBtn.style.setProperty('opacity', '0.5', 'important');
            issueBtn.style.setProperty('cursor', 'not-allowed', 'important');
            issueBtn.style.setProperty('pointer-events', 'none', 'important');
            issueBtn.style.setProperty('filter', 'grayscale(80%)', 'important');
            issueBtn.title = displayMsg;
        } else if (eligible && currentStudent && !currentStudent.is_certificate_issued) {
            issueBtn.disabled = false;
            issueBtn.removeAttribute('disabled');
            issueBtn.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            issueBtn.style.setProperty('opacity', '1', 'important');
            issueBtn.style.setProperty('cursor', 'pointer', 'important');
            issueBtn.style.setProperty('pointer-events', 'auto', 'important');
            issueBtn.style.setProperty('filter', 'none', 'important');
            issueBtn.title = '';
        }
    }

    if (printBtn) {
        if (!isJobOpen) {
            printBtn.disabled = true;
            printBtn.setAttribute('disabled', 'disabled');
            printBtn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            printBtn.style.setProperty('opacity', '0.5', 'important');
            printBtn.style.setProperty('cursor', 'not-allowed', 'important');
            printBtn.style.setProperty('pointer-events', 'none', 'important');
            printBtn.style.setProperty('filter', 'grayscale(80%)', 'important');
            printBtn.title = displayMsg;
        } else if (currentStudent && currentStudent.is_certificate_issued && currentStudent.certificate_number) {
            printBtn.disabled = false;
            printBtn.removeAttribute('disabled');
            printBtn.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            printBtn.style.setProperty('opacity', '1', 'important');
            printBtn.style.setProperty('cursor', 'pointer', 'important');
            printBtn.style.setProperty('pointer-events', 'auto', 'important');
            printBtn.style.setProperty('filter', 'none', 'important');
            printBtn.title = '';
        }
    }
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_CERTIFICATE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CERTIFICATE_JOB_OPEN) : true;
    const message = window.CERTIFICATE_JOB_MESSAGE || '';

    applyCertificatePermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_CERTIFICATE_JOB_OPEN = Boolean(data.is_certificate_job_open);
            window.CERTIFICATE_JOB_MESSAGE = data.certificate_job_message || '';
            applyCertificatePermissionUI(window.IS_CERTIFICATE_JOB_OPEN, window.CERTIFICATE_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic graduation certificate job permission check error:', err);
    });
}
window.updateJobPermissionState = updateJobPermissionState;
function getCsrfToken() {
    const name = 'csrftoken';
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
    return cookieValue || '';
}

function formatToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showToast(message) {
    const toast = document.getElementById('toastMsg');
    const toastText = document.getElementById('toastText');
    if (!toast || !toastText) return;
    toastText.innerText = message;
    toast.classList.add('show');

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

function hideAllResults() {
    if (idSearchResults) idSearchResults.classList.remove('show');
    if (nameSearchResults) nameSearchResults.classList.remove('show');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 🌟 3. جلب أسماء المسؤولين النشطين ديناميكياً (نفس فكرة التقرير الثاني)
// ============================================================
function fetchActiveOfficials() {
    const officialsApiUrl = window.GET_OFFICIALS_API_URL || '/users/api/officials/';
    
    fetch(officialsApiUrl, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': getCsrfToken()
        }
    })
    .then(response => {
        if (!response.ok) return null;
        return response.json();
    })
    .then(data => {
        if (data && data.success && data.officials) {
            data.officials.forEach(official => {
                if (official.status === 'active') {
                    const titlePrefix = official.title ? `${official.title} ` : '';
                    const fullName = `${titlePrefix}${official.name}`;
                    
                    if (official.position_key === 'dean' || official.position === 'dean' || (official.title && official.title.includes('عميد'))) {
                        activeOfficials.dean = fullName;
                    } else if (official.position_key === 'registrar' || official.position === 'registrar' || (official.title && official.title.includes('مسجل'))) {
                        activeOfficials.registrar = fullName;
                    }
                }
            });
            console.log('✅ تم تحميل أسماء المسؤولين النشطين بنجاح:', activeOfficials);
        }
    })
    .catch(error => {
        console.warn('⚠️ تعذر جلب أسماء المسؤولين ديناميكياً:', error);
    });
}

// ============================================================
// 🌟 4. حقن ستايل الطباعة الرسمي (A4) برمجياً دون نوافذ منبثقة
// ============================================================
function injectPrintStyles() {
    const styleId = 'print-cert-styles';
    if (document.getElementById(styleId)) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
        @media screen {
            #printCertContainer {
                display: none !important;
            }
        }

        @media print {
            /* 1. إخفاء كافة عناصر الموقع الحالية برمجياً */
            body * {
                visibility: hidden !important;
            }
            
            /* 2. إلغاء هوامش الصفحة وحذف ترويسة وتذييل المتصفح التلقائي */
            @page {
                size: A4 portrait;
                margin: 0;
            }

            /* 3. إظهار حاوية الإفادة فقط */
            #printCertContainer, 
            #printCertContainer * {
                visibility: visible !important;
            }

            /* 4. تنزيل المحتوى لمنتصف الورقة A4 الرسمية الجاهزة */
            #printCertContainer {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 5cm 2.2cm 2cm 2.2cm !important; /* هوامش علوية تعيد النص لمنتصف الصفحة */
                box-sizing: border-box !important;
                direction: rtl !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                font-family: "Arial", "Tahoma", sans-serif !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
            }

            .statement-print {
                text-align: center !important;
                line-height: 2.3 !important;
                font-size: 16pt !important;
                margin-top: 15px !important;
                margin-bottom: 20px !important;
            }

            .statement-print p {
                margin: 5px 0 !important;
            }

            .legal-text-print {
                text-align: center !important;
                font-size: 15pt !important;
                font-weight: 600 !important;
                margin-top: 20px !important;
                margin-bottom: 20px !important;
            }

            /* قسم رمز الـ QR المُكبر والمتمركز في المساحة الفارغة قبل التوقيعات */
            .qr-center-section-print {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 50px auto 10px auto !important;
                text-align: center !important;
            }

            .qr-box-print {
                width: 125px !important;
                height: 125px !important;
                padding: 4px !important;
                background: #ffffff !important;
                border: 1.5px solid #cbd5e1 !important;
                border-radius: 8px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
            }

            .qr-box-print img {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                display: block !important;
            }

            .qr-label-print {
                font-size: 8.5pt !important;
                color: #475569 !important;
                margin-top: 5px !important;
                font-weight: 700 !important;
                display: block !important;
            }

            /* قسم التوقيعات: المسجل العام وعميد الكلية في أسفل الصفحة */
            .signatures-print {
                display: flex !important;
                justify-content: space-between !important;
                align-items: flex-end !important;
                width: 100% !important;
                margin-top: auto !important;
                padding: 0 25px 1.5cm 25px !important;
            }

            .signature-column-print {
                width: 38% !important;
                text-align: center !important;
            }

            .official-name-print {
                font-size: 12pt !important;
                font-weight: bold !important;
                color: #000000 !important;
                margin: 0 0 4px 0 !important;
                min-height: 22px !important;
            }

            .role-title-print {
                font-size: 11pt !important;
                color: #222222 !important;
                margin: 0 0 25px 0 !important;
            }

            .signature-line-print {
                border-bottom: 1px solid #000000 !important;
                width: 85% !important;
                margin: 0 auto !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

// ============================================================
// اختيار وتفعيل الطالبة
// ============================================================
function selectStudent(student) {
    if (!student) return;
    currentStudent = student;
    renderStudent(student);
    if (idInput) idInput.value = student.id;
    if (nameInput) nameInput.value = student.name;
    hideAllResults();

    if (!student.eligible) {
        showToast('⚠️ عفواً، لا يوجد إخلاء طرف معتمد لهذه الطالبة. لا يمكن إصدار الإفادة.');
    } else if (student.is_certificate_issued) {
        showToast(`✅ تم اختيار الطالبة الخريجة (الإفادة مصدورة برقم: ${student.certificate_number})`);
    } else {
        showToast(`✅ تم اختيار الطالبة الخريجة: ${student.name} (جاهزة للإصدار)`);
    }
}

// ============================================================
// عرض بيانات الطالبة
// ============================================================
function renderStudent(student) {
    if (!student) {
        if (emptyState) emptyState.style.display = 'flex';
        if (studentProfile) studentProfile.style.display = 'none';
        if (certDataCard) certDataCard.style.display = 'none';
        if (kpiCardsRow) kpiCardsRow.style.display = 'none';
        if (academicDetailsGrid) academicDetailsGrid.style.display = 'none';

        if (statusBadge) {
            statusBadge.className = 'badge-status';
            statusBadge.innerHTML = '—';
        }
        eligible = false;
        currentStudent = null;
        updateButtons();
        if (printPreview) printPreview.classList.remove('open');
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (studentProfile) studentProfile.style.display = 'block';

    eligible = student.eligible === true;
    const isIssued = student.is_certificate_issued === true && !!student.certificate_number;

    if (statusBadge) {
        statusBadge.className = 'badge-status';
        if (eligible) {
            statusBadge.classList.add('eligible');
            if (isIssued) {
                statusBadge.innerHTML = `<span class="material-symbols-outlined">check_circle</span> تمت مصادقة وإصدار إفادة التخرج بنجاح (رقم الإفادة: ${student.certificate_number})`;
            } else {
                statusBadge.innerHTML = `<span class="material-symbols-outlined">verified</span> مستحقة لإفادة التخرج (مخلى طرفها - في انتظار الإصدار)`;
            }
        } else {
            statusBadge.classList.add('not-eligible');
            statusBadge.innerHTML = `<span class="material-symbols-outlined">cancel</span> غير مستحقة (عفواً، لا يوجد إخلاء طرف معتمد لهذه الطالبة. لا يمكن إصدار الإفادة.)`;
        }
    }

    if (eligible) {
        if (kpiCardsRow) kpiCardsRow.style.display = 'grid';
        if (academicDetailsGrid) academicDetailsGrid.style.display = 'grid';
        if (certDataCard) certDataCard.style.display = 'block';

        if (sName) sName.innerText = student.name || '—';
        if (sId) sId.innerText = student.id || '—';
        if (sNational) sNational.innerText = student.national || '—';
        if (sDept) sDept.innerText = student.dept ? `قسم ${student.dept}` : '—';
        if (sMajor) sMajor.innerText = student.specialization || student.major || student.dept || '—';
        if (sLevel) sLevel.innerText = student.level ? `${student.level}` : '—';
        if (sJoinYear) sJoinYear.innerText = student.joinYear || '—';
        if (sGradYear) sGradYear.innerText = student.gradYear || '—';
        if (sGpa) sGpa.innerText = student.gpa || '—';
        if (sGrade) sGrade.innerText = student.grade || '—';
        if (sProjectGrade) sProjectGrade.innerText = (student.project_grade !== undefined && student.project_grade !== null) ? `${student.project_grade}` : '—';
        if (sClearanceDate) sClearanceDate.innerText = student.clearance_date || '—';
    } else {
        if (kpiCardsRow) kpiCardsRow.style.display = 'none';
        if (academicDetailsGrid) academicDetailsGrid.style.display = 'none';
        if (certDataCard) certDataCard.style.display = 'none';

        if (sName) sName.innerText = student.name || '—';
        if (sId) sId.innerText = student.id || '—';
        if (sNational) sNational.innerText = '—';
        if (sDept) sDept.innerText = student.dept ? `قسم ${student.dept}` : '—';
        if (sMajor) sMajor.innerText = student.specialization || student.major || student.dept || '—';
        if (sLevel) sLevel.innerText = student.level ? `${student.level}` : '—';
        if (sJoinYear) sJoinYear.innerText = '—';
        if (sGradYear) sGradYear.innerText = '—';
        if (sGpa) sGpa.innerText = '—';
        if (sGrade) sGrade.innerText = '—';
        if (sProjectGrade) sProjectGrade.innerText = '—';
        if (sClearanceDate) sClearanceDate.innerText = '—';
    }

    if (certNumber) {
        certNumber.value = isIssued ? student.certificate_number : 'غير مصدورة بعد (اضغط إصدار الإفادة لتوليد الرقم)';
    }
    if (certDate) {
        certDate.value = isIssued ? (student.certificate_issued_at || student.clearance_date) : formatToday();
    }
    updateButtons();
    if (printPreview) printPreview.classList.remove('open');
}

function updateButtons() {
    if (!currentStudent || !eligible) {
        if (issueBtn) {
            issueBtn.disabled = true;
            issueBtn.style.display = 'none';
        }

        if (printBtn) {
            printBtn.disabled = true;
            printBtn.style.display = 'none';
        }

        return;
    }

    const isIssued =
        currentStudent.is_certificate_issued === true &&
        !!currentStudent.certificate_number;

    // ==============================
    // زر إصدار الإفادة
    // ==============================
    if (issueBtn) {
        if (isIssued) {
            issueBtn.disabled = true;
            issueBtn.style.display = 'none';
        } else {
            issueBtn.disabled = false;
            issueBtn.style.display = 'inline-flex';
            issueBtn.innerHTML =
                '<span class="material-symbols-outlined">verified</span> إصدار الإفادة';
        }
    }

    // ==============================
    // زر الطباعة
    // ==============================
    if (printBtn) {
        if (isIssued) {
            printBtn.disabled = false;
            printBtn.removeAttribute('disabled');
            printBtn.style.display = 'inline-flex';

            // إزالة أي تعطيل سابق
            printBtn.classList.remove(
                'opacity-50',
                'pointer-events-none',
                'cursor-not-allowed'
            );

            printBtn.style.setProperty('opacity', '1', 'important');
            printBtn.style.setProperty('cursor', 'pointer', 'important');
            printBtn.style.setProperty('pointer-events', 'auto', 'important');
            printBtn.style.setProperty('filter', 'none', 'important');

            printBtn.title = 'طباعة إفادة التخرج';
        } else {
            printBtn.disabled = true;
            printBtn.style.display = 'none';
        }
    }
}
// ============================================================
// عرض نتائج البحث في قائمة منسدلة
// ============================================================
function showNameSearchResults(students) {
    if (!nameSearchResults) return;
    nameSearchResults.innerHTML = '';

    if (!students || students.length === 0) {
        nameSearchResults.classList.remove('show');
        return;
    }

    students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <span class="result-main">${student.name}</span>
            <span class="result-sub">رقم القيد: ${student.id} (${student.is_certificate_issued ? 'مصدورة' : (student.eligible ? 'خريجة جاهزة' : 'غير مكتمل')})</span>
        `;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectStudent(student);
        });
        nameSearchResults.appendChild(item);
    });
    nameSearchResults.classList.add('show');
}

function showIdSearchResults(students) {
    if (!idSearchResults) return;
    idSearchResults.innerHTML = '';

    if (!students || students.length === 0) {
        idSearchResults.classList.remove('show');
        return;
    }

    students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <span class="result-main">${student.id}</span>
            <span class="result-sub">${student.name} (${student.is_certificate_issued ? 'إفادة مصدورة' : (student.eligible ? 'مستحقة' : '-')})</span>
        `;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectStudent(student);
        });
        idSearchResults.appendChild(item);
    });
    idSearchResults.classList.add('show');
}

// ============================================================
// البحث من الباك إند أوتوماتيكياً عبر API
// ============================================================
async function performSearch() {
    const rawId = idInput ? idInput.value.trim() : '';
    const rawName = nameInput ? nameInput.value.trim() : '';
    const query = rawId || rawName;

    if (!query) {
        showToast('⚠️ الرجاء إدخال رقم القيد أو الاسم للبحث');
        return;
    }

    showToast('⏳ جاري جلب وحساب بيانات إفادة التخرج...');

    try {
        const res = await fetch(`/renewal/api/get-graduation-certificate-data/?reg_num=${encodeURIComponent(query)}&name=${encodeURIComponent(query)}&query=${encodeURIComponent(query)}`);
        
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
            showToast('❌ حدث خطأ من الخادم أثناء المعالجة (500). يرجى المحاولة لاحقاً');
            return;
        }

        const data = await res.json();

        if (!data.success || !data.students || data.students.length === 0) {
            currentStudent = null;
            renderStudent(null);
            showToast(data.message || '⚠️ لم يتم العثور على طالبة بهذه البيانات');
            hideAllResults();
            return;
        }

        if (data.students.length === 1) {
            selectStudent(data.students[0]);
        } else {
            if (rawName.length > 0) {
                showNameSearchResults(data.students);
            } else {
                showIdSearchResults(data.students);
            }
        }
    } catch (err) {
        console.error(err);
        showToast('❌ تعذر الاتصال بالخادم أو معالجة الاستجابة');
    }
}

// البحث الفوري عند الكتابة
if (nameInput) {
    nameInput.addEventListener('input', function() {
        const rawName = this.value.trim();
        if (rawName.length < 2) {
            if (nameSearchResults) nameSearchResults.classList.remove('show');
            return;
        }
        fetch(`/renewal/api/get-graduation-certificate-data/?name=${encodeURIComponent(rawName)}`)
            .then(res => {
                const contentType = res.headers.get('content-type') || '';
                if (!res.ok || !contentType.includes('application/json')) return null;
                return res.json();
            })
            .then(data => {
                if (data && data.success && data.students) {
                    showNameSearchResults(data.students);
                }
            })
            .catch(err => console.error(err));
    });
}

if (idInput) {
    idInput.addEventListener('input', function() {
        const rawId = this.value.trim();
        if (rawId.length < 2) {
            if (idSearchResults) idSearchResults.classList.remove('show');
            return;
        }
        fetch(`/renewal/api/get-graduation-certificate-data/?reg_num=${encodeURIComponent(rawId)}`)
            .then(res => {
                const contentType = res.headers.get('content-type') || '';
                if (!res.ok || !contentType.includes('application/json')) return null;
                return res.json();
            })
            .then(data => {
                if (data && data.success && data.students) {
                    showIdSearchResults(data.students);
                }
            })
            .catch(err => console.error(err));
    });
}

// إخفاء النتائج عند النقر خارجها
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-wrapper')) {
        hideAllResults();
    }
});

// ============================================================
// إصدار الشهادة من الباك إند وحفظ الرقم لمرة واحدة
// ============================================================
async function issueCertificate() {
    if (typeof window.IS_CERTIFICATE_JOB_OPEN !== 'undefined' && !window.IS_CERTIFICATE_JOB_OPEN) {
        showToast(window.CERTIFICATE_JOB_MESSAGE || "⚠️ خدمة 'إفادة التخرج' غير مفعلة حالياً في إدارة الوظائف");
        return;
    }

    if (!eligible || !currentStudent) {
        showToast('⚠️ لا يمكن إصدار إفادة لطالبة غير مخلّى طرفها');
        return;
    }

    if (currentStudent.is_certificate_issued) {
        showToast(`⚠️ إفادة التخرج مصدورة مسبقاً برقم: ${currentStudent.certificate_number}`);
        return;
    }

    if (issueBtn) {
        issueBtn.disabled = true;
        issueBtn.innerHTML = '<span class="material-symbols-outlined">sync</span> جاري الإصدار...';
    }
    showToast('⏳ جاري إصدار وثيقة إفادة التخرج وتوليد الرقم التسلسلي...');

    try {
        const response = await fetch('/renewal/api/issue-graduation-certificate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                student_id: currentStudent.id,
                pk: currentStudent.pk
            })
        });

        const data = await response.json();
        if (data.success) {
            currentStudent.is_certificate_issued = true;
            currentStudent.certificate_number = data.certificate_number;
            currentStudent.certificate_issued_at = data.certificate_issued_at;

            if (certNumber) certNumber.value = data.certificate_number;
            if (certDate) certDate.value = data.certificate_issued_at;

            showToast(data.message || `✅ تم إصدار وثيقة إفادة التخرج بنجاح برقم: ${data.certificate_number}`);
            renderStudent(currentStudent);
        } else {
            showToast(`❌ ${data.message || 'فشل إصدار الإفادة'}`);
            if (issueBtn) {
                issueBtn.disabled = false;
                issueBtn.innerHTML = '<span class="material-symbols-outlined">verified</span> إصدار الإفادة';
            }
        }
    } catch (err) {
        console.error(err);
        showToast('❌ تعذر الاتصال بالخادم عند إصدار الإفادة');
        if (issueBtn) {
            issueBtn.disabled = false;
            issueBtn.innerHTML = '<span class="material-symbols-outlined">verified</span> إصدار الإفادة';
        }
    }
}

// ============================================================
// 🌟 5. طباعة وثيقة التخرج مباشرة على نفس الصفحة (بدون نوافذ منبثقة)
// ============================================================
function openPrintPreview() {
    if (typeof window.IS_CERTIFICATE_JOB_OPEN !== 'undefined' && !window.IS_CERTIFICATE_JOB_OPEN) {
        showToast(window.CERTIFICATE_JOB_MESSAGE || "⚠️ خدمة 'إفادة التخرج' غير مفعلة حالياً في إدارة الوظائف");
        return;
    }

    if (!currentStudent) {
        showToast('⚠️ الرجاء اختيار طالبة أولاً للطباعة');
        return;
    }
    if (!eligible) {
        showToast('⚠️ لا يمكن طباعة إفادة طالبة لم تستكمل إجراءات إخلاء الطرف والتخرج');
        return;
    }
    if (!currentStudent.is_certificate_issued || !currentStudent.certificate_number) {
        showToast('⚠️ يجب القيام بإصدار الإفادة أولاً قبل إجراء عملية الطباعة');
        return;
    }

    const student = currentStudent;

    const studentName = student.name || ".........................";
    const studentId = student.id || student.student_id || ".........................";
    const nationalId = student.national || student.national_id || ".........................";
    
    // 1. التخصص هو اسم القسم المباشر من قاعدة البيانات (مثل: هندسة ديكور)
    let rawSpec = student.specialization || student.major || student.dept || "";
    if (rawSpec.startsWith("قسم ")) {
        rawSpec = rawSpec.replace(/^قسم\s+/, "");
    }
    const specialization = rawSpec || ".........................";
    
    // 2. نوع الفصل الدراسي + السنة الدراسية (مثل: الربيع 2026)
    const graduationSemester = student.grad_semester || student.semester_name || (student.gradYear ? `فصل ${student.gradYear}` : ".........................");

    const gpa = student.gpa || ".........................";
    const grade = student.grade || student.evaluation || ".........................";
    const issueDate = student.certificate_issued_at || student.clearance_date || formatToday();

    // 3. جلب اسم الشخص المعين في المنصب من activeOfficials المحملة من API أو من بيانات الطالبة
    let registrarName = (activeOfficials.registrar && !activeOfficials.registrar.includes('...'))
        ? activeOfficials.registrar
        : (student.registrar_general_name || ".........................");

    let deanName = (activeOfficials.dean && !activeOfficials.dean.includes('...'))
        ? activeOfficials.dean
        : (student.dean_name || ".........................");

    // 3.5 تجهيز رابط أو بيانات QR Code للتحقق الإلكتروني
    const qrDataStr = student.qr_code_data || student.qr_data || (window.location.origin + '/student/verify/' + encodeURIComponent(studentId)) || `STUDENT:${studentId}`;
    const qrSrc = student.qr_code_url || (qrDataStr ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrDataStr)}` : '');

    // 4. إنشاء وتعبئة حاوية الطباعة في الصفحة الحالية
    let printContainer = document.getElementById('printCertContainer');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'printCertContainer';
        document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = `
        <div>
            <!-- التاريخ (على جهة اليسار) -->
            <div style="text-align: left; font-size: 14px; font-weight: bold; margin-bottom: 20px;">
                التاريخ: ${escapeHtml(issueDate)}
            </div>

            <!-- نص الإفادة (بدون إطار خارجي) -->
            <div class="statement-print">
                <p>تفيدكم إدارة كلية طرابلس للعلوم والتقنية</p>
                <p>بأن الطالبة <strong style="font-size: 18pt;">${escapeHtml(studentName)}</strong></p>
                <p>والمسجلة برقم قيد <strong>(${escapeHtml(studentId)})</strong> ، ورقمها الوطني <strong>(${escapeHtml(nationalId)})</strong></p>
                <p>قد تحصلت على درجة الإجازة المتخصصة (بكالوريوس)</p>
                <p>في تخصص <strong>${escapeHtml(specialization)}</strong></p>
                <p>بمعدل عام (<strong>${escapeHtml(gpa)}</strong>) وبتقدير (<strong>${escapeHtml(grade)}</strong>)</p>
                <p>للفصل الدراسي <strong>${escapeHtml(graduationSemester)}</strong></p>
            </div>

            <!-- النص القانوني -->
            <div class="legal-text-print">
                أعطيت لها هذه الإفادة بناءً على طلبها لاستعمالها فيما يخصها قانوناً.
            </div>

            <!-- رمز QR Code للتحقق الإلكتروني (متمركز في المساحة بين النص والتوقيعات) -->
            ${qrSrc ? `
            <div class="qr-center-section-print">
                <div class="qr-box-print">
                    <img src="${qrSrc}" alt="رمز التحقق" />
                </div>
                <span class="qr-label-print">رمز التحقق الإلكتروني</span>
            </div>
            ` : ''}
        </div>

        <!-- التوقيعات الرسمية في أسفل الصفحة -->
        <div class="signatures-print">
            <!-- المسجل العام -->
            <div class="signature-column-print">
                <p class="official-name-print">${escapeHtml(registrarName)}</p>
                <p class="role-title-print">المسجل العام بالكلية</p>
                <div class="signature-line-print"></div>
            </div>

            <!-- عميد الكلية -->
            <div class="signature-column-print">
                <p class="official-name-print">${escapeHtml(deanName)}</p>
                <p class="role-title-print">عميد الكلية</p>
                <div class="signature-line-print"></div>
            </div>
        </div>
    `;

    // 5. إطلاق الطباعة المباشرة
    setTimeout(function() {
        window.print();
    }, 150);
}

// ============================================================
// إعادة تعيين
// ============================================================
function resetAll() {
    currentStudent = null;
    renderStudent(null);
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (certNumber) certNumber.value = '—';
    if (certDate) certDate.value = formatToday();
    if (printPreview) printPreview.classList.remove('open');
    hideAllResults();
    showToast('🔄 تم إعادة تعيين الصفحة');
}

// ============================================================
// ربط الأحداث والتهيئة
// ============================================================
function initGraduationCertificate() {
    if (searchBtn) searchBtn.addEventListener('click', performSearch);
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (document.activeElement === idInput || document.activeElement === nameInput)) {
            e.preventDefault();
            performSearch();
        }
    });
    if (issueBtn) issueBtn.addEventListener('click', issueCertificate);

    if (printBtn) {
        printBtn.disabled = true;
        printBtn.style.display = 'none';
        printBtn.addEventListener('click', openPrintPreview);
    }

    if (resetBtn) resetBtn.addEventListener('click', resetAll);
    if (closePreviewBtn) closePreviewBtn.addEventListener('click', () => printPreview.classList.remove('open'));

    // حقن ستايل الطباعة المباشرة
    injectPrintStyles();

    // جلب أسماء المسؤولين النشطين ديناميكياً
    fetchActiveOfficials();

    if (certDate) certDate.value = formatToday();
    if (certNumber) certNumber.value = '—';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';

    currentStudent = null;
    renderStudent(null);
    updateJobPermissionState();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGraduationCertificate);
} else {
    initGraduationCertificate();
}

// تصدير الدوال للنافذة
window.performSearch = performSearch;
window.issueCertificate = issueCertificate;
window.openPrintPreview = openPrintPreview;
window.resetAll = resetAll;
window.renderStudent = renderStudent;