// ============================================================
// 📊 لوحة تحكم مدير إدارة ومنسقة الدراسة والامتحانات
// coordinator_dashboard.js v1.0.3 with Pass/Fail Analytics & Charts
// ============================================================

console.log('✅ coordinator_dashboard.js v1.0.3 with Pass/Fail Charts loaded');

let allProfessors = [];
let allDepartments = [];
let passFailAnalytics = {
    total_evaluated: 0,
    passed_count: 0,
    failed_count: 0,
    pass_rate: 0,
    fail_rate: 0,
    highest_success_dept: null,
    highest_failure_dept: null
};

let passFailDoughnutChart = null;
let deptPassFailBarChart = null;

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
async function fetchCoordinatorOfficials() {
    let registrarName = "أ. المسجل العام";
    let registrarPos = "المسجل العام بالكلية";
    let coordinatorName = "أ. منسق الدراسة والامتحانات";
    let coordinatorPos = "منسق الدراسة والامتحانات";

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

            const coord = data.officials.find(o => 
                (o.position_key && (o.position_key.includes('coordinator') || o.position_key.includes('exam_officer'))) ||
                (o.position && (o.position.includes('منسق') || o.position.includes('منسقة')))
            );
            if (coord && coord.name) {
                coordinatorName = coord.name;
                if (coord.position) coordinatorPos = coord.position;
            }
        }
    } catch (e) {
        console.warn("Could not fetch officials:", e);
    }
    return { registrarName, registrarPos, coordinatorName, coordinatorPos };
}

// 🖨️ 1. زر طباعة التقرير الإحصائي والرسومات البيانية
window.printStatisticalReport = async function() {
    const { registrarName, registrarPos, coordinatorName, coordinatorPos } = await fetchCoordinatorOfficials();

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

    const passRate = (passFailAnalytics && passFailAnalytics.pass_rate !== undefined) ? passFailAnalytics.pass_rate : (document.getElementById('statPassRate')?.innerText || '0%');
    const passedCount = passFailAnalytics?.passed_count || 0;
    const failedCount = passFailAnalytics?.failed_count || 0;
    const totalEval = passFailAnalytics?.total_evaluated || (passedCount + failedCount);

    let deptRows = '';
    if (Array.isArray(allDepartments) && allDepartments.length > 0) {
        allDepartments.forEach((d, idx) => {
            deptRows += `
                <tr style="border-bottom: 1px solid #000; text-align: center;">
                    <td style="padding: 6px 10px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: bold;">${d.name || 'تخصص أكاديمي'}</td>
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
    <title>التقرير الإحصائي والرسوم البيانية - منسق الدراسة والامتحانات</title>
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
            <div class="report-main-title">التقرير الإحصائي والرسوم البيانية لمنسق الدراسة والامتحانات</div>
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
                <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px;">مؤشر نسب النجاح والرسوب</div>
                <img src="${doughnutImg}" class="chart-img">
            </div>` : ''}
            ${barImg ? `
            <div class="chart-box">
                <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px;">مقارنة التخصصات والشُعب</div>
                <img src="${barImg}" class="chart-img">
            </div>` : ''}
        </div>

        ${deptRows ? `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">جدول نسب النجاح والرسوب حسب التخصصات:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th style="text-align: right;">التخصص / الشعبة</th>
                    <th style="text-align: center; width: 100px;">الناجحون</th>
                    <th style="text-align: center; width: 100px;">الراسبون</th>
                    <th style="text-align: center; width: 100px;">نسبة النجاح</th>
                </tr>
            </thead>
            <tbody>
                ${deptRows}
            </tbody>
        </table>` : ''}

        <div class="signatures-area">
            <div class="sig-card">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">${coordinatorName}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 28px;">${coordinatorPos}</div>
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
    const { registrarName, registrarPos, coordinatorName, coordinatorPos } = await fetchCoordinatorOfficials();

    const passRate = (passFailAnalytics && passFailAnalytics.pass_rate !== undefined) ? passFailAnalytics.pass_rate : (document.getElementById('statPassRate')?.innerText || '0%');
    const passedCount = passFailAnalytics?.passed_count || 0;
    const failedCount = passFailAnalytics?.failed_count || 0;
    const totalEval = passFailAnalytics?.total_evaluated || (passedCount + failedCount);

    let deptRows = '';
    if (Array.isArray(allDepartments) && allDepartments.length > 0) {
        allDepartments.forEach((d, idx) => {
            deptRows += `
                <tr style="border-bottom: 1px solid #000; text-align: center;">
                    <td style="padding: 7px 10px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 7px 10px; text-align: right; font-weight: bold;">${d.name || 'تخصص أكاديمي'}</td>
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
    <title>التقرير العادي لمنسق الدراسة والامتحانات</title>
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
            <div class="report-main-title">تقرير الأداء والمتابعة الأكاديمية لمنسق الدراسة والامتحانات</div>
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

        <div style="font-weight: 800; font-size: 13px; margin-bottom: 6px;">أولاً: جدول تفصيلي بنتائج الشعب والتخصصات:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th style="text-align: right;">الشعبة / التخصص</th>
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
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">${coordinatorName}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 28px;">${coordinatorPos}</div>
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

function normalizeArabic(str) {
    if (!str) return '';
    return str
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase()
        .trim();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// ============================================================
// 📈 تهيئة وإنشاء الرسوم البيانية التفاعلية للأقسام والمجموعات والأساتذة
// ============================================================
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js is not loaded yet');
        return;
    }

    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    // 1. الرسم الدائري: توزيع الطلاب حسب الأقسام الأكاديمية (Doughnut Chart)
    const ctxDoughnut = document.getElementById('passFailDoughnutChart');
    if (ctxDoughnut && allDepartments && allDepartments.length > 0) {
        if (passFailDoughnutChart) passFailDoughnutChart.destroy();

        const deptLabels = allDepartments.map(d => d.name);
        const deptCounts = allDepartments.map(d => d.count || 0);
        const totalDeptStudents = deptCounts.reduce((a, b) => a + b, 0);
        const palette = ['#307e92', '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

        passFailDoughnutChart = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: deptLabels,
                datasets: [{
                    data: deptCounts,
                    backgroundColor: palette.slice(0, deptLabels.length),
                    borderWidth: 2.5,
                    borderColor: isDark ? '#1e293b' : '#ffffff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { family: 'Segoe UI, sans-serif', size: 12, weight: '700' },
                            padding: 12,
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed;
                                const pct = totalDeptStudents > 0 ? Math.round((val / totalDeptStudents) * 100) : 0;
                                return ` ${context.label}: ${val} طالب (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. الرسم الشريطي: مقارنة أعداد الأساتذة والمجموعات حسب الأقسام (Grouped Bar Chart)
    const ctxBar = document.getElementById('deptPassFailBarChart');
    if (ctxBar && allDepartments && allDepartments.length > 0) {
        if (deptPassFailBarChart) deptPassFailBarChart.destroy();

        const labels = allDepartments.map(d => d.name);
        const profsData = allDepartments.map(d => d.prof_count || 0);
        const groupsData = allDepartments.map(d => d.group_count || 0);

        deptPassFailBarChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'عدد الأساتذة',
                        data: profsData,
                        backgroundColor: '#0284c7dd',
                        borderColor: '#0284c7',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 26
                    },
                    {
                        label: 'عدد المجموعات',
                        data: groupsData,
                        backgroundColor: '#10b981dd',
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        maxBarThickness: 26
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { weight: '700', size: 11.5 } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { weight: '600' }, stepSize: 1, beginAtZero: true }
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
                            label: function(context) {
                                return ` ${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const dept = allDepartments[index];
                        if (dept && dept.id) {
                            filterByDepartment(dept.id);
                        }
                    }
                }
            }
        });
    }
}

// ============================================================
// فلترة وعرض الأساتذة في الدليل
// ============================================================
function filterProfessors() {
    const searchInput = document.getElementById('profSearchInput');
    const deptSelect = document.getElementById('deptFilterSelect');
    const container = document.getElementById('profsGridContainer');
    const counter = document.getElementById('profsCountDisplay');

    if (!container) return;

    const query = normalizeArabic(searchInput ? searchInput.value : '');
    const selectedDeptId = deptSelect ? deptSelect.value : '';

    const filtered = allProfessors.filter(prof => {
        if (selectedDeptId && String(prof.department_id) !== String(selectedDeptId)) {
            return false;
        }

        if (!query) return true;

        const nameMatch = normalizeArabic(prof.full_name).includes(query);
        const idMatch = normalizeArabic(prof.professor_id).includes(query);
        const emailMatch = normalizeArabic(prof.email).includes(query);
        const deptMatch = normalizeArabic(prof.department_name).includes(query);

        const coursesMatch = (prof.courses_taught || []).some(c => 
            normalizeArabic(c.name).includes(query) || 
            normalizeArabic(c.code).includes(query)
        );

        return nameMatch || idMatch || emailMatch || deptMatch || coursesMatch;
    });

    if (counter) {
        counter.textContent = filtered.length;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--coord-text-muted); padding: 3rem 1rem; background: var(--coord-card-bg); border-radius: 14px; border: 1.5px dashed var(--coord-card-border);">
                <span class="material-symbols-outlined" style="font-size: 44px; color: #94a3b8; display: block; margin-bottom: 0.5rem;">search_off</span>
                <p style="font-size: 1.05rem; font-weight: 800; margin: 0 0 0.25rem 0;">لا توجد نتائج مطابقة للبحث</p>
                <p style="font-size: 0.85rem; margin: 0; color: var(--coord-text-muted);">يرجى التأكد من الكلمات المدخلة أو مسح الفلتر</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(prof => {
        const coursesHtml = (prof.courses_taught && prof.courses_taught.length > 0)
            ? prof.courses_taught.map(c => {
                const groupsText = (c.groups && c.groups.length > 0) ? `(${c.groups.join(', ')})` : '';
                return `
                    <div class="coord-course-tag" title="${escapeHtml(c.name)}">
                        <span class="coord-course-code">${escapeHtml(c.code)}</span>
                        <span>${escapeHtml(c.name)}</span>
                        ${groupsText ? `<span style="font-size: 0.72rem; color: var(--coord-text-muted);">${escapeHtml(groupsText)}</span>` : ''}
                    </div>
                `;
            }).join('')
            : `<div class="coord-empty-courses-alert"><span class="material-symbols-outlined" style="font-size: 15px; vertical-align: middle;">info</span> لا توجد مواد مسندة لهذا الأستاذ حالياً.</div>`;

        const phoneHtml = (prof.phone && prof.phone !== '—')
            ? `<div class="coord-contact-line"><span class="material-symbols-outlined">phone</span><span>${escapeHtml(prof.phone)}</span></div>`
            : '';

        return `
            <div class="coord-prof-card" data-prof-id="${prof.id}" data-dept-id="${prof.department_id || ''}">
                <div>
                    <div class="coord-prof-header">
                        <div class="coord-prof-avatar">
                            <span class="material-symbols-outlined">person</span>
                        </div>
                        <div class="coord-prof-meta">
                            <h3 class="coord-prof-name" title="${escapeHtml(prof.full_name)}">${escapeHtml(prof.full_name)}</h3>
                            <span class="coord-prof-dept-badge">${escapeHtml(prof.department_name)}</span>
                        </div>
                    </div>

                    <div class="coord-prof-contact-box">
                        <div class="coord-contact-line">
                            <span class="material-symbols-outlined">badge</span>
                            <span>الرقم الوظيفي: <strong>${escapeHtml(prof.professor_id)}</strong></span>
                        </div>
                        <div class="coord-contact-line">
                            <span class="material-symbols-outlined">mail</span>
                            <span>${escapeHtml(prof.email || 'لا يوجد بريد مسجل')}</span>
                        </div>
                        ${phoneHtml}
                    </div>
                </div>

                <div class="coord-courses-assigned-container">
                    <div class="coord-courses-title-row">
                        <span>المواد المسندة للتدريس:</span>
                        <span class="coord-courses-count-pill">${prof.courses_count || 0} مواد</span>
                    </div>
                    <div class="coord-courses-pill-grid">
                        ${coursesHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// تصفية سريعة بالنقر على القسم
// ============================================================
function filterByDepartment(deptId) {
    const deptSelect = document.getElementById('deptFilterSelect');
    if (deptSelect) {
        deptSelect.value = deptId;
        filterProfessors();
        
        const targetSection = document.getElementById('profsGridContainer');
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const selectedOpt = deptSelect.options[deptSelect.selectedIndex];
        const deptName = selectedOpt ? selectedOpt.text : 'القسم المحدد';
        showNotification('info', `🔍 تم تصفية الأساتذة حسب: ${deptName}`);
    }
}

// مسح الفلاتر
function resetProfFilters() {
    const searchInput = document.getElementById('profSearchInput');
    const deptSelect = document.getElementById('deptFilterSelect');

    if (searchInput) searchInput.value = '';
    if (deptSelect) deptSelect.value = '';

    filterProfessors();
    showNotification('info', '🔄 تم مسح كافة الفلاتر وعرض جميع الأساتذة');
}

// ============================================================
// تحديث البيانات الحية عبر API
// ============================================================
function refreshCoordinatorData() {
    showNotification('info', '⏳ جاري تحديث مؤشرات النجاح والرسوب ودليل الأساتذة...');

    Promise.all([
        fetch('/faculty/api/coordinator/stats/').then(r => r.json()),
        fetch('/faculty/api/coordinator/professors/').then(r => r.json())
    ])
    .then(([statsData, profsData]) => {
        if (statsData.success && statsData.stats) {
            const s = statsData.stats;
            
            // تحديث بطاقات المؤشرات الـ 4
            const elPassRate = document.getElementById('statPassRate');
            const elPassedCount = document.getElementById('statPassedCount');
            const elFailRate = document.getElementById('statFailRate');
            const elFailedCount = document.getElementById('statFailedCount');
            const elBestDeptName = document.getElementById('statBestDeptName');
            const elBestDeptRate = document.getElementById('statBestDeptRate');
            const elWorstDeptName = document.getElementById('statWorstDeptName');
            const elWorstDeptRate = document.getElementById('statWorstDeptRate');

            if (elPassRate) elPassRate.textContent = `${s.overall_pass_rate}%`;
            if (elPassedCount) elPassedCount.textContent = s.overall_passed;
            if (elFailRate) elFailRate.textContent = `${s.overall_fail_rate}%`;
            if (elFailedCount) elFailedCount.textContent = s.overall_failed;

            if (s.highest_success_dept) {
                if (elBestDeptName) elBestDeptName.textContent = s.highest_success_dept.name;
                if (elBestDeptRate) elBestDeptRate.textContent = `${s.highest_success_dept.pass_rate}%`;
            }
            if (s.highest_failure_dept) {
                if (elWorstDeptName) elWorstDeptName.textContent = s.highest_failure_dept.name;
                if (elWorstDeptRate) elWorstDeptRate.textContent = `${s.highest_failure_dept.fail_rate}%`;
            }

            passFailAnalytics = {
                total_evaluated: s.total_evaluated,
                passed_count: s.overall_passed,
                failed_count: s.overall_failed,
                pass_rate: s.overall_pass_rate,
                fail_rate: s.overall_fail_rate,
                highest_success_dept: s.highest_success_dept,
                highest_failure_dept: s.highest_failure_dept
            };

            if (s.departments) {
                allDepartments = s.departments;
            }

            initCharts();
        }

        if (profsData.success && profsData.professors) {
            allProfessors = profsData.professors;
            filterProfessors();
        }

        showNotification('success', '✅ تم تحديث مؤشرات إدارة الدراسة والامتحانات بنجاح');
    })
    .catch(err => {
        console.error('❌ Error refreshing coordinator data:', err);
        showNotification('error', '❌ تعذر تحديث البيانات من الخادم');
    });
}

// ============================================================
// التهيئة عند تحميل الصفحة
// ============================================================
function init() {
    try {
        const profsEl = document.getElementById('professorsDataJson');
        if (profsEl) {
            allProfessors = JSON.parse(profsEl.textContent || '[]');
        }

        const deptsEl = document.getElementById('departmentsStatsJson');
        if (deptsEl) {
            allDepartments = JSON.parse(deptsEl.textContent || '[]');
        }

        const pfEl = document.getElementById('passFailJson');
        if (pfEl) {
            passFailAnalytics = JSON.parse(pfEl.textContent || '{}');
        }
    } catch (e) {
        console.error('⚠️ JSON parsing error:', e);
    }

    const searchInput = document.getElementById('profSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterProfessors);
    }

    const deptSelect = document.getElementById('deptFilterSelect');
    if (deptSelect) {
        deptSelect.addEventListener('change', filterProfessors);
    }

    initCharts();

    // مراقبة التبديل بين الوضع الداكن والفاتح لتحديث ألوان الرسوم
    const observer = new MutationObserver(() => {
        initCharts();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

window.filterByDepartment = filterByDepartment;
window.resetProfFilters = resetProfFilters;
window.refreshCoordinatorData = refreshCoordinatorData;
window.filterProfessors = filterProfessors;
window.initCharts = initCharts;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
