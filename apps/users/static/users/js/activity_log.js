// ============================================
// سجل الأحداث - Activity Log
// ============================================

console.log('✅ activity_log.js loaded successfully');

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function filterTable() {
    const action = document.getElementById('filterAction').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const user = document.getElementById('filterUser').value.trim().toLowerCase();
    
    const tableBox = document.getElementById('logsTableBox');
    const rows = document.querySelectorAll('.log-row');
    const pagination = document.getElementById('logsPagination');
    
    // التحقق من وجود أي فلترة نشطة
    const isFiltering = (action !== '') || (dateFrom !== '') || (dateTo !== '') || (user !== '');
    
    if (isFiltering) {
        if (tableBox) tableBox.classList.remove('hidden');
        if (pagination) pagination.classList.add('hidden'); // إخفاء الترقيم أثناء الفلترة النشطة
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('page')) {
            if (tableBox) tableBox.classList.add('hidden');
        }
        if (pagination) pagination.classList.remove('hidden');
    }
    
    rows.forEach(row => {
        let matches = true;
        
        if (action && row.dataset.action !== action) {
            matches = false;
        }
        if (user && !row.dataset.user.includes(user)) {
            matches = false;
        }
        if (dateFrom && row.dataset.date < dateFrom) {
            matches = false;
        }
        if (dateTo && row.dataset.date > dateTo) {
            matches = false;
        }
        
        if (matches) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function resetFilters() {
    window.location.href = '/users/activity-log/';
}

function printLogs() {
    window.print();
}

// دالة لإظهار/إخفاء التفاصيل
function toggleDetails(btn, id) {
    const detailsDiv = document.getElementById(id);
    if (detailsDiv.classList.contains('hidden')) {
        detailsDiv.classList.remove('hidden');
        btn.innerText = '📋 إخفاء التفاصيل';
    } else {
        detailsDiv.classList.add('hidden');
        btn.innerText = '📋 عرض التفاصيل';
    }
}

// Bind to window for templates to access
window.filterTable = filterTable;
window.resetFilters = resetFilters;
window.printLogs = printLogs;
window.toggleDetails = toggleDetails;

// تفعيل الفلترة والبحث التلقائي عند تغيير الحقول
function initActivityLogAutoSearch() {
    const actionSelect = document.getElementById('filterAction');
    const dateFromInput = document.getElementById('filterDateFrom');
    const dateToInput = document.getElementById('filterDateTo');
    const userInput = document.getElementById('filterUser');
    const userSuggestions = document.getElementById('userSuggestions');
    
    let allUsers = [];
    
    // جلب قائمة المستخدمين للاقتراحات من الـ API المشترك
    fetch('/users/api/audit-log-suggestions/')
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            allUsers = data.users || [];
        }
    })
    .catch(e => console.error('Error fetching usernames:', e));
    
    const showSuggestions = (input, suggestionsDiv, list) => {
        if (!suggestionsDiv) return;
        const query = input.value.trim().toLowerCase();
        if (!query) {
            suggestionsDiv.classList.add('hidden');
            return;
        }
        
        const filtered = list.filter(item => item.toLowerCase().includes(query));
        
        if (filtered.length > 0) {
            suggestionsDiv.innerHTML = '';
            filtered.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = "p-2 border-b hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center search-result-item";
                itemDiv.style.fontSize = "0.85rem";
                
                const nameSpan = document.createElement('span');
                nameSpan.className = "font-bold text-slate-800 dark:text-white";
                nameSpan.textContent = item;
                
                const actionSpan = document.createElement('span');
                actionSpan.className = "text-primary text-xs font-bold";
                actionSpan.textContent = "اختيار ←";
                
                itemDiv.appendChild(nameSpan);
                itemDiv.appendChild(actionSpan);
                
                itemDiv.addEventListener('click', () => {
                    input.value = item;
                    suggestionsDiv.classList.add('hidden');
                    filterTable(); // تصفية تلقائية في المتصفح عند اختيار مستخدم
                });
                
                suggestionsDiv.appendChild(itemDiv);
            });
            suggestionsDiv.classList.remove('hidden');
        } else {
            suggestionsDiv.innerHTML = '<div class="p-2 text-center text-gray-500" style="font-size: 0.85rem;">لا توجد نتائج</div>';
            suggestionsDiv.classList.remove('hidden');
        }
    };
    
    if (userInput && userSuggestions) {
        userInput.addEventListener('input', () => {
            showSuggestions(userInput, userSuggestions, allUsers);
            filterTable(); // فلترة حية في المتصفح عند كتابة كل حرف
        });
        userInput.addEventListener('focus', () => {
            showSuggestions(userInput, userSuggestions, allUsers);
        });
    }
    
    if (actionSelect) {
        actionSelect.addEventListener('change', filterTable); // فلترة حية في المتصفح عند اختيار إجراء
    }
    if (dateFromInput) {
        dateFromInput.addEventListener('change', filterTable); // فلترة حية في المتصفح عند إدخال تاريخ البدء
    }
    if (dateToInput) {
        dateToInput.addEventListener('change', filterTable); // فلترة حية في المتصفح عند إدخال تاريخ الانتهاء
    }
    
    document.addEventListener('click', (e) => {
        if (userInput && !userInput.contains(e.target) && userSuggestions && !userSuggestions.contains(e.target)) {
            userSuggestions.classList.add('hidden');
        }
    });

    // تشغيل الفلترة المبدئية إذا كانت هناك قيم تم تعبئتها بواسطة Django
    filterTable();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initActivityLogAutoSearch);
} else {
    initActivityLogAutoSearch();
}
