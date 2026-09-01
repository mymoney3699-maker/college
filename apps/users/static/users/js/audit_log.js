// ============================================
// أرشيف التعديلات والحذف - Audit Log
// ============================================

console.log('✅ audit_log.js loaded successfully');

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

function filterLogs() {
    const action = document.getElementById('filterAction').value;
    const modelName = document.getElementById('filterModel').value;
    const user = document.getElementById('filterUser').value;
    
    let url = '/users/audit-log/filter/?';
    if (action) url += `action=${action}&`;
    if (modelName) url += `model_name=${modelName}&`;
    if (user) url += `user=${user}&`;
    
    window.location.href = url;
}

function resetFilters() {
    window.location.href = '/users/audit-log/';
}

function printLogs() {
    window.print();
}

// دالة لإظهار/إخفاء التفاصيل
function toggleDetails(btn, id) {
    const detailsDiv = document.getElementById(id);
    if (detailsDiv.classList.contains('hidden')) {
        detailsDiv.classList.remove('hidden');
        if (btn.innerText.includes('عرض')) {
            btn.innerText = btn.innerText.replace('عرض', 'إخفاء');
        }
    } else {
        detailsDiv.classList.add('hidden');
        if (btn.innerText.includes('إخفاء')) {
            btn.innerText = btn.innerText.replace('إخفاء', 'عرض');
        }
    }
}

// Bind to window for templates to access
window.filterLogs = filterLogs;
window.resetFilters = resetFilters;
window.printLogs = printLogs;
window.toggleDetails = toggleDetails;

// تفعيل اقتراحات البحث عند الكتابة في حقول الفلترة (الجدول والمستخدم)
function initAuditLogSuggestions() {
    const modelInput = document.getElementById('filterModel');
    const userInput = document.getElementById('filterUser');
    const modelSuggestions = document.getElementById('modelSuggestions');
    const userSuggestions = document.getElementById('userSuggestions');
    const actionSelect = document.getElementById('filterAction');
    
    let allUsers = [];
    let allModels = [];
    
    // جلب البيانات اللازمة للاقتراحات من الـ API
    fetch('/users/api/audit-log-suggestions/')
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            allUsers = data.users || [];
            allModels = data.models || [];
        }
    })
    .catch(e => console.error('Error fetching audit log suggestions:', e));
    
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
                    filterLogs(); // تصفية تلقائية عند اختيار اقتراح
                });
                
                suggestionsDiv.appendChild(itemDiv);
            });
            suggestionsDiv.classList.remove('hidden');
        } else {
            suggestionsDiv.innerHTML = '<div class="p-2 text-center text-gray-500" style="font-size: 0.85rem;">لا توجد نتائج</div>';
            suggestionsDiv.classList.remove('hidden');
        }
    };
    
    if (modelInput && modelSuggestions) {
        modelInput.addEventListener('input', () => {
            showSuggestions(modelInput, modelSuggestions, allModels);
        });
        modelInput.addEventListener('focus', () => {
            showSuggestions(modelInput, modelSuggestions, allModels);
        });
        modelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterLogs();
            }
        });
    }
    
    if (userInput && userSuggestions) {
        userInput.addEventListener('input', () => {
            showSuggestions(userInput, userSuggestions, allUsers);
        });
        userInput.addEventListener('focus', () => {
            showSuggestions(userInput, userSuggestions, allUsers);
        });
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterLogs();
            }
        });
    }

    if (actionSelect) {
        actionSelect.addEventListener('change', () => {
            filterLogs(); // تصفية تلقائية عند تغيير نوع الإجراء
        });
    }
    
    document.addEventListener('click', (e) => {
        if (modelInput && !modelInput.contains(e.target) && modelSuggestions && !modelSuggestions.contains(e.target)) {
            modelSuggestions.classList.add('hidden');
        }
        if (userInput && !userInput.contains(e.target) && userSuggestions && !userSuggestions.contains(e.target)) {
            userSuggestions.classList.add('hidden');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuditLogSuggestions);
} else {
    initAuditLogSuggestions();
}
