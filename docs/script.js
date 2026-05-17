const API_BASE = '/api';
const FIXED_FACULTY = 'علوم';
const FIXED_FACULTY_LABEL = 'كلية العلوم';

const FIELDS = {
  sid: { validate: v => /^\d{6,10}$/.test(v.trim()) },
  nid: { validate: v => /^\d{14}$/.test(v.trim()) }
};

const KEYS = Object.keys(FIELDS);

function el(id) {
  return document.getElementById(id);
}

KEYS.forEach(k => {
  const input = el(k);
  input.addEventListener('input', () => onInput(k));
  input.addEventListener('change', () => onInput(k));
  input.addEventListener('focus', () => el('f-' + k).classList.add('focused'));
  input.addEventListener('blur', () => {
    el('f-' + k).classList.remove('focused');
    if (el(k).value.length > 0) validateField(k, true);
  });
});

function onInput(k) {
  const val = el(k).value;
  const wrap = el('f-' + k);
  wrap.classList.remove('has-error');
  if (FIELDS[k].validate(val)) wrap.classList.add('is-valid');
  else wrap.classList.remove('is-valid');
  updateProgress();
  updateBtn();
}

function validateField(k, showError) {
  const val = el(k).value;
  const ok = FIELDS[k].validate(val);
  const wrap = el('f-' + k);
  wrap.classList.remove('is-valid', 'has-error');
  if (ok) wrap.classList.add('is-valid');
  else if (showError) wrap.classList.add('has-error');
  return ok;
}

function validCount() {
  return KEYS.filter(k => FIELDS[k].validate(el(k).value)).length;
}

function updateProgress() {
  const pct = Math.round((validCount() / KEYS.length) * 100);
  el('progressFill').style.width = pct + '%';
  el('progressPct').textContent = pct + '%';
}

function updateBtn() {
  const allValid = KEYS.every(k => FIELDS[k].validate(el(k).value));
  el('submitBtn').disabled = !allValid;
}

function setLoginError(message) {
  const old = document.getElementById('loginErrorBox');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'loginErrorBox';
  box.style.cssText = 'margin:12px 0;color:#e24b4a;background:#fff8f8;border:1px solid #ffd4d4;border-radius:10px;padding:10px 12px;font-size:12px;text-align:center;';
  box.textContent = message;
  el('submitBtn').before(box);
}

function mapStudentFromApi(student) {
  return {
    dbStudentId: student.student_id,
    name: student.full_name,
    studentId: student.student_number,
    phone: student.phone || '',
    email: student.email || '',
    nid: student.national_id,
    facultyId: student.faculty_id,
    faculty: FIXED_FACULTY,
    facultyLabel: student.faculty_name_ar || FIXED_FACULTY_LABEL,
    departmentId: student.department_id,
    departmentName: student.department_name_ar || '',
    level: student.academic_level || '',
    userKey: student.student_id || (student.student_number + '_' + student.national_id)
  };
}

async function handleSubmit() {
  let allOk = true;
  KEYS.forEach(k => {
    if (!validateField(k, true)) allOk = false;
  });
  if (!allOk) return;

  const btn = el('submitBtn');
  const btnText = btn.querySelector('.btn-text');
  const originalText = btnText.textContent;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_number: el('sid').value.trim(),
        national_id: el('nid').value.trim()
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'بيانات الدخول غير صحيحة');
    }

    const userData = mapStudentFromApi(result.student);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    showSuccess(userData);
  } catch (error) {
    setLoginError(error.message || 'تعذر الاتصال بالسيرفر');
    btn.classList.remove('loading');
    btn.disabled = false;
    btnText.textContent = originalText;
  }
}

function showSuccess(userData) {
  const data = {
    'الاسم': userData.name,
    'الكلية': userData.facultyLabel,
    'القسم': userData.departmentName,
    'رقم الطالب': userData.studentId,
    'الرقم القومي': userData.nid
  };

  el('successDetail').innerHTML = Object.entries(data)
    .map(([k, v]) => `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v || '-'}</span></div>`)
    .join('');

  el('formView').style.display = 'none';
  el('successView').classList.add('visible');
}

function goToBooking() {
  window.location.href = 'data/departments.html';
}

function resetForm() {
  KEYS.forEach(k => {
    el(k).value = '';
    el('f-' + k).classList.remove('is-valid', 'has-error', 'focused');
  });
  const loginError = document.getElementById('loginErrorBox');
  if (loginError) loginError.remove();
  updateProgress();
  updateBtn();
  el('submitBtn').classList.remove('loading');
  el('successView').classList.remove('visible');
  el('formView').style.display = '';
}

updateProgress();
updateBtn();
