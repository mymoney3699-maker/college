// static/js/departments.js
// إدارة الأقسام والتخصصات - JavaScript

let targetDeptId = null;
let targetIsActive = false;

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

function openAddDepartmentModal() {
    document.getElementById('addDeptModal').classList.remove('hidden');
}

function closeAddDepartmentModal() {
    document.getElementById('addDeptModal').classList.add('hidden');
}

function filterDeptTable() {
    const input = document.getElementById("deptSearchInput").value.toLowerCase();
    const rows = document.querySelectorAll("#departmentsTable tbody tr");
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(input) ? "" : "none";
    });
}

function onToggleDeptClick(btn) {
    const deptId = btn.getAttribute('data-dept-id');
    const deptName = btn.getAttribute('data-dept-name');
    const isActive = btn.getAttribute('data-dept-active') === '1';
    confirmToggleDepartment(deptId, deptName, isActive);
}

function confirmToggleDepartment(deptId, deptName, isActive) {
    targetDeptId = deptId;
    targetIsActive = isActive;
    
    const actionText = isActive ? "تجميد / إلغاء تفعيل" : "تفعيل";
    document.getElementById('toggleModalTitle').innerText = `${actionText} قسم (${deptName})`;
    document.getElementById('toggleModalBody').innerText = `هل أنت متأكد من ${actionText} قسم (${deptName})؟`;
    
    const confirmBtn = document.getElementById('confirmToggleBtn');
    if (isActive) {
        confirmBtn.innerText = "تجميد القسم الآن";
        confirmBtn.className = "px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 shadow-md";
    } else {
        confirmBtn.innerText = "تفعيل القسم الآن";
        confirmBtn.className = "px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md";
    }
    
    document.getElementById('toggleConfirmModal').classList.remove('hidden');
}

function closeToggleModal() {
    document.getElementById('toggleConfirmModal').classList.add('hidden');
    targetDeptId = null;
}

async function executeToggleDepartment() {
    if (!targetDeptId) return;
    try {
        const csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
        const csrfToken = csrfEl ? csrfEl.value : '';

        const response = await fetch(`/renewal/api/departments/toggle-active/${targetDeptId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const res = await response.json();
        if (res.success || res.status === 'success') {
            showNotification('success', res.message || 'تم تحديث حالة تفعيل القسم بنجاح');
            closeToggleModal();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('error', res.error || res.message || 'حدث خطأ أثناء تنفيذ الطلب');
            closeToggleModal();
        }
    } catch (err) {
        console.error('❌ Error in executeToggleDepartment:', err);
        showNotification('error', '❌ تعذر الاتصال بالسيرفر');
        closeToggleModal();
    }
}

// ============================================================
// الدالة الرئيسية لإضافة القسم
// ============================================================
async function submitNewDepartment(e) {
    e.preventDefault();
    
    console.log('🟢 تم الضغط على زر حفظ القسم');
    
    const name = document.getElementById('newDeptName').value.trim();
    const code = document.getElementById('newDeptCode').value.trim();
    
    console.log('📦 البيانات:', { name, code });
    
    if (!name || !code) {
        showNotification('warning', 'الرجاء إدخال اسم القسم والرمز المختصر');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';
    }

    try {
        // جلب CSRF Token من الـ form
        const csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
        const csrfToken = csrfEl ? csrfEl.value : '';
        
        if (!csrfToken) {
            showNotification('error', 'رمز الأمان (CSRF) غير متوفر، الرجاء تحديث الصفحة');
            return;
        }

        const url = '/renewal/api/departments/create/';
        console.log('📤 إرسال طلب إلى:', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ name, code })
        });

        console.log('📥 حالة الاستجابة:', response.status);

        const result = await response.json();
        console.log('📄 نتيجة الاستجابة:', result);

        if (response.ok && (result.success || result.status === 'success')) {
            showNotification('success', result.message || `تمت إضافة قسم (${name}) بنجاح`);
            closeAddDepartmentModal();
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification('error', result.error || result.message || 'حدث خطأ أثناء إضافة القسم.');
        }
    } catch (error) {
        console.error('❌ خطأ في submitNewDepartment:', error);
        showNotification('error', '❌ تعذر الاتصال بالسيرفر، يرجى المحاولة مرة أخرى.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ القسم';
        }
    }
}

// ============================================================
// جعل الدوال متاحة عالمياً
// ============================================================
window.submitNewDepartment = submitNewDepartment;
window.openAddDepartmentModal = openAddDepartmentModal;
window.closeAddDepartmentModal = closeAddDepartmentModal;
window.filterDeptTable = filterDeptTable;
window.onToggleDeptClick = onToggleDeptClick;
window.executeToggleDepartment = executeToggleDepartment;
window.closeToggleModal = closeToggleModal;

console.log('✅ تم تحميل سكريبت إدارة الأقسام بنجاح');