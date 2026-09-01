/**
 * ============================================================
 * عرض النتائج - Show Results
 * show_results.js  v1.0.0
 * ============================================================
 */

console.log('✅ show_results.js loaded');

// ============================================================
// بيانات وهمية (تُستبدل بـ API لاحقاً)
// ============================================================
const resultsData = [
    { id: '20241001', subject: 'مقدمة في تكنولوجيا المعلومات', year: '2024', semester: 'الخريف', score: 92, gpa: 3.7 },
    { id: '20241001', subject: 'برمجة (1)', year: '2024', semester: 'الخريف', score: 88, gpa: 3.5 },
    { id: '20241002', subject: 'هياكل بيانات', year: '2024', semester: 'الربيع', score: 85, gpa: 3.4 },
    { id: '20241002', subject: 'رياضيات متقطعة', year: '2024', semester: 'الربيع', score: 78, gpa: 3.0 },
    { id: '20241003', subject: 'قواعد بيانات', year: '2025', semester: 'الخريف', score: 90, gpa: 3.6 },
    { id: '20241003', subject: 'شبكات', year: '2025', semester: 'الخريف', score: 82, gpa: 3.2 },
    { id: '20241004', subject: 'OOP', year: '2025', semester: 'الربيع', score: 87, gpa: 3.5 },
    { id: '20241004', subject: 'إدارة مشاريع', year: '2025', semester: 'الربيع', score: 79, gpa: 3.1 },
    { id: '20241005', subject: 'تحليل نظم', year: '2026', semester: 'الخريف', score: 93, gpa: 3.8 },
    { id: '20241005', subject: 'تطوير ويب', year: '2026', semester: 'الخريف', score: 86, gpa: 3.4 },
];

let currentPage = 1;
const itemsPerPage = 5;

// ============================================================
// دوال مساعدة
// ============================================================
function getUniqueMajors() {
    // محاكاة جلب التخصصات من الخادم
    return ['كل التخصصات', 'برمجة وتحليل نظم', 'شبكات واتصالات', 'نظم المعلومات', 'علوم الحاسوب'];
}

function getUniqueSeasons() {
    // محاكاة جلب المواسم من الخادم
    return ['اختر الموسم', 'ربيع 2024', 'خريف 2024', 'ربيع 2025', 'خريف 2025', 'ربيع 2026', 'خريف 2026'];
}

// ============================================================
// تهيئة القوائم المنسدلة
// ============================================================
function populateDropdowns() {
    const majorSelect = document.getElementById('majorSelect');
    const seasonSelect = document.getElementById('seasonSelect');

    if (majorSelect) {
        const majors = getUniqueMajors();
        majorSelect.innerHTML = majors.map(m => 
            `<option value="${m}">${m}</option>`
        ).join('');
    }

    if (seasonSelect) {
        const seasons = getUniqueSeasons();
        seasonSelect.innerHTML = seasons.map(s => 
            `<option value="${s}">${s}</option>`
        ).join('');
    }
}

// ============================================================
// عرض النتائج
// ============================================================
function renderResults(data) {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-message">لا توجد نتائج مطابقة للبحث</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(row => `
        <tr>
            <td>${row.id}</td>
            <td>${row.subject}</td>
            <td>${row.year}</td>
            <td>${row.semester}</td>
            <td>${row.score}</td>
            <td>${row.gpa.toFixed(2)}</td>
        </tr>
    `).join('');
}

// ============================================================
// البحث والتصفية
// ============================================================
function searchResults() {
    const major = document.getElementById('majorSelect')?.value || '';
    const season = document.getElementById('seasonSelect')?.value || '';
    const searchTerm = document.getElementById('searchInput')?.value?.trim() || '';

    let filtered = resultsData;

    // فلترة حسب التخصص (محاكاة)
    if (major && major !== 'كل التخصصات') {
        // في الواقع سيتم استخدام API للفلترة
        filtered = filtered.filter(row => row.id.startsWith('202410'));
    }

    // فلترة حسب الموسم
    if (season && season !== 'اختر الموسم') {
        const seasonParts = season.split(' ');
        if (seasonParts.length === 2) {
            const year = seasonParts[1];
            const semester = seasonParts[0];
            filtered = filtered.filter(row => 
                row.year === year && row.semester === semester
            );
        }
    }

    // فلترة حسب رقم القيد
    if (searchTerm) {
        filtered = filtered.filter(row => 
            row.id.includes(searchTerm) || 
            row.subject.includes(searchTerm)
        );
    }

    currentPage = 1;
    displayPage(filtered);
}

// ============================================================
// عرض صفحة محددة
// ============================================================
function displayPage(data) {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = data.slice(start, end);
    renderResults(pageData);
}

// ============================================================
// التنقل بين الصفحات
// ============================================================
function nextPage() {
    const totalItems = resultsData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        searchResults();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        searchResults();
    }
}

// ============================================================
// الرجوع إلى الصفحة السابقة
// ============================================================
function goBack() {
    window.history.back();
}

// ============================================================
// تهيئة الصفحة
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Show Results page ready');
    populateDropdowns();
    // عرض جميع النتائج عند التحميل
    searchResults();
});

// ============================================================
// تصدير الدوال للنافذة
// ============================================================
window.searchResults = searchResults;
window.nextPage = nextPage;
window.prevPage = prevPage;
window.goBack = goBack;
window.populateDropdowns = populateDropdowns;
window.renderResults = renderResults;