function showProfileTab(tabName) {
    // 1. إخفاء محتوى كافة التبويبات
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // 2. إظهار التبويب المطلوب
    const activeTab = document.getElementById(tabName + 'Tab');
    if (activeTab) activeTab.classList.remove('hidden');
    
    // 3. إزالة كلاس النشاط من الأزرار
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab');
    });
    
    // 4. إضافة كلاس النشاط للزر الفعلي
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabName));
    if (btn) {
        btn.classList.add('active-tab');
    }
}

function saveProfile() {
    // دالة محاكاة لحفظ البيانات الشخصية
    alert('تم حفظ التغييرات بنجاح');
}

function changePassword() {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    
    if (!oldPass || !newPass || !confirmPass) {
        alert('يرجى ملء كافة الحقول المطلوبة');
        return;
    }
    if (newPass !== confirmPass) {
        alert('تأكيد كلمة المرور غير متطابق');
        return;
    }
    
    // دالة محاكاة لتغيير كلمة المرور
    alert('تم تغيير كلمة المرور بنجاح');
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}
