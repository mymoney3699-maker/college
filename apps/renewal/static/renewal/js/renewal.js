// ============================================================
// لوحة التحكم الرئيسية - RENEWAL DASHBOARD JS v3.2.0
// ============================================================

console.log("✅ Dashboard JS v3.2.0 loaded successfully");

function getJsonData(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return null;
    try {
        const rawData = JSON.parse(element.textContent);
        return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
        console.error(`❌ Error parsing #${elementId}:`, e);
        return null;
    }
}

function loadDashboard() {
    const semestersData = getJsonData('semesters-data');
    const departmentsData = getJsonData('departments-data');
    const statusData = getJsonData('status-data');

    if (!semestersData || !semestersData.data) {
        console.warn("⚠️ No data available to draw charts.");
        return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const chartBorderColor = isDark ? '#1e293b' : '#ffffff';

    // الخطوط العامة المشتركة (Cairo)
    const globalFont = { family: 'Cairo, sans-serif', size: 12, weight: 'bold' };

    // لوحة الألوان الموحدة عالية التباين للطباعة والشاشات
    const brandPalette = [
        '#1e3a8a',
        '#c2410c',
        '#15803d',
        '#0f766e',
        '#6b21a8',
        '#b91c1c',
        '#4338ca',
        '#b45309'
    ];

    // --- 📊 1. مخطط الفصول الدراسية (أعمدة رأسية) ---
    const ctxSemester = document.getElementById('semesterChart');
    if (ctxSemester) {
        new Chart(ctxSemester, {
            type: 'bar',
            data: {
                labels: semestersData.labels,
                datasets: [{
                    label: 'عدد الطلاب',
                    data: semestersData.data,
                    backgroundColor: 'rgba(2, 132, 199, 0.85)',
                    borderRadius: 8,
                    maxBarThickness: 48,
                    categoryPercentage: 0.85,
                    barPercentage: 0.9,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                return ` الطلاب: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: { font: globalFont, stepSize: 1, color: textColor, padding: 8 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: globalFont, color: textColor, padding: 8 }
                    }
                }
            }
        });
    }

    // --- 📈 2. مخطط التخصصات (أعمدة أفقية حديثة ومتساوية) ---
    const ctxDepartment = document.getElementById('departmentChart');
    if (ctxDepartment) {
        new Chart(ctxDepartment, {
            type: 'bar',
            data: {
                labels: departmentsData.labels,
                datasets: [{
                    label: 'الطلاب حسب التخصص',
                    data: departmentsData.data,
                    backgroundColor: brandPalette,
                    borderRadius: 8,
                    maxBarThickness: 36,
                    categoryPercentage: 0.85,
                    barPercentage: 0.9,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                return ` الطلاب: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: { font: globalFont, stepSize: 1, color: textColor, padding: 8 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: globalFont, color: textColor, padding: 8 }
                    }
                }
            }
        });
    }

    // --- 🎯 3. مخطط الحالات الأكاديمية (دائري مكبر وموضح) ---
    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus) {
        const chartColors = (statusData.colors && statusData.colors.length) ? statusData.colors : brandPalette;

        new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusData.labels,
                datasets: [{
                    data: statusData.data,
                    backgroundColor: chartColors,
                    borderWidth: 2,
                    borderColor: chartBorderColor,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '58%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        labels: { 
                            font: globalFont, 
                            color: textColor,
                            boxWidth: 12, 
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return ` ${label}: ${value} طالب (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', loadDashboard);

// ============================================================
// 🖨️ وظائف الطباعة المباشرة الرسمية الموحدة A4
// ============================================================

// 1. طباعة الواجهة بالرسوم البيانية في إطار رسمي معتمد A4 متناسق تماماً
function printDashboardVisual() {
    console.log('🖨️ printDashboardVisual triggered');
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';
    const currentSemester = window.CURRENT_SEMESTER_NAME || document.querySelector('.header-banner-badge')?.textContent.trim() || 'الفصل الدراسي الحالي';
    const dateStr = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });

    // تحويل الرسوم البيانية إلى صور عادية بجودة عالية لضمان دقة الطباعة
    const statusChartCanvas = document.getElementById('statusChart');
    const semesterChartCanvas = document.getElementById('semesterChart');
    const departmentChartCanvas = document.getElementById('departmentChart');

    const statusImg = statusChartCanvas ? statusChartCanvas.toDataURL('image/png') : '';
    const semesterImg = semesterChartCanvas ? semesterChartCanvas.toDataURL('image/png') : '';
    const deptImg = departmentChartCanvas ? departmentChartCanvas.toDataURL('image/png') : '';

    const totalStudents  = document.getElementById('totalStudents')?.textContent.trim() || '0';
    const totalActive    = document.getElementById('totalActive')?.textContent.trim() || '0';
    const newStudents    = document.getElementById('newStudents')?.textContent.trim() || '0';
    const totalRegular   = document.getElementById('totalRegular')?.textContent.trim() || '0';
    const totalSuspended = document.getElementById('totalSuspended')?.textContent.trim() || '0';
    const withdrawn      = document.getElementById('withdrawnStudents')?.textContent.trim() || '0';

    let registrarName = 'أ. احمد محمد علي محمود';
    if (window.OfficialsHelper?.getOfficial) {
        const off = window.OfficialsHelper.getOfficial('general_registrar');
        if (off?.name) registrarName = (off.title ? off.title + ' ' : '') + off.name;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير مؤشرات ورسوم لوحة تحكم القبول والتسجيل</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    @page {
        size: A4 portrait;
        margin: 5mm 6mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body {
        font-family: 'Cairo', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11.5px;
        direction: rtl;
        background: #fff;
        color: #000;
        width: 100%;
        height: 100%;
    }
    
    .print-frame {
        border: 2px solid #0f172a;
        padding: 10px 14px;
        box-sizing: border-box;
        width: 100%;
        height: 284mm;
        max-height: 285mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: #fff;
    }

    /* 1. ترويسة الكلية الرسمية ثنائية اللغة */
    .print-header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        direction: rtl;
    }
    .print-header-ar {
        flex: 1;
        text-align: center;
        font-size: 10.5px;
        line-height: 1.35;
        color: #000;
    }
    .print-header-ar .gov-title { font-size: 12px; font-weight: 900; margin-bottom: 1px; }
    .print-header-ar .inst-title { font-size: 10px; font-weight: 800; margin-bottom: 1px; }
    .print-header-ar .clg-title { font-size: 11.5px; font-weight: 900; color: #000; }
    .print-header-ar .dept-title { font-size: 10px; font-weight: 800; color: #1e293b; }

    .print-header-logo-box {
        flex: 0 0 85px;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 8px;
    }
    .doc-logo {
        max-height: 64px;
        max-width: 64px;
        width: auto;
        object-fit: contain;
        display: block;
        margin: 0 auto;
    }

    .print-header-en {
        flex: 1;
        text-align: center;
        font-size: 9.5px;
        line-height: 1.25;
        color: #000;
        direction: ltr;
        font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
    }
    .print-header-en .gov-en { font-size: 10.5px; font-weight: bold; margin-bottom: 1px; }
    .print-header-en .inst-en { font-weight: 600; margin-bottom: 1px; }
    .print-header-en .clg-en { font-size: 10px; font-weight: bold; letter-spacing: 0.3px; }

    .print-header-line {
        border-top: 1.5px solid #000;
        margin: 3px 0 6px 0;
        width: 100%;
        display: block;
    }

    /* 2. عنوان التقرير وشريط الميتا */
    .doc-title {
        font-size: 14.5px;
        font-weight: 900;
        color: #000;
        text-align: center;
        margin: 2px 0 6px 0;
        letter-spacing: -0.2px;
    }

    .dept-meta-grid {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1.2px solid #000;
        background: #f8fafc;
        border-radius: 4px;
        padding: 4px 10px;
        margin-bottom: 8px;
        font-size: 11px;
        font-weight: 800;
    }

    /* 3. كروت الإحصائيات الخمسة */
    .metrics-summary-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
        margin-bottom: 8px;
    }
    .metric-card {
        border: 1.2px solid #000;
        padding: 5px 4px;
        text-align: center;
        background: #fff;
        border-radius: 4px;
    }
    .metric-lbl {
        font-size: 9.5px;
        font-weight: 800;
        color: #1e293b;
        margin-bottom: 2px;
        white-space: nowrap;
    }
    .metric-val {
        font-size: 15px;
        font-weight: 900;
        color: #000;
        font-family: monospace, 'Cairo';
        line-height: 1.1;
    }

    /* 4. حاوية الرسوم البيانية */
    .chart-container-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;
    }
    .chart-box {
        border: 1.2px solid #000;
        padding: 4px 6px 6px 6px;
        text-align: center;
        border-radius: 4px;
        background: #fff;
    }
    .chart-box-header {
        font-size: 11px;
        font-weight: 900;
        margin-bottom: 4px;
        border-bottom: 1px solid #000;
        padding-bottom: 2px;
        background: #f1f5f9;
        border-radius: 2px;
    }
    .chart-img-medium {
        max-width: 100%;
        height: 135px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
    }
    .chart-box-full {
        border: 1.2px solid #000;
        padding: 4px 6px 6px 6px;
        text-align: center;
        border-radius: 4px;
        background: #fff;
        margin-bottom: 8px;
    }
    .chart-img-wide {
        max-width: 100%;
        height: 125px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
    }

    /* 5. توقيعات الإدارة الرسمية */
    .sig-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 15px 0 15px;
        margin-top: auto;
        page-break-inside: avoid;
    }
    .sig-col {
        text-align: center;
        width: 220px;
    }
    .sig-name {
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 2px;
    }
    .sig-title {
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 14px;
        color: #334155;
    }
    .sig-line {
        font-size: 11px;
        font-weight: 800;
        color: #000;
    }

    @media print {
        @page { size: A4 portrait; margin: 5mm 6mm; }
        .print-frame { border: 2px solid #000 !important; }
    }
</style>
</head>
<body>
    <div class="print-frame">
        <div>
            <!-- 1. الترويسة الرسمية ثنائية اللغة المعتمدة -->
            <div class="print-header-section">
                <!-- اليمين: العربية -->
                <div class="print-header-ar">
                    <div class="gov-title">دولة ليبيا</div>
                    <div class="inst-title">حكومة الوحدة الوطنية</div>
                    <div class="inst-title">وزارة التعليم التقني والفني</div>
                    <div class="clg-title">كلية طرابلس للعلوم والتقنية</div>
                    <div class="dept-title">قسم القبول والتسجيل وشؤون الطلاب</div>
                </div>

                <!-- الوسط: الشعار الدائري -->
                <div class="print-header-logo-box">
                    <img class="doc-logo" src="${logoUrl}" alt="شعار الكلية" onerror="this.onerror=null; this.style.display='none';">
                </div>

                <!-- اليسار: الإنجليزية -->
                <div class="print-header-en">
                    <div class="gov-en">State of Libya</div>
                    <div class="inst-en">Government of National Unity</div>
                    <div class="inst-en">Ministry of Technical & Vocational Education</div>
                    <div class="clg-en">TRIPOLI COLLEGE OF SCIENCE & TECHNOLOGY</div>
                    <div class="inst-en" style="font-size: 9px; color: #334155;">Admission & Registration Dept.</div>
                </div>
            </div>

            <div class="print-header-line"></div>
            <div class="doc-title">تقرير المؤشرات والرسوم البيانية الإحصائية - لوحة تحكم القبول والتسجيل</div>

            <div class="dept-meta-grid">
                <div><span>الفصل الدراسي:</span> <strong>${escapeHtml(currentSemester)}</strong></div>
                <div><span>إجمالي طلاب الكلية:</span> <strong>${totalStudents} طالب</strong></div>
                <div><span>تاريخ واستخراج التقرير:</span> <strong>${dateStr} (${timeStr})</strong></div>
            </div>

            <!-- كروت الإحصائيات الخمسة -->
            <div class="metrics-summary-grid">
                <div class="metric-card">
                    <div class="metric-lbl">المسجلون بالفصل الحالي</div>
                    <div class="metric-val">${totalActive}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">الطلبة المستجدون</div>
                    <div class="metric-val">${newStudents}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">الطلاب المنتظمون</div>
                    <div class="metric-val">${totalRegular}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">موقوفو القيد</div>
                    <div class="metric-val">${totalSuspended}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-lbl">مسحوبو الملفات</div>
                    <div class="metric-val">${withdrawn}</div>
                </div>
            </div>

            <!-- صف الرسوم البيانية الأول (مخططان جنباً إلى جنب) -->
            <div class="chart-container-row">
                <div class="chart-box">
                    <div class="chart-box-header">توزيع الطلاب حسب الحالات الأكاديمية المعتمدة</div>
                    ${statusImg ? `<img src="${statusImg}" class="chart-img-medium" />` : '<p style="padding: 30px 0; color: #64748b;">لا تتوفر رسمة بيانية</p>'}
                </div>
                <div class="chart-box">
                    <div class="chart-box-header">توزيع الطلاب حسب الأقسام والتخصصات</div>
                    ${deptImg ? `<img src="${deptImg}" class="chart-img-medium" />` : '<p style="padding: 30px 0; color: #64748b;">لا تتوفر رسمة بيانية</p>'}
                </div>
            </div>

            <!-- صف الرسوم البيانية الثاني (المستويات والفصول الدراسية) -->
            ${semesterImg ? `
            <div class="chart-box-full">
                <div class="chart-box-header">توزيع وكثافة الطلاب حسب المستويات والفصول الدراسية</div>
                <img src="${semesterImg}" class="chart-img-wide" />
            </div>` : ''}
        </div>

        <!-- التوقيعات الإدارية المعتمدة -->
        <div class="sig-container">
            <div class="sig-col">
                <div class="sig-name">${escapeHtml(registrarName)}</div>
                <div class="sig-title">المسجل العام بالكلية</div>
                <div class="sig-line">التوقيع والختم: .......................................</div>
            </div>
            <div class="sig-col">
                <div class="sig-name">د. عميد الكلية</div>
                <div class="sig-title">إدارة كلية طرابلس للعلوم والتقنية</div>
                <div class="sig-line">التوقيع والختم: .......................................</div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
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

// 2. طباعة التقرير الإحصائي الرسمي المعياري A4 (إطار أسود 2px، ترويسة معتمدة، جداول وتوقيع انسيابي)
function printOfficialDataReport() {
    console.log('🖨️ printOfficialDataReport triggered');
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';
    const currentSemester = window.CURRENT_SEMESTER_NAME || document.querySelector('.header-banner-badge')?.textContent.trim() || 'الفصل الدراسي الحالي';
    const dateStr = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });

    // قراءة البيانات من منطقة التقرير الرسمي المكتوبة في index.html
    const reportArea = document.getElementById('official-report-print-area');
    let statusRowsHtml = '';
    let deptRowsHtml = '';

    if (reportArea) {
        const tables = reportArea.querySelectorAll('table');
        if (tables[0]) statusRowsHtml = tables[0].querySelector('tbody').innerHTML;
        if (tables[1]) deptRowsHtml = tables[1].querySelector('tbody').innerHTML;
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
<title>التقرير الإحصائي الرسمي - كلية طرابلس للعلوم والتقنية</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    @page {
        size: A4 portrait;
        margin: 5mm 6mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body {
        font-family: 'Cairo', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11.5px;
        direction: rtl;
        background: #fff;
        color: #000;
        width: 100%;
        height: 100%;
    }

    .print-frame {
        border: 2px solid #0f172a;
        padding: 10px 14px;
        box-sizing: border-box;
        width: 100%;
        min-height: 284mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: #fff;
    }

    /* 1. ترويسة الكلية الرسمية ثنائية اللغة */
    .print-header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        direction: rtl;
    }
    .print-header-ar {
        flex: 1;
        text-align: center;
        font-size: 10.5px;
        line-height: 1.35;
        color: #000;
    }
    .print-header-ar .gov-title { font-size: 12px; font-weight: 900; margin-bottom: 1px; }
    .print-header-ar .inst-title { font-size: 10px; font-weight: 800; margin-bottom: 1px; }
    .print-header-ar .clg-title { font-size: 11.5px; font-weight: 900; color: #000; }
    .print-header-ar .dept-title { font-size: 10px; font-weight: 800; color: #1e293b; }

    .print-header-logo-box {
        flex: 0 0 85px;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 8px;
    }
    .doc-logo {
        max-height: 64px;
        max-width: 64px;
        width: auto;
        object-fit: contain;
        display: block;
        margin: 0 auto;
    }

    .print-header-en {
        flex: 1;
        text-align: center;
        font-size: 9.5px;
        line-height: 1.25;
        color: #000;
        direction: ltr;
        font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
    }
    .print-header-en .gov-en { font-size: 10.5px; font-weight: bold; margin-bottom: 1px; }
    .print-header-en .inst-en { font-weight: 600; margin-bottom: 1px; }
    .print-header-en .clg-en { font-size: 10px; font-weight: bold; letter-spacing: 0.3px; }

    .print-header-line {
        border-top: 1.5px solid #000;
        margin: 3px 0 6px 0;
        width: 100%;
        display: block;
    }

    .doc-title {
        font-size: 14.5px;
        font-weight: 900;
        color: #000;
        text-align: center;
        margin: 2px 0 6px 0;
        letter-spacing: -0.2px;
    }

    .dept-meta-grid {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1.2px solid #000;
        background: #f8fafc;
        border-radius: 4px;
        padding: 4px 10px;
        margin-bottom: 10px;
        font-size: 11px;
        font-weight: 800;
    }

    .section-head {
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 6px;
        border-bottom: 1.5px solid #000;
        padding-bottom: 3px;
        color: #0f172a;
    }

    .rpt-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 14px;
    }
    .rpt-table th {
        background: #f1f5f9;
        color: #000;
        border: 1px solid #000;
        padding: 5px 6px;
        font-size: 11.5px;
        font-weight: 900;
    }
    .rpt-table td {
        border: 1px solid #000;
        padding: 5px 6px;
        font-size: 11px;
    }

    /* التوقيع والختم الرسمي */
    .sig-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 15px 0 15px;
        margin-top: auto;
        page-break-inside: avoid;
    }
    .sig-col {
        text-align: center;
        width: 220px;
    }
    .sig-name {
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 2px;
    }
    .sig-title {
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 14px;
        color: #334155;
    }
    .sig-line {
        font-size: 11px;
        font-weight: 800;
        color: #000;
    }

    @media print {
        @page { size: A4 portrait; margin: 5mm 6mm; }
        .print-frame { border: 2px solid #000 !important; }
    }
</style>
</head>
<body>
    <div class="print-frame">
        <div>
            <!-- 1. الترويسة الرسمية ثنائية اللغة المعتمدة -->
            <div class="print-header-section">
                <!-- اليمين: العربية -->
                <div class="print-header-ar">
                    <div class="gov-title">دولة ليبيا</div>
                    <div class="inst-title">حكومة الوحدة الوطنية</div>
                    <div class="inst-title">وزارة التعليم التقني والفني</div>
                    <div class="clg-title">كلية طرابلس للعلوم والتقنية</div>
                    <div class="dept-title">قسم القبول والتسجيل وشؤون الطلاب</div>
                </div>

                <!-- الوسط: الشعار الدائري -->
                <div class="print-header-logo-box">
                    <img class="doc-logo" src="${logoUrl}" alt="شعار الكلية" onerror="this.onerror=null; this.style.display='none';">
                </div>

                <!-- اليسار: الإنجليزية -->
                <div class="print-header-en">
                    <div class="gov-en">State of Libya</div>
                    <div class="inst-en">Government of National Unity</div>
                    <div class="inst-en">Ministry of Technical & Vocational Education</div>
                    <div class="clg-en">TRIPOLI COLLEGE OF SCIENCE & TECHNOLOGY</div>
                    <div class="inst-en" style="font-size: 9px; color: #334155;">Admission & Registration Dept.</div>
                </div>
            </div>

            <div class="print-header-line"></div>
            <div class="doc-title">التقرير الإحصائي الرسمي الشامل لمؤشرات القبول والتسجيل</div>

            <div class="dept-meta-grid">
                <div><span>الفصل الدراسي:</span> <strong>${escapeHtml(currentSemester)}</strong></div>
                <div><span>تاريخ واستخراج التقرير:</span> <strong>${dateStr} (${timeStr})</strong></div>
            </div>

            <div class="section-head">أولاً: إحصائيات الطلاب حسب الحالة الأكاديمية الرسمية</div>
            <table class="rpt-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th style="text-align: right; padding-right: 10px;">الحالة الأكاديمية</th>
                        <th style="width: 140px; text-align: center;">عدد الطلاب / الطالبات</th>
                        <th style="width: 140px; text-align: center;">النسبة المئوية (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${statusRowsHtml}
                </tbody>
            </table>

            <div class="section-head">ثانياً: التوزيع العددي حسب الأقسام والتخصصات الدراسية</div>
            <table class="rpt-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th style="text-align: right; padding-right: 10px;">القسم / التخصص</th>
                        <th style="width: 140px; text-align: center;">عدد المسجلين</th>
                        <th style="width: 140px; text-align: center;">النسبة المئوية (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${deptRowsHtml}
                </tbody>
            </table>
        </div>

        <!-- التوقيع والختم الرسمي -->
        <div class="sig-container">
            <div class="sig-col">
                <div class="sig-name">${escapeHtml(registrarName)}</div>
                <div class="sig-title">المسجل العام بالكلية</div>
                <div class="sig-line">التوقيع والختم: .......................................</div>
            </div>
            <div class="sig-col">
                <div class="sig-name">د. عميد الكلية</div>
                <div class="sig-title">إدارة كلية طرابلس للعلوم والتقنية</div>
                <div class="sig-line">التوقيع والختم: .......................................</div>
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

// تصدير الدوال بالنطاق العام
window.printDashboardVisual = printDashboardVisual;
window.printOfficialDataReport = printOfficialDataReport;