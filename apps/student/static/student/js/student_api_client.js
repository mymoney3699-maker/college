/**
 * ============================================================
 * Student API Client - عميل استدعاء الـ APIs لتطبيق الطالب
 * student_api_client.js v1.0.0
 * ============================================================
 */

class StudentAPIClient {
    constructor() {
        this.baseUrl = '/student/api';
    }

    /**
     * جلب هيدرز التوثيق (JWT Token + CSRF Token)
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        // 1. تمرير JWT Token إذا كان محفوظاً في localStorage أو sessionStorage
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // 2. تمرير Django CSRF Token للجلسات
        const csrfToken = this.getCookie('csrftoken');
        if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
        }

        return headers;
    }

    /**
     * قراءة الكوكيز للحصول على CSRF Token
     */
    getCookie(name) {
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

    /**
     * معالجة الأخطاء وحالات HTTP المختلفة (401, 404, 400, 500)
     */
    async handleResponse(response) {
        const contentType = response.headers.get('content-type');
        let data = {};
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { success: false, error: text || 'استجابة غير متوقعة من الخادم' };
        }

        if (!response.ok) {
            const errorObj = {
                status: response.status,
                message: data.error || data.message || `خطأ في الخادم (${response.status})`
            };

            if (response.status === 401) {
                console.warn('🔒 401 Unauthorized: يرجى إعادة تسجيل الدخول');
                if (typeof showToast === 'function') {
                    showToast('انتهت الجلسة، يرجى إعادة تسجيل الدخول', 'error');
                }
            } else if (response.status === 404) {
                console.warn('🔍 404 Not Found: البيانات المطلوبة غير موجودة');
                if (typeof showToast === 'function') {
                    showToast('البيانات المطلوبة غير موجودة', 'warning');
                }
            } else if (response.status === 400) {
                console.warn('⚠️ 400 Bad Request:', errorObj.message);
                if (typeof showToast === 'function') {
                    showToast(errorObj.message, 'error');
                }
            }

            throw errorObj;
        }

        return data;
    }

    /**
     * API: جلب ملف الطالب الشخصي
     */
    async getProfile(studentId = null) {
        let url = `${this.baseUrl}/profile/`;
        if (studentId) url += `?student_id=${encodeURIComponent(studentId)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return await this.handleResponse(response);
    }

    /**
     * API: جلب المقررات المسجلة للطالب
     */
    async getCourses(semesterId = null, studentId = null) {
        let url = `${this.baseUrl}/courses/`;
        const params = new URLSearchParams();
        if (semesterId) params.append('semester_id', semesterId);
        if (studentId) params.append('student_id', studentId);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return await this.handleResponse(response);
    }

    /**
     * API: جلب نتائج ودرجات الطالب
     */
    async getGrades(semesterId = null, courseId = null, studentId = null) {
        let url = `${this.baseUrl}/grades/`;
        const params = new URLSearchParams();
        if (semesterId) params.append('semester_id', semesterId);
        if (courseId) params.append('course_id', courseId);
        if (studentId) params.append('student_id', studentId);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return await this.handleResponse(response);
    }

    /**
     * API: جلب ملخص داشبورد الطالب الشامل
     */
    async getSummary(studentId = null) {
        let url = `${this.baseUrl}/summary/`;
        if (studentId) url += `?student_id=${encodeURIComponent(studentId)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return await this.handleResponse(response);
    }

    /**
     * API: تحديث ملف الطالب الشخصي
     */
    async updateProfile(profileData) {
        const url = `${this.baseUrl}/update-profile/`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(profileData)
        });
        return await this.handleResponse(response);
    }

    /**
     * API: تغيير كلمة المرور
     */
    async changePassword(passwordData) {
        const url = `${this.baseUrl}/change-password/`;
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(passwordData)
        });
        return await this.handleResponse(response);
    }

    /**
     * API: جلب قائمة الفصول الدراسية للطالب (لدعم الـ dropdown)
     */
    async getSemesters() {
        const url = `${this.baseUrl}/semesters/`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getAuthHeaders()
        });
        return await this.handleResponse(response);
    }
}

// تصدير الكائن للاستخدام المباشر في صفحات الواجهة
window.StudentAPI = new StudentAPIClient();
