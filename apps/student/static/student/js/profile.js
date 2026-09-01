/**
 * ============================================================
 * الملف الشخصي - Personal Info & Account Settings
 * profile.js  v2.0.0 (API Integrated with JWT/Session Auth)
 * ============================================================
 */

console.log('✅ profile.js loaded');

let originalData = {};

/**
 * جلب بيانات الملف الشخصي من الـ API عند فتح الصفحة
 */
async function loadStudentProfile() {
    const fields = ['fullName', 'studentId', 'studentMajor', 'studentLevel', 'studentStatus', 'studentEmail', 'studentPhone', 'studentNationalId'];
    
    // إظهار حالة التحميل Loading State
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.placeholder = 'جاري التحميل... ⏳';
    });

    try {
        const res = await window.StudentAPI.getProfile();
        if (res.success && res.profile) {
            const p = res.profile;
            
            setFieldValue('fullName', p.full_name);
            setFieldValue('studentId', p.student_id);
            setFieldValue('studentMajor', p.department.name);
            setFieldValue('studentLevel', p.level.name);
            setFieldValue('studentStatus', p.academic_status);
            setFieldValue('studentEmail', p.email);
            setFieldValue('studentPhone', p.phone);
            setFieldValue('studentNationalId', p.national_id);

            // تحديث عناوين الهيدر بالواجهة
            const headerName = document.querySelector('.profile-name');
            const headerSubtitle = document.querySelector('.profile-subtitle');
            if (headerName) headerName.textContent = p.full_name;
            if (headerSubtitle) headerSubtitle.textContent = `${p.department.name} - ${p.level.name}`;

            saveOriginalData();
        }
    } catch (err) {
        console.error('❌ Error loading student profile:', err);
        showToast(err.message || 'فشل جلب بيانات الطالب من الخادم', 'error');
    }
}

function setFieldValue(id, val) {
    const el = document.getElementById(id);
    if (el) {
        el.value = val || '';
        el.placeholder = '';
    }
}

function saveOriginalData() {
    const fields = ['fullName', 'studentId', 'studentMajor', 'studentLevel', 'studentStatus', 'studentEmail', 'studentPhone'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) originalData[id] = el.value;
    });
}

function resetForm() {
    const fields = ['fullName', 'studentEmail', 'studentPhone'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && originalData[id] !== undefined) {
            el.value = originalData[id];
        }
    });
    showToast('تم إلغاء التعديلات', 'info');
}

/**
 * حفظ تعديلات الملف الشخصي عبر الـ API
 */
async function saveProfile() {
    const fullName = document.getElementById('fullName');
    const studentEmail = document.getElementById('studentEmail');
    const studentPhone = document.getElementById('studentPhone');

    if (!fullName || !fullName.value.trim()) {
        showToast('الاسم الكامل مطلوب', 'error');
        if (fullName) fullName.focus();
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (studentEmail && studentEmail.value.trim() && !emailRegex.test(studentEmail.value.trim())) {
        showToast('يرجى إدخال بريد إلكتروني صحيح', 'error');
        studentEmail.focus();
        return;
    }

    const saveBtn = document.querySelector('.btn-save');
    const originalText = saveBtn ? saveBtn.textContent : 'حفظ';
    if (saveBtn) {
        saveBtn.textContent = '⏳ جاري الحفظ...';
        saveBtn.disabled = true;
    }

    try {
        const payload = {
            full_name: fullName.value.trim(),
            email: studentEmail ? studentEmail.value.trim() : '',
            phone: studentPhone ? studentPhone.value.trim() : ''
        };

        const res = await window.StudentAPI.updateProfile(payload);
        if (res.success) {
            showToast('✅ تم حفظ التعديلات بنجاح');
            saveOriginalData();
        } else {
            showToast(res.error || 'حدث خطأ أثناء الحفظ', 'error');
        }
    } catch (err) {
        console.error('❌ Error saving profile:', err);
        showToast(err.message || 'حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }
}

function showToast(message, type = 'success') {
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type === 'error');
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    
    let bgColor = '#10b981';
    if (type === 'error') bgColor = '#dc2626';
    else if (type === 'info') bgColor = '#3b82f6';
    else if (type === 'warning') bgColor = '#f59e0b';

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: bgColor,
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        zIndex: '9999',
        fontWeight: '700',
        fontSize: '0.875rem',
        fontFamily: "'Cairo', sans-serif",
        direction: 'rtl',
        maxWidth: '90%',
        textAlign: 'center',
        opacity: '0',
        transition: 'opacity 0.3s ease'
    });
    
    document.body.appendChild(toast);
    
    setTimeout(() => { toast.style.opacity = '1'; }, 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Personal Info page ready with API integration');
    loadStudentProfile();
});

window.resetForm = resetForm;
window.saveProfile = saveProfile;
if (typeof window.showToast !== 'function') { window.showToast = showToast; }