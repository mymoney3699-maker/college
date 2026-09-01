// ============================================
// بيانات الطالب - Student Data
// ============================================

console.log('✅ student_data.js loaded successfully');

// الحصول على CSRF token
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

// دالة لتأمين النص من XSS
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
window.showToastMessage = (message, isError = false) => showNotification(isError ? 'error' : 'success', message);

// البحث عن طالب
function searchStudent() {
    console.log('🔍 searchStudent called');

    const regNum = document.getElementById('searchRegNum')?.value || '';
    const name = document.getElementById('searchName')?.value || '';

    if (!regNum && !name) {
        if (typeof toastWarning === 'function') toastWarning('الرجاء إدخال رقم القيد أو اسم الطالب');
        return;
    }

    if (typeof toastInfo === 'function') toastInfo('جاري البحث...');

    fetch(`/renewal/search-student-api/?reg_num=${encodeURIComponent(regNum)}&name=${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('📊 Search results:', data);

            const resultsDiv = document.getElementById('searchResults');

            if (data.success && data.students && data.students.length > 0) {
                let html = '<div class="border rounded-lg overflow-hidden">';
                data.students.forEach(student => {
                    html += `
                    <div class="p-3 border-b hover:bg-gray-100 cursor-pointer flex justify-between items-center search-result-item"
                         onclick="window.selectStudent(${JSON.stringify(student).replace(/"/g, '&quot;')})">
                        <div>
                            <div class="font-bold">${escapeHtml(student.name)} ${escapeHtml(student.father_name || '')}</div>
                            <div class="text-sm text-gray-500">رقم القيد: ${escapeHtml(student.student_id)}</div>
                        </div>
                    </div>
                `;
                });
                html += '</div>';
                resultsDiv.innerHTML = html;
                resultsDiv.classList.remove('hidden');
                if (typeof toastSuccess === 'function') toastSuccess(`تم العثور على ${data.students.length} نتيجة`);
            } else {
                resultsDiv.innerHTML = '<div class="text-center text-red-600 p-4 border rounded-lg">❌ لا توجد نتائج</div>';
                resultsDiv.classList.remove('hidden');
                if (typeof toastWarning === 'function') toastWarning('لا توجد نتائج مطابقة');
            }
        })
        .catch(error => {
            console.error('❌ Error searching student:', error);
            if (typeof toastError === 'function') toastError('حدث خطأ في البحث');
        });
}

// 🔥 دالة مساعدة لتطبيق حالة الطالب مباشرة وبأمان (تدعم حقل Input Readonly و Select)
function applyStudentStatus(studentObj) {
    const studentStatusElem = document.getElementById('student_status') || document.getElementById('student_status_id') || document.getElementById('status');
    if (!studentStatusElem) return;

    if (!studentObj) {
        if (studentStatusElem.tagName && studentStatusElem.tagName.toLowerCase() === 'input') {
            studentStatusElem.value = 'منتظم';
        }
        return;
    }

    let statusName = studentObj.student_status_name || (studentObj.student_status ? (studentObj.student_status.name || studentObj.student_status) : '');
    if (!statusName || statusName === '--' || statusName === 'جديد') {
        statusName = 'منتظم';
    }

    if (studentStatusElem.tagName && studentStatusElem.tagName.toLowerCase() === 'input') {
        studentStatusElem.value = statusName;
        studentStatusElem.readOnly = true;
        studentStatusElem.disabled = true;
        studentStatusElem.setAttribute('readonly', 'readonly');
        studentStatusElem.setAttribute('disabled', 'disabled');
        studentStatusElem.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        studentStatusElem.style.removeProperty('background-color');
        studentStatusElem.style.removeProperty('color');
        studentStatusElem.style.setProperty('font-weight', '600', 'important');
        studentStatusElem.style.setProperty('cursor', 'not-allowed', 'important');
        studentStatusElem.style.setProperty('pointer-events', 'none', 'important');
    } else if (studentStatusElem.options) {
        const targetId = String(studentObj.student_status_id || '').trim();
        const targetName = String(statusName).trim();
        let matched = false;

        const optionsLen = studentStatusElem.options?.length || 0;
        for (let i = 0; i < optionsLen; i++) {
            const opt = studentStatusElem.options[i];
            const optVal = String(opt?.value || '').trim();
            const optText = String(opt?.text || opt?.innerText || '').trim();

            if ((targetId && optVal === targetId) || (targetName && (optVal === targetName || optText === targetName))) {
                opt.selected = true;
                studentStatusElem.selectedIndex = i;
                studentStatusElem.value = opt.value;
                matched = true;
                break;
            }
        }

        if (!matched && (studentObj.student_id || targetName === 'منتظم' || !targetName)) {
            for (let i = 0; i < optionsLen; i++) {
                const opt = studentStatusElem.options[i];
                const optText = String(opt?.text || opt?.innerText || '').trim();
                const optVal = String(opt?.value || '').trim();
                if (optText.includes('منتظم') || optVal.includes('منتظم')) {
                    opt.selected = true;
                    studentStatusElem.selectedIndex = i;
                    studentStatusElem.value = opt.value;
                    matched = true;
                    break;
                }
            }
        }

        studentStatusElem.disabled = true;
        studentStatusElem.setAttribute('disabled', 'disabled');
        studentStatusElem.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        studentStatusElem.style.removeProperty('background-color');
        studentStatusElem.style.removeProperty('color');
        studentStatusElem.style.setProperty('font-weight', '600', 'important');
        studentStatusElem.style.setProperty('cursor', 'not-allowed', 'important');
        studentStatusElem.style.setProperty('pointer-events', 'none', 'important');
    }
}

// ============================================================
// 🔥 حالة وقفل النموذج للوضع للقراءة فقط (Disabled / Locked State)
// ============================================================
let isFormEditingUnlocked = false;

function lockStudentForm() {
    console.log('🔒 Locking student form (Read-only mode)');
    isFormEditingUnlocked = false;

    const form = document.getElementById('studentForm');
    if (!form) return;

    // 1. حظر جميع حقول النصوص والتاريخ والأرقام
    const textInputs = form.querySelectorAll('input:not(#searchRegNum):not(#searchName), textarea');
    textInputs.forEach(input => {
        if (input.type !== 'file' && input.type !== 'hidden') {
            input.readOnly = true;
            input.disabled = true;
            input.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
            input.style.removeProperty('background-color');
            input.style.removeProperty('color');
            input.style.setProperty('cursor', 'not-allowed', 'important');
            input.style.setProperty('pointer-events', 'none', 'important');
        }
    });

    // 2. حظر جميع القوائم المنسدلة بدون استثناء واستهداف الحاويات الخارجيّة لها
    const selects = form.querySelectorAll('select');
    selects.forEach(select => {
        select.disabled = true;
        select.setAttribute('disabled', 'disabled');
        select.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        select.style.removeProperty('background-color');
        select.style.removeProperty('color');
        select.style.setProperty('cursor', 'not-allowed', 'important');
        select.style.setProperty('pointer-events', 'none', 'important');
        select.style.setProperty('opacity', '0.7', 'important');

        // استهداف الحاوية المباشرة (Wrapper container) للقائمة المنسدلة
        if (select.parentElement) {
            select.parentElement.style.pointerEvents = 'none';
        }
    });

    // 3. حظر اختيار صورة الطالب
    const avatarPlaceholder = document.getElementById('avatar_placeholder');
    if (avatarPlaceholder) {
        avatarPlaceholder.style.pointerEvents = 'none';
        avatarPlaceholder.style.opacity = '0.7';
        avatarPlaceholder.style.cursor = 'not-allowed';
    }

    // 4. تعطيل زر الحفظ
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.style.opacity = '0.5';
        btnSave.style.cursor = 'not-allowed';
    }

    updateJobPermissionState();
}

function unlockStudentForm() {
    console.log('🔓 Unlocking student form for editing');
    isFormEditingUnlocked = true;

    const form = document.getElementById('studentForm');
    if (!form) return;

    // 1. فتح حقول النصوص والتاريخ (ما عدا رقم القيد وحالة الطالب الثابتة)
    const textInputs = form.querySelectorAll('input:not(#student_id):not(#student_status):not(#searchRegNum):not(#searchName), textarea');
    textInputs.forEach(input => {
        if (input.type !== 'file' && input.type !== 'hidden') {
            input.readOnly = false;
            input.disabled = false;
            input.removeAttribute('readonly');
            input.removeAttribute('disabled');
            input.classList.remove('is-locked', 'bg-gray-100', 'cursor-not-allowed');
            input.style.removeProperty('background-color');
            input.style.removeProperty('color');
            input.style.setProperty('cursor', 'text', 'important');
            input.style.setProperty('pointer-events', 'auto', 'important');
            input.style.setProperty('opacity', '1', 'important');
        }
    });

    // 2. فتح جميع القوائم المنسدلة (ما عدا حالة الطالب) وإعادة تفعيل الحاويات
    const selects = form.querySelectorAll('select:not(#student_status)');
    selects.forEach(select => {
        select.disabled = false;
        select.removeAttribute('disabled');
        select.removeAttribute('readonly');
        select.classList.remove('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        select.style.removeProperty('background-color');
        select.style.removeProperty('color');
        select.style.setProperty('cursor', 'pointer', 'important');
        select.style.setProperty('pointer-events', 'auto', 'important');
        select.style.setProperty('opacity', '1', 'important');

        if (select.parentElement) {
            select.parentElement.style.pointerEvents = 'auto';
        }
    });

    toggleIdentityFields();
    updateAcademicFieldsState();

    // 3. فتح صورة الطالب
    const avatarPlaceholder = document.getElementById('avatar_placeholder');
    if (avatarPlaceholder) {
        avatarPlaceholder.style.pointerEvents = 'auto';
        avatarPlaceholder.style.opacity = '1';
        avatarPlaceholder.style.cursor = 'pointer';
    }

    // 4. تفعيل زر الحفظ
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.disabled = false;
        btnSave.removeAttribute('disabled');
        btnSave.style.setProperty('opacity', '1', 'important');
        btnSave.style.setProperty('cursor', 'pointer', 'important');
        btnSave.style.setProperty('pointer-events', 'auto', 'important');
        btnSave.style.setProperty('filter', 'none', 'important');
    }

    updateJobPermissionState();
}

function enableFormEditing() {
    console.log('✏️ enableFormEditing called');
    const isEditJobOpen = (typeof window.IS_EDIT_JOB_OPEN !== 'undefined') ? Boolean(window.IS_EDIT_JOB_OPEN) : true;

    if (isEditJobOpen === false) {
        showToastMessage(window.EDIT_JOB_MESSAGE || '⚠️ عذراً، خدمة تعديل بيانات الطلاب موقوفة حالياً حسب جدول إدارة الوظائف.', true);
        return;
    }

    window.isFormEditingUnlocked = true;
    unlockStudentForm();

    const studentName = document.getElementById('name')?.value || '';
    if (typeof toastSuccess === 'function') {
        toastSuccess(`تم فتح قفل الحقول للتعديل على بيانات الطالب: ${studentName}`);
    } else if (typeof toastInfo === 'function') {
        toastInfo('تم تفعيل التعديل. يمكنك حفظ التعديلات عند الانتهاء');
    }
    updateJobPermissionState();
}

function renderStudentQRCode(qrUrl, qrData) {
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) return;
    
    const targetSrc = qrUrl || (qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}` : '');
    
    if (targetSrc) {
        qrContainer.innerHTML = `
            <img id="qr_image" src="${targetSrc}" alt="كود QR" 
                 style="width: 100%; height: 100%; object-fit: contain; display: block;" 
                 onerror="if('${encodeURIComponent(qrData || '')}'){ this.src='https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData || '')}'; }" />
        `;
    } else {
        qrContainer.innerHTML = `
            <img id="qr_image" src="" alt="كود QR" style="width: 100%; height: 100%; object-fit: contain; display: none;" />
            <span id="qr_placeholder" class="text-xs font-bold" style="text-align: center; color: #64748b; display: block;">اختر طالباً لعرض الـ QR</span>
        `;
    }
}

// ============================================================
// 🔥 دالة اختيار طالب من نتائج البحث (معدلة بالكامل)
// ============================================================
function selectStudent(student) {
    console.log('👨‍🎓 selectStudent called');

    // ============================================================
    // 🔥🔥🔥 طباعة كائن الطالب بالكامل لمعرفة المسميات 🔥🔥🔥
    // ============================================================
    console.log("📦 Full student object:", JSON.stringify(student, null, 2));
    console.log("📦 Student object keys:", Object.keys(student));

    // ============================================================
    // 🔥🔥🔥 البحث عن جميع الاحتمالات الممكنة لمسمى رقم الجواز 🔥🔥🔥
    // ============================================================
    const passportValue = student.passport_number ||
        student.passport ||
        student.passport_no ||
        student.passport_num ||
        student.passportNumber ||
        student.passportNo ||
        student.passportNum ||
        '';

    // ============================================================
    // 🔥🔥🔥 البحث عن جميع الاحتمالات الممكنة لمسمى الرقم الوطني 🔥🔥🔥
    // ============================================================
    const nationalIdValue = student.national_id ||
        student.national_number ||
        student.national_no ||
        student.nat_id ||
        student.nationalId ||
        student.nationalNumber ||
        student.nationalNo ||
        student.natId ||
        '';

    console.log('📝 Passport value found:', passportValue);
    console.log('📝 National ID value found:', nationalIdValue);

    // ============================================================
    // 🔥🔥🔥 تعبئة جميع الحقول الأساسية (أمان تام للقيم والعناصر) 🔥🔥🔥
    // ============================================================
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    setVal('student_id', student.student_id);
    setVal('name', student.name);
    setVal('father_name', student.father_name);
    setVal('grandfather_name', student.grandfather_name);
    setVal('last_name', student.last_name);
    setVal('national_id', nationalIdValue);
    setVal('phone', student.phone);
    setVal('email', student.email);
    setVal('birth_date', student.birth_date);
    setVal('current_address', student.address);
    setVal('enrollment_date', student.enrollment_date);

    // 🔥🔥🔥 تعبئة فصل القيد بشكل صحيح 🔥🔥🔥
    if (student.enrollment_semester) {
        const semesterText = String(student.enrollment_semester).trim();
        const parts = semesterText.split(/\s+/);
        let yearPart = '';
        let semesterPart = '';

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            const cleanNum = p.replace(/[^0-9]/g, '');
            if (cleanNum) {
                yearPart = cleanNum;
            }
            if (p.includes('ربيع')) {
                semesterPart = 'ربيع';
            } else if (p.includes('خريف')) {
                semesterPart = 'خريف';
            }
        }

        if (!semesterPart) {
            if (semesterText.includes('ربيع')) {
                semesterPart = 'ربيع';
            } else if (semesterText.includes('خريف')) {
                semesterPart = 'خريف';
            }
        }

        setVal('semester_year', yearPart || student.semester_year || '');
        setVal('semester_type', semesterPart || student.semester_type || '');
    } else {
        setVal('semester_year', student.semester_year || '');
        setVal('semester_type', student.semester_type || '');
    }

    setVal('notes', student.notes);
    setVal('guardian_name', student.guardian_name);
    setVal('guardian_phone', student.guardian_phone);

    if (student.birth_place_id) setVal('birth_place', student.birth_place_id);
    
    // الجنس
    if (student.gender_id) {
        setVal('gender', student.gender_id);
    } else if (student.gender_name) {
        const gSelect = document.getElementById('gender');
        if (gSelect) {
            for (let opt of gSelect.options) {
                if (opt.text.trim() === String(student.gender_name).trim() || opt.value === String(student.gender_name).trim()) {
                    opt.selected = true;
                    break;
                }
            }
        }
    }

    // فصيلة الدم
    if (student.blood_type) setVal('blood_type', student.blood_type);
    if (student.nationality_id) setVal('nationality', student.nationality_id);

    // ============================================================
    // 🔥🔥🔥 تعبئة حقل identity_input والحقول الخفية 🔥🔥🔥
    // ============================================================
    const identityInput = document.getElementById('identity_input');
    const nationalIdInput = document.getElementById('national_id');
    const passportInput = document.getElementById('passport_number');

    // 🔥 تعبئة الحقول الخفية بالقيم المستخرجة
    if (passportInput) passportInput.value = passportValue || '';
    if (nationalIdInput) nationalIdInput.value = nationalIdValue || '';

    // 🔥 تعيين قيمة identity_input حسب الجنسية
    const isLibyan = isLibyanNationality();
    if (identityInput) {
        identityInput.value = isLibyan ? (nationalIdValue || '') : (passportValue || '');
    }

    // 🔥 مزامنة وحماية حالة الطالب
    syncIdentityToHiddenField();
    applyStudentStatus(student);

    // Populate photo if available
    const avatarImg = document.getElementById('avatar_img');
    const avatarIcon = document.getElementById('avatar_icon');
    if (student.photo_url) {
        if (avatarImg) {
            avatarImg.src = student.photo_url;
            avatarImg.style.display = 'block';
        }
        if (avatarIcon) avatarIcon.style.display = 'none';
    } else {
        if (avatarImg) {
            avatarImg.src = '';
            avatarImg.style.display = 'none';
        }
        if (avatarIcon) avatarIcon.style.display = 'block';
    }

    // الحالة الاجتماعية
    if (student.marital_status_id && document.getElementById('marital_status')) {
        document.getElementById('marital_status').value = student.marital_status_id;
    } else if (student.marital_status_name && document.getElementById('marital_status')) {
        const mSelect = document.getElementById('marital_status');
        for (let opt of mSelect.options) {
            if (opt.text.trim() === String(student.marital_status_name).trim() || opt.value === String(student.marital_status_name).trim()) {
                opt.selected = true;
                break;
            }
        }
    }
    if (student.department_id && document.getElementById('department')) document.getElementById('department').value = student.department_id;
    if (student.study_plan_id && document.getElementById('study_plan')) document.getElementById('study_plan').value = student.study_plan_id;
    if (student.qualification_id && document.getElementById('qualification')) document.getElementById('qualification').value = student.qualification_id;

    // تعبئة بيانات المؤهل العلمي
    const qualDate = student.qualification_date || (student.qualification ? student.qualification.date : '');
    const qualPlace = student.qualification_place || (student.qualification ? student.qualification.place : '');
    const qualMajor = student.qualification_major || (student.qualification ? student.qualification.major : '');
    const qualGrade = student.qualification_grade || (student.qualification ? student.qualification.grade : '');
    const qualPercentage = student.qualification_percentage || (student.qualification ? student.qualification.percentage : '');

    if (document.getElementById('qualification_date')) document.getElementById('qualification_date').value = qualDate || '';
    if (document.getElementById('qualification_place')) document.getElementById('qualification_place').value = qualPlace || '';
    if (document.getElementById('qualification_major')) document.getElementById('qualification_major').value = qualMajor || '';
    if (document.getElementById('qualification_grade')) document.getElementById('qualification_grade').value = qualGrade || '';
    if (document.getElementById('qualification_percentage')) document.getElementById('qualification_percentage').value = qualPercentage || '';

    if (document.getElementById('searchResults')) document.getElementById('searchResults').classList.add('hidden');

    // تحويل مسار الـ Form
    const studentForm = document.getElementById('studentForm');
    if (studentForm && student.id) {
        studentForm.action = `/renewal/edit-student/${student.id}/`;
    }
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
        formTitle.innerText = `بيانات الطالب: ${student.name || ''}`;
    }
    const btnSaveText = document.getElementById('btnSaveText');
    if (btnSaveText) {
        btnSaveText.innerText = 'حفظ التعديلات';
    }

    // 🎯 عرض كود الـ QR وتخزين الرابط في خاصية data-url للزر
    window.currentSelectedStudent = student;
    const qrUrl = student.qr_code_url || student.qr_code || '';
    const qrData = student.qr_code_data || '';
    renderStudentQRCode(qrUrl, qrData);

    const btnCopyQR = document.getElementById('btnCopyQR');
    if (btnCopyQR) {
        btnCopyQR.dataset.url = qrData;
        btnCopyQR.setAttribute('data-url', qrData);
    }



    // 🔥 قفل النموذج للقراءة فقط وتحديث حالة الصلاحيات
    window.isFormEditingUnlocked = false;
    lockStudentForm();
    updateJobPermissionState();

    if (typeof toastSuccess === 'function') toastSuccess(`تم اختيار وتعبئة بيانات الطالب: ${student.name} (وضع القراءة فقط)`);
}


// مسح نتائج البحث
function clearSearchResults() {
    console.log('🧹 clearSearchResults called');

    document.getElementById('searchRegNum').value = '';
    document.getElementById('searchName').value = '';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchResults').classList.add('hidden');

    if (typeof toastInfo === 'function') toastInfo('تم مسح نتائج البحث');
}

// مسح النموذج بالكامل (إعادة لوضع التسجيل الجديد)
function clearStudentForm() {
    console.log('🧹 clearStudentForm called');
    const isAddJobOpen = (typeof window.IS_ADD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_ADD_JOB_OPEN) : true;

    if (isAddJobOpen === false) {
        showToastMessage(window.ADD_JOB_MESSAGE || '⚠️ عذراً، خدمة إضافة طالب جديد موقوفة حالياً حسب جدول إدارة الوظائف.', true);
        return;
    }

    window.isFormEditingUnlocked = true;
    unlockStudentForm();

    const form = document.getElementById('studentForm');
    if (form) {
        form.reset();
        form.action = `/renewal/student-data/`;
    }

    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
        formTitle.innerText = 'تسجيل طالب جديد';
    }
    const btnSaveText = document.getElementById('btnSaveText');
    if (btnSaveText) {
        btnSaveText.innerText = 'حفظ';
    }

    const studentIdElem = document.getElementById('student_id');
    if (studentIdElem) studentIdElem.value = '';

    const searchResultsElem = document.getElementById('searchResults');
    if (searchResultsElem) searchResultsElem.classList.add('hidden');

    const studentStatusElem = document.getElementById('student_status');
    if (studentStatusElem) {
        studentStatusElem.value = 'منتظم';
        studentStatusElem.disabled = true;
        studentStatusElem.readOnly = true;
        studentStatusElem.setAttribute('disabled', 'disabled');
        studentStatusElem.setAttribute('readonly', 'readonly');
        studentStatusElem.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        studentStatusElem.style.removeProperty('background-color');
        studentStatusElem.style.removeProperty('color');
        studentStatusElem.style.setProperty('font-weight', '600', 'important');
        studentStatusElem.style.setProperty('cursor', 'not-allowed', 'important');
        studentStatusElem.style.setProperty('pointer-events', 'none', 'important');
    }

    renderStudentQRCode('', '');


    const photoInput = document.getElementById('photo_input');
    if (photoInput) photoInput.value = '';

    const avatarImg = document.getElementById('avatar_img');
    const avatarIcon = document.getElementById('avatar_icon');
    if (avatarImg) {
        avatarImg.src = '';
        avatarImg.style.display = 'none';
    }
    if (avatarIcon) {
        avatarIcon.style.display = 'block';
    }

    // تفريغ الحقول الخفية وحقل الهوية
    const identityInputClear = document.getElementById('identity_input');
    if (identityInputClear) identityInputClear.value = '';

    const identityLabelClear = document.getElementById('identityFieldLabel');
    if (identityLabelClear) identityLabelClear.innerHTML = 'الرقم الوطني / رقم الجواز <span class="text-red-500">*</span>';

    const identityHintClear = document.getElementById('identityFieldHint');
    if (identityHintClear) identityHintClear.textContent = 'اختر الجنسية لتحديد نوع وثيقة الهوية';

    const natIdElem = document.getElementById('national_id');
    if (natIdElem) natIdElem.value = '';

    const passElem = document.getElementById('passport_number');
    if (passElem) passElem.value = '';

    const semTypeElem = document.getElementById('semester_type');
    if (semTypeElem) semTypeElem.value = '';

    const semYearElem = document.getElementById('semester_year');
    if (semYearElem) semYearElem.value = '';

    const btnEdit = document.getElementById('btnEdit');
    if (btnEdit) {
        btnEdit.disabled = true;
        btnEdit.setAttribute('disabled', 'disabled');
        btnEdit.style.opacity = '0.5';
        btnEdit.style.cursor = 'not-allowed';
    }

    if (!isAddJobOpen) {
        lockStudentForm();
        updateJobPermissionState();
        if (typeof toastWarning === 'function') {
            toastWarning(window.ADD_JOB_MESSAGE || '⚠️ خدمة إضافة طالب جديد غير مفتوحة حالياً حسب جدول الوظائف.');
        } else if (typeof toastInfo === 'function') {
            toastInfo(window.ADD_JOB_MESSAGE || '⚠️ خدمة إضافة طالب جديد غير مفتوحة حالياً.');
        }
        return;
    }

    // 🔥 فتح النموذج بالكامل لوضع إدخال طالب جديد إذا كانت الخدمة مفتوحة
    unlockStudentForm();
    updateJobPermissionState();

    if (typeof toastInfo === 'function') toastInfo('تم إرجاع النموذج لوضع التسجيل الجديد');
}

// رجوع للصفحة السابقة
function goBack() {
    console.log('🔙 goBack called');
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// دوال تقييد المدخلات لحماية البيانات
function restrictToLetters(inputElement) {
    if (!inputElement) return;
    inputElement.addEventListener('input', function () {
        // يقبل فقط الحروف العربية والإنجليزية والمسافات
        const cleanedValue = this.value.replace(/[^a-zA-Z\u0600-\u06FF\s]/g, '');
        if (this.value !== cleanedValue) {
            this.value = cleanedValue;
        }
    });
}

function restrictToDigits(inputElement, maxLength = null) {
    if (!inputElement) return;
    inputElement.addEventListener('input', function () {
        // يقبل فقط الأرقام
        let cleanedValue = this.value.replace(/[^0-9]/g, '');
        if (maxLength && cleanedValue.length > maxLength) {
            cleanedValue = cleanedValue.substring(0, maxLength);
        }
        if (this.value !== cleanedValue) {
            this.value = cleanedValue;
        }
    });
}

function restrictToFloat(inputElement) {
    if (!inputElement) return;
    inputElement.addEventListener('input', function () {
        // يقبل الأرقام والنقطة العشرية لمرة واحدة
        let value = this.value.replace(/[^0-9.]/g, '');
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        if (this.value !== value) {
            this.value = value;
        }
    });
}

// دالة للتحكم في تفعيل أو تعطيل الحقول الأكاديمية والمؤهل بناءً على حالة الطالب
function updateAcademicFieldsState() {
    const studentStatus = document.getElementById('student_status')?.value || '';
    const shouldDisable = (studentStatus === '2' || studentStatus === '3' || studentStatus.includes('خريج') || studentStatus.includes('منقطع'));

    const academicFields = [
        'semester_type',
        'semester_year',
        'department',
        'study_plan',
        'qualification',
        'qualification_place',
        'qualification_date',
        'qualification_grade',
        'qualification_major',
        'qualification_percentage'
    ];

    academicFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            const isSelect = field.tagName.toLowerCase() === 'select';
            if (!isFormEditingUnlocked) {
                field.disabled = true;
                field.setAttribute('disabled', 'disabled');
                if (!isSelect) { field.readOnly = true; field.setAttribute('readonly', 'readonly'); }
                field.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
                field.style.removeProperty('background-color');
                field.style.removeProperty('color');
                field.style.setProperty('cursor', 'not-allowed', 'important');
                field.style.setProperty('pointer-events', 'none', 'important');
                field.style.setProperty('opacity', '0.7', 'important');
                if (isSelect && field.parentElement) {
                    field.parentElement.style.pointerEvents = 'none';
                }
            } else {
                field.disabled = shouldDisable;
                if (shouldDisable) {
                    field.setAttribute('disabled', 'disabled');
                    if (!isSelect) { field.readOnly = true; field.setAttribute('readonly', 'readonly'); }
                    field.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
                    field.style.removeProperty('background-color');
                    field.style.removeProperty('color');
                    field.style.setProperty('cursor', 'not-allowed', 'important');
                    field.style.setProperty('pointer-events', 'none', 'important');
                    field.style.setProperty('opacity', '0.7', 'important');
                    if (isSelect && field.parentElement) {
                        field.parentElement.style.pointerEvents = 'none';
                    }
                } else {
                    field.disabled = false;
                    field.removeAttribute('disabled');
                    if (!isSelect) { field.readOnly = false; field.removeAttribute('readonly'); }
                    field.classList.remove('is-locked', 'bg-gray-100', 'cursor-not-allowed');
                    field.style.removeProperty('background-color');
                    field.style.removeProperty('color');
                    field.style.setProperty('cursor', isSelect ? 'pointer' : 'text', 'important');
                    field.style.setProperty('pointer-events', 'auto', 'important');
                    field.style.setProperty('opacity', '1', 'important');
                    if (isSelect && field.parentElement) {
                        field.parentElement.style.pointerEvents = 'auto';
                    }
                }
            }
        }
    });
}

// ============================================================
// 🔥 دالة مساعدة: تحديد هل الجنسية ليبية
// ============================================================
function isLibyanNationality() {
    const nationalitySelect = document.getElementById('nationality');
    if (!nationalitySelect || !nationalitySelect.value) return false;
    const selectedOption = nationalitySelect.options[nationalitySelect.selectedIndex];
    const name = selectedOption ? selectedOption.text.toLowerCase() : '';
    return name.includes('ليبي') || name.includes('ليبيا') || name.includes('ليبيه') || name.includes('الليبيون') || name.includes('libyan');
}

// ============================================================
// 🔥 مزامنة حية: نسخ قيمة identity_input للحقل الخفي الصحيح
// ============================================================
function syncIdentityToHiddenField() {
    const identityInput = document.getElementById('identity_input');
    const nationalIdInput = document.getElementById('national_id');
    const passportInput = document.getElementById('passport_number');

    if (!identityInput) {
        console.warn('⚠️ identity_input element not found');
        return;
    }

    // لا تقم بأي شيء إذا كان الحقل معطلاً
    if (identityInput.disabled) {
        console.log('⏭️ identity_input is disabled, skipping sync');
        return;
    }

    const val = identityInput.value.trim();
    const isLibyan = isLibyanNationality();

    console.log('🔄 Syncing identity field - Is Libyan:', isLibyan, 'Value:', val);

    if (isLibyan) {
        // 🔥 الطالب ليبي: تعيين national_id وتفريغ passport_number
        if (nationalIdInput) {
            nationalIdInput.value = val;
            console.log('🔵 Libyan student - National ID set to:', val);
        }
        if (passportInput) {
            passportInput.value = ''; // تفريغ passport
            console.log('🔵 Libyan student - Passport cleared');
        }
    } else {
        // 🔥 الطالب غير ليبي: تعيين passport_number وتفريغ national_id
        if (passportInput) {
            passportInput.value = val;
            console.log('🟢 Non-Libyan student - Passport number set to:', val);
        }
        if (nationalIdInput) {
            nationalIdInput.value = ''; // تفريغ national_id
            console.log('🟢 Non-Libyan student - National ID cleared');
        }
    }

    // 🔥 التأكد من أن الحقول الخفية محدثة
    console.log('📝 Final sync state:');
    console.log('   - national_id:', nationalIdInput?.value || '');
    console.log('   - passport_number:', passportInput?.value || '');
}

// ============================================================
// 🔥 التحكم في حقل الهوية بشكل ديناميكي حسب الجنسية
// ============================================================
function toggleIdentityFields() {
    const nationalitySelect = document.getElementById('nationality');
    const identityLabel = document.getElementById('identityFieldLabel');
    const identityInput = document.getElementById('identity_input');
    const identityHint = document.getElementById('identityFieldHint');
    const nationalIdInput = document.getElementById('national_id');
    const passportInput = document.getElementById('passport_number');

    if (!nationalitySelect || !identityInput) return;

    // فحص مرن للجنسية الليبية بكل أشكالها
    const natNameLower = nationalitySelect.value
        ? (nationalitySelect.options[nationalitySelect.selectedIndex]?.text || '').toLowerCase()
        : '';
    const isLibyan = natNameLower.includes('ليبي') || natNameLower.includes('ليبيا') || natNameLower.includes('ليبيه') || natNameLower.includes('الليبيون') || natNameLower.includes('libyan');

    console.log('🔄 Toggle identity fields - Is Libyan:', isLibyan);

    if (!nationalitySelect.value) {
        // لم يتم اختيار جنسية
        if (identityLabel) identityLabel.innerHTML = 'الرقم الوطني / رقم الجواز <span class="text-red-500">*</span>';
        identityInput.placeholder = 'اختر الجنسية أولاً';
        identityInput.disabled = true;
        identityInput.readOnly = true;
        identityInput.setAttribute('disabled', 'disabled');
        identityInput.setAttribute('readonly', 'readonly');
        identityInput.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        identityInput.style.removeProperty('background-color');
        identityInput.style.removeProperty('color');
        identityInput.style.setProperty('cursor', 'not-allowed', 'important');
        identityInput.style.setProperty('pointer-events', 'none', 'important');
        if (identityHint) identityHint.textContent = 'اختر الجنسية لتحديد نوع وثيقة الهوية';
        // تفريغ الحقول الخفية
        if (nationalIdInput) { nationalIdInput.value = ''; nationalIdInput.required = false; }
        if (passportInput) { passportInput.value = ''; passportInput.required = false; }
        return;
    }

    // تفعيل أو تعطيل الحقل حسب حالة القفل
    if (isFormEditingUnlocked) {
        identityInput.disabled = false;
        identityInput.readOnly = false;
        identityInput.removeAttribute('disabled');
        identityInput.removeAttribute('readonly');
        identityInput.classList.remove('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        identityInput.style.removeProperty('background-color');
        identityInput.style.removeProperty('color');
        identityInput.style.setProperty('cursor', 'text', 'important');
        identityInput.style.setProperty('pointer-events', 'auto', 'important');
        identityInput.style.setProperty('opacity', '1', 'important');
    } else {
        identityInput.disabled = true;
        identityInput.readOnly = true;
        identityInput.setAttribute('disabled', 'disabled');
        identityInput.setAttribute('readonly', 'readonly');
        identityInput.classList.add('is-locked', 'bg-gray-100', 'cursor-not-allowed');
        identityInput.style.removeProperty('background-color');
        identityInput.style.removeProperty('color');
        identityInput.style.setProperty('cursor', 'not-allowed', 'important');
        identityInput.style.setProperty('pointer-events', 'none', 'important');
    }

    if (isLibyan) {
        if (identityLabel) identityLabel.innerHTML = 'الرقم الوطني <span class="text-red-500">*</span>';
        identityInput.placeholder = 'أدخل الرقم الوطني (12 رقم)';
        if (identityHint) identityHint.textContent = 'مطلوب للطلاب الليبيين فقط (12 رقم بالضبط)';
        if (nationalIdInput) { nationalIdInput.required = true; }
        if (passportInput) { passportInput.required = false; passportInput.value = ''; }
        // إذا كانت هناك قيمة في national_id، ضعها في identity_input
        if (nationalIdInput && nationalIdInput.value) {
            identityInput.value = nationalIdInput.value;
        }
    } else {
        if (identityLabel) identityLabel.innerHTML = 'رقم الجواز <span class="text-red-500">*</span>';
        identityInput.placeholder = 'أدخل رقم جواز السفر (6-12 حرف/رقم)';
        if (identityHint) identityHint.textContent = 'مطلوب للطلاب غير الليبيين (6-12 حرف/رقم)';
        if (passportInput) { passportInput.required = true; }
        if (nationalIdInput) { nationalIdInput.required = false; nationalIdInput.value = ''; }
        // إذا كانت هناك قيمة في passport_number، ضعها في identity_input
        if (passportInput && passportInput.value) {
            identityInput.value = passportInput.value;
        }
    }

    // 🔥 مزامنة القيمة الحالية بعد تغيير الجنسية
    syncIdentityToHiddenField();
}

// ============================================================
// 🔥 تهيئة الصفحة مع إضافة معالج Form Submit
// ============================================================
function init() {
    console.log('🚀 Initializing student data page');

    // تقييد حقول النصوص (الحروف والمسافات فقط)
    const letterFields = ['name', 'father_name', 'grandfather_name', 'last_name', 'guardian_name', 'searchName', 'qualification_major', 'qualification_grade'];
    letterFields.forEach(id => {
        restrictToLetters(document.getElementById(id));
    });

    // تقييد حقل الرقم الوطني (12 رقماً فقط)
    restrictToDigits(document.getElementById('national_id'), 12);
    restrictToDigits(document.getElementById('phone'), 10);
    restrictToDigits(document.getElementById('guardian_phone'), 10);
    restrictToDigits(document.getElementById('searchRegNum'));

    // تقييد النسبة المئوية لأرقام ونقطة عشرية فقط
    restrictToFloat(document.getElementById('qualification_percentage'));

    // ربط حدث تغيير حالة الطالب للتحكم في الحقول الأكاديمية
    const statusSelect = document.getElementById('student_status');
    if (statusSelect) {
        statusSelect.addEventListener('change', updateAcademicFieldsState);
    }
    updateAcademicFieldsState();

    // 🔥 ربط حدث تغيير الجنسية بمزامنة الحقول
    const nationalitySelect = document.getElementById('nationality');
    if (nationalitySelect) {
        nationalitySelect.addEventListener('change', function () {
            console.log('🔄 Nationality changed, toggling identity fields...');
            toggleIdentityFields();
        });
    }

    // 🔥 ربط حدث الإدخال في identity_input بمزامنة فورية
    const identityInputField = document.getElementById('identity_input');
    if (identityInputField) {
        identityInputField.addEventListener('input', function () {
            syncIdentityToHiddenField();
        });
        identityInputField.addEventListener('change', function () {
            syncIdentityToHiddenField();
        });
    }

    const form = document.getElementById('studentForm');
    if (form) {
        // إزالة اللون الأحمر عند التعديل في أي حقل
        const allInputs = form.querySelectorAll('input, select, textarea');
        allInputs.forEach(input => {
            const clearStyle = () => {
                input.style.borderColor = '';
                input.style.boxShadow = '';
            };
            input.addEventListener('input', clearStyle);
            input.addEventListener('change', clearStyle);
        });

        // ============================================================
        // 🔥🔥🔥 معالج إرسال النموذج (Form Submit Handler) 🔥🔥🔥
        // ============================================================
        form.addEventListener('submit', function (e) {
            console.log('📤 Form submission started...');

            // 🔥 مزامنة الحقول قبل الإرسال للتأكد من صحة البيانات (السطر الأول)
            syncIdentityToHiddenField();

            // طباعة القيم للتأكد
            const nationalIdVal = document.getElementById('national_id')?.value || '';
            const passportVal = document.getElementById('passport_number')?.value || '';
            const semesterTypeVal = document.getElementById('semester_type')?.value || '';
            console.log('📝 Form Data - National ID:', nationalIdVal);
            console.log('📝 Form Data - Passport:', passportVal);
            console.log('📝 Form Data - Is Libyan:', isLibyanNationality());
            console.log('📝 Form Data - Semester Type:', semesterTypeVal);

            const highlightError = (inputElement, errorText, solutionText) => {
                e.preventDefault();
                showToastMessage(`⚠️ ${errorText}\n💡 الحل: ${solutionText}`, true);
                if (inputElement) {
                    inputElement.focus();
                    inputElement.style.borderColor = '#ef4444';
                    inputElement.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
                }
            };

            const lettersPattern = /^[\u0600-\u06FFa-zA-Z\s]+$/;

            // 1) اسم الطالب
            const studentNameInput = document.getElementById('name');
            const studentName = studentNameInput ? studentNameInput.value.trim() : '';
            if (!studentName) {
                return highlightError(studentNameInput, 'اسم الطالب مطلوب.', 'الرجاء إدخال الاسم الأول للطالب.');
            }
            if (!lettersPattern.test(studentName)) {
                return highlightError(studentNameInput, 'اسم الطالب غير صحيح: يجب أن يحتوي على حروف فقط.', 'الرجاء كتابة اسم الطالب بدون أرقام أو رموز خاصة.');
            }

            // 2) اسم الأب
            const fatherNameInput = document.getElementById('father_name');
            const fatherName = fatherNameInput ? fatherNameInput.value.trim() : '';
            if (!fatherName) {
                return highlightError(fatherNameInput, 'اسم الأب مطلوب.', 'الرجاء إدخال اسم والد الطالب.');
            }
            if (!lettersPattern.test(fatherName)) {
                return highlightError(fatherNameInput, 'اسم الأب غير صحيح: يجب أن يحتوي على حروف فقط.', 'الرجاء كتابة اسم الأب بدون أرقام أو رموز.');
            }

            // 3) اسم الجد
            const grandfatherNameInput = document.getElementById('grandfather_name');
            const grandfatherName = grandfatherNameInput ? grandfatherNameInput.value.trim() : '';
            if (!grandfatherName) {
                return highlightError(grandfatherNameInput, 'اسم الجد مطلوب.', 'الرجاء إدخال اسم جد الطالب.');
            }
            if (!lettersPattern.test(grandfatherName)) {
                return highlightError(grandfatherNameInput, 'اسم الجد غير صحيح: يجب أن يحتوي على حروف فقط.', 'الرجاء كتابة اسم الجد بدون أرقام.');
            }

            // 4) اللقب
            const lastNameInput = document.getElementById('last_name');
            const lastName = lastNameInput ? lastNameInput.value.trim() : '';
            if (!lastName) {
                return highlightError(lastNameInput, 'اللقب/العائلة مطلوب.', 'الرجاء إدخال لقب عائلة الطالب.');
            }
            if (!lettersPattern.test(lastName)) {
                return highlightError(lastNameInput, 'اللقب غير صحيح: يجب أن يحتوي على حروف فقط.', 'الرجاء كتابة اللقب بدون أرقام.');
            }

            // 5) تاريخ الميلاد
            const birthDateInput = document.getElementById('birth_date');
            const birthDate = birthDateInput ? birthDateInput.value : '';
            if (!birthDate) {
                return highlightError(birthDateInput, 'تاريخ الميلاد مطلوب.', 'الرجاء اختيار تاريخ ميلاد الطالب.');
            }
            const today = new Date();
            const bDate = new Date(birthDate);
            if (bDate >= today) {
                return highlightError(birthDateInput, 'تاريخ الميلاد غير منطقي: يجب أن يكون في الماضي.', 'الرجاء اختيار تاريخ ميلاد الطالب الفعلي بشكل صحيح.');
            }

            // 6) مكان الميلاد
            const birthPlaceInput = document.getElementById('birth_place');
            if (birthPlaceInput && !birthPlaceInput.value) {
                return highlightError(birthPlaceInput, 'مكان الميلاد مطلوب.', 'الرجاء اختيار مدينة ودولة الميلاد من القائمة.');
            }

            // 7) الجنسية
            const nationalityInput = document.getElementById('nationality');
            if (nationalityInput && !nationalityInput.value) {
                return highlightError(nationalityInput, 'الجنسية مطلوبة.', 'الرجاء تحديد جنسية الطالب من القائمة.');
            }

            // 8) الجنس
            const genderInput = document.getElementById('gender');
            if (genderInput && !genderInput.value) {
                return highlightError(genderInput, 'حقل الجنس مطلوب.', 'الرجاء اختيار جنس الطالب (ذكر/أنثى).');
            }

            // 9) التحقق من وثيقة الهوية
            const identityInputVal = document.getElementById('identity_input');
            const identityValue = identityInputVal ? identityInputVal.value.trim() : '';
            const isLibyan = isLibyanNationality();

            if (isLibyan) {
                // ليبي: يجب أن يكون الرقم الوطني موجوداً (12 رقم)
                if (!identityValue) {
                    return highlightError(identityInputVal, 'الرقم الوطني مطلوب للطالب الليبي.', 'الرجاء إدخال الرقم الوطني (12 رقم).');
                }
                if (identityValue.length !== 12) {
                    return highlightError(identityInputVal, 'الرقم الوطني يجب أن يتكون من 12 رقماً.', 'الرجاء إدخال 12 رقم بالضبط.');
                }
                if (!/^\d+$/.test(identityValue)) {
                    return highlightError(identityInputVal, 'الرقم الوطني يجب أن يحتوي على أرقام فقط.', 'الرجاء إدخال أرقام فقط بدون حروف.');
                }
            } else {
                // 🔥 غير ليبي: يجب أن يكون رقم الجواز موجوداً (6-12 حرف/رقم)
                if (!identityValue) {
                    return highlightError(identityInputVal, 'رقم الجواز مطلوب للطالب غير الليبي.', 'الرجاء إدخال رقم جواز السفر.');
                }
                if (identityValue.length < 6 || identityValue.length > 12) {
                    return highlightError(identityInputVal, 'رقم الجواز يجب أن يكون بين 6-12 حرف/رقم.', 'الرجاء إدخال رقم جواز صحيح (6-12 حرف/رقم).');
                }
                // 🔥 السماح بالأرقام والحروف الإنجليزية (رقم الجواز)
                if (!/^[a-zA-Z0-9]+$/.test(identityValue)) {
                    return highlightError(identityInputVal, 'رقم الجواز يجب أن يحتوي على حروف وأرقام فقط.', 'الرجاء إدخال رقم جواز صحيح (حروف وأرقام إنجليزية فقط).');
                }
            }

            // 10) رقم الهاتف
            const phoneInput = document.getElementById('phone');
            const phone = phoneInput ? phoneInput.value.trim() : '';
            if (phone) {
                if (!/^\d{10}$/.test(phone)) {
                    return highlightError(phoneInput, 'رقم الهاتف غير صحيح: يجب أن يتكون من 10 أرقام بالضبط.', 'يرجى كتابة رقم الهاتف الليبي بشكل صحيح متضمناً 10 خانات رقمية.');
                }
                const prefix = phone.substring(0, 3);
                if (!['091', '092', '093', '094'].includes(prefix)) {
                    return highlightError(phoneInput, 'بادئة رقم الهاتف غير صحيحة.', 'الرجاء تعديل رقم الهاتف ليبدأ ببادئة صحيحة (091، 092، 093، أو 094).');
                }
            }

            // 11) القسم (التخصص)
            const majorInput = document.getElementById('department');
            if (majorInput && !majorInput.value) {
                return highlightError(majorInput, 'حقل التخصص الأكاديمي مطلوب.', 'الرجاء اختيار القسم الدراسي للطالب.');
            }

            // 12) الخطة الدراسية
            const studyPlanInput = document.getElementById('study_plan');
            if (studyPlanInput && !studyPlanInput.value) {
                return highlightError(studyPlanInput, 'الخطة الدراسية مطلوبة.', 'الرجاء تحديد الخطة الدراسية للطالب من القائمة.');
            }

            // 14) حالة الطالب
            const studentStatusInput = document.getElementById('student_status');
            if (studentStatusInput && !studentStatusInput.value) {
                return highlightError(studentStatusInput, 'حالة الطالب مطلوبة.', 'الرجاء تحديد حالة القيد الحالية للطالب.');
            }

            // 15) الفصل الدراسي
            const semesterTypeInput = document.getElementById('semester_type');
            if (semesterTypeInput && !semesterTypeInput.value) {
                return highlightError(semesterTypeInput, 'نوع الفصل الدراسي مطلوب.', 'الرجاء اختيار نوع الفصل الدراسي للقبول.');
            }
            const semesterYearInput = document.getElementById('semester_year');
            if (semesterYearInput && !semesterYearInput.value) {
                return highlightError(semesterYearInput, 'سنة التسجيل مطلوبة.', 'الرجاء إدخال سنة التسجيل للقبول كتابة.');
            }

            // 16) تاريخ الإلحاق
            const enrollDateInput = document.getElementById('enrollment_date');
            if (enrollDateInput && !enrollDateInput.value) {
                return highlightError(enrollDateInput, 'تاريخ الإلحاق مطلوب.', 'الرجاء اختيار تاريخ إلحاق أو قبول الطالب بالكلية.');
            }

            // 17) اسم ورقم ولي الأمر
            const guardianNameInput = document.getElementById('guardian_name');
            const guardianPhoneInput = document.getElementById('guardian_phone');
            const guardianName = guardianNameInput ? guardianNameInput.value.trim() : '';
            const guardianPhone = guardianPhoneInput ? guardianPhoneInput.value.trim() : '';

            if (guardianPhone && !guardianName) {
                return highlightError(guardianNameInput, 'اسم ولي الأمر مطلوب عند إدخال هاتف ولي الأمر.', 'الرجاء كتابة اسم ولي الأمر الكامل.');
            }
            if (guardianPhone) {
                if (!/^\d{10}$/.test(guardianPhone)) {
                    return highlightError(guardianPhoneInput, 'رقم هاتف ولي الأمر غير صحيح: يجب أن يتكون من 10 أرقام.', 'يرجى كتابة الرقم المكون من 10 خانات رقمية بشكل صحيح.');
                }
                const prefix = guardianPhone.substring(0, 3);
                if (!['091', '092', '093', '094'].includes(prefix)) {
                    return highlightError(guardianPhoneInput, 'بادئة هاتف ولي الأمر غير صحيحة.', 'يرجى كتابة رقم هاتف يبدأ بإحدى البادئات (091، 092، 093، أو 094).');
                }
            }

            // 18) النسبة المئوية للمؤهل الدراسي
            const percentageInput = document.getElementById('qualification_percentage');
            const percentage = percentageInput ? percentageInput.value.trim() : '';
            if (percentage) {
                const val = parseFloat(percentage);
                if (isNaN(val) || val < 50 || val > 100) {
                    return highlightError(percentageInput, 'نسبة المؤهل الدراسي غير صحيحة.', 'الرجاء إدخال النسبة المئوية للشهادة بقيمة صحيحة بين 50% و 100%.');
                }
            }

            // 🔥 قبل الإرسال، نضمن أن الحقول الخفية صحيحة
            syncIdentityToHiddenField();

            // 🔥 التأكد من أن قيمة الفصل الدراسي صحيحة (بدون أل التعريف)
            const semesterTypeSelect = document.getElementById('semester_type');
            if (semesterTypeSelect) {
                const currentVal = semesterTypeSelect.value;
                // إذا كانت القيمة 'الربيع' أو 'الخريف'، صححها
                if (currentVal === 'الربيع') {
                    semesterTypeSelect.value = 'ربيع';
                    console.log('🔧 Corrected semester type from "الربيع" to "ربيع"');
                } else if (currentVal === 'الخريف') {
                    semesterTypeSelect.value = 'خريف';
                    console.log('🔧 Corrected semester type from "الخريف" to "خريف"');
                }
                console.log('📚 Final semester type:', semesterTypeSelect.value);
            }

            console.log('✅ Form validation passed. Submitting with:');
            console.log('   National ID:', document.getElementById('national_id')?.value);
            console.log('   Passport:', document.getElementById('passport_number')?.value);
            console.log('   Semester Type:', document.getElementById('semester_type')?.value);
            console.log('   Semester Year:', document.getElementById('semester_year')?.value);

            // 🔥 تفعيل القوائم المنسدلة مؤقتاً لضمان نقل قيمها في POST data لـ Django
            const allSelects = form.querySelectorAll('select');
            allSelects.forEach(s => { s.disabled = false; });

            // 🔥🔥🔥 تغليف updateQRCode في try...catch لمنع تعطل الجافاسكربت أثناء الإرسال 🔥🔥🔥
            try {
                if (typeof window.updateQRCode === 'function') {
                    window.updateQRCode();
                }
            } catch (e) {
                console.warn('⚠️ QR Code error ignored during form submit:', e);
            }
        });
    }

    const searchRegNum = document.getElementById('searchRegNum');
    const searchName = document.getElementById('searchName');

    if (searchRegNum) {
        searchRegNum.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchStudent();
            }
        });
    }

    if (searchName) {
        searchName.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchStudent();
            }
        });
    }

    // تهيئة حالة الـ QR
    if (!document.getElementById('student_id')?.value) {
        renderStudentQRCode('', '');
    }

    // ربط حدث الضغط على الصورة الشخصية لرفع ملف جديد
    const avatarPlaceholder = document.getElementById('avatar_placeholder');
    if (avatarPlaceholder && avatarPlaceholder.tagName !== 'LABEL') {
        avatarPlaceholder.addEventListener('click', function (e) {
            if (e.target.id !== 'photo_input') {
                document.getElementById('photo_input')?.click();
            }
        });
    }

    // 🔥 تهيئة identity_input في حالة التعديل: نقل القيمة الموجودة في الحقول الخفية للحقل المرئي
    const initIdentityInput = document.getElementById('identity_input');
    const initNationalId = document.getElementById('national_id');
    const initPassport = document.getElementById('passport_number');
    if (initIdentityInput) {
        const existingVal = (initNationalId && initNationalId.value) || (initPassport && initPassport.value) || '';
        if (existingVal) {
            initIdentityInput.value = existingVal;
        }
    }

    // 🔥 تطبيق الوضع المباشر القائم على حالة الصفحة عند التحميل
    const hasStudentId = document.getElementById('student_id')?.value;
    if (hasStudentId) {
        lockStudentForm();
        const btnEdit = document.getElementById('btnEdit');
        if (btnEdit) {
            btnEdit.disabled = false;
            btnEdit.removeAttribute('disabled');
            btnEdit.style.opacity = '1';
            btnEdit.style.cursor = 'pointer';
        }
    } else {
        clearStudentForm();
    }
}

// معاينة الصورة المرفوعة
function previewAvatar(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('avatar_img');
            const icon = document.getElementById('avatar_icon');
            if (img) {
                img.src = e.target.result;
                img.style.display = 'block';
            }
            if (icon) {
                icon.style.display = 'none';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 🔥 دالة نسخ رابط التحقق الخاص بـ QR إلى الحافظة (Clipboard)
function copyQRCodeLink() {
    try {
        const btn = document.getElementById('btnCopyQR');
        const student = window.currentSelectedStudent;
        const qrUrl = (btn && (btn.dataset.url || btn.getAttribute('data-url'))) || (student && student.qr_code_data) || '';

        if (!qrUrl) {
            if (typeof toastError === 'function') toastError('يرجى اختيار طالب أولاً لنسخ رابط التحقق');
            return;
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(qrUrl).then(() => showCopySuccess()).catch(() => fallbackCopyText(qrUrl));
        } else {
            fallbackCopyText(qrUrl);
        }
    } catch (e) {
        console.error('Error in copyQRCodeLink:', e);
    }
}


function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showCopySuccess();
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
}

function showCopySuccess() {
    const btnText = document.getElementById('btnCopyQRText');
    if (btnText) {
        const originalText = btnText.innerText;
        btnText.innerText = 'تم النسخ بنجاح! ✅';
        setTimeout(() => {
            btnText.innerText = originalText;
        }, 2000);
    }
    if (typeof toastSuccess === 'function') {
        toastSuccess('تم نسخ رابط التحقق إلى الحافظة بنجاح!');
    }
}


// ============================================================
// 🔥 التحكم في حالة الأزرار بناءً على صلاحية الوظيفة (SystemJob Permission)
// ============================================================
// ============================================================
// 🔥 التحكم في حالة الأزرار بناءً على صلاحية الوظيفة المستقلة (Dual SystemJob Permissions)
// ============================================================
window.isFormEditingUnlocked = false;

function applyButtonPermissionStyles(isAddOpen, addMsg, isEditOpen, editMsg) {
    const btnNew = document.getElementById('btnNew');
    const btnEdit = document.getElementById('btnEdit');
    const btnSave = document.getElementById('btnSave');
    const btnSaveText = document.getElementById('btnSaveText');
    const isEditExisting = Boolean(document.getElementById('student_id')?.value);

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    console.log(`🔐 Dual Permission State - AddOpen: ${isAddOpen}, EditOpen: ${isEditOpen}, EditExisting: ${isEditExisting}, Unlocked: ${window.isFormEditingUnlocked}`);

    if (banner) {
        if (!isAddOpen || (!isEditOpen && isEditExisting)) {
            let msg = '';
            if (!isAddOpen && addMsg) msg += addMsg + ' ';
            if (!isEditOpen && isEditExisting && editMsg) msg += editMsg;
            if (bannerText) bannerText.textContent = msg.trim() || '⚠️ خدمة إضافة أو تعديل بيانات الطلاب موقوفة حالياً في جدول الوظائف.';
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    // 1. التحكم المستقل في زر "جديد" (Add Student Job)
    if (btnNew) {
        if (!isAddOpen) {
            btnNew.disabled = true;
            btnNew.setAttribute('disabled', 'disabled');
            btnNew.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            btnNew.style.setProperty('opacity', '0.5', 'important');
            btnNew.style.setProperty('cursor', 'not-allowed', 'important');
            btnNew.style.setProperty('pointer-events', 'none', 'important');
            btnNew.style.setProperty('filter', 'grayscale(80%)', 'important');
            if (addMsg) btnNew.title = addMsg;
        } else {
            btnNew.disabled = false;
            btnNew.removeAttribute('disabled');
            btnNew.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            btnNew.style.setProperty('opacity', '1', 'important');
            btnNew.style.setProperty('cursor', 'pointer', 'important');
            btnNew.style.setProperty('pointer-events', 'auto', 'important');
            btnNew.style.setProperty('filter', 'none', 'important');
            btnNew.title = '';
        }
    }

    // 2. التحكم المستقل في زر "تعديل" (Edit Student Job)
    if (btnEdit) {
        if (!isEditOpen) {
            btnEdit.disabled = true;
            btnEdit.setAttribute('disabled', 'disabled');
            btnEdit.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
            btnEdit.style.setProperty('opacity', '0.5', 'important');
            btnEdit.style.setProperty('cursor', 'not-allowed', 'important');
            btnEdit.style.setProperty('pointer-events', 'none', 'important');
            btnEdit.style.setProperty('filter', 'grayscale(80%)', 'important');
            if (editMsg) btnEdit.title = editMsg;
        } else {
            if (isEditExisting) {
                btnEdit.disabled = false;
                btnEdit.removeAttribute('disabled');
                btnEdit.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btnEdit.style.setProperty('opacity', '1', 'important');
                btnEdit.style.setProperty('cursor', 'pointer', 'important');
                btnEdit.style.setProperty('pointer-events', 'auto', 'important');
                btnEdit.style.setProperty('filter', 'none', 'important');
                btnEdit.title = '';
            } else {
                btnEdit.disabled = true;
                btnEdit.setAttribute('disabled', 'disabled');
                btnEdit.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btnEdit.style.setProperty('opacity', '0.5', 'important');
                btnEdit.style.setProperty('cursor', 'not-allowed', 'important');
                btnEdit.style.setProperty('pointer-events', 'none', 'important');
                btnEdit.style.setProperty('filter', 'grayscale(80%)', 'important');
                btnEdit.title = 'اختر طالباً من نتائج البحث لتفعيل التعديل';
            }
        }
    }

    // 3. التحكم في زر "حفظ" (Save Button)
    if (btnSave) {
        if (!isEditExisting) {
            if (btnSaveText) btnSaveText.innerText = 'حفظ';
            if (isAddOpen && window.isFormEditingUnlocked) {
                btnSave.disabled = false;
                btnSave.removeAttribute('disabled');
                btnSave.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btnSave.style.setProperty('opacity', '1', 'important');
                btnSave.style.setProperty('cursor', 'pointer', 'important');
                btnSave.style.setProperty('pointer-events', 'auto', 'important');
                btnSave.style.setProperty('filter', 'none', 'important');
            } else {
                btnSave.disabled = true;
                btnSave.setAttribute('disabled', 'disabled');
                btnSave.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btnSave.style.setProperty('opacity', '0.5', 'important');
                btnSave.style.setProperty('cursor', 'not-allowed', 'important');
                btnSave.style.setProperty('pointer-events', 'none', 'important');
                btnSave.style.setProperty('filter', 'grayscale(80%)', 'important');
            }
        } else {
            if (btnSaveText) btnSaveText.innerText = 'حفظ التعديلات';
            if (isEditOpen && window.isFormEditingUnlocked) {
                btnSave.disabled = false;
                btnSave.removeAttribute('disabled');
                btnSave.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btnSave.style.setProperty('opacity', '1', 'important');
                btnSave.style.setProperty('cursor', 'pointer', 'important');
                btnSave.style.setProperty('pointer-events', 'auto', 'important');
                btnSave.style.setProperty('filter', 'none', 'important');
            } else {
                btnSave.disabled = true;
                btnSave.setAttribute('disabled', 'disabled');
                btnSave.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btnSave.style.setProperty('opacity', '0.5', 'important');
                btnSave.style.setProperty('cursor', 'not-allowed', 'important');
                btnSave.style.setProperty('pointer-events', 'none', 'important');
                btnSave.style.setProperty('filter', 'grayscale(80%)', 'important');
            }
        }
    }
}

function updateJobPermissionState() {
    let isAddJobOpen = (typeof window.IS_ADD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_ADD_JOB_OPEN) : true;
    let addJobMessage = window.ADD_JOB_MESSAGE || '';
    let isEditJobOpen = (typeof window.IS_EDIT_JOB_OPEN !== 'undefined') ? Boolean(window.IS_EDIT_JOB_OPEN) : true;
    let editJobMessage = window.EDIT_JOB_MESSAGE || '';

    // تطبيق فوري استناداً إلى المتغيرات المحلية
    applyButtonPermissionStyles(isAddJobOpen, addJobMessage, isEditJobOpen, editJobMessage);

    // تحديث لحظي مباشر عبر API دون انتظار إعادة تحميل الصفحة
    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_ADD_JOB_OPEN = Boolean(data.is_add_job_open);
            window.ADD_JOB_MESSAGE = data.add_job_message || data.message || '';
            window.IS_EDIT_JOB_OPEN = Boolean(data.is_edit_job_open);
            window.EDIT_JOB_MESSAGE = data.edit_job_message || '';

            applyButtonPermissionStyles(
                window.IS_ADD_JOB_OPEN, window.ADD_JOB_MESSAGE,
                window.IS_EDIT_JOB_OPEN, window.EDIT_JOB_MESSAGE
            );
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic job permission check error:', err);
    });
}

// ربط الدوال
window.searchStudent = searchStudent;
window.selectStudent = selectStudent;
window.clearSearchResults = clearSearchResults;
window.clearStudentForm = clearStudentForm;
window.enableFormEditing = enableFormEditing;
window.lockStudentForm = lockStudentForm;
window.unlockStudentForm = unlockStudentForm;
window.updateJobPermissionState = updateJobPermissionState;
window.goBack = goBack;
window.previewAvatar = previewAvatar;
window.isLibyanNationality = isLibyanNationality;
window.syncIdentityToHiddenField = syncIdentityToHiddenField;
window.toggleIdentityFields = toggleIdentityFields;
window.copyQRCodeLink = copyQRCodeLink;


// تهيئة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ All functions registered');
console.log('   - window.searchStudent:', typeof window.searchStudent);
console.log('   - window.goBack:', typeof window.goBack);