# apps/renewal/urls.py
from django.urls import path
from . import views

app_name = 'renewal'

urlpatterns = [
  
    path('', views.dashboard, name='index'),  
    path('dashboard/', views.dashboard, name='dashboard'),
    path('api/dashboard/', views.dashboard, name='dashboard_api'),
    path('api/semester-stats/', views.semester_stats_api, name='semester_stats_api'),  
    path('notifications/', views.registrar_notifications, name='notifications'),
    path('api/notifications/mark-read/', views.mark_registrar_notifications_read, name='mark_notifications_read'),
    path('renewed-students/', views.renewed_students_list, name='renewed_students_list'),
    path('suspended-students/', views.suspended_students_list, name='suspended_students_list'),
    path('withdrawn-students/', views.withdrawn_students_list, name='withdrawn_students_list'),
    path('department-transfers/', views.department_transfers_list, name='department_transfers_list'),  
    
   
    path('departments/', views.department_list_view, name='department_list'),
    path('departments/<int:id>/edit/', views.department_update_view, name='department_update'),
    path('departments/<str:dept_code>/', views.department_detail_view, name='department_detail'),
    path('api/departments/<str:dept_code>/analytics/', views.department_analytics_api, name='department_analytics_api'),
    path('student-data/', views.student_data, name='student_data'),
    path('student-list/', views.student_list, name='student_list'),
    path('student-register/', views.student_register, name='student_register'),
    path('student-detail/<str:student_id>/', views.student_detail, name='student_detail'),
    path('edit-student/<int:student_id>/', views.edit_student, name='edit_student'),
    path('student-withdrawal/', views.student_withdrawal_view, name='student_withdrawal'),
    path('api/student-withdrawal/', views.process_student_withdrawal_api, name='api_student_withdrawal'),
    
  
    path('return-student/', views.return_student, name='return_student'),
    path('return-graduate/', views.return_graduate, name='return_graduate'),
    path('search-student/', views.search_student, name='search_student'),
    path('search-student-api/', views.search_student_api, name='search_student_api'),
    

    path('download-materials/', views.download_materials, name='download_materials'),
    path('my-materials-report/', views.my_materials_report, name='my_materials_report'),
    path('subject-data/', views.subject_data, name='subject_data'),
    path('special-download/', views.special_download, name='special_download'),
  
    path('renew-registration/', views.renew_registration, name='renew_registration'),
    path('special-renew/', views.special_renew_page, name='special_renew'),
    

    path('clearance/', views.clearance, name='clearance'),
    path('api/clearance-check/<int:student_id>/', views.clearance_check_api, name='clearance_check_api'),
    path('api/process-clearance/', views.process_clearance_api, name='process_clearance_api'),
    path('nationality-data/', views.nationality_data, name='nationality_data'),
    path('jobs/', views.jobs_page, name='jobs'),
    path('affiliated-students/', views.affiliated_students, name='affiliated_students'),
    path('groups/', views.groups_page, name='groups'),
    path('reports/', views.reports_page, name='reports'),
    

    path('student-grades/', views.student_grades, name='student_grades'),
    path('subject-grades/', views.subject_grades, name='subject_grades'),
    path('suggested-courses/', views.suggested_courses, name='suggested_courses'),
    path('equivalent-students/', views.equivalent_students, name='equivalent_students'),
    path('edit-semester/', views.edit_semester, name='edit_semester'),
    path('places-data/', views.places_data, name='places_data'),
    path('qualification-data/', views.qualification_data, name='qualification_data'),
    path('specialty-data/', views.specialty_data, name='specialty_data'),
    path('graduation-projects/', views.graduation_projects, name='graduation_projects'),
    path('students-tracking/', views.students_tracking, name='students_tracking'),
    path('graduation-certificate/', views.graduation_certificate, name='graduation_certificate'),
    path('api/get-graduation-certificate-data/', views.get_graduation_certificate_api, name='get_graduation_certificate_api'),
    path('api/issue-graduation-certificate/', views.issue_graduation_certificate_api, name='issue_graduation_certificate_api'),
    path('student-enrollment-certificate/', views.student_enrollment_certificate, name='student_enrollment_certificate'),
    path('api/search-enrollment-student/', views.search_enrollment_student_api, name='search_enrollment_student_api'),
    path('graduates-dashboard/', views.graduates_dashboard, name='graduates_dashboard'),
    path('api/graduates-stats/', views.api_graduates_stats, name='api_graduates_stats'),
    path('graduation-archive/', views.graduation_archive, name='graduation_archive'),
    path('api/get-graduation-archive-data/', views.get_graduation_archive_api, name='get_graduation_archive_api'),
    path('file-withdrawal-archive/', views.file_withdrawal_archive, name='file_withdrawal_archive'),
    path('api/get-file-withdrawal-archive-data/', views.get_file_withdrawal_archive_api, name='get_file_withdrawal_archive_api'),
    path('failed-students/', views.failed_students, name='failed_students'),
    path('students-by-gpa/', views.students_by_gpa, name='students_by_gpa'),
    path('export-students-gpa-excel/', views.export_students_gpa_excel, name='export_students_gpa_excel'),
    path('courses-report/', views.courses_report, name='courses_report'),
    path('excel-results/', views.excel_results, name='excel_results'),
    path('student-grades-by-course/', views.student_grades_by_course_page, name='student_grades_by_course'),

    path('renew-by-level/', views.renew_registration_by_level, name='renew_by_level'),
    path('api/get-students-by-level/', views.get_students_by_level_api, name='get_students_by_level'),
    path('api/get-students-by-dept-level/', views.get_students_by_department_and_level_api, name='get_students_by_dept_level'),
    path('api/get-student-detail/<int:student_id>/', views.get_student_detail_api, name='get_student_detail'),
    path('api/renew-student-special/', views.renew_student_special_api, name='renew_student_special'),
    path('api/search-student-renew/', views.search_student_for_renew_api, name='search_student_renew'),
    path('api/renew-single-student/', views.renew_single_student_api, name='renew_single_student'),
    path('api/search-student-by-name-id/', views.search_student_by_name_or_id_api, name='search_student_by_name_id'),
    path('api/renew-students/', views.renew_students_api, name='renew_students_api'),
    path('api/get-renewed-students/', views.get_renewed_students_api, name='get_renewed_students'),
    path('api/search-student-simple/', views.search_student_simple_api, name='search_student_simple'),
   
    path('api/search-student-suspend/', views.search_student_for_suspend_api, name='search_student_suspend'),
    path('api/search-student-special-renew/', views.search_student_for_special_renew_api, name='search_student_special_renew'),
    path('api/search-student-download/', views.search_student_for_download_api, name='search_student_download'),
    
 
    path('api/get-special-case-students/', views.get_special_case_students_api, name='get_special_case_students'),
    path('api/special-renew-student/', views.special_renew_student_api, name='special_renew_student'),
    path('api/get-students-for-download/', views.get_students_for_download_api, name='get_students_for_download'),
    
  
    path('semester-management/', views.semester_page, name='semester_management'),
    path('api/semesters/', views.get_semesters_api, name='get_semesters_api'),
    path('api/semesters/create/', views.create_semester_api, name='create_semester_api'),
    path('api/semesters/update/<int:semester_id>/', views.update_semester_api, name='update_semester_api'),
    path('api/semesters/delete/<int:semester_id>/', views.delete_semester_api, name='delete_semester_api'),
    path('api/semesters/set-active/<int:semester_id>/', views.set_active_semester_api, name='set_active_semester_api'),
    
    # ============================================
    # إدارة الجنسيات
    # ============================================
    path('api/nationalities/', views.get_nationalities_api, name='get_nationalities_api'),
    path('api/nationalities/create/', views.create_nationality_api, name='create_nationality_api'),
    path('api/nationalities/update/<int:nationality_id>/', views.update_nationality_api, name='update_nationality_api'),
    path('api/nationalities/delete/<int:nationality_id>/', views.delete_nationality_api, name='delete_nationality_api'),
    path('api/students-by-nationality/', views.search_students_by_nationality_api, name='students_by_nationality_api'),
    
    # ============================================
    # تنزيل المواد
    # ============================================
    path('api/courses/', views.get_courses_api, name='get_courses_api'),
    path('api/get-courses/', views.get_courses_api, name='get_courses_alt_api'),
    path('api/get-students-for-materials/', views.get_students_for_materials_api, name='get_students_for_materials'),
    path('api/department-courses/<int:department_id>/', views.get_department_courses_api, name='department_courses'),
    path('api/get-semester-courses/', views.get_semester_courses_api, name='get_semester_courses_api'),
    path('api/preview-materials/', views.preview_materials_api, name='preview_materials'),
    path('api/download-materials/', views.download_materials_for_students_api, name='download_materials_for_students'),
    path('api/student-courses/<int:student_id>/', views.get_student_courses_api, {'semester_id': 0}, name='get_student_courses_default'),
    path('api/student-courses/<int:student_id>/<int:semester_id>/', views.get_student_courses_api, name='get_student_courses'),
    path('api/download-special-materials/', views.download_special_materials_api, name='download_special_materials'),
    path('api/search-student-for-download/', views.search_student_for_download_api, name='search_student_for_download'),
    path('api/get-special-case-students/', views.get_special_case_students_api, name='get_special_case_students'),
    
    # ============================================
    # API للدرجات
    # ============================================
    path('api/course-grades/', views.course_grades_api, name='course_grades_api'),
    
    # ============================================
    # Admin lookup APIs
    # ============================================
    path('api/nationalities/', views.get_nationalities_api, name='get_nationalities'),
    path('api/nationalities/create/', views.create_nationality_api, name='create_nationality'),
    path('api/nationalities/update/<int:nationality_id>/', views.update_nationality_api, name='update_nationality'),
    path('api/nationalities/delete/<int:nationality_id>/', views.delete_nationality_api, name='delete_nationality'),
    path('api/nationalities/toggle-active/<int:nationality_id>/', views.toggle_nationality_active_api, name='toggle_nationality_active'),

    path('api/places/', views.get_places_api, name='get_places'),
    path('api/places/create/', views.create_place_api, name='create_place'),
    path('api/places/update/<int:place_id>/', views.update_place_api, name='update_place'),
    path('api/places/delete/<int:place_id>/', views.delete_place_api, name='delete_place'),
    path('api/places/toggle-active/<int:place_id>/', views.toggle_place_active_api, name='toggle_place_active'),
    
    path('api/qualifications/', views.get_qualifications_api, name='get_qualifications'),
    path('api/qualifications/create/', views.create_qualification_api, name='create_qualification'),
    path('api/qualifications/update/<int:qual_id>/', views.update_qualification_api, name='update_qualification'),
    path('api/qualifications/delete/<int:qual_id>/', views.delete_qualification_api, name='delete_qualification'),
    path('api/qualifications/toggle-active/<int:qual_id>/', views.toggle_qualification_active_api, name='toggle_qualification_active'),
    
    path('api/departments/', views.get_departments_api, name='get_departments'),
    path('api/get-department-levels/<int:dept_id>/', views.get_department_levels_api, name='get_department_levels'),
    path('api/departments/create/', views.create_department_api, name='create_department'),
    path('api/departments/update/<int:dept_id>/', views.update_department_api, name='update_department'),
    path('api/departments/delete/<int:dept_id>/', views.delete_department_api, name='delete_department'),
    path('api/departments/toggle-active/<int:dept_id>/', views.toggle_department_active_api, name='toggle_department_active'),
    
    # ============================================
    # APIs للمواد الدراسية
    # ============================================
    path('api/subjects/', views.get_subjects_api, name='get_subjects_api'),
    path('api/subjects/save/', views.save_subject_api, name='save_subject_api'),
    
    path('api/courses/', views.get_courses_api, name='get_courses'),
    path('api/courses/create/', views.create_course_api, name='create_course'),
    path('api/courses/update/<int:course_id>/', views.update_course_api, name='update_course'),
    path('filters-data/', views.filters_data_api, name='filters_data_api'),
    path('subject-data-api/', views.subject_data_api, name='subject_data_api'),
    
    # ============================================
    # المجموعات (Groups)
    # ============================================
    path('api/remove-student-group/', views.remove_student_from_group_api, name='remove_student_group_api'),
    path('api/group-students/', views.get_group_students_api, name='get_group_students_api'),
    path('api/save-groups/', views.save_groups_api, name='save_groups_api'),
    path('api/filtered-groups/', views.get_filtered_groups_api, name='get_filtered_groups'),
    path('api/group-details/<int:group_id>/', views.get_group_details_api, name='get_group_details'),
    path('api/update-group/<int:group_id>/', views.update_group_api, name='update_group'),
    path('jobs/', views.jobs_management_page, name='jobs_page'),
    path('api/jobs/', views.get_jobs_api, name='get_jobs_api'),
    path('api/jobs/create/', views.create_job_api, name='create_job_api'),
    path('api/jobs/update/<int:job_id>/', views.update_job_api, name='update_job_api'),
    path('api/jobs/delete/<int:job_id>/', views.delete_job_api, name='delete_job_api'),
    path('api/jobs/check-permission/', views.check_job_permission_api, name='check_job_permission_api'),
    
    # ============================================
    # تبديل المجموعات (Group Swap)
    # ============================================
    path('group-swap/', views.group_swap_page, name='group_swap'),
    path('api/student-detail/<int:student_id>/', views.student_detail_api, name='student_detail_api'),
    path('api/swap-groups/', views.swap_groups_api, name='swap_groups_api'),
    
    # ============================================
    # إدارة إيقاف القيد الفصلي
    # ============================================
    path('suspend-student/', views.suspend_student_page, name='suspend_student_page'),
    path('api/suspended-students-filtered/', views.get_suspended_students_filtered_api, name='suspended_students_filtered'),
    path('api/suspend-student/', views.suspend_student_api, name='suspend_student_api'),
    path('api/verify-suspension-print/<int:student_id>/', views.verify_suspension_print_api, name='verify_suspension_print_api'),
    path('api/activate-suspended-student/', views.activate_suspended_student_api, name='activate_suspended_student_api'),
    path('special-renew/', views.special_renew_page, name='special_renew'),
    path('api/search-student-special-renew/', views.search_student_for_special_renew_api, name='search_student_special_renew'),
    path('api/get-special-case-students/', views.get_special_case_students_api, name='get_special_case_students'),
    path('api/special-renew-student/', views.special_renew_student_api, name='special_renew_student'),
    path('api/search-student-download/', views.search_student_for_download_api, name='search_student_download'),
    path('api/get-students-for-download/', views.get_students_for_download_api, name='get_students_for_download'),
    path('api/plans-by-department/', views.get_plans_by_department_api, name='get_plans_by_department_api'),
    path('plans-display/', views.plans_display_view, name='plans_display'),

    path('plans-manage/', views.plans_manage_view, name='plans_manage'),
    path('plans/create/', views.plan_create_view, name='plan_create'),
    path('plans/<int:plan_id>/edit/', views.plan_edit_view, name='plan_edit'),
    path('plans/toggle-active/<int:plan_id>/', views.plan_toggle_active_view, name='plan_toggle_active'),
    path('plans/<int:plan_id>/add-course/', views.plan_add_course_view, name='plan_add_course'),
    path('api/plan-courses/<int:plan_id>/', views.get_plan_courses_api, name='get_plan_courses_api'),
    path('plans/<int:plan_id>/remove-course/<int:course_id>/', views.plan_remove_course_view, name='plan_remove_course'),
    path('graduation-certificate/', views.graduation_certificate, name='graduation_certificate'),
    path('student-tracking/', views.student_tracking, name='student_tracking'),
    path('non-libyan-students/', views.non_libyan_students_view, name='non_libyan_students'),
    path('api/non-libyan-students/', views.non_libyan_students_api, name='non_libyan_students_api'),
    path('api/export-non-libyan-students/', views.export_non_libyan_students, name='export_non_libyan_students'),
# ============================================================
# urls.py - ربط مسار صفحة النماذج والإجراءات الفارغة
# ============================================================
    # مسار صفحة النماذج والاستمارات الإدارية الفارغة
    path('blank-forms/', views.blank_forms_view, name='blank_forms'),
]
