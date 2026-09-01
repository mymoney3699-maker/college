/**
 * ============================================================
 * المقررات الدراسية - Student Courses & Study Plan
 * courses.js  v2.1.0 (API Integrated with Live Accordions & Chart)
 * ============================================================
 */

console.log('✅ courses.js v2.1.0 loaded with Accordion & Progress Chart');

document.addEventListener('DOMContentLoaded', () => {
    initGPAProgressChart();
    loadStudentCourses();
});

/**
 * دالة تهيئة رسم بياني لمؤشر التقدم الدراسي للطالب (GPA Progress Chart)
 */
function initGPAProgressChart(customLabels = null, customData = null) {
    const canvas = document.getElementById('liveProgressChart');
    if (!canvas) return;

    const gpaDisplay = document.getElementById('gpaValueDisplay');
    const currentGpa = gpaDisplay ? parseFloat(gpaDisplay.textContent.trim()) || 3.0 : 3.0;

    // تدمير الرسم السابقة إن وجدت
    if (window.gpaChartInstance) {
        window.gpaChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const titleColor = isDark ? '#38bdf8' : '#0F4C50';
    const borderColor = isDark ? '#38bdf8' : '#1A5D63';

    const ctx = canvas.getContext('2d');
    
    // إنشاء تدرج لوني للخلفية (Teal Gradient)
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    if (isDark) {
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    } else {
        gradient.addColorStop(0, 'rgba(26, 93, 99, 0.3)');
        gradient.addColorStop(1, 'rgba(26, 93, 99, 0.0)');
    }

    const labels = customLabels && customLabels.length > 0
        ? customLabels
        : ['فصل 1', 'فصل 2', 'الفصل الحالي'];

    const sampleData = customData && customData.length > 0
        ? customData
        : [currentGpa, currentGpa];

    window._lastGpaLabels = labels;
    window._lastGpaData = sampleData;

    window.gpaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'المعدل التراكمي (GPA)',
                data: sampleData,
                borderColor: borderColor,
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: borderColor,
                pointBorderColor: isDark ? '#0f172a' : '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { family: 'Cairo', size: 12, weight: 'bold' },
                        color: titleColor
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    titleFont: { family: 'Cairo' },
                    bodyFont: { family: 'Cairo' }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 4.0,
                    ticks: {
                        stepSize: 0.5,
                        font: { family: 'Cairo' },
                        color: textColor
                    },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: {
                        font: { family: 'Cairo' },
                        color: textColor
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// مراقبة تغيير الوضع الليلي لإعادة رسم المخطط بألوان متوافقة
if (typeof MutationObserver !== 'undefined') {
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (window.gpaChartInstance && window._lastGpaLabels) {
                    initGPAProgressChart(window._lastGpaLabels, window._lastGpaData);
                }
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });
}

/**
 * جلب واستعراض المقررات المسجلة للطالب من الخادم
 */
async function loadStudentCourses(semesterId = null) {
    const container = document.getElementById('semesters-container');
    if (!container) return;

    try {
        const res = await window.StudentAPI.getCourses(semesterId);
        if (res.success && res.courses && res.courses.length > 0) {
            renderLiveCourses(container, res.courses);
        }
    } catch (err) {
        console.log('ℹ️ Server side template already loaded or fallback used:', err);
    }
}

/**
 * رندر المقررات الدراسية المقروءة من الـ API بأسلوب الأكورديون
 */
function renderLiveCourses(container, courses) {
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: #64748b; background: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">
                <span style="font-size: 2.5rem;">📚</span>
                <p style="font-weight: 800; font-size: 1.1rem; color: #334155; margin-top: 0.5rem;">لا توجد مقررات دراسية مسجلة في هذا الفصل</p>
            </div>
        `;
        return;
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1rem';
    container.style.width = '100%';

    // تجميع المواد بحسب الفصل الدراسي
    const grouped = {};
    courses.forEach(c => {
        const semKey = c.semester ? c.semester.display : 'المقررات الدراسية للفصل الحالي';
        if (!grouped[semKey]) grouped[semKey] = [];
        grouped[semKey].push(c);
    });

    let html = '';
    for (const [semTitle, crsList] of Object.entries(grouped)) {
        html += `
            <div class="semester-accordion-card" style="width: 100%; box-sizing: border-box; background: white; border-radius: 16px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.03); transition: all 0.25s ease;">
                <!-- هيدر الأكورديون (مطابق تماماً لعرض وهيكل الهيدر الرئيسي) -->
                <div class="semester-accordion-header" onclick="toggleSemesterAccordion(this)" style="width: 100%; box-sizing: border-box; background: linear-gradient(135deg, #1A5D63 0%, #0F4C50 100%); color: white; padding: 1.25rem 1.75rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; transition: all 0.25s ease;" onmouseover="this.style.filter='brightness(1.05)';" onmouseout="this.style.filter='none';">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="background: rgba(255, 255, 255, 0.15); border-radius: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); flex-shrink: 0;">
                            <span class="material-symbols-outlined" style="font-size: 24px; color: white;">menu_book</span>
                        </div>
                        <div>
                            <span style="font-size: 1.15rem; font-weight: 800; color: white; display: block; line-height: 1.3;">
                                📖 ${escapeHtml(semTitle)}
                            </span>
                            <span style="font-size: 0.82rem; color: #e0f2fe; opacity: 0.9;">
                                المقررات المعتمدة للمستوى الدراسي
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 0.85rem; background: rgba(255,255,255,0.2); padding: 0.35rem 0.9rem; border-radius: 20px; font-weight: 700; color: white; backdrop-filter: blur(4px); white-space: nowrap;">
                            ${crsList.length} مواد
                        </span>
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <span class="material-symbols-outlined accordion-arrow" style="color: white; font-size: 22px; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: inline-block; transform: rotate(-90deg);">expand_more</span>
                        </div>
                    </div>
                </div>
                
                <!-- محتوى الأكورديون (مغلق افتراضياً) -->
                <div class="semester-accordion-body" style="width: 100%; box-sizing: border-box; padding: 1.5rem 1.75rem; display: none; transition: all 0.3s ease; background: #ffffff;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; width: 100%; box-sizing: border-box;">
        `;

        crsList.forEach(crs => {
            const isPassed = Boolean(crs.is_passed);
            const statusBadge = isPassed
                ? `<span style="color: #16a34a; font-weight: 800;">مكتمل (ناجح)</span>`
                : (crs.status === 'راسب' ? `<span style="color: #dc2626; font-weight: 800;">راسب</span>` : `<span style="color: #0284c7; font-weight: 800;">جاري دراستها</span>`);
            
            const iconBadge = isPassed
                ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background-color: #dcfce7; color: #16a34a; border-radius: 50%; font-weight: bold; font-size: 1rem; flex-shrink: 0;" title="تم الاجتياز بنجاح">✔</span>`
                : `<span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background-color: #f1f5f9; color: #64748b; border-radius: 50%; font-size: 0.95rem; flex-shrink: 0;" title="لم يتم اجتيازها أو تسجيلها بعد">🔒</span>`;

            html += `
                <div style="width: 100%; box-sizing: border-box; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;" onmouseover="this.style.borderColor='#1A5D63'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${iconBadge}
                        <div>
                            <div style="font-weight: 800; color: #1e293b; font-size: 1rem; line-height: 1.3;">${escapeHtml(crs.name)}</div>
                            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">
                                الكود: <span style="font-weight: 700; color: #475569;">${escapeHtml(crs.code)}</span> | القسم: <span style="color: #475569;">${escapeHtml(crs.department_name || '--')}</span>
                            </div>
                            <div style="font-size: 0.78rem; margin-top: 0.25rem;">
                                الحالة: ${statusBadge}
                            </div>
                        </div>
                    </div>

                    <div style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 0.85rem; padding: 0.4rem 0.8rem; border-radius: 8px; text-align: center; flex-shrink: 0;">
                        ${crs.credits} ساعات
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * دالة تبديل الأكورديون بنمط تفاعلي (فتح فصل محدد وإغلاق باقي الفصول)
 */
function toggleSemesterAccordion(headerElem) {
    const card = headerElem.closest('.semester-accordion-card');
    if (!card) return;
    const body = card.querySelector('.semester-accordion-body');
    const arrow = headerElem.querySelector('.accordion-arrow');
    const container = card.parentElement || document.getElementById('semesters-container');
    
    const isCurrentlyClosed = (body.style.display === 'none' || !body.style.display || getComputedStyle(body).display === 'none');

    // 1. إغلاق جميع الفصول الدراسية الأخرى لإبقاء العرض منظماً ومغلقاً عدا المختار
    if (container) {
        const allCards = container.querySelectorAll('.semester-accordion-card');
        allCards.forEach(otherCard => {
            if (otherCard !== card) {
                const otherBody = otherCard.querySelector('.semester-accordion-body');
                const otherArrow = otherCard.querySelector('.accordion-arrow');
                if (otherBody) {
                    otherBody.style.display = 'none';
                }
                if (otherArrow) {
                    otherArrow.style.transform = 'rotate(-90deg)';
                }
                otherCard.style.borderColor = '#cbd5e1';
                otherCard.style.boxShadow = '0 4px 10px rgba(0,0,0,0.03)';
            }
        });
    }

    // 2. تبديل حالة الفصل الدراسي المنقور
    if (isCurrentlyClosed) {
        body.style.display = 'block';
        if (arrow) {
            arrow.style.transform = 'rotate(0deg)';
        }
        card.style.borderColor = '#1A5D63';
        card.style.boxShadow = '0 8px 20px rgba(26,93,99,0.12)';
    } else {
        body.style.display = 'none';
        if (arrow) {
            arrow.style.transform = 'rotate(-90deg)';
        }
        card.style.borderColor = '#cbd5e1';
        card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.03)';
    }
}

/**
 * رندر حالة الخطأ بشكل سلس بالواجهة
 */
function renderErrorState(container, errorMsg) {
    container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; color: #991b1b;">
            <span style="font-size: 2.5rem;">⚠️</span>
            <p style="font-weight: 700; margin-top: 0.5rem;">${escapeHtml(errorMsg)}</p>
            <button onclick="loadStudentCourses()" style="margin-top: 1rem; background: #dc2626; color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 700; cursor: pointer;">
                إعادة المحاولة 🔄
            </button>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.loadStudentCourses = loadStudentCourses;
window.initGPAProgressChart = initGPAProgressChart;
window.toggleSemesterAccordion = toggleSemesterAccordion;