/**
 * ============================================================
 * النتائج والتقديرات - Student Grades & Transcript
 * results_estimates.js  v3.1.0 (API Integrated + Accordion & Fixed Chart)
 * ============================================================
 */

console.log('✅ results_estimates.js v3.1.0 loaded with Accordion & Fixed Chart');

document.addEventListener('DOMContentLoaded', () => {
    initAcademicGpaChart();
    loadSemestersFilter();
    loadStudentGrades();
});

/**
 * دالة تهيئة الرسم البياني لتطور المعدل الأكاديمي مع إصلاح bug كلمة undefined
 */
function initAcademicGpaChart(semData = null, cgpaVal = null) {
    const canvas = document.getElementById('academicGpaChart');
    if (!canvas) return;

    const cgpaEl = document.getElementById('cgpaDisplay');
    const currentCgpa = cgpaVal || (cgpaEl ? parseFloat(cgpaEl.textContent.trim()) || 3.6 : 3.6);

    if (window.academicGpaChartInstance) {
        window.academicGpaChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    
    // إنشاء تدرج لوني خلفي باللون التايلي
    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(26, 93, 99, 0.25)');
    gradient.addColorStop(1, 'rgba(26, 93, 99, 0.0)');

    const labels = semData && semData.length > 0
        ? semData.map(s => s.label)
        : ['فصل 1', 'فصل 2', 'فصل 3', 'فصل 4', 'فصل 5', 'الفصل الحالي'];

    const dataPoints = semData && semData.length > 0
        ? semData.map(s => s.gpa)
        : [
            Math.max(2.0, (currentCgpa - 0.5).toFixed(2)),
            Math.max(2.2, (currentCgpa - 0.3).toFixed(2)),
            Math.max(2.5, (currentCgpa - 0.2).toFixed(2)),
            Math.max(2.8, (currentCgpa - 0.1).toFixed(2)),
            currentCgpa.toFixed(2),
            currentCgpa.toFixed(2)
        ];

    window.academicGpaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'المعدل التراكمي', // ✅ تم إصلاح مشكلة undefined المكتوبة أعلى الرسم
                data: dataPoints,
                borderColor: '#1A5D63',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#0F4C50',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { family: 'Cairo', size: 11, weight: 'bold' },
                        color: '#0F4C50'
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
                        font: { family: 'Cairo', size: 10 },
                        color: '#64748b'
                    },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    ticks: {
                        font: { family: 'Cairo', size: 10 },
                        color: '#64748b'
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * تحميل فلتر الفصول الدراسية من الـ API
 */
async function loadSemestersFilter() {
    const select = document.getElementById('semester-filter');
    if (!select) return;

    try {
        const res = await window.StudentAPI.getSemesters();
        if (res.success && res.semesters) {
            select.innerHTML = '<option value="">كل الفصول الدراسية</option>';
            res.semesters.forEach(sem => {
                const opt = document.createElement('option');
                opt.value = sem.id;
                opt.textContent = sem.display + (sem.is_active ? ' (الحالي)' : '');
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.warn('⚠️ لم يتم تحميل الفصول الدراسية:', err.message);
    }
}

/**
 * جلب كشف درجات الطالب والمعدل التراكمي من الـ API
 */
async function loadStudentGrades() {
    const container = document.getElementById('semesters-container');
    const semesterId = document.getElementById('semester-filter')?.value || '';

    try {
        // جلب الدرجات (مع فلتر الفصل إن وجد)
        const gradesRes = await window.StudentAPI.getGrades(semesterId || null);

        if (gradesRes.success && gradesRes.grades !== undefined) {
            updateStatsDisplay(gradesRes);
            renderLiveGrades(container, gradesRes.grades);
        }

        // جلب الملف الشخصي لتحديث المعدل التراكمي الكامل
        try {
            const profileRes = await window.StudentAPI.getProfile();
            if (profileRes.success && profileRes.profile) {
                const gpaEl = document.getElementById('cgpaDisplay');
                const creditsEl = document.getElementById('completedCreditsDisplay');
                const passedEl = document.getElementById('passedCoursesDisplay');
                
                const gpaVal = profileRes.profile.gpa || 0.0;
                if (gpaEl) gpaEl.textContent = gpaVal;
                if (creditsEl) creditsEl.textContent = profileRes.profile.completed_credits || 0;
                if (passedEl) passedEl.textContent = profileRes.profile.passed_courses || 0;

                // تحديث الرسم البياني
                initAcademicGpaChart(null, parseFloat(gpaVal));
            }
        } catch (profileErr) {
            console.warn('⚠️ لم يتم تحديث بيانات الملف الشخصي:', profileErr.message);
        }

    } catch (err) {
        console.error('❌ Error loading student grades:', err);
    }
}

/**
 * تحديث عداد الإحصائيات في الأعلى
 */
function updateStatsDisplay(gradesRes) {
    const totalEl = document.getElementById('totalGradesDisplay');
    if (totalEl) totalEl.textContent = gradesRes.count || 0;
}

/**
 * رندر درجات الطالب بالواجهة مع معالجة الحجب والأكورديون
 */
function renderLiveGrades(container, grades) {
    if (!container) return;

    container.style.width = '100%';
    container.style.boxSizing = 'border-box';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '1.25rem';

    if (!grades || grades.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card" style="width: 100%; box-sizing: border-box; text-align: center; padding: 3.5rem 1.5rem; background: white; border-radius: 16px; border: 1.5px dashed #cbd5e1; color: #64748b; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                <span style="font-size: 2.8rem; display: block; margin-bottom: 0.75rem;">📊</span>
                <h3 style="font-weight: 800; font-size: 1.2rem; color: #334155; margin: 0 0 0.4rem 0;">لا توجد درجات أو نتائج مسجلة حتى الآن</h3>
                <p style="font-size: 0.9rem; color: #64748b; margin: 0;">سيتم عرض الدرجات والتقديرات التفصيلية فور اعتمادها ونشرها من قبل الكلية.</p>
            </div>
        `;
        return;
    }

    // تجميع الدرجات حسب الفصل
    const grouped = {};
    grades.forEach(g => {
        const semKey = g.semester ? g.semester.display : 'الفصول الدراسية';
        if (!grouped[semKey]) grouped[semKey] = [];
        grouped[semKey].push(g);
    });

    const cgpaText = document.getElementById('cgpaDisplay')?.textContent || '0.00';

    let html = '';
    for (const [semTitle, gList] of Object.entries(grouped)) {
        let totalPoints = 0;
        let totalCredits = 0;
        let isFullyApproved = true;
        let hasBlocked = false;

        gList.forEach(g => {
            const isBlk = g.is_blocked || (g.block_reason && String(g.block_reason).trim().length > 0);
            const isPub = g.is_published || g.is_final_published;
            if (isBlk) {
                isFullyApproved = false;
                hasBlocked = true;
            } else if (!isPub) {
                isFullyApproved = false;
            }

            if (g.credits) {
                totalCredits += g.credits;
                if (isPub && !isBlk && g.total_grade !== null && g.total_grade !== undefined) {
                    totalPoints += g.total_grade * g.credits;
                }
            }
        });

        let gpaBadgeHtml = '';
        if (isFullyApproved && totalCredits > 0) {
            const semGpa = (totalPoints / totalCredits).toFixed(2);
            gpaBadgeHtml = `
                <span style="font-size: 0.85rem; background: rgba(255,255,255,0.2); padding: 0.35rem 0.85rem; border-radius: 20px; font-weight: 700; color: white;">
                    المعدل الفصلي: ${semGpa}
                </span>`;
        } else {
            const statusLabel = hasBlocked ? '⚠️ محجوب' : 'قيد الاعتماد';
            gpaBadgeHtml = `
                <span style="font-size: 0.85rem; background: rgba(254, 242, 242, 0.15); border: 1px solid rgba(254, 202, 202, 0.3); padding: 0.35rem 0.85rem; border-radius: 20px; font-weight: 700; color: #fed7aa;">
                    المعدل الفصلي: ${statusLabel}
                </span>`;
        }

        html += `
            <div class="semester-accordion-card" style="width: 100%; box-sizing: border-box; background: white; border-radius: 16px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.25s ease;">
                <!-- هيدر الأكورديون -->
                <div class="semester-accordion-header" onclick="toggleSemesterAccordion(this)" style="width: 100%; box-sizing: border-box; background: linear-gradient(135deg, #1A5D63 0%, #0F4C50 100%); color: white; padding: 1.25rem 1.75rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; transition: background 0.2s ease;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-symbols-outlined" style="font-size: 1.35rem; color: #e0f2fe;">calendar_month</span>
                        <span style="font-size: 1.15rem; font-weight: 800; color: white;">
                            📅 ${escapeHtml(semTitle)}
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${gpaBadgeHtml}
                        <span style="font-size: 0.85rem; background: rgba(255,255,255,0.2); padding: 0.35rem 0.85rem; border-radius: 20px; font-weight: 700; color: white;">
                            ${totalCredits} ساعات
                        </span>
                        <span class="accordion-arrow" style="color: white; font-size: 0.9rem; transition: transform 0.3s ease; display: inline-block;">▼</span>
                    </div>
                </div>

                <!-- محتوى الأكورديون -->
                <div class="semester-accordion-body" style="width: 100%; box-sizing: border-box; padding: 1.5rem; display: block;">
                    <div class="table-responsive" style="width: 100%; box-sizing: border-box; overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.92rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569;">
                                    <th style="padding: 0.85rem; font-weight: 800;">الكود</th>
                                    <th style="padding: 0.85rem; font-weight: 800;">اسم المادة</th>
                                    <th style="padding: 0.85rem; text-align: center; font-weight: 800;">الساعات</th>
                                    <th style="padding: 0.85rem; text-align: center; font-weight: 800;">المجموع / 100</th>
                                    <th style="padding: 0.85rem; text-align: center; font-weight: 800;">التقدير</th>
                                    <th style="padding: 0.85rem; text-align: center; font-weight: 800;">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        gList.forEach(g => {
            const isBlocked = !!g.is_blocked;
            const isFinalPub = !isBlocked && (g.is_published || (g.total_grade !== null && g.total_grade !== undefined));
            const isPassed = isFinalPub && !!g.is_passed;

            let statusBadge = '';
            let totalDisplay = '--';
            let letterDisplay = '--';
            let scoreColor = '#475569';

            if (isBlocked) {
                const reasonStr = escapeHtml(g.block_reason || 'تجاوز نسبة الغياب الورقي');
                statusBadge = `
                    <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 3px;">
                        <span style="padding: 0.35rem 0.85rem; border-radius: 20px; font-weight: 800; font-size: 0.8rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; display: inline-flex; align-items: center; gap: 4px;" title="${reasonStr}">⚠️ تم حجب النتيجة</span>
                        <span style="font-size: 0.75rem; color: #991b1b; font-weight: 700; background: #fff5f5; padding: 2px 8px; border-radius: 6px; border: 1px dashed #fca5a5;">${reasonStr}</span>
                    </div>
                `;
                scoreColor = '#dc2626';
            } else if (isFinalPub) {
                totalDisplay = g.total_grade !== null && g.total_grade !== undefined ? g.total_grade : '--';
                letterDisplay = g.grade_letter || '--';
                if (isPassed) {
                    statusBadge = `<span style="padding: 0.3rem 0.75rem; border-radius: 20px; font-weight: 800; font-size: 0.8rem; background: #dcfce7; color: #15803d; display: inline-flex; align-items: center; gap: 4px;">✔ ناجح</span>`;
                    scoreColor = '#16a34a';
                } else {
                    statusBadge = `<span style="padding: 0.3rem 0.75rem; border-radius: 20px; font-weight: 800; font-size: 0.8rem; background: #fee2e2; color: #b91c1c;">راسب</span>`;
                    scoreColor = '#dc2626';
                }
            } else {
                statusBadge = `<span style="padding: 0.3rem 0.75rem; border-radius: 20px; font-weight: 800; font-size: 0.8rem; background: #e0f2fe; color: #0284c7;">⏳ رصد نصفي</span>`;
            }

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='transparent';">
                    <td style="padding: 0.85rem; font-weight: 800; color: #1A5D63;">${escapeHtml(g.course_code)}</td>
                    <td style="padding: 0.85rem; font-weight: 700; color: #1e293b;">${escapeHtml(g.course_name)}</td>
                    <td style="padding: 0.85rem; text-align: center; font-weight: 600;">${g.credits}</td>
                    <td style="padding: 0.85rem; text-align: center; font-weight: 800; color: ${scoreColor};">${totalDisplay}</td>
                    <td style="padding: 0.85rem; text-align: center; font-weight: 700;">${escapeHtml(letterDisplay)}</td>
                    <td style="padding: 0.85rem; text-align: center;">${statusBadge}</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>

                    <!-- كارت الملخص السفلي -->
                    <div style="margin-top: 1.25rem; padding: 1rem 1.25rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                            <span style="font-size: 0.9rem; font-weight: 700; color: #334155;">
                                إجمالي ساعات الفصل: <strong style="color: #0F4C50;">${totalCredits}</strong>
                            </span>
                            <span style="font-size: 0.9rem; font-weight: 700; color: #334155;">
                                المعدل الفصلي: <strong style="color: #0284c7;">${semGpa}</strong>
                            </span>
                        </div>
                        <div>
                            <span style="font-size: 0.95rem; font-weight: 800; color: #1A5D63; background: #e0f2fe; padding: 0.4rem 1rem; border-radius: 8px;">
                                المعدل التراكمي العام: ${escapeHtml(cgpaText)}
                            </span>
                        </div>
                    </div>

                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderGradesError(container, errorMsg) {
    if (!container) return;
    container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; color: #991b1b;">
            <span style="font-size: 2.5rem;">⚠️</span>
            <p style="font-weight: 700; margin-top: 0.5rem;">${escapeHtml(errorMsg)}</p>
            <button onclick="loadStudentGrades()" style="margin-top: 1rem; background: #dc2626; color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 700; cursor: pointer;">
                إعادة المحاولة 🔄
            </button>
        </div>
    `;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.loadStudentGrades = loadStudentGrades;
window.initAcademicGpaChart = initAcademicGpaChart;