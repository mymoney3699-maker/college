// ============================================
// بحث عن طالب - Search Student
// ============================================

console.log('✅ search_student.js loaded successfully');

let searchTimeout;
let allStudents = []; // تخزين جميع الطلاب من الـ API

// Helper function to get CSRF token
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

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    if (!text) return '-';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// دالة لتطهير وتوحيد الحروف العربية
function normalizeArabic(text) {
    if (!text) return '';
    return text
        .trim()
        .toLowerCase()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/\s+/g, ' ');
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

// عرض رسائل التحذير
function showWarning(msg) {
    showNotification('warning', msg);
}

// عرض بطاقة تفاصيل الطالب
function renderResults(students) {
    const studentInfo = document.getElementById('studentInfo');
    const profileViewer = document.getElementById('studentProfileViewer');
    const searchResults = document.getElementById('searchResults');
    
    if (!studentInfo) return;
    
    if (!students || students.length === 0) {
        studentInfo.innerHTML = '<div class="text-center text-yellow-600 p-4 border rounded-lg">❌ لا توجد نتائج مطابقة</div>';
        studentInfo.style.display = 'block';
        clearViewerFields();
        return;
    }
    
    // إخفاء الرسائل الافتراضية
    studentInfo.style.display = 'none';
    
    // إخفاء قائمة الاقتراحات
    if (searchResults) {
        searchResults.classList.add('hidden');
    }
    
    // تعبئة بيانات أول طالب
    const student = students[0];
    
    // تعبئة الحقول
    const fieldsMap = {
        'view_student_id': student.student_id,
        'view_name': student.name,
        'view_father_name': student.father_name,
        'view_grandfather_name': student.grandfather_name,
        'view_last_name': student.last_name,
        'view_birth_date': student.birth_date,
        'view_birth_place': student.birth_place_id,
        'view_nationality': student.nationality_id,
        'view_blood_type': student.blood_type,
        'view_gender': student.gender_id,
        'view_marital_status': student.marital_status_id,
        'view_national_id': student.national_id,
        'view_phone': student.phone,
        'view_email': student.email,
        'view_current_address': student.address,
        'view_department': student.department_id,
        'view_study_plan': student.study_plan_id,
        'view_group': student.group_id,
        'view_student_status': student.student_status_id,
        'view_enrollment_date': student.enrollment_date,
        'view_notes': student.notes,
        'view_level': student.level_id,
        'view_semester_type': student.semester_type || '',
        'view_semester_year': student.semester_year || '',
        
        // ولي الأمر
        'view_guardian_name': student.guardian_name,
        'view_guardian_phone': student.guardian_phone,
        
        // المؤهل العلمي
        'view_qualification': student.qualification_id,
        'view_qualification_place': student.qualification_place,
        'view_qualification_date': student.qualification_date,
        'view_qualification_grade': student.qualification_grade,
        'view_qualification_major': student.qualification_major,
        'view_qualification_percentage': student.qualification_percentage
    };
    
    for (const [id, value] of Object.entries(fieldsMap)) {
        const field = document.getElementById(id);
        if (field) {
            field.value = value || '';
            if (field.tagName.toLowerCase() === 'select') {
                field.dispatchEvent(new Event('change'));
            }
        }
    }
    
    // تحديث صورة الطالب
    const photoImg = document.getElementById('student_photo_preview');
    const avatarIcon = document.getElementById('view_avatar_icon');
    const photoUrl = student.photo_url || student.photo;

    if (photoImg) {
        if (photoUrl) {
            photoImg.src = photoUrl;
            photoImg.style.display = 'block';
            if (avatarIcon) avatarIcon.style.display = 'none';
        } else {
            photoImg.src = '/static/images/default_avatar.png';
            photoImg.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'block';
        }
    }

    // تحديث QR Code
    updateViewQRCode(student);
    
    // تعطيل حقول البحث لمنع تغييرها أثناء عرض ملف الطالب
    const searchRegNum = document.getElementById('searchRegNum');
    const searchName = document.getElementById('searchName');
    if (searchRegNum) {
        searchRegNum.disabled = true;
        searchRegNum.readOnly = true;
    }
    if (searchName) {
        searchName.disabled = true;
        searchName.readOnly = true;
    }

    // تعطيل جميع الحقول (قراءة فقط)
    const viewerFields = document.querySelectorAll('#studentProfileViewer input, #studentProfileViewer select, #studentProfileViewer textarea');
    viewerFields.forEach(field => {
        field.disabled = true;
        field.readOnly = true;
        field.classList.add('read-only-field');
        
        if (field.tagName.toLowerCase() === 'select') {
            const wrapper = field.nextElementSibling;
            if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
                const trigger = wrapper.querySelector('.custom-select-trigger');
                if (trigger) {
                    trigger.disabled = true;
                    trigger.style.pointerEvents = 'none';
                    trigger.style.opacity = '0.7';
                }
            }
        }
    });
    
    // تعطيل زر موافق
    const approveBtn = document.querySelector('.btn-approve');
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.style.opacity = '0.5';
        approveBtn.style.cursor = 'not-allowed';
    }
    
    // تغيير عنوان القسم
    const viewerTitle = document.querySelector('#studentProfileViewer .group-title');
    if (viewerTitle) {
        viewerTitle.innerHTML = 'بيانات الطالب';
        viewerTitle.style.color = '#ffffff';
    }
    
    if (profileViewer) {
        profileViewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// عرض قائمة الاقتراحات
function renderSuggestions(students) {
    const resultsDiv = document.getElementById('searchResults');
    const studentInfo = document.getElementById('studentInfo');
    
    if (!resultsDiv) return;
    
    if (!students || students.length === 0) {
        resultsDiv.innerHTML = `<div class="text-center text-yellow-600 p-4 font-bold">❌ لا توجد نتائج مطابقة</div>`;
        resultsDiv.classList.remove('hidden');
        if (studentInfo) studentInfo.style.display = 'block';
        clearViewerFields();
        return;
    }
    
    if (studentInfo) studentInfo.style.display = 'none';
    
    let html = `
        <div class="p-3 text-sm text-primary font-bold border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-[#1e293b] z-10">📋 عدد النتائج: ${students.length}</div>
        <div class="flex-col">
    `;
    
    students.forEach(student => {
        html += `
            <div class="search-result-item" onclick="window.selectStudent('${student.student_id}')">
                <div class="search-result-item-info">
                    <span class="search-result-item-name">${escapeHtml(student.name)}</span>
                    <span class="search-result-item-id">
                        رقم القيد: ${escapeHtml(student.student_id)} | ${escapeHtml(student.department_name || '-')}
                    </span>
                </div>
                <span class="search-result-item-action">
                    ← اختيار
                </span>
            </div>
        `;
    });
    
    html += `</div>`;
    resultsDiv.innerHTML = html;
    resultsDiv.classList.remove('hidden');
}

// اختيار طالب وعرض بياناته
function selectStudent(studentId) {
    console.log('🎓 selectStudent called with:', studentId);
    
    if (!studentId) {
        console.error('❌ Missing student ID');
        return;
    }
    
    // البحث في allStudents
    const student = allStudents.find(s => s.student_id.toString() === studentId.toString());
    if (student) {
        // تحديث حقول البحث
        const regNumInput = document.getElementById('searchRegNum');
        const nameInput = document.getElementById('searchName');
        if (regNumInput) regNumInput.value = student.student_id;
        if (nameInput) nameInput.value = student.name;
        
        // عرض البيانات
        renderResults([student]);
    } else {
        // إذا لم يتم العثور على الطالب، قم بجلب البيانات من الـ API
        fetch(`/renewal/search-student-api/?reg_num=${studentId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.students && data.students.length > 0) {
                    allStudents = data.students;
                    renderResults([data.students[0]]);
                }
            })
            .catch(error => {
                console.error('❌ Error fetching student:', error);
                showWarning('حدث خطأ في جلب بيانات الطالب');
            });
    }
}

// دالة البحث الرئيسية
function doSearch() {
    console.log('🔍 doSearch called');
    
    const regNum = document.getElementById('searchRegNum');
    const name = document.getElementById('searchName');
    
    if (!regNum || !name) {
        console.error('❌ Elements not found!');
        return;
    }
    
    const regNumValue = regNum.value.trim();
    const nameValue = name.value.trim();
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    const studentInfo = document.getElementById('studentInfo');
    const resultsDiv = document.getElementById('searchResults');
    
    // إذا كانت الحقول فارغة، امسح كل شيء
    if (!regNumValue && !nameValue) {
        clearSearch();
        return;
    }
    
    // مسح الحقول السابقة
    clearViewerFields();
    
    // إظهار مؤشر التحميل
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    
    // بناء رابط الـ API
    let url = `/renewal/search-student-api/?`;
    if (regNumValue) url += `reg_num=${encodeURIComponent(regNumValue)}&`;
    if (nameValue) url += `name=${encodeURIComponent(nameValue)}`;
    
    console.log('📡 Fetching:', url);
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('📊 Data received from API:', data);
        
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        
        if (data.success && data.students && data.students.length > 0) {
            // تخزين جميع الطلاب
            allStudents = data.students;
            
            // التحقق من وجود تطابق تام لرقم القيد
            if (regNumValue) {
                const exactMatch = allStudents.find(s => s.student_id.toLowerCase() === regNumValue.toLowerCase());
                if (exactMatch) {
                    // تحديث حقول البحث
                    regNum.value = exactMatch.student_id;
                    name.value = exactMatch.name;
                    // عرض بيانات الطالب مباشرة
                    renderResults([exactMatch]);
                    return;
                }
            }
            
            // عرض قائمة الاقتراحات
            renderSuggestions(allStudents);
        } else {
            // لا توجد نتائج - إظهار إشعار عائم وتنبيه تحذيري
            const notFoundMsg = data.message || 'لم يتم العثور على أي طالب يطابق بيانات البحث المدخلة';
            showNotification('warning', notFoundMsg);
            if (resultsDiv) {
                resultsDiv.innerHTML = `<div class="text-center text-yellow-600 dark:text-yellow-400 p-4 border border-slate-200 dark:border-slate-700 rounded-lg font-bold">⚠️ ${notFoundMsg}</div>`;
                resultsDiv.classList.remove('hidden');
            }
            clearViewerFields();
        }
    })
    .catch(error => {
        console.error('❌ Search error:', error);
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        showNotification('error', 'حدث خطأ في البحث. يرجى المحاولة مرة أخرى.');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<div class="text-center text-red-600 dark:text-red-400 p-4 border border-slate-200 dark:border-slate-700 rounded-lg font-bold">❌ حدث خطأ في البحث. يرجى المحاولة مرة أخرى.</div>';
            resultsDiv.classList.remove('hidden');
        }
        clearViewerFields();
    });
}

// البحث المباشر مع تأخير
function liveSearch() {
    console.log('⌨️ liveSearch called');
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(doSearch, 300);
}

// توليد وعرض QR Code
function updateViewQRCode(student) {
    console.log('📱 updateViewQRCode called', student);
    
    const qrImg = document.getElementById('view_qr_image');
    const qrPlaceholder = document.getElementById('view_qr_placeholder');
    const qrUrl = student ? (student.qr_code_url || student.qr_code) : '';
    // ✅ دائماً نبني الرابط النظيف من qr_key + الـ origin الحالي
    //    حتى لا نستخدم qr_code_data القديم الذي قد يحتوي على IP مختلف أو signature منتهي
    if (student && student.qr_key) {
        window.currentViewQRLink = `${window.location.origin}/student/qr/${student.qr_key}/`;
        window.currentViewStudent = student;
    } else {
        window.currentViewQRLink = student ? (student.qr_code_data || '') : '';
        window.currentViewStudent = student || null;
    }
    
    if (qrImg) {
        if (qrUrl) {
            qrImg.src = qrUrl;
            qrImg.style.display = 'block';
            if (qrPlaceholder) qrPlaceholder.style.display = 'none';
        } else {
            qrImg.src = '';
            qrImg.style.display = 'none';
            if (qrPlaceholder) qrPlaceholder.style.display = 'block';
        }
    }
}

// نسخ رابط الـ QR
function copyQRCodeLink() {
    // إعادة بناء الرابط النظيف من qr_key لضمان استخدام الـIP الحالي
    const student = window.currentViewStudent;
    let link = window.currentViewQRLink || '';
    if (student && student.qr_key) {
        link = `${window.location.origin}/student/qr/${student.qr_key}/`;
    }
    if (link) {
        console.log('📋 Copying QR URL:', link);
        (navigator.clipboard
            ? navigator.clipboard.writeText(link)
            : Promise.reject(new Error('no clipboard')))
        .then(() => {
            const btnText = document.getElementById('btnCopyQRText');
            if (btnText) {
                const orig = btnText.innerText;
                btnText.innerText = 'تم النسخ!';
                setTimeout(() => { btnText.innerText = orig; }, 2000);
            }
            showNotification('success', 'تم نسخ رابط التحقق بنجاح إلى الحافظة');
        }).catch(err => {
            console.error('Failed to copy QR link:', err);
            // احتياطي: نسخ textarea
            const ta = document.createElement('textarea');
            ta.value = link;
            ta.style.position = 'fixed';
            ta.style.left = '-999999px';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); showNotification('success', 'تم نسخ رابط التحقق بنجاح'); } catch (e) { showNotification('error', 'تعذر نسخ الرابط إلى الحافظة'); }
            document.body.removeChild(ta);
        });
    } else {
        showNotification('warning', 'يرجى اختيار طالب أولاً لنسخ رابط التحقق');
    }
}
window.copyQRCodeLink = copyQRCodeLink;

// مسح جميع حقول العرض
function clearViewerFields() {
    const viewerFields = document.querySelectorAll('#studentProfileViewer input, #studentProfileViewer select, #studentProfileViewer textarea');
    viewerFields.forEach(field => {
        field.value = '';
        field.disabled = true;
        field.readOnly = true;
        field.classList.add('read-only-field');
        
        if (field.tagName.toLowerCase() === 'select') {
            const wrapper = field.nextElementSibling;
            if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
                const trigger = wrapper.querySelector('.custom-select-trigger');
                if (trigger) {
                    trigger.disabled = true;
                    trigger.style.pointerEvents = 'none';
                    trigger.style.opacity = '0.7';
                }
            }
        }
    });
    
    // تفريغ صورة الطالب
    const photoImg = document.getElementById('student_photo_preview');
    const avatarIcon = document.getElementById('view_avatar_icon');
    if (photoImg) {
        photoImg.src = '';
        photoImg.style.display = 'none';
    }
    if (avatarIcon) {
        avatarIcon.style.display = 'block';
    }

    // تفريغ QR Code
    const qrImg = document.getElementById('view_qr_image');
    const qrPlaceholder = document.getElementById('view_qr_placeholder');
    if (qrImg) {
        qrImg.src = '';
        qrImg.style.display = 'none';
    }
    if (qrPlaceholder) {
        qrPlaceholder.style.display = 'block';
    }
    window.currentViewQRLink = '';
    
    // إعادة تعيين عنوان القسم
    const viewerTitle = document.querySelector('#studentProfileViewer .group-title');
    if (viewerTitle) {
        viewerTitle.innerHTML = 'بيانات الطالب';
        viewerTitle.style.color = '';
    }
}

// مسح البحث بالكامل
function clearSearch() {
    console.log('🧹 clearSearch called');
    
    const regNumInput = document.getElementById('searchRegNum');
    const nameInput = document.getElementById('searchName');
    const studentInfo = document.getElementById('studentInfo');
    const resultsDiv = document.getElementById('searchResults');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const profileViewer = document.getElementById('studentProfileViewer');
    
    if (regNumInput) {
        regNumInput.value = '';
        regNumInput.disabled = false;
        regNumInput.readOnly = false;
    }
    if (nameInput) {
        nameInput.value = '';
        nameInput.disabled = false;
        nameInput.readOnly = false;
    }
    if (studentInfo) {
        studentInfo.innerHTML = '';
        studentInfo.style.display = 'none';
    }
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
    }
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    
    // إخفاء ملف الطالب
    if (profileViewer) profileViewer.style.display = 'none';
    
    // مسح الحقول
    clearViewerFields();
    
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // مسح التخزين المؤقت
    allStudents = [];
}

// الرجوع للصفحة السابقة
function goBack() {
    console.log('🔙 goBack called');
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// إغلاق ملف الطالب
function closeProfileViewer() {
    console.log('🔙 closeProfileViewer called');
    clearSearch();
}

// إخفاء نتائج البحث عند النقر خارجها
document.addEventListener('click', function(event) {
    const resultsDiv = document.getElementById('searchResults');
    const searchRegNum = document.getElementById('searchRegNum');
    const searchName = document.getElementById('searchName');
    
    if (resultsDiv && !resultsDiv.contains(event.target) && 
        searchRegNum && !searchRegNum.contains(event.target) && 
        searchName && !searchName.contains(event.target)) {
        resultsDiv.classList.add('hidden');
    }
});

// تهيئة الصفحة
function init() {
    console.log('🚀 Initializing search student page');
    clearViewerFields();
    
    // إظهار رسالة ترحيبية
    const studentInfo = document.getElementById('studentInfo');
    if (studentInfo) {
        studentInfo.innerHTML = '<div class="text-center text-gray-500 p-4">🔍 ابحث عن طالب باستخدام رقم القيد أو الاسم</div>';
        studentInfo.style.display = 'block';
    }
}

// ربط الدوال بـ Window
window.liveSearch = liveSearch;
window.doSearch = doSearch;
window.selectStudent = selectStudent;
window.clearSearch = clearSearch;
window.goBack = goBack;
window.closeProfileViewer = closeProfileViewer;
window.clearViewerFields = clearViewerFields;

// تهيئة عند تحميل DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ All functions registered to window object');