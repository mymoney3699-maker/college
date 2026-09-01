# apps/faculty/urls.py
from django.urls import path
from . import views

app_name = 'faculty'

urlpatterns = [
    # ===== الروابط الموجودة =====
    path('grade-entry/', views.grade_entry, name='grade_entry'),
    path('attendance/', views.attendance_report, name='attendance'),
    path('group-reports/', views.group_reports, name='group_reports'),
    path('profile/', views.profile_page, name='profile'),
    path('sections/', views.sections, name='sections'),
    path('student-form-print/', views.student_form_print, name='student_form_print'),
    path('attendance-sheet/', views.attendance_sheet, name='attendance_sheet'),
    path('api/save-attendance/', views.save_attendance_api, name='save_attendance_api'),
    path('exam-attendance-form/', views.exam_attendance_form, name='exam_attendance_form'),
    
    # ===== روابط الأقسام =====
    path('department/general/', views.general_department, name='general_department'),
    path('department/programming/', views.programming_department, name='programming_department'),
    path('department/business/', views.business_department, name='business_department'),
    path('department/accounting/', views.accounting_department, name='accounting_department'),
    path('department/finance/', views.finance_department, name='finance_department'),
    path('department/arts/', views.arts_department, name='arts_department'),
    path('department/optics/', views.optics_department, name='optics_department'),
    path('department/fashion/', views.fashion_department, name='fashion_department'),
    path('department/<str:dept_name>/', views.department_view, name='department_view'),
    
    # ===== 🔥 روابط API الأساسية =====
    path('api/departments/', views.get_departments_api, name='get_departments_api'),
    path('api/department/<int:dept_id>/', views.get_department_data_api, name='get_department_data_api'),
    path('api/professor/save/', views.save_professor_api, name='save_professor_api'),
    path('api/professor/<str:prof_id>/toggle/', views.toggle_professor_api, name='toggle_professor_api'),
    path('api/courses/by-department/<int:dept_id>/', views.get_courses_by_department_api, name='get_courses_by_department_api'),
    path('api/levels/', views.get_levels_api, name='get_levels_api'),
    path('api/groups/', views.get_groups_api, name='get_groups_api'),
    
    # ===== 🔥🔥🔥 روابط API الجديدة لإدارة تكليفات الأساتذة والموظفين =====
    path('api/professor/<int:prof_id>/details/', views.get_professor_details_api, name='get_professor_details_api'),
    path('api/assignment/delete/', views.delete_assignment_api, name='delete_assignment_api'),
    path('api/assignment/add/', views.add_assignment_api, name='add_assignment_api'),
    path('api/staff/save/', views.save_staff_api, name='save_staff_api'),
    path('api/staff/<str:staff_id>/toggle/', views.toggle_staff_api, name='toggle_staff_api'),

    # ===== 🔥 لوحة تحكم مدير ومنسق الدراسة والامتحانات =====
    path('exam-director-dashboard/', views.exam_director_dashboard, name='exam_director_dashboard'),
    path('coordinator-dashboard/', views.coordinator_dashboard, name='coordinator_dashboard'),
    path('exam-director-dashboard/report/statistical/', views.dashboard_statistical_report, name='dashboard_statistical_report'),
    path('exam-director-dashboard/report/standard/', views.dashboard_standard_report, name='dashboard_standard_report'),
    path('api/coordinator/stats/', views.api_coordinator_stats, name='coordinator_stats_api'),
    path('api/coordinator/professors/', views.api_professors_directory, name='coordinator_professors_api'),
]