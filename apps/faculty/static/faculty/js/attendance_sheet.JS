/**
 * ============================================================
 * كشف حضور الطلاب - Attendance Sheet (نموذج ورقي فارغ للطباعة)
 * attendance_sheet.js  v2.1.0
 * ============================================================
 */

console.log('✅ attendance_sheet.js v2.1.0 loaded');

const attendanceDataEl = document.getElementById('attendance-data');
if (attendanceDataEl) {
    try {
        const data = JSON.parse(attendanceDataEl.textContent);
        window.databaseStudents = data.students || [];
        window.studentsByGroup = data.students_by_group || {};
        window.databaseDepartments = data.departments || [];
        window.databaseGroups = data.groups || [];
        window.databaseCourses = data.courses || [];
        window.databaseSemesters = data.semesters || [];
        window.databaseLevels = data.levels || [];
    } catch (e) {
        console.error('Error parsing attendance-data JSON:', e);
    }
}

const جميع_الطلاب_الأبجدية = window.databaseStudents || [];

function عند_تغيير_الإدخال() {
    const بطاقة_الجدول = document.getElementById('بطاقة-الجدول');
    if (بطاقة_الجدول) {
        بطاقة_الجدول.classList.add('hidden');
        بطاقة_الجدول.style.display = 'none';
    }
    التحقق_من_صحة_المدخلات();
}

function التحقق_من_صحة_المدخلات() {
    const القسم = document.getElementById('حقل-القسم')?.value?.trim() || '';
    const المجموعة = document.getElementById('حقل-المجموعة')?.value?.trim() || '';
    const المادة = document.getElementById('حقل-المادة')?.value?.trim() || '';
    const زر_العرض = document.getElementById('زر-عرض-الكشف');
    if (!زر_العرض) return;

    if (القسم && المجموعة && المادة) {
        زر_العرض.disabled = false;
        زر_العرض.style.opacity = '1';
        زر_العرض.style.cursor = 'pointer';
    } else {
        زر_العرض.disabled = true;
        زر_العرض.style.opacity = '0.5';
        زر_العرض.style.cursor = 'not-allowed';
    }
}

function مزامنة_بيانات_الطباعة(عدد_الطلاب = 0) {
    const القسم = document.getElementById('حقل-القسم')?.value || 'الكل';
    const المجموعة = document.getElementById('حقل-المجموعة')?.value || 'الكل';
    const المادة = document.getElementById('حقل-المادة')?.value || 'عامة';
    const المستوى = document.getElementById('اختيار-المستوى')?.value || 'الكل';

    let textLevel = المستوى;
    if (textLevel === 'الكل' || textLevel === '0' || !textLevel) {
        textLevel = 'كافة المستويات';
    }

    let textDept = القسم;
    if (textDept === 'الكل' || !textDept) {
        textDept = 'كافة الأقسام';
    }

    let textGroup = المجموعة;
    if (textGroup === 'الكل' || !textGroup) {
        textGroup = 'كافة المجموعات';
    }

    // ① تاريخ السحب فقط بدون وقت
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

    const rptDept   = document.getElementById('rptPrintDept');
    const rptCourse = document.getElementById('rptPrintCourse');
    const rptGroup  = document.getElementById('rptPrintGroup');
    const rptLevel  = document.getElementById('rptPrintLevel');
    const rptDate   = document.getElementById('rptPrintDateVal');

    if (rptDept)   rptDept.textContent   = textDept;
    if (rptCourse) rptCourse.textContent = المادة;
    if (rptGroup)  rptGroup.textContent  = textGroup;
    if (rptLevel)  rptLevel.textContent  = textLevel;
    if (rptDate)   rptDate.textContent   = dateStr;
}

function توليد_الكشف() {
    const القسم = document.getElementById('حقل-القسم')?.value?.trim();
    const المجموعة = document.getElementById('حقل-المجموعة')?.value?.trim();
    const المادة = document.getElementById('حقل-المادة')?.value?.trim();

    if (!القسم || !المجموعة || !المادة) {
        alert("يرجى اختيار القسم والمجموعة والمادة الدراسية أولاً.");
        return;
    }

    const بطاقة_الجدول = document.getElementById('بطاقة-الجدول');
    if (بطاقة_الجدول) {
        بطاقة_الجدول.classList.remove('hidden');
        بطاقة_الجدول.style.display = 'block';
    }

    تحميل_الطلاب();
    بطاقة_الجدول.scrollIntoView({ behavior: 'smooth' });
}

function تحميل_الطلاب() {
    const القسم = document.getElementById('حقل-القسم')?.value?.trim();
    const المجموعة = document.getElementById('حقل-المجموعة')?.value?.trim();
    const المستوى = document.getElementById('اختيار-المستوى')?.value?.trim();

    let الطلاب = [...جميع_الطلاب_الأبجدية];
    
    // 1. الفلترة حسب القسم
    if (القسم && القسم !== 'الكل' && القسم !== 'كافة الأقسام') {
        الطلاب = الطلاب.filter(s => s.dept === القسم || String(s.dept_id) === String(القسم));
    }

    // 2. الفلترة حسب المجموعة
    if (المجموعة && المجموعة !== 'الكل' && المجموعة !== 'كافة المجموعات') {
        الطلاب = الطلاب.filter(s => s.group === المجموعة || String(s.group_id) === String(المجموعة));
    }

    // 3. الفلترة حسب المستوى
    if (المستوى && المستوى !== 'الكل' && المستوى !== 'كافة المستويات') {
        الطلاب = الطلاب.filter(s => {
            const lvlStr = String(s.level || '').trim();
            const lvlNumStr = String(s.level_number || '').trim();
            const targetLvl = String(المستوى).trim();
            
            return lvlStr === targetLvl ||
                   lvlNumStr === targetLvl ||
                   `المستوى ${lvlNumStr}` === targetLvl ||
                   `المستوى ${lvlStr}` === targetLvl ||
                   String(s.level_id) === targetLvl;
        });
    }

    الطلاب.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    مزامنة_بيانات_الطباعة(الطلاب.length);

    const عداد = document.getElementById('عداد-الطلاب');
    if (عداد) {
        عداد.innerText = `العدد: ${الطلاب.length} طالب (مرتبين أبجدياً)`;
    }

    عرض_صفوف_الجدول(الطلاب);
}

function عرض_صفوف_الجدول(الطلاب) {
    const جسم_الجدول = document.getElementById('جسم-الجدول');
    const جسم_طباعة = document.getElementById('جسم-طباعة');

    if (!جسم_الجدول || !جسم_طباعة) return;

    جسم_الجدول.innerHTML = '';
    جسم_طباعة.innerHTML = '';

    if (الطلاب.length === 0) {
        const emptyRow = `
            <tr>
                <td colspan="17" class="rpt-empty-cell">
                    لا توجد بيانات مطابقة للفلاتر المحددة
                </td>
            </tr>
        `;
        جسم_الجدول.innerHTML = emptyRow;
        جسم_طباعة.innerHTML = emptyRow;
        return;
    }

    const عدد_الأيام = 14;

    الطلاب.forEach((طالب, index) => {
        // صف المعاينة على الشاشة
        const صف_شاشة = document.createElement('tr');
        let خلايا_شاشة = `
            <td>${index + 1}</td>
            <td style="font-family: monospace; font-weight: 700;">${طالب.id}</td>
            <td class="student-name-cell border-separator" style="text-align: right; font-weight: 700;">${طالب.name}</td>
        `;
        for (let i = 0; i < عدد_الأيام; i++) {
            خلايا_شاشة += `<td class="day-column" style="text-align: center;"></td>`;
        }
        صف_شاشة.innerHTML = خلايا_شاشة;
        جسم_الجدول.appendChild(صف_شاشة);

        // صف ورقة الطباعة الرسمية
        const صف_طباعة = document.createElement('tr');
        let خلايا_طباعة = `
            <td style="text-align:center; font-weight:700;">${index + 1}</td>
            <td style="text-align:center; font-family:monospace; font-weight:700;">${طالب.id}</td>
            <td style="text-align:right; font-weight:600;">${طالب.name}</td>
        `;
        for (let i = 0; i < عدد_الأيام; i++) {
            خلايا_طباعة += `<td></td>`;
        }
        صف_طباعة.innerHTML = خلايا_طباعة;
        جسم_طباعة.appendChild(صف_طباعة);
    });
}

function طباعة_الكشف_المباشر() {
    تحميل_الطلاب();

    const container = document.getElementById('reportPrintContainer');
    if (container && container.parentElement !== document.body) {
        document.body.appendChild(container);
    }

    const doPrint = () => window.print();

    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') {
                res.then(doPrint).catch(doPrint);
            } else {
                setTimeout(doPrint, 400);
            }
        } catch (e) {
            console.warn('OfficialsHelper error:', e);
            doPrint();
        }
    } else {
        doPrint();
    }
}

function تصفية_الطلاب_بالاسم() {
    const نص_البحث = document.getElementById('حقل-البحث')?.value?.trim()?.toLowerCase() || '';
    const القسم = document.getElementById('حقل-القسم')?.value?.trim();
    const المجموعة = document.getElementById('حقل-المجموعة')?.value?.trim();
    const المستوى = document.getElementById('اختيار-المستوى')?.value?.trim();

    let الطلاب = [...جميع_الطلاب_الأبجدية];

    if (القسم && القسم !== 'الكل' && القسم !== 'كافة الأقسام') {
        الطلاب = الطلاب.filter(s => s.dept === القسم || String(s.dept_id) === String(القسم));
    }
    if (المجموعة && المجموعة !== 'الكل' && المجموعة !== 'كافة المجموعات') {
        الطلاب = الطلاب.filter(s => s.group === المجموعة || String(s.group_id) === String(المجموعة));
    }
    if (المستوى && المستوى !== 'الكل' && المستوى !== 'كافة المستويات') {
        الطلاب = الطلاب.filter(s => {
            const lvlStr = String(s.level || '').trim();
            const lvlNumStr = String(s.level_number || '').trim();
            const targetLvl = String(المستوى).trim();
            return lvlStr === targetLvl || lvlNumStr === targetLvl || `المستوى ${lvlNumStr}` === targetLvl || `المستوى ${lvlStr}` === targetLvl || String(s.level_id) === targetLvl;
        });
    }

    const المصفاة = الطلاب.filter(طالب => 
        طالب.name.toLowerCase().includes(نص_البحث) || طالب.id.includes(نص_البحث)
    );

    عرض_صفوف_الجدول(المصفاة);
    const عداد = document.getElementById('عداد-الطلاب');
    if (عداد) {
        عداد.innerText = `المطابق للبحث: ${المصفاة.length} من أصل ${الطلاب.length}`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 صفحة كشف الحضور جاهزة مع تحسينات الفلترة والطباعة الرسمية الموحدة');

    const اختيار_المستوى = document.getElementById('اختيار-المستوى');
    if (اختيار_المستوى) {
        اختيار_المستوى.addEventListener('change', عند_تغيير_الإدخال);
    }

    التحقق_من_صحة_المدخلات();
    تحميل_الطلاب();
});

window.addEventListener('beforeprint', function() {
    تحميل_الطلاب();
});

window.عند_تغيير_الإدخال = عند_تغيير_الإدخال;
window.توليد_الكشف = توليد_الكشف;
window.طباعة_الكشف_المباشر = طباعة_الكشف_المباشر;
window.تحميل_الطلاب = تحميل_الطلاب;
window.تصفية_الطلاب_بالاسم = تصفية_الطلاب_بالاسم;
window.مزامنة_بيانات_الطباعة = مزامنة_بيانات_الطباعة;
window.التحقق_من_صحة_المدخلات = التحقق_من_صحة_المدخلات;