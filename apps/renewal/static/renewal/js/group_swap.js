// ============================================
// تبديل المجموعات - Group Swap JavaScript
// ============================================

console.log('✅ group_swap.js loaded successfully');

let currentStudent = null;
let targetGroups = [];
let targetStudents = [];
let selectedTargetGroup = null;
let selectedTargetStudent = null;

// ============================================================
// دوال مساعدة
// ============================================================

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

function escapeHtml(text) {
    if (!text) return '-';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToastMessage(message, isError = false) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
            width: 100%;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${isError ? '#e11d48' : '#0f766e'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.9rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.4s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        direction: rtl;
        min-width: 200px;
    `;
    toast.innerHTML = `
        <span class="material-symbols-outlined">${isError ? 'error' : 'check_circle'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 4000);
}

// ============================================================
// تحميل بيانات الطالب
// ============================================================
function loadStudentData() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('student_id');
    
    if (!studentId) {
        showToastMessage('⚠️ لم يتم تحديد الطالب', true);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('swapContent').classList.remove('hidden');
        document.getElementById('swapContent').innerHTML = `
            <div class="text-center py-12 text-red-500">
                <span class="material-symbols-outlined" style="font-size: 48px;">error</span>
                <p class="text-xl font-bold mt-4">لم يتم تحديد الطالب</p>
                <p class="text-gray-500">الرجاء العودة لصفحة المجموعات واختيار طالب للتبديل</p>
                <button class="btn-action btn-exit mt-4" onclick="window.location.href='/renewal/groups/'">
                    <span class="material-symbols-outlined">arrow_back</span> العودة للمجموعات
                </button>
            </div>
        `;
        return;
    }
    
    // جلب بيانات الطالب
    fetch(`/renewal/api/student-detail/${studentId}/`)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                currentStudent = data.student;
                displayCurrentStudent(currentStudent);
                loadTargetGroups(currentStudent);
            } else {
                showToastMessage(data.error || 'حدث خطأ في جلب بيانات الطالب', true);
                document.getElementById('loadingState').classList.add('hidden');
                document.getElementById('swapContent').classList.remove('hidden');
            }
        })
        .catch(err => {
            console.error('Error loading student:', err);
            showToastMessage('حدث خطأ في الاتصال', true);
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('swapContent').classList.remove('hidden');
        });
}

// ============================================================
// عرض بيانات الطالب الحالي
// ============================================================
function displayCurrentStudent(student) {
    document.getElementById('currentStudentName').textContent = student.name || '-';
    document.getElementById('currentStudentId').textContent = student.student_id || '-';
    document.getElementById('currentStudentDept').textContent = student.department_name || '-';
    document.getElementById('currentStudentLevel').textContent = student.level_number || '-';
    document.getElementById('currentStudentGroup').textContent = student.group_name || 'غير محددة';
    
    // إظهار المحتوى
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('swapContent').classList.remove('hidden');
}

// ============================================================
// تحميل المجموعات المستهدفة
// ============================================================
function loadTargetGroups(student) {
    const departmentId = student.department_id;
    const levelId = student.level_id;
    const semesterType = student.semester_type || 'fall';
    const semesterYear = student.semester_year || new Date().getFullYear();
    
    if (!departmentId || !levelId) {
        showToastMessage('⚠️ بيانات الطالب غير مكتملة', true);
        return;
    }
    
    let url = `/renewal/api/filtered-groups/?department_id=${departmentId}&level_id=${levelId}&semester_type=${semesterType}&semester_year=${semesterYear}`;
    
    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                targetGroups = data.groups.filter(g => g.id !== student.group_id);
                populateTargetGroups(targetGroups);
            } else {
                showToastMessage(data.error || 'حدث خطأ في جلب المجموعات', true);
            }
        })
        .catch(err => {
            console.error('Error loading target groups:', err);
            showToastMessage('حدث خطأ في الاتصال', true);
        });
}

// ============================================================
// تعبئة قائمة المجموعات المستهدفة
// ============================================================
function populateTargetGroups(groups) {
    const select = document.getElementById('targetGroupSelect');
    select.innerHTML = '<option value="">-- اختر المجموعة --</option>';
    
    if (groups.length === 0) {
        select.innerHTML += '<option value="" disabled>لا توجد مجموعات متاحة للتبديل</option>';
        showToastMessage('⚠️ لا توجد مجموعات أخرى متاحة للتبديل', true);
        return;
    }
    
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `${group.name} (${group.student_count} طالب)`;
        select.appendChild(option);
    });
    
    showToastMessage(`✅ تم تحميل ${groups.length} مجموعة للتبديل`, false);
}

// ============================================================
// تحميل طلاب المجموعة المستهدفة
// ============================================================
function loadTargetGroupStudents() {
    const select = document.getElementById('targetGroupSelect');
    const groupId = select.value;
    
    if (!groupId) {
        document.getElementById('targetGroupInfo').classList.add('hidden');
        document.getElementById('targetStudentSelect').disabled = true;
        document.getElementById('targetStudentSelect').innerHTML = '<option value="">-- اختر المجموعة أولاً --</option>';
        document.getElementById('targetStudentInfo').classList.add('hidden');
        document.getElementById('swapSummary').classList.add('hidden');
        document.getElementById('confirmSwapBtn').disabled = true;
        selectedTargetGroup = null;
        selectedTargetStudent = null;
        return;
    }
    
    // البحث عن المجموعة في البيانات المخزنة
    selectedTargetGroup = targetGroups.find(g => g.id == groupId);
    if (!selectedTargetGroup) {
        // إذا لم تكن موجودة، جلبها من الـ API
        fetch(`/renewal/api/group-details/${groupId}/`)
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    selectedTargetGroup = data.group;
                    displayTargetGroupInfo(selectedTargetGroup);
                    populateTargetStudents(selectedTargetGroup.students);
                } else {
                    showToastMessage(data.error || 'حدث خطأ', true);
                }
            })
            .catch(err => {
                console.error('Error loading group details:', err);
                showToastMessage('حدث خطأ في الاتصال', true);
            });
        return;
    }
    
    displayTargetGroupInfo(selectedTargetGroup);
    populateTargetStudents(selectedTargetGroup.students);
}

// ============================================================
// عرض معلومات المجموعة المستهدفة
// ============================================================
function displayTargetGroupInfo(group) {
    document.getElementById('targetGroupInfo').classList.remove('hidden');
    document.getElementById('targetGroupName').textContent = group.name || '-';
    document.getElementById('targetGroupCount').textContent = group.student_count || 0;
}

// ============================================================
// تعبئة قائمة طلاب المجموعة المستهدفة
// ============================================================
function populateTargetStudents(students) {
    const select = document.getElementById('targetStudentSelect');
    select.innerHTML = '<option value="">-- اختر الطالب البديل --</option>';
    select.disabled = false;
    
    if (!students || students.length === 0) {
        select.innerHTML += '<option value="" disabled>لا يوجد طلاب في هذه المجموعة</option>';
        select.disabled = true;
        showToastMessage('⚠️ لا يوجد طلاب في هذه المجموعة للتبديل', true);
        return;
    }
    
    // استبعاد الطالب الحالي (إذا كان في هذه المجموعة)
    const filteredStudents = students.filter(s => s.id !== currentStudent.id);
    
    if (filteredStudents.length === 0) {
        select.innerHTML += '<option value="" disabled>لا يوجد طلاب آخرين للتبديل</option>';
        select.disabled = true;
        showToastMessage('⚠️ لا يوجد طلاب آخرين في هذه المجموعة للتبديل', true);
        return;
    }
    
    filteredStudents.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} (${student.student_id})`;
        select.appendChild(option);
    });
    
    // إضافة حدث التغيير
    select.onchange = function() {
        selectTargetStudent(this.value);
    };
}

// ============================================================
// اختيار الطالب البديل
// ============================================================
function selectTargetStudent(studentId) {
    if (!studentId) {
        selectedTargetStudent = null;
        document.getElementById('targetStudentInfo').classList.add('hidden');
        document.getElementById('swapSummary').classList.add('hidden');
        document.getElementById('confirmSwapBtn').disabled = true;
        return;
    }
    
    // البحث عن الطالب في قائمة الطلاب
    const student = selectedTargetGroup.students.find(s => s.id == studentId);
    if (!student) {
        showToastMessage('الطالب غير موجود', true);
        return;
    }
    
    selectedTargetStudent = student;
    
    // عرض معلومات الطالب البديل
    document.getElementById('targetStudentInfo').classList.remove('hidden');
    document.getElementById('targetStudentName').textContent = student.name || '-';
    document.getElementById('targetStudentId').textContent = student.student_id || '-';
    document.getElementById('targetStudentGroup').textContent = selectedTargetGroup.name || '-';
    
    // عرض ملخص التبديل
    displaySwapSummary();
    
    // تفعيل زر التأكيد
    document.getElementById('confirmSwapBtn').disabled = false;
}

// ============================================================
// عرض ملخص التبديل
// ============================================================
function displaySwapSummary() {
    document.getElementById('swapSummary').classList.remove('hidden');
    
    document.getElementById('swapFromText').textContent = `${currentStudent.name}`;
    document.getElementById('swapFromGroup').textContent = currentStudent.group_name || 'غير محددة';
    
    document.getElementById('swapToText').textContent = `${selectedTargetStudent.name}`;
    document.getElementById('swapToGroup').textContent = selectedTargetGroup.name || 'غير محددة';
}

// ============================================================
// نافذة تأكيد التبديل المخصصة بالـ JS
// ============================================================
function showCustomConfirmSwapModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmSwap');
        const btnOk = document.getElementById('confirmSwapBtnOk');
        const btnCancel = document.getElementById('confirmSwapBtnCancel');
        
        const elStudentAName = document.getElementById('confirmStudentAName');
        const elStudentAGroup = document.getElementById('confirmStudentAGroup');
        const elStudentBName = document.getElementById('confirmStudentBName');
        const elStudentBGroup = document.getElementById('confirmStudentBGroup');

        if (!modal) {
            resolve(window.confirm(`هل أنت متأكد من رغبتك في تبديل:\n${currentStudent.name} (${currentStudent.group_name}) ←→ ${selectedTargetStudent.name} (${selectedTargetGroup.name})`));
            return;
        }

        if (elStudentAName) elStudentAName.textContent = currentStudent.name || '-';
        if (elStudentAGroup) elStudentAGroup.textContent = currentStudent.group_name || 'غير محددة';
        if (elStudentBName) elStudentBName.textContent = selectedTargetStudent.name || '-';
        if (elStudentBGroup) elStudentBGroup.textContent = selectedTargetGroup.name || 'غير محددة';

        const handleConfirm = () => {
            cleanup();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            resolve(false);
        };

        const cleanup = () => {
            if (btnOk) btnOk.removeEventListener('click', handleConfirm);
            if (btnCancel) btnCancel.removeEventListener('click', handleCancel);
        };

        if (btnOk) btnOk.addEventListener('click', handleConfirm);
        if (btnCancel) btnCancel.addEventListener('click', handleCancel);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    });
}

// ============================================================
// تأكيد عملية التبديل
// ============================================================
async function confirmSwap() {
    if (!currentStudent || !selectedTargetStudent || !selectedTargetGroup) {
        showToastMessage('⚠️ البيانات غير مكتملة للتبديل', true);
        return;
    }
    
    if (currentStudent.id === selectedTargetStudent.id) {
        showToastMessage('⚠️ لا يمكن تبديل الطالب مع نفسه', true);
        return;
    }
    
    if (currentStudent.group_id === selectedTargetGroup.id) {
        showToastMessage('⚠️ الطالب موجود بالفعل في هذه المجموعة', true);
        return;
    }
    
    // تأكيد المستخدم عبر نافذة JS مخصصة وأنيقة
    const isConfirmed = await showCustomConfirmSwapModal();
    if (!isConfirmed) {
        return;
    }
    
    // تعطيل الزر أثناء المعالجة
    const btn = document.getElementById('confirmSwapBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> جاري المعالجة...';
    }
    
    // إرسال طلب التبديل
    fetch('/renewal/api/swap-groups/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            student_a_id: currentStudent.id,
            student_b_id: selectedTargetStudent.id
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToastMessage('✅ تم تبديل المجموعات بنجاح!', false);
            // إعادة توجيه بعد 1.5 ثانية
            setTimeout(() => {
                window.location.href = '/renewal/groups/';
            }, 1500);
        } else {
            showToastMessage(data.error || '❌ فشل التبديل', true);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined">swap_horiz</span> تأكيد المقايضة والتبديل';
            }
        }
    })
    .catch(err => {
        console.error('Error swapping groups:', err);
        showToastMessage('❌ حدث خطأ في الاتصال', true);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">swap_horiz</span> تأكيد المقايضة والتبديل';
        }
    });
}

// ============================================================
// تهيئة الصفحة
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadStudentData();
});

// ============================================================
// ربط الدوال بالمدى العام
// ============================================================
window.loadStudentData = loadStudentData;
window.loadTargetGroups = loadTargetGroups;
window.loadTargetGroupStudents = loadTargetGroupStudents;
window.selectTargetStudent = selectTargetStudent;
window.confirmSwap = confirmSwap;
window.showToastMessage = showToastMessage;

console.log('✅ group_swap.js initialized');