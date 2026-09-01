# apps/student/serializers.py

def serialize_student_profile(student):
    """تحويل بيانات ملف الطالب الشخصي إلى JSON بصلابة"""
    if not student:
        return None

    # جلب السجل الأكاديمي مباشرة من قاعدة البيانات لضمان البيانات المحدَّثة
    from apps.student.models import AcademicRecord
    try:
        academic_record = AcademicRecord.objects.get(student=student)
    except AcademicRecord.DoesNotExist:
        academic_record = None


    first_name = getattr(student, 'name', '') or ''
    father_name = getattr(student, 'father_name', '') or ''
    grand_father_name = getattr(student, 'grand_father_name', '') or getattr(student, 'grandfather_name', '') or ''
    family_name = getattr(student, 'family_name', '') or getattr(student, 'last_name', '') or ''

    parts = [p for p in [first_name, father_name, grand_father_name, family_name] if p]
    full_name_str = " ".join(parts) if parts else str(student)

    dept = getattr(student, 'department', None)
    lvl = getattr(student, 'level', None)
    grp = getattr(student, 'group', None)

    return {
        'id': student.id,
        'student_id': getattr(student, 'student_id', None) or f"STU{student.id:06d}",
        'full_name': full_name_str,
        'first_name': first_name,
        'father_name': father_name,
        'family_name': family_name,
        'national_id': getattr(student, 'national_id', '-') or '-',
        'passport_number': getattr(student, 'passport_number', '-') or '-',
        'phone': getattr(student, 'phone', None) or getattr(student, 'phone_number', None) or '-',
        'email': getattr(student, 'email', None) or (student.user.email if hasattr(student, 'user') and student.user else '-'),
        'department': {
            'id': dept.id if dept else None,
            'name': dept.name if dept else '-',
        },
        'level': {
            'id': lvl.id if lvl else None,
            'number': lvl.number if lvl else '-',
            'name': f"المستوى {lvl.number}" if lvl else '-',
        },
        'group': {
            'id': grp.id if grp else None,
            'name': grp.name if grp else '-',
        },
        'academic_status': getattr(getattr(student, 'student_status', None), 'name', 'نشط') or 'نشط',
        'gpa': round(academic_record.cumulative_gpa, 2) if (academic_record and academic_record.cumulative_gpa) else 0.0,
        'total_credits': academic_record.total_registered_credits if academic_record else 0,
        'completed_credits': academic_record.total_completed_credits if academic_record else 0,
        'passed_courses': academic_record.passed_courses_count if academic_record else 0,
        'failed_courses': academic_record.failed_courses_count if academic_record else 0,
    }


def serialize_course_registration(registration):
    """تحويل بيانات تسجيل مادة إلى JSON ببيانات تقييم دقيقة من قاعدة البيانات"""
    if not registration or not registration.course:
        return None
    
    c = registration.course
    sem = registration.semester
    dept = getattr(c, 'department', None)
    lvl = getattr(c, 'level', None)
    
    from apps.renewal.models import Grade
    from django.db.models import Q
    grade = Grade.objects.filter(
        student=registration.student,
        course=c,
        semester=sem
    ).filter(
        Q(is_published=True) | Q(is_midterm_published=True) | Q(is_final_published=True)
    ).exclude(is_blocked=True).first()

    is_passed = grade.is_passed if grade else False
    status_str = 'ناجح' if is_passed else ('راسب' if (grade and grade.total_grade is not None and not grade.is_passed) else 'جاري دراستها')

    return {
        'registration_id': registration.id,
        'course_id': c.id,
        'code': c.code,
        'name': c.name,
        'credits': c.credits,
        'department_name': dept.name if dept else '-',
        'level_number': lvl.number if lvl else '-',
        'grade': grade.total_grade if grade else None,
        'letter': grade.get_grade_letter() if grade else '--',
        'is_passed': is_passed,
        'status': status_str,
        'semester': {
            'id': sem.id if sem else None,
            'year': sem.year if sem else None,
            'type': sem.type if sem else None,
            'display': f"{sem.year} - {sem.get_type_display()}" if sem else '-',
        }
    }


def serialize_student_grade(grade):
    """تحويل بيانات درجة مادة إلى JSON مع معالجة الحجب والنشر بدقة"""
    if not grade or not grade.course:
        return None
    
    c = grade.course
    sem = grade.semester

    is_blocked = getattr(grade, 'is_blocked', False)
    reason_str = getattr(grade, 'block_reason', None) or "تجاوز نسبة الغياب الورقي"
    block_msg = f"⚠️ تم حجب نتيجة هذه المادة ({reason_str}) - يرجى مراجعة قسم الدراسة والامتحانات." if is_blocked else ""

    is_mid_pub = getattr(grade, 'is_published', False) or getattr(grade, 'is_midterm_published', False)
    is_final_pub = getattr(grade, 'is_published', False) or getattr(grade, 'is_final_published', False)
    is_pub = is_mid_pub or is_final_pub
    pub_msg = "لم يتم نشر نتائج هذه المادة بعد من قِبل إدارة الكنترول" if not is_pub else ""

    is_final_entered = getattr(grade, 'is_final_entered', False) or (grade.final_grade is not None and grade.final_grade > 0)

    midterm_val = grade.midterm_grade if (not is_blocked and is_mid_pub and grade.midterm_grade is not None) else None
    final_val = grade.final_grade if (not is_blocked and is_final_pub and is_final_entered) else None
    total_val = grade.total_grade if (not is_blocked and is_final_pub and is_final_entered) else None

    if is_blocked:
        status_text = "⚠️ محجوب"
    elif is_final_pub:
        status_text = "ناجح" if grade.is_passed else "راسب"
    elif is_mid_pub:
        status_text = "⏳ رصد نصفي"
    else:
        status_text = "🔒 غير منشور"

    lvl = getattr(c, 'level', None)
    is_hidden = is_blocked or not is_pub

    return {
        'grade_id': grade.id,
        'course_id': c.id,
        'course_code': c.code,
        'course_name': c.name,
        'credits': c.credits,
        'course_level': lvl.number if lvl else None,
        'course_level_display': f"المستوى {lvl.number}" if lvl else '-',
        'semester': {
            'id': sem.id if sem else None,
            'year': sem.year if sem else None,
            'type': sem.type if sem else None,
            'display': f"{sem.year} - {sem.get_type_display()}" if sem else '-',
        },
        'midterm_grade': midterm_val,
        'final_grade': final_val,
        'total_grade': total_val,
        'is_final_entered': is_final_entered,
        'is_passed': False if is_hidden else grade.is_passed,
        'grade_letter': '--' if is_hidden else (grade.get_grade_letter() if hasattr(grade, 'get_grade_letter') else status_text),
        'status': status_text,
        'is_blocked': is_blocked,
        'block_reason': reason_str if is_blocked else '',
        'block_message': block_msg,
        'is_published': is_pub,
        'publish_message': pub_msg,
    }
