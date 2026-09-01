/**
 * ============================================================
 * لوحة قسم إدارة الأعمال - Business Department Dashboard
 * business.js  v2.0.0
 * ============================================================
 * السلوك: الخلايا للقراءة فقط بشكل افتراضي.
 * - الضغط على ✏️ تعديل → يفعّل التحرير ويظهر ✔ حفظ و✕ إلغاء
 * - الضغط على ✔ حفظ  → يحفظ التغييرات في localStorage
 * - الضغط على ✕ إلغاء → يُعيد القيم الأصلية بدون حفظ
 */

console.log('✅ business.js v2.0.0 loaded');

// ============================================================
// البيانات
// ============================================================
let teachers = [];

let employees = [];

let classes = [];

let chart = null;

// ============================================================
// دوال مساعدة
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function getTotalStudents() {
    return classes.reduce((sum, c) => sum + (typeof c.count === 'number' ? c.count : 0), 0);
}

// ============================================================
// تحديث العدد الكلي
// ============================================================
function updateTotalBox() {
    const totalEl = document.getElementById('totalStudentsCount');
    if (totalEl) totalEl.innerText = getTotalStudents();

    const emptyMsg = document.getElementById('emptyChartMessage');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', classes.length > 0);
}

// ============================================================
// الرسم البياني
// ============================================================
function initChart() {
    const ctx = document.getElementById('studentsChart');
    if (!ctx) return;

    if (chart) chart.destroy();

    const textColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-slate-light').trim() || '#475569';
    const gridColor = '#f1f5f9';
    const isDark = document.documentElement.classList.contains('dark');
    const barColor   = isDark ? '#4a99ad' : '#307e92';
    const hoverColor = isDark ? '#5aadc2' : '#b59b66';

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: classes.map(c => c.name),
            datasets: [{
                label: 'عدد الطلاب',
                data: classes.map(c => c.count),
                backgroundColor: barColor,
                hoverBackgroundColor: hoverColor,
                borderRadius: 6,
                barPercentage: 0.55
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Cairo', size: 12, weight: '700' },
                    bodyFont:  { family: 'Cairo', size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: ctx => `عدد الطلاب: ${ctx.raw} طالب`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Cairo', weight: '700' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Cairo', weight: '700' } }
                }
            }
        }
    });

    updateTotalBox();
}

// ============================================================
// عرض جدول أعضاء هيئة التدريس
// ============================================================
function renderTeachers() {
    const container = document.getElementById('teachersList');
    if (!container) return;

    container.innerHTML = teachers.map((t, i) => `
        <tr id="teacher-row-${i}">
            <td id="teacher-name-${i}">${escapeHtml(t.name) || '<span style="color:#94a3b8;font-style:italic;">أستاذ جديد</span>'}</td>
            <td id="teacher-email-${i}">${escapeHtml(t.email) || '<span style="color:#94a3b8;font-style:italic;">example@tripoli.edu.ly</span>'}</td>
            <td class="col-action">
                <div class="row-actions" id="teacher-actions-${i}">
                    <button class="btn-row-edit" title="تعديل" onclick="startEditTeacher(${i})">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                </div>
                <div class="save-actions hidden" id="teacher-save-${i}">
                    <button class="btn-row-save" title="حفظ التعديل" onclick="saveTeacher(${i})">
                        <span class="material-symbols-outlined">check</span>
                    </button>
                    <button class="btn-row-cancel" title="إلغاء" onclick="cancelEditTeacher(${i})">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// تفعيل وضع التعديل لصف معلم
function startEditTeacher(index) {
    const nameCell  = document.getElementById(`teacher-name-${index}`);
    const emailCell = document.getElementById(`teacher-email-${index}`);
    const row       = document.getElementById(`teacher-row-${index}`);

    // حفظ القيم الأصلية في data attributes
    nameCell.dataset.original  = teachers[index].name;
    emailCell.dataset.original = teachers[index].email;

    // تفعيل التحرير
    nameCell.contentEditable  = 'true';
    emailCell.contentEditable = 'true';
    nameCell.innerText  = teachers[index].name;
    emailCell.innerText = teachers[index].email;
    nameCell.classList.add('cell-editing');
    emailCell.classList.add('cell-editing');
    row.classList.add('editing-row');

    // إظهار أزرار الحفظ/الإلغاء وإخفاء أزرار التعديل/الحذف
    document.getElementById(`teacher-actions-${index}`).classList.add('hidden');
    document.getElementById(`teacher-save-${index}`).classList.remove('hidden');

    nameCell.focus();

    // تحديد النص للتسهيل
    const range = document.createRange();
    range.selectNodeContents(nameCell);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

// حفظ التعديل
function saveTeacher(index) {
    const nameCell  = document.getElementById(`teacher-name-${index}`);
    const emailCell = document.getElementById(`teacher-email-${index}`);

    teachers[index].name  = nameCell.innerText.trim();
    teachers[index].email = emailCell.innerText.trim();

    saveAll();
    renderTeachers();
}

// إلغاء التعديل وإعادة القيم الأصلية
function cancelEditTeacher(index) {
    renderTeachers(); // إعادة الرسم بالبيانات الأصلية بدون حفظ
}

// حذف معلم
function deleteTeacher(index) {
    if (confirm('هل أنت متأكد من حذف هذا العضو؟')) {
        teachers.splice(index, 1);
        renderTeachers();
        saveAll();
    }
}

// إضافة معلم جديد
function addTeacher() {
    teachers.push({ name: "", email: "" });
    renderTeachers();
    // فتح وضع التعديل مباشرة على الصف الجديد
    startEditTeacher(teachers.length - 1);
    saveAll();
}

// ============================================================
// عرض جدول الموظفين
// ============================================================
function renderEmployees() {
    const container = document.getElementById('employeesList');
    if (!container) return;

    container.innerHTML = employees.map((e, i) => `
        <tr id="employee-row-${i}">
            <td id="employee-name-${i}">${escapeHtml(e.name) || '<span style="color:#94a3b8;font-style:italic;">موظف جديد</span>'}</td>
            <td id="employee-email-${i}">${escapeHtml(e.email) || '<span style="color:#94a3b8;font-style:italic;">example@tripoli.edu.ly</span>'}</td>
            <td class="col-action">
                <div class="row-actions" id="employee-actions-${i}">
                    <button class="btn-row-edit" title="تعديل" onclick="startEditEmployee(${i})">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                </div>
                <div class="save-actions hidden" id="employee-save-${i}">
                    <button class="btn-row-save" title="حفظ التعديل" onclick="saveEmployee(${i})">
                        <span class="material-symbols-outlined">check</span>
                    </button>
                    <button class="btn-row-cancel" title="إلغاء" onclick="cancelEditEmployee(${i})">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// تفعيل وضع التعديل لصف موظف
function startEditEmployee(index) {
    const nameCell  = document.getElementById(`employee-name-${index}`);
    const emailCell = document.getElementById(`employee-email-${index}`);
    const row       = document.getElementById(`employee-row-${index}`);

    nameCell.dataset.original  = employees[index].name;
    emailCell.dataset.original = employees[index].email;

    nameCell.contentEditable  = 'true';
    emailCell.contentEditable = 'true';
    nameCell.innerText  = employees[index].name;
    emailCell.innerText = employees[index].email;
    nameCell.classList.add('cell-editing');
    emailCell.classList.add('cell-editing');
    row.classList.add('editing-row');

    document.getElementById(`employee-actions-${index}`).classList.add('hidden');
    document.getElementById(`employee-save-${index}`).classList.remove('hidden');

    nameCell.focus();

    const range = document.createRange();
    range.selectNodeContents(nameCell);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

// حفظ التعديل
function saveEmployee(index) {
    const nameCell  = document.getElementById(`employee-name-${index}`);
    const emailCell = document.getElementById(`employee-email-${index}`);

    employees[index].name  = nameCell.innerText.trim();
    employees[index].email = emailCell.innerText.trim();

    saveAll();
    renderEmployees();
}

// إلغاء التعديل
function cancelEditEmployee(index) {
    renderEmployees();
}

// حذف موظف
function deleteEmployee(index) {
    if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
        employees.splice(index, 1);
        renderEmployees();
        saveAll();
    }
}

// إضافة موظف جديد
function addEmployee() {
    employees.push({ name: "", email: "" });
    renderEmployees();
    startEditEmployee(employees.length - 1);
    saveAll();
}

// ============================================================
// حفظ واسترجاع بيانات الإدارة
// ============================================================
function saveDeptHead() {
    localStorage.setItem('deptHead_business', JSON.stringify({
        deptDesc:  document.getElementById('deptDesc')?.innerText || '',
        headName:  document.getElementById('headName')?.value || '',
        headEmail: document.getElementById('headEmail')?.value || ''
    }));
}

function loadDeptHead() {
    const saved = localStorage.getItem('deptHead_business');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.deptDesc  && document.getElementById('deptDesc'))  document.getElementById('deptDesc').innerText  = data.deptDesc;
        if (data.headName  && document.getElementById('headName'))  document.getElementById('headName').value     = data.headName;
        if (data.headEmail && document.getElementById('headEmail')) document.getElementById('headEmail').value    = data.headEmail;
    } else {
        if (document.getElementById('headName'))  document.getElementById('headName').value  = "";
        if (document.getElementById('headEmail')) document.getElementById('headEmail').value = "";
    }
}

// ============================================================
// حفظ واسترجاع جميع البيانات
// ============================================================
function saveAll() {
    localStorage.setItem('deptTeachers_business', JSON.stringify(teachers));
    localStorage.setItem('deptEmployees_business', JSON.stringify(employees));
    saveDeptHead();
}

function loadAll() {
    const savedTeachers  = localStorage.getItem('deptTeachers_business');
    const savedEmployees = localStorage.getItem('deptEmployees_business');

    if (savedTeachers)  teachers  = JSON.parse(savedTeachers);
    if (savedEmployees) employees = JSON.parse(savedEmployees);

    loadDeptHead();
    renderTeachers();
    renderEmployees();
    initChart();
}

// ============================================================
// مراقبة تغيير الوضع الداكن لتحديث الرسم البياني
// ============================================================
const observer = new MutationObserver(function () {
    if (chart) {
        const isDark = document.documentElement.classList.contains('dark');
        chart.data.datasets[0].backgroundColor      = isDark ? '#4a99ad' : '#307e92';
        chart.data.datasets[0].hoverBackgroundColor = isDark ? '#5aadc2' : '#b59b66';
        chart.update();
    }
});

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// ============================================================
// تهيئة الصفحة
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    loadAll();
});

// ============================================================
// تصدير الدوال للنافذة
// ============================================================
window.addTeacher        = addTeacher;
window.startEditTeacher  = startEditTeacher;
window.saveTeacher       = saveTeacher;
window.cancelEditTeacher = cancelEditTeacher;
window.deleteTeacher     = deleteTeacher;

window.addEmployee        = addEmployee;
window.startEditEmployee  = startEditEmployee;
window.saveEmployee       = saveEmployee;
window.cancelEditEmployee = cancelEditEmployee;
window.deleteEmployee     = deleteEmployee;

window.saveDeptHead = saveDeptHead;