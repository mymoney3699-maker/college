// ============================================
// التحليلات والرسوم البيانية وطباعة التقارير للقسم (Department Detail Analytics & Printing)
// v2.4.0 - Full A4 Border Fix + Robust Stats Reading
// ============================================

console.log('✅ department_detail.js v2.4.0 loaded successfully');

let statusChartInstance = null;
let topFailedChartInstance = null;
let gpaTrendChartInstance = null;

// تحميل الرسوم البيانية العامة للقسم (حالات الطلاب ومسار GPA)
function loadDepartmentAnalytics() {
    const deptCode = window.DEPT_CODE || '';
    if (!deptCode) {
        console.warn('⚠️ Dept code not found');
        return;
    }

    const levelId = document.getElementById('deptLevelFilter')?.value || 'all';
    const url = `/renewal/api/departments/${encodeURIComponent(deptCode)}/analytics/?level_id=${encodeURIComponent(levelId)}`;

    fetch(url, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) return;
            renderStatusChart(data.status_counts);
            renderTopFailedChart(data.top_failed_courses);
            renderGpaTrendChart(data.gpa_trends);
        })
        .catch(error => console.error('❌ Error fetching analytics:', error));
}

function loadTopFailedCoursesOnly(levelId = 'all') {
    const deptCode = window.DEPT_CODE || '';
    if (!deptCode) return;

    const url = `/renewal/api/departments/${encodeURIComponent(deptCode)}/analytics/?level_id=${encodeURIComponent(levelId)}`;

    fetch(url, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.top_failed_courses) {
                renderTopFailedChart(data.top_failed_courses);
            }
        })
        .catch(error => console.error('❌ Error fetching top failed courses:', error));
}

const statusColorMap = {
    'منتظم': '#10b981',                     // أخضر زمردي
    'موقوف قيده': '#f59e0b',                 // برتقالي/كهرماني
    'مسحوبة ملف': '#ef4444',                 // أحمر
    'إخلاء طرف': '#3b82f6',                  // أزرق
    'إخلاء طرف / خريج معتمد': '#8b5cf6',     // بنفسجي
};

function renderStatusChart(statusData) {
    const ctx = document.getElementById('chartStudentStatus');
    if (!ctx) return;

    if (statusChartInstance) {
        statusChartInstance.destroy();
        statusChartInstance = null;
    }

    let labels = (statusData && statusData.labels) ? statusData.labels : ['منتظم', 'موقوف قيده', 'مسحوبة ملف', 'إخلاء طرف', 'إخلاء طرف / خريج معتمد'];
    let dataValues = (statusData && statusData.data) ? statusData.data : [0, 0, 0, 0, 0];
    let bgColors = labels.map(lbl => statusColorMap[lbl] || '#94a3b8');

    const totalSum = dataValues.reduce((a, b) => Number(a) + Number(b), 0);
    if (totalSum === 0) {
        labels = ['لا توجد بيانات طلاب حالياً'];
        dataValues = [1];
        bgColors = ['#cbd5e1'];
    }

    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: true, position: 'bottom', labels: { font: { family: 'Cairo', size: 10 } } }
            }
        }
    });
}

function renderTopFailedChart(failedData) {
    const ctx = document.getElementById('chartTopFailedCourses');
    if (!ctx) return;

    if (topFailedChartInstance) {
        topFailedChartInstance.destroy();
        topFailedChartInstance = null;
    }

    const labels = (failedData && failedData.labels && failedData.labels.length > 0) ? failedData.labels : ['لا توجد مواد بها رسوب بالمستوى المختار'];
    const counts = (failedData && failedData.failed_counts && failedData.failed_counts.length > 0) ? failedData.failed_counts : [0];

    topFailedChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'عدد حالات الرسوب',
                data: counts,
                backgroundColor: 'rgba(239, 68, 68, 0.85)',
                borderColor: '#dc2626',
                borderWidth: 1.5,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(220, 38, 38, 0.95)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Cairo', size: 10 } } },
                y: { ticks: { font: { family: 'Cairo', size: 10 } } }
            }
        }
    });
}

function renderGpaTrendChart(gpaData) {
    const ctx = document.getElementById('chartGpaTrend');
    if (!ctx) return;

    if (gpaTrendChartInstance) {
        gpaTrendChartInstance.destroy();
        gpaTrendChartInstance = null;
    }

    const labels = (gpaData && gpaData.labels && gpaData.labels.length > 0) ? gpaData.labels : ['المستوى 1', 'المستوى 2', 'المستوى 3', 'المستوى 4'];
    const gpas = (gpaData && gpaData.gpas && gpaData.gpas.length > 0) ? gpaData.gpas : [0, 0, 0, 0];

    gpaTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'متوسط GPA للمستوى',
                data: gpas,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#4338ca',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 4.0, ticks: { font: { family: 'Cairo', size: 10 } } },
                x: { ticks: { font: { family: 'Cairo', size: 10 } } }
            }
        }
    });
}

// ============================================
// 🖨️ 1. طباعة التقرير التفصيلي الشامل للقسم المختار
// ============================================
function printDepartmentSummaryReport() {
    const deptName = window.DEPT_NAME || document.querySelector('.h3.fw-bold span:first-of-type, .page-header-title span:first-of-type')?.textContent.trim() || 'القسم العلمي';
    const deptCode = window.DEPT_CODE || document.querySelector('.badge.font-monospace')?.textContent.trim() || '';

    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';
    const dateStr = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // قراءة الإحصائيات من كروت الصفحة - البحث عن h3 داخل stat-card بالترتيب
    const statCards = document.querySelectorAll('.stat-card h3');
    const totalStudents = statCards[0]?.textContent.trim() || '0';
    const facultyCount = statCards[1]?.textContent.trim() || '0';
    const lowGpaCount = statCards[2]?.textContent.trim() || '0';
    const coursesCount = statCards[3]?.textContent.trim() || '0';

    const coursesTableRows = document.querySelectorAll('[x-show="activeTab === \'courses\'"] table tbody tr');
    let coursesList = [];

    coursesTableRows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 5) {
            const code = cols[1]?.textContent.trim() || '';
            const name = cols[2]?.textContent.trim() || '';
            const hours = cols[3]?.textContent.trim() || '';
            const level = cols[4]?.textContent.trim() || '';

            let levelNum = 99;
            const match = level.match(/\d+/);
            if (match) levelNum = parseInt(match[0]);

            coursesList.push({ code, name, hours, level, levelNum });
        }
    });

    coursesList.sort((a, b) => a.levelNum - b.levelNum);

    let coursesRowsHtml = '';
    if (coursesList.length === 0) {
        coursesRowsHtml = `<tr><td colspan="5" style="padding:15px;text-align:center;font-weight:700;">لا توجد مقررات دراسية مسجلة لهذا القسم.</td></tr>`;
    } else {
        coursesList.forEach((c, idx) => {
            coursesRowsHtml += `
                <tr>
                    <td style="padding:6px 5px;border:1px solid #000;text-align:center;font-weight:800;">${idx + 1}</td>
                    <td style="padding:6px 5px;border:1px solid #000;text-align:center;font-family:monospace;font-weight:900;">${escapeHtml(c.code)}</td>
                    <td style="padding:6px 8px;border:1px solid #000;text-align:right;font-weight:800;">${escapeHtml(c.name)}</td>
                    <td style="padding:6px 5px;border:1px solid #000;text-align:center;font-weight:800;">${escapeHtml(c.hours)}</td>
                    <td style="padding:6px 5px;border:1px solid #000;text-align:center;font-weight:800;">${escapeHtml(c.level)}</td>
                </tr>`;
        });
    }

    let registrarName = 'أ. احمد محمد علي محمود';
    if (window.OfficialsHelper?.getOfficial) {
        const off = window.OfficialsHelper.getOfficial('general_registrar');
        if (off?.name) registrarName = (off.title ? off.title + ' ' : '') + off.name;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير قسم - ${escapeHtml(deptName)}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: 'Cairo', sans-serif; font-size: 12.5px; direction: rtl; background: #fff; color: #000; width: 100%; }
    
    .print-frame {
        border: 2px solid #000;
        padding: 18px 22px;
        box-sizing: border-box;
        width: 100%;
        min-height: 277mm;
        display: flex;
        flex-direction: column;
        background: #fff;
    }
    .print-frame > div:first-child { flex: 1; }

    .doc-header { text-align: center; margin-bottom: 8px; }
    .doc-logo { width: 75px; height: 75px; object-fit: contain; display: block; margin: 0 auto 3px; }
    .doc-gov { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
    .doc-college { font-size: 16px; font-weight: 900; margin-top: 2px; }
    .doc-line { border-bottom: 1.5px solid #000; margin: 6px 0; }
    .doc-title { font-size: 18.5px; font-weight: 900; text-align: center; margin: 6px 0; }

    .dept-meta-grid {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1.5px solid #000;
        background: #f8fafc;
        border-radius: 6px;
        padding: 8px 14px;
        margin: 10px 0 14px 0;
        font-size: 13px;
        font-weight: 800;
    }
    
    .metrics-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 16px;
    }
    .metric-card {
        border: 1px solid #000;
        padding: 8px 10px;
        text-align: center;
        background: #fff;
        border-radius: 4px;
    }
    .metric-lbl { font-size: 11px; font-weight: 700; color: #333; }
    .metric-val { font-size: 16px; font-weight: 900; color: #000; margin-top: 2px; }

    .section-head {
        font-size: 14px;
        font-weight: 900;
        margin-bottom: 8px;
        border-bottom: 1px solid #000;
        padding-bottom: 4px;
    }

    .courses-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    .courses-table th {
        background: #f1f5f9;
        color: #000;
        border: 1px solid #000;
        padding: 7px 5px;
        font-size: 12px;
        font-weight: 900;
    }
    .courses-table td {
        border: 1px solid #000;
        font-size: 12px;
    }

    .sig-container {
        display: flex;
        justify-content: flex-end;
        margin-top: 25px;
        padding-left: 10px;
        page-break-inside: avoid;
    }
    .sig-col { text-align: center; width: 240px; }
    .sig-name { font-size: 13.5px; font-weight: 900; margin-bottom: 3px; }
    .sig-title { font-size: 12.5px; font-weight: 800; margin-bottom: 18px; }
    .sig-line { font-size: 12.5px; font-weight: 800; }

    @media print {
        @page { size: A4 portrait; margin: 5mm; }
        .print-frame { border: 2px solid #000 !important; }
    }
</style>
</head>
<body>
    <div class="print-frame">
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
                    <img class="doc-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.onerror=null; this.style.display='none';">
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
            <div class="doc-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">التقرير التفصيلي الشامل لقسم / ${escapeHtml(deptName)}</div>

            <div class="dept-meta-grid">
                <div><span>القسم العلمي:</span> <strong>${escapeHtml(deptName)} (${escapeHtml(deptCode)})</strong></div>
                <div><span>تاريخ الإصدار:</span> <strong>${dateStr}</strong></div>
            </div>

            <div class="metrics-summary-grid">
                <div class="metric-card">
                    <div class="metric-lbl">إجمالي الطلاب المنتسبين</div>
                    <div class="metric-val">${escapeHtml(totalStudents)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">أعضاء هيئة التدريس</div>
                    <div class="metric-val">${escapeHtml(facultyCount)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">إنذار انخفاض الأداء</div>
                    <div class="metric-val">${escapeHtml(lowGpaCount)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">المقـررات الدراسية</div>
                    <div class="metric-val">${escapeHtml(coursesCount)}</div>
                </div>
            </div>

            <div class="section-head">المقررات الدراسية المعتمدة (مرتبة بحسب المستوى الدراسي)</div>
            <table class="courses-table">
                <thead>
                    <tr>
                        <th style="width: 35px; text-align: center;">#</th>
                        <th style="width: 110px; text-align: center;">رمز المادة</th>
                        <th style="text-align: right; padding-right: 10px;">اسم المقرر الدراسي</th>
                        <th style="width: 70px; text-align: center;">الساعات</th>
                        <th style="width: 130px; text-align: center;">المستوى الدراسي</th>
                    </tr>
                </thead>
                <tbody>
                    ${coursesRowsHtml}
                </tbody>
            </table>
        </div>

        <div class="sig-container">
            <div class="sig-col">
                <div class="sig-name">${escapeHtml(registrarName)}</div>
                <div class="sig-title">المسجل العام بالكلية</div>
                <div class="sig-line">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 200);
        };
    <\/script>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 3000);
}

// ============================================
// 🖨️ 2. طباعة كشف طلاب القسم المستقل المباشر من الشاشة
// ============================================
function printDepartmentStudentsReport() {
    console.log('🖨️ printDepartmentStudentsReport triggered');

    const deptName = window.DEPT_NAME || document.querySelector('.h3.fw-bold span:first-of-type, .page-header-title span:first-of-type')?.textContent.trim() || 'القسم العلمي';
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';
    const dateStr = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // 1. قراءة صفوف الجدول المباشر من #deptStudentsTable فقط (للدقة)
    const studentsTable = document.getElementById('deptStudentsTable');
    const tableRows = studentsTable
        ? studentsTable.querySelectorAll('tbody tr')
        : document.querySelectorAll('#deptStudentsTable tbody tr');
    let studentsList = [];

    tableRows.forEach(tr => {
        const cols = tr.querySelectorAll('td');
        if (cols.length >= 3) {
            const regId = cols[1]?.textContent.trim() || '';
            const name = cols[2]?.textContent.trim() || '';
            const level = cols[4]?.textContent.trim() || '';

            // تجاهل صف الـ empty state وصفوف بدون بيانات سليمة
            if (regId && name && !name.includes('لا يوجد')) {
                studentsList.push({ regId, name, level });
            }
        }
    });

    // 🔥 الترتيب الأبجدي الحتمي للطلاب من (أ) إلى (ي)
    studentsList.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    let rowsHtml = '';
    if (studentsList.length === 0) {
        rowsHtml = `<tr><td colspan="4" style="padding:20px;text-align:center;font-weight:800;border:1px solid #000;">لا يوجد طلاب مقيدين بهذا القسم حالياً.</td></tr>`;
    } else {
        studentsList.forEach((s, idx) => {
            rowsHtml += `
                <tr>
                    <td style="padding:7px 5px;border:1px solid #000;text-align:center;font-weight:800;font-size:12px;">${idx + 1}</td>
                    <td style="padding:7px 5px;border:1px solid #000;text-align:center;font-weight:900;font-family:monospace;font-size:13px;">${escapeHtml(s.regId)}</td>
                    <td style="padding:7px 10px;border:1px solid #000;text-align:right;font-weight:800;font-size:13px;">${escapeHtml(s.name)}</td>
                    <td style="padding:7px 5px;border:1px solid #000;text-align:center;"></td>
                </tr>
            `;
        });
    }

    // جلب اسم المسئولين ديناميكياً من OfficialsHelper
    let registrarName = 'أ. احمد محمد علي محمود';
    if (window.OfficialsHelper?.getOfficial) {
        const off = window.OfficialsHelper.getOfficial('general_registrar');
        if (off?.name) registrarName = (off.title ? off.title + ' ' : '') + off.name;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>كشف طلاب - ${escapeHtml(deptName)}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: 'Cairo', sans-serif; font-size: 12.5px; direction: rtl; background: #fff; color: #000; width: 100%; }
    
    .print-frame {
        border: 2px solid #000;
        padding: 18px 22px;
        box-sizing: border-box;
        width: 100%;
        min-height: 277mm;
        display: flex;
        flex-direction: column;
        background: #fff;
    }
    .print-frame > div:first-child { flex: 1; }

    .doc-header { text-align: center; margin-bottom: 8px; }
    .doc-logo { width: 75px; height: 75px; object-fit: contain; display: block; margin: 0 auto 3px; }
    .doc-gov { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
    .doc-college { font-size: 16px; font-weight: 900; margin-top: 2px; }
    .doc-line { border-bottom: 1.5px solid #000; margin: 6px 0; }
    .doc-title { font-size: 18.5px; font-weight: 900; text-align: center; margin: 6px 0; }

    .dept-meta-grid {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1.5px solid #000;
        background: #f8fafc;
        border-radius: 6px;
        padding: 8px 14px;
        margin: 10px 0 14px 0;
        font-size: 13px;
        font-weight: 800;
    }

    .students-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    .students-table th {
        background: #f1f5f9;
        color: #000;
        border: 1px solid #000;
        padding: 7px 5px;
        font-size: 12.5px;
        font-weight: 900;
    }
    .students-table td {
        border: 1px solid #000;
        font-size: 12.5px;
    }

    /* التوقيع والختم ينزل طبيعياً فور انتهاء الجدول بدون التثبيت القسري بالأسفل */
    .sig-container {
        display: flex;
        justify-content: flex-end;
        margin-top: 25px;
        padding-left: 10px;
        page-break-inside: avoid;
    }
    .sig-col { text-align: center; width: 240px; }
    .sig-name { font-size: 13.5px; font-weight: 900; margin-bottom: 3px; }
    .sig-title { font-size: 12.5px; font-weight: 800; margin-bottom: 18px; }
    .sig-line { font-size: 12.5px; font-weight: 800; }

    @media print {
        @page { size: A4 portrait; margin: 5mm; }
        .print-frame { border: 2px solid #000 !important; }
    }
</style>
</head>
<body>
    <div class="print-frame">
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
                    <img class="doc-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.onerror=null; this.style.display='none';">
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
            <div class="doc-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">كشف الطلاب المقيدين بقسم / ${escapeHtml(deptName)}</div>

            <div class="dept-meta-grid">
                <div><span>القسم العلمي:</span> <strong>${escapeHtml(deptName)}</strong></div>
                <div><span>عدد الطلاب:</span> <strong>${studentsList.length} طالب</strong></div>
                <div><span>تاريخ الإصدار:</span> <strong>${dateStr}</strong></div>
            </div>

            <table class="students-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th style="width: 130px; text-align: center;">رقم القيد</th>
                        <th style="text-align: right; padding-right: 12px;">اسم الطالب  </th>
                        <th style="width: 150px; text-align: center;">التوقيع / ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>

        <!-- التوقيع والختم ينزل طبيعياً بعد انتهاء الجدول مباشرة -->
        <div class="sig-container">
            <div class="sig-col">
                <div class="sig-name">${escapeHtml(registrarName)}</div>
                <div class="sig-title">المسجل العام </div>
                <div class="sig-line">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 200);
        };
    <\/script>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function () {
    const levelSelect = document.getElementById('deptLevelFilter');

    if (levelSelect) {
        levelSelect.addEventListener('change', function () {
            loadTopFailedCoursesOnly(this.value);
        });
    }

    loadDepartmentAnalytics();
});

// تصدير الدوال للنطاق العام
window.loadTopFailedCoursesOnly = loadTopFailedCoursesOnly;
window.loadDepartmentAnalytics = loadDepartmentAnalytics;
window.printDepartmentSummaryReport = printDepartmentSummaryReport;
window.printDepartmentStudentsReport = printDepartmentStudentsReport;
window.printDepartmentStudentList = printDepartmentStudentsReport;