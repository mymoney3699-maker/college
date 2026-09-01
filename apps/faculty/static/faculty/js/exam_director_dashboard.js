// ============================================================
// 📊 لوحة مدير إدارة الدراسة والامتحانات - JS v2.1.0
// exam_director_dashboard.js — مطابق لتصميم coordinator_dashboard
// ============================================================

'use strict';
console.log('✅ exam_director_dashboard.js v2.1.0 loaded');

let allProfessors      = [];
let allDepartments     = [];
let passFailData       = {};
let passFailDoughnutChart = null;
let deptPassFailBarChart  = null;

// ============================================================
// 🔔 نظام الإشعارات العائمة
// ============================================================
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const icon  = document.getElementById('toastIcon');
    const msg   = document.getElementById('toastMessage');
    if (!toast || !icon || !msg) return;

    msg.innerText = message;

    const isDark = document.documentElement.classList.contains('dark');
    msg.style.color = isDark ? '#f8fafc' : '#1e293b';

    if (type === 'success') {
        toast.style.borderRightColor = '#10b981';
        icon.innerText = 'check_circle';
        icon.style.color = '#10b981';
    } else if (type === 'warning') {
        toast.style.borderRightColor = '#f59e0b';
        icon.innerText = 'warning';
        icon.style.color = '#f59e0b';
    } else {
        toast.style.borderRightColor = '#f43f5e';
        icon.innerText = 'error';
        icon.style.color = '#f43f5e';
    }

    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';

    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
    }, 4000);
}

window.showNotification = showNotification;
window.toastSuccess = (m) => showNotification('success', m);
window.toastError   = (m) => showNotification('error', m);

// ============================================================
// 🖨️ آلية الطباعة في الخلفية عبر Hidden Iframe بدون فتح صفحات جديدة
// ============================================================
function printViaHiddenIframe(htmlContent) {
    const oldIframe = document.getElementById('reportPrintHiddenIframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'reportPrintHiddenIframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    const triggerPrint = () => {
        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error("Print Error:", err);
            }
            setTimeout(() => {
                if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 3000);
        }, 350);
    };

    const images = doc.images;
    let loaded = 0;
    const total = images.length;

    if (total === 0) {
        triggerPrint();
    } else {
        for (let i = 0; i < total; i++) {
            if (images[i].complete) {
                loaded++;
                if (loaded === total) triggerPrint();
            } else {
                images[i].onload = images[i].onerror = () => {
                    loaded++;
                    if (loaded === total) triggerPrint();
                };
            }
        }
        setTimeout(triggerPrint, 1500);
    }
}

// دالة جلب توقيع المسؤولين من API
async function fetchExamDirectorOfficials() {
    let registrarName = "أ. المسجل العام";
    let registrarPos = "المسجل العام بالكلية";
    let directorName = "أ. مدير الدراسة والامتحانات";
    let directorPos = "مدير إدارة الدراسة والامتحانات";

    try {
        const res = await fetch('/users/api/officials/');
        const data = await res.json();
        if (data.success && Array.isArray(data.officials)) {
            const reg = data.officials.find(o => 
                (o.position_key && o.position_key.includes('registrar')) ||
                (o.position && (o.position.includes('مسجل عام') || o.position.includes('المسجل العام')))
            );
            if (reg && reg.name) {
                registrarName = reg.name;
                if (reg.position) registrarPos = reg.position;
            }

            const dir = data.officials.find(o => 
                (o.position_key && (o.position_key.includes('exam_director') || o.position_key.includes('exams_director'))) ||
                (o.position && (o.position.includes('مدير الدراسة') || o.position.includes('مدير ادارة الدراسة')))
            );
            if (dir && dir.name) {
                directorName = dir.name;
                if (dir.position) directorPos = dir.position;
            }
        }
    } catch (e) {
        console.warn("Could not fetch officials:", e);
    }
    return { registrarName, registrarPos, directorName, directorPos };
}

// 🖨️ 1. زر طباعة التقرير الإحصائي والرسومات البيانية
window.printStatisticalReport = async function() {
    const { registrarName, registrarPos, directorName, directorPos } = await fetchExamDirectorOfficials();

    // التقاط الرسوم البيانية كصور DataURL
    let doughnutImg = '';
    let barImg = '';
    const dCanvas = document.getElementById('passFailDoughnutChart');
    const bCanvas = document.getElementById('deptPassFailBarChart');
    if (dCanvas) {
        try { doughnutImg = dCanvas.toDataURL('image/png'); } catch (e) {}
    }
    if (bCanvas) {
        try { barImg = bCanvas.toDataURL('image/png'); } catch (e) {}
    }

    const passRate = (passFailData && passFailData.pass_rate !== undefined) ? passFailData.pass_rate : (document.getElementById('statPassRate')?.innerText || '0%');
    const passedCount = passFailData?.passed_count || 0;
    const failedCount = passFailData?.failed_count || 0;
    const totalEval = passFailData?.total_evaluated || (passedCount + failedCount);

    let deptRows = '';
    if (Array.isArray(allDepartments) && allDepartments.length > 0) {
        allDepartments.forEach((d, idx) => {
            deptRows += `
                <tr style="border-bottom: 1px solid #000; text-align: center;">
                    <td style="padding: 6px 10px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: bold;">${d.name || 'قسم أكاديمي'}</td>
                    <td style="padding: 6px 10px;">${d.passed_count || 0}</td>
                    <td style="padding: 6px 10px;">${d.failed_count || 0}</td>
                    <td style="padding: 6px 10px; font-weight: bold;">${d.pass_rate || 0}%</td>
                </tr>
            `;
        });
    }

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>التقرير الإحصائي والرسوم البيانية - إدارة الدراسة والامتحانات</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        @media print {
            body { margin: 0; padding: 0; background: #fff !important; color: #000 !important; }
        }
        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
            direction: rtl;
        }
        .print-sheet {
            border: 2px solid #000;
            padding: 22px 28px;
            box-sizing: border-box;
            background: #fff;
            width: 100%;
        }
        .header-box {
            text-align: center;
            margin-bottom: 12px;
        }
        .college-logo {
            width: 75px;
            height: 75px;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px auto;
        }
        .header-title-1 { font-size: 15px; font-weight: 800; margin: 2px 0; }
        .header-title-2 { font-size: 14px; font-weight: 800; margin: 2px 0; }
        .header-title-3 { font-size: 14px; font-weight: 800; margin: 2px 0; }
        .divider-line {
            border-bottom: 2px solid #000;
            margin: 10px 0 12px 0;
            width: 100%;
        }
        .report-main-title {
            font-size: 20px;
            font-weight: 900;
            text-align: center;
            margin: 8px 0 14px 0;
        }
        .kpi-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        .kpi-table th, .kpi-table td {
            border: 1px solid #000;
            padding: 7px 10px;
            text-align: center;
            font-size: 12px;
        }
        .kpi-table th {
            background: #f0f0f0;
            font-weight: 900;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 12px;
        }
        .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 6px 8px;
        }
        .data-table th {
            background: #f0f0f0;
            font-weight: bold;
        }
        .charts-container {
            display: flex;
            gap: 15px;
            margin-bottom: 16px;
            page-break-inside: avoid;
        }
        .chart-box {
            flex: 1;
            border: 1px solid #000;
            padding: 10px;
            text-align: center;
        }
        .chart-img {
            max-width: 100%;
            max-height: 220px;
            object-fit: contain;
        }
        .signatures-area {
            display: flex;
            justify-content: flex-end;
            gap: 50px;
            margin-top: 36px;
            page-break-inside: avoid;
        }
        .sig-card {
            text-align: center;
            min-width: 180px;
        }
    </style>
</head>
<body>
    <div class="print-sheet">
        <div class="header-box">
            <img src="/static/images/شعار الكلية.jpeg" alt="شعار الكلية" class="college-logo" onerror="this.style.display='none'">
            <div class="header-title-1">دولة ليبيا</div>
            <div class="header-title-2">وزارة التعليم التقني والفني</div>
            <div class="header-title-3">كلية طرابلس للعلوم والتقنية</div>
            <div class="divider-line"></div>
            <div class="report-main-title">التقرير الإحصائي والرسوم البيانية لإدارة الدراسة والامتحانات</div>
        </div>

        <table class="kpi-table">
            <thead>
                <tr>
                    <th>نسبة النجاح العامة</th>
                    <th>إجمالي الطلاب المقيمين</th>
                    <th>عدد الطلاب الناجحين</th>
                    <th>عدد الطلاب الراسبين</th>
                    <th>تاريخ التقرير</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="font-weight: bold; font-size: 14px;">${passRate}</td>
                    <td style="font-weight: bold; font-size: 14px;">${totalEval}</td>
                    <td style="font-weight: bold; font-size: 14px;">${passedCount}</td>
                    <td style="font-weight: bold; font-size: 14px;">${failedCount}</td>
                    <td>${new Date().toLocaleDateString('ar-LY')}</td>
                </tr>
            </tbody>
        </table>

        <div class="charts-container">
            ${doughnutImg ? `
            <div class="chart-box">
                <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px;">مؤشر نسب النجاح والرسوب العام</div>
                <img src="${doughnutImg}" class="chart-img">
            </div>` : ''}
            ${barImg ? `
            <div class="chart-box">
                <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px;">مقارنة أداء ونسب الأقسام العلمية</div>
                <img src="${barImg}" class="chart-img">
            </div>` : ''}
        </div>

        ${deptRows ? `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">جدول نسب النجاح والرسوب حسب التخصصات والأقسام:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th style="text-align: right;">القسم العلمي</th>
                    <th style="text-align: center; width: 100px;">عدد الناجحين</th>
                    <th style="text-align: center; width: 100px;">عدد الراسبين</th>
                    <th style="text-align: center; width: 100px;">نسبة النجاح</th>
                </tr>
            </thead>
            <tbody>
                ${deptRows}
            </tbody>
        </table>` : ''}

        <div class="signatures-area">
            <div class="sig-card">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">${directorName}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 28px;">${directorPos}</div>
                <div style="border-bottom: 1.5px solid #000; width: 140px; margin: 0 auto;"></div>
            </div>
            <div class="sig-card">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">${registrarName}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 28px;">${registrarPos}</div>
                <div style="border-bottom: 1.5px solid #000; width: 140px; margin: 0 auto;"></div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    printViaHiddenIframe(html);
};

// 🖨️ 2. زر طباعة التقرير العادي القياسي
window.printStandardReport = async function() {
    const { registrarName, registrarPos, directorName, directorPos } = await fetchExamDirectorOfficials();

    const passRate = (passFailData && passFailData.pass_rate !== undefined) ? passFailData.pass_rate : (document.getElementById('statPassRate')?.innerText || '0%');
    const passedCount = passFailData?.passed_count || 0;
    const failedCount = passFailData?.failed_count || 0;
    const totalEval = passFailData?.total_evaluated || (passedCount + failedCount);

    let deptRows = '';
    if (Array.isArray(allDepartments) && allDepartments.length > 0) {
        allDepartments.forEach((d, idx) => {
            deptRows += `
                <tr style="border-bottom: 1px solid #000; text-align: center;">
                    <td style="padding: 7px 10px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 7px 10px; text-align: right; font-weight: bold;">${d.name || 'قسم أكاديمي'}</td>
                    <td style="padding: 7px 10px;">${d.passed_count || 0} طالب</td>
                    <td style="padding: 7px 10px;">${d.failed_count || 0} طالب</td>
                    <td style="padding: 7px 10px; font-weight: bold;">${d.pass_rate || 0}%</td>
                    <td style="padding: 7px 10px;">معتمد</td>
                </tr>
            `;
        });
    }

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>التقرير العادي لإدارة الدراسة والامتحانات</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        @media print {
            body { margin: 0; padding: 0; background: #fff !important; color: #000 !important; }
        }
        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
            direction: rtl;
        }
        .print-sheet {
            border: 2px solid #000;
            padding: 22px 28px;
            box-sizing: border-box;
            background: #fff;
            width: 100%;
        }
        .header-box {
            text-align: center;
            margin-bottom: 12px;
        }
        .college-logo {
            width: 75px;
            height: 75px;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px auto;
        }
        .header-title-1 { font-size: 15px; font-weight: 800; margin: 2px 0; }
        .header-title-2 { font-size: 14px; font-weight: 800; margin: 2px 0; }
        .header-title-3 { font-size: 14px; font-weight: 800; margin: 2px 0; }
        .divider-line {
            border-bottom: 2px solid #000;
            margin: 10px 0 12px 0;
            width: 100%;
        }
        .report-main-title {
            font-size: 20px;
            font-weight: 900;
            text-align: center;
            margin: 8px 0 14px 0;
        }
        .kpi-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
        }
        .kpi-table th, .kpi-table td {
            border: 1px solid #000;
            padding: 8px 10px;
            text-align: center;
            font-size: 12px;
        }
        .kpi-table th {
            background: #f0f0f0;
            font-weight: 900;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
            font-size: 12px;
        }
        .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 7px 10px;
        }
        .data-table th {
            background: #f0f0f0;
            font-weight: bold;
        }
        .signatures-area {
            display: flex;
            justify-content: flex-end;
            gap: 50px;
            margin-top: 36px;
            page-break-inside: avoid;
        }
        .sig-card {
            text-align: center;
            min-width: 180px;
        }
    </style>
</head>
<body>
    <div class="print-sheet">
        <div class="header-box">
            <img src="/static/images/شعار الكلية.jpeg" alt="شعار الكلية" class="college-logo" onerror="this.style.display='none'">
            <div class="header-title-1">دولة ليبيا</div>
            <div class="header-title-2">وزارة التعليم التقني والفني</div>
            <div class="header-title-3">كلية طرابلس للعلوم والتقنية</div>
            <div class="divider-line"></div>
            <div class="report-main-title">تقرير الأداء الأكاديمي الشامل لإدارة الدراسة والامتحانات</div>
        </div>

        <table class="kpi-table">
            <thead>
                <tr>
                    <th>نسبة النجاح العامة</th>
                    <th>إجمالي الطلاب المقيمين</th>
                    <th>الناجحون</th>
                    <th>الراسبون</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="font-weight: bold; font-size: 14px;">${passRate}</td>
                    <td style="font-weight: bold; font-size: 14px;">${totalEval}</td>
                    <td style="font-weight: bold; font-size: 14px;">${passedCount}</td>
                    <td style="font-weight: bold; font-size: 14px;">${failedCount}</td>
                </tr>
            </tbody>
        </table>

        <div style="font-weight: 800; font-size: 13px; margin-bottom: 6px;">أولاً: جدول تفصيلي بنتائج الأقسام العلمية والتخصصات:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th style="text-align: right;">القسم العلمي</th>
                    <th style="width: 110px; text-align: center;">عدد الناجحين</th>
                    <th style="width: 110px; text-align: center;">عدد الراسبين</th>
                    <th style="width: 110px; text-align: center;">نسبة النجاح</th>
                    <th style="width: 100px; text-align: center;">حالة الاعتماد</th>
                </tr>
            </thead>
            <tbody>
                ${deptRows || '<tr><td colspan="6" style="text-align:center;">لا توجد بيانات للأقسام</td></tr>'}
            </tbody>
        </table>

        <div class="signatures-area">
            <div class="sig-card">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">${directorName}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 28px;">${directorPos}</div>
                <div style="border-bottom: 1.5px solid #000; width: 140px; margin: 0 auto;"></div>
            </div>
            <div class="sig-card">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">${registrarName}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 28px;">${registrarPos}</div>
                <div style="border-bottom: 1.5px solid #000; width: 140px; margin: 0 auto;"></div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    printViaHiddenIframe(html);
};

// ============================================================
// 🔧 أدوات مساعدة
// ============================================================
function normalizeArabic(str) {
    if (!str) return '';
    return str.replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
}

function isDark() {
    return document.documentElement.classList.contains('dark')
        || document.body.classList.contains('dark');
}

// ============================================================
// 📈 الرسوم البيانية
// ============================================================
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js not loaded yet');
        return;
    }

    const dark      = isDark();
    const textColor = dark ? '#94a3b8' : '#475569';
    const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';

    const passedCount = passFailData.passed_count  || 0;
    const failedCount = passFailData.failed_count  || 0;
    const totalCount  = passFailData.total_evaluated || (passedCount + failedCount);

    // 1. الدائري: نجاح / رسوب
    const ctxD = document.getElementById('passFailDoughnutChart');
    if (ctxD) {
        if (passFailDoughnutChart) { passFailDoughnutChart.destroy(); passFailDoughnutChart = null; }
        passFailDoughnutChart = new Chart(ctxD, {
            type: 'doughnut',
            data: {
                labels: ['الطلاب الناجحون', 'الطلاب الراسبون'],
                datasets: [{
                    data: [passedCount, failedCount],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 2.5,
                    borderColor: dark ? '#1e293b' : '#ffffff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { family: 'Segoe UI, sans-serif', size: 13, weight: '800' },
                            padding: 14,
                            usePointStyle: true,
                            boxWidth: 9
                        }
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label(ctx) {
                                const val = ctx.parsed;
                                const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: ${val} طالب (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. الشريطي: مقارنة الأقسام
    const ctxB = document.getElementById('deptPassFailBarChart');
    if (ctxB && allDepartments && allDepartments.length > 0) {
        if (deptPassFailBarChart) { deptPassFailBarChart.destroy(); deptPassFailBarChart = null; }

        const labels  = allDepartments.map(d => d.name);
        const passed  = allDepartments.map(d => d.passed_count || 0);
        const failed  = allDepartments.map(d => d.failed_count || 0);

        deptPassFailBarChart = new Chart(ctxB, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'عدد الناجحين',
                        data: passed,
                        backgroundColor: '#10b981dd',
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 28
                    },
                    {
                        label: 'عدد الراسبين',
                        data: failed,
                        backgroundColor: '#f43f5edd',
                        borderColor: '#f43f5e',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 28
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 800 },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { weight: '700', size: 11.5 } },
                        border: { display: false }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { weight: '600' }, stepSize: 2 },
                        border: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            font: { family: 'Segoe UI, sans-serif', size: 12, weight: '700' },
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label(ctx) {
                                return ` ${ctx.dataset.label}: ${ctx.parsed.y} طالب`;
                            }
                        }
                    }
                },
                onClick(event, elements) {
                    if (elements.length > 0) {
                        const d = allDepartments[elements[0].index];
                        if (d) window.filterByDepartment(d.id);
                    }
                }
            }
        });
    }
}

// ============================================================
// 👨‍🏫 تصفية وفلترة شبكة الأساتذة
// ============================================================
window.filterByDepartment = function(deptId) {
    const sel = document.getElementById('deptFilterSelect');
    if (sel) {
        sel.value = String(deptId);
        applyProfFilters();
    }
    const grid = document.getElementById('profsGridContainer');
    if (grid) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.resetProfFilters = function() {
    const searchEl = document.getElementById('profSearchInput');
    const deptEl   = document.getElementById('deptFilterSelect');
    if (searchEl) searchEl.value = '';
    if (deptEl)   deptEl.value   = '';
    applyProfFilters();
    showNotification('success', 'تم مسح الفلتر وعرض جميع الأساتذة');
};

function applyProfFilters() {
    const query  = normalizeArabic(document.getElementById('profSearchInput')?.value  || '');
    const deptId = document.getElementById('deptFilterSelect')?.value || '';

    const cards = document.querySelectorAll('#profsGridContainer .coord-prof-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const profDeptId = card.dataset.deptId || '';
        const profId     = card.dataset.profId  || '';

        // نص الكرت كله للبحث
        const cardText = normalizeArabic(card.innerText || '');

        let show = true;
        if (query  && !cardText.includes(query))                        show = false;
        if (deptId && profDeptId !== String(deptId))                   show = false;

        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    });

    const countEl   = document.getElementById('profsCountDisplay');
    const emptyEl   = document.getElementById('profsEmptyState');
    if (countEl)  countEl.textContent = visibleCount;
    if (emptyEl)  emptyEl.style.display = (visibleCount === 0) ? 'block' : 'none';
}

// ============================================================
// 🚀 تهيئة الصفحة
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // قراءة البيانات
    try {
        const profsEl    = document.getElementById('professorsDataJson');
        const deptsEl    = document.getElementById('departmentsStatsJson');
        const passFailEl = document.getElementById('passFailJson');
        if (profsEl)    allProfessors  = JSON.parse(profsEl.textContent);
        if (deptsEl)    allDepartments = JSON.parse(deptsEl.textContent);
        if (passFailEl) passFailData   = JSON.parse(passFailEl.textContent);
    } catch(e) {
        console.error('⚠️ Error parsing initial data:', e);
    }

    // رسم البيانات البيانية
    initCharts();

    // أحداث البحث والفلترة
    document.getElementById('profSearchInput')?.addEventListener('input',  applyProfFilters);
    document.getElementById('deptFilterSelect')?.addEventListener('change', applyProfFilters);

    // مراقبة الوضع الداكن لإعادة رسم الرسوم
    new MutationObserver(() => {
        initCharts();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
