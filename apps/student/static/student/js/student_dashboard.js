/**
 * ============================================================
 * لوحة تحكم الطالب - Student Dashboard
 * student_dashboard.js  v2.0.0 (Database Integration)
 * ============================================================
 */

console.log('✅ student_dashboard.js v2.0.0 loaded with Database Integration');

// ============================================================
// إنشاء رسم بياني لمعدل الطالب الأكاديمي عبر الفصول (Line Chart)
// ============================================================
function initSemesterChart() {
    const canvas = document.getElementById('semesterTimelineChart');
    if (!canvas) return;

    // استخراج بيانات قاعدة البيانات المحقونة في window.dashboardData
    const dbData = window.dashboardData || {};
    const labels = (dbData.gpaLabels && dbData.gpaLabels.length > 0) ? dbData.gpaLabels : ['الفصل الحالي'];
    const values = (dbData.gpaData && dbData.gpaData.length > 0) ? dbData.gpaData.map(Number) : [0.00];

    const maxVal = Math.max(...values.filter(n => !isNaN(n)), 0);
    const isPercentage = maxVal > 4.0;
    const yMax = isPercentage ? 100 : 4.0;
    const yStep = isPercentage ? 20 : 1.0;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const borderColor = '#1A5D63';
    
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(26, 93, 99, 0.25)');
    gradient.addColorStop(1, 'rgba(26, 93, 99, 0.0)');

    if (window.semesterChartInstance) {
        window.semesterChartInstance.destroy();
    }

    window.semesterChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'المعدل التراكمي (cGPA)',
                data: values,
                borderColor: borderColor,
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointBackgroundColor: '#0F4C50',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f1f5f9' : '#1e293b',
                    bodyColor: isDark ? '#94a3b8' : '#475569',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            return `المعدل: ${val}${isPercentage ? '%' : ''}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    suggestedMax: yMax,
                    ticks: {
                        stepSize: yStep,
                        color: textColor,
                        font: { family: 'Cairo', weight: '600' },
                        callback: function(val) {
                            return isPercentage ? `${val}%` : val;
                        }
                    },
                    grid: { color: isDark ? '#334155' : '#f1f5f9' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textColor,
                        font: { family: 'Cairo', weight: '600' }
                    }
                }
            }
        }
    });
}

// ============================================================
// إنشاء رسم بياني للمواد بالخطة (Doughnut Chart)
// ============================================================
function initSubjectsChart() {
    const canvas = document.getElementById('subjectsCountChart');
    if (!canvas) return;

    const dbData = window.dashboardData || {};
    const completed = parseInt(dbData.completedCourses) || 0;
    const remaining = parseInt(dbData.remainingCourses) || 0;
    const total = completed + remaining;

    const isDark = document.documentElement.classList.contains('dark');
    const completedColor = '#1A5D63';
    const remainingColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#475569';

    const ctx = canvas.getContext('2d');

    if (window.subjectsChartInstance) {
        window.subjectsChartInstance.destroy();
    }

    const chartData = (total === 0) ? [0, 1] : [completed, remaining];
    const chartLabels = (total === 0) ? ['لا توجد خطة مسجلة'] : ['مكتملة (ناجح)', 'متبقية بالخطة'];
    const chartColors = (total === 0) ? ['#cbd5e1'] : [completedColor, remainingColor];

    window.subjectsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        padding: 10,
                        font: { family: 'Cairo', size: 11, weight: '700' },
                        color: textColor
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f1f5f9' : '#1e293b',
                    bodyColor: isDark ? '#94a3b8' : '#475569',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            if (total === 0) return 'لا توجد مقررات دراسية محددة بالخطة';
                            const val = context.parsed;
                            const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${val} مادة (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '68%'
        }
    });
}

// ============================================================
// دالة التحقق من حالة التخرج
// ============================================================
function checkGraduationStatus() {
    const studentStatus = "مستمر";
    if (studentStatus === "خريج") {
        alert("جاري تجهيز وتحميل إفادة التخرج الرقمية المعتمدة الخاصة بك...");
        // يمكن إعادة توجيه إلى صفحة إفادة التخرج
        // window.location.href = "{% url 'student:graduation_certificate' %}";
    } else {
        alert("عذراً، هذه الخدمة متاحة للطلاب الخريجين فقط. حالتك الأكاديمية الحالية بالمنظومة: [ مستمر ]");
    }
}

// ============================================================
// مراقبة تغيير الوضع الداكن لإعادة إنشاء الرسوم البيانية
// ============================================================
const darkModeObserver = new MutationObserver(function() {
    // إعادة إنشاء الرسوم البيانية عند تغيير الوضع الداكن
    const semesterCanvas = document.getElementById('semesterTimelineChart');
    const subjectsCanvas = document.getElementById('subjectsCountChart');
    
    if (semesterCanvas) {
        Chart.getChart('semesterTimelineChart')?.destroy();
        initSemesterChart();
    }
    if (subjectsCanvas) {
        Chart.getChart('subjectsCountChart')?.destroy();
        initSubjectsChart();
    }
});

darkModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// ============================================================
// تهيئة الصفحة
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Student Dashboard page ready');
    initSemesterChart();
    initSubjectsChart();
});

// ============================================================
// تصدير الدوال للنافذة
// ============================================================
window.checkGraduationStatus = checkGraduationStatus;
window.initSemesterChart = initSemesterChart;
window.initSubjectsChart = initSubjectsChart;