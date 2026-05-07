const API_BASE = '/api';

let currentUser = {};
let cancelBookingId = null;

window.addEventListener('DOMContentLoaded', () => {
  currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  if (!currentUser.dbStudentId) {
    window.location.href = '../index.html';
    return;
  }

  setupHeader();
  renderAssignedDepartment();
});

function setupHeader() {
  const initials = (currentUser.name || 'طالب')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  document.getElementById('navAvatar').textContent = initials || 'ط';
  document.getElementById('navName').textContent = currentUser.name || 'الطالب';

  document.getElementById('sidebarFacultyIcon').textContent = '🔬';
  document.getElementById('sidebarFacultyName').textContent = currentUser.facultyLabel || 'كلية العلوم';
  document.getElementById('sidebarStudentInfo').textContent = `${currentUser.departmentName || 'القسم'} · ${currentUser.studentId || ''}`;
  document.getElementById('sidebarFacultyBadge').textContent = 'علوم';

  document.getElementById('breadFaculty').textContent = currentUser.facultyLabel || 'كلية العلوم';
  document.getElementById('pageTitle').textContent = 'القسم المسجل للطالب';
}

function showView(view) {
  document.getElementById('deptView').style.display = view === 'dept' ? '' : 'none';
  document.getElementById('bookingsView').style.display = view === 'bookings' ? '' : 'none';
  document.getElementById('studentView').style.display = view === 'student' ? '' : 'none';

  document.getElementById('navDepts').classList.toggle('active', view === 'dept');
  document.getElementById('navBookings').classList.toggle('active', view === 'bookings');
  document.getElementById('navStudent').classList.toggle('active', view === 'student');

  if (view === 'dept') renderAssignedDepartment();
  if (view === 'bookings') renderBookings();
  if (view === 'student') renderStudentProfile();
}

function renderAssignedDepartment() {
  const box = document.getElementById('assignedDeptBox');

  if (!currentUser.departmentId || !currentUser.departmentName) {
    box.innerHTML = `
      <div class="assigned-empty-card">
        <div class="assigned-empty-icon">🏫</div>
        <div class="assigned-empty-title">القسم غير ظاهر حاليًا</div>
        <div class="assigned-empty-sub">راجع بيانات الطالب في قاعدة البيانات: department_id / department_name</div>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="assigned-dept-card" onclick="goToDept()">
      <div class="assigned-dept-icon">💻</div>
      <div class="assigned-dept-content">
        <div class="assigned-label">القسم المسجل من قاعدة البيانات</div>
        <div class="assigned-name">${currentUser.departmentName}</div>
        <div class="assigned-meta">${currentUser.facultyLabel || 'كلية العلوم'} · جاهز لعرض المواعيد المتاحة</div>
      </div>
      <button class="assigned-action">حجز موعد</button>
    </div>`;
}

function valueOrDash(value) {
  return value && String(value).trim() ? value : '-';
}

function renderStudentProfile() {
  const box = document.getElementById('studentProfileBox');
  const initials = (currentUser.name || 'طالب')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const rows = [
    ['الاسم', valueOrDash(currentUser.name)],
    ['رقم الطالب', valueOrDash(currentUser.studentId)],
    ['رقم التليفون', valueOrDash(currentUser.phone)],
    ['الرقم القومي', valueOrDash(currentUser.nid)],
    ['البريد الإلكتروني', valueOrDash(currentUser.email)],
    ['الكلية', valueOrDash(currentUser.facultyLabel)],
    ['القسم', valueOrDash(currentUser.departmentName)],
    ['الفرقة', valueOrDash(currentUser.level)]
  ];

  box.innerHTML = `
    <div class="student-profile-card">
      <div class="student-profile-head">
        <div class="student-profile-avatar">${initials || 'ط'}</div>
        <div>
          <div class="student-profile-name">${valueOrDash(currentUser.name)}</div>
          <div class="student-profile-sub">${valueOrDash(currentUser.facultyLabel)} · ${valueOrDash(currentUser.studentId)}</div>
        </div>
      </div>
      <div class="student-data-grid">
        ${rows.map(([label, value]) => `
          <div class="student-data-item">
            <div class="student-data-label">${label}</div>
            <div class="student-data-value ${label.includes('البريد') ? 'ltr-value' : ''}">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('ar-EG');
}

function formatTime(value) {
  if (!value) return '-';
  if (typeof value === 'string') {
    const match = value.match(/(\d{2}:\d{2})/);
    return match ? match[1] : value.slice(0, 5);
  }
  return String(value).slice(0, 5);
}

async function renderBookings() {
  const statsEl = document.getElementById('statsBar');
  const listEl = document.getElementById('bookingsList');

  statsEl.innerHTML = '';
  listEl.innerHTML = `<div class="bookings-empty"><div style="font-size:32px;margin-bottom:10px">⏳</div><div>جاري تحميل الحجوزات...</div></div>`;

  try {
    const response = await fetch(`${API_BASE}/students/${currentUser.dbStudentId}/bookings`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'تعذر تحميل الحجوزات');
    }

    const bookings = result.bookings || [];
    const activeBookings = bookings.filter(b => b.status === 'booked');

    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-num">${bookings.length}</div><div class="stat-label">إجمالي الحجوزات</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#22c55e">${activeBookings.length}</div><div class="stat-label">مواعيد مؤكدة</div></div>`;

    if (bookings.length === 0) {
      listEl.innerHTML = `<div class="bookings-empty"><div style="font-size:40px;margin-bottom:12px">📅</div><div style="font-size:15px;font-weight:600;color:#888">لا توجد حجوزات بعد</div><div style="font-size:13px;margin-top:6px">اضغط على قسمي وابدأ الحجز</div></div>`;
      return;
    }

    listEl.innerHTML = bookings.map(b => {
      const isBooked = b.status === 'booked';
      const time = `${formatDate(b.slot_date)} · ${formatTime(b.start_time)} - ${formatTime(b.end_time)}`;
      return `
        <div class="booking-item" id="booking-item-${b.booking_id}">
          <div class="booking-dot"></div>
          <div class="booking-info">
            <div class="booking-title">${b.professor_name || '-'}</div>
            <div class="booking-meta">${b.department_name_ar || currentUser.departmentName || '-'} · ${b.course_name || b.type_name || '-'} · ${time}</div>
          </div>
          <div class="booking-badge">${isBooked ? 'مؤكد' : 'ملغي'}</div>
          ${isBooked ? `<button class="cancel-btn" onclick="openCancelModal(${b.booking_id}, '${String(b.professor_name || '').replace(/'/g, '')}', '${formatTime(b.start_time)}')">إلغاء</button>` : ''}
        </div>`;
    }).join('');
  } catch (error) {
    listEl.innerHTML = `<div class="bookings-empty"><div style="font-size:36px;margin-bottom:12px">⚠️</div><div>${error.message}</div></div>`;
  }
}

function openCancelModal(bookingId, doctorName, slot) {
  cancelBookingId = bookingId;
  document.getElementById('cancelSubText').textContent = `هل تريد إلغاء موعدك مع ${doctorName || 'الدكتور'} الساعة ${slot || ''}؟`;
  document.getElementById('cancelOverlay').classList.add('open');
}

function closeCancelModal() {
  document.getElementById('cancelOverlay').classList.remove('open');
  cancelBookingId = null;
}

async function confirmCancel() {
  if (!cancelBookingId) return;

  try {
    const response = await fetch(`${API_BASE}/bookings/${cancelBookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: currentUser.dbStudentId })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'تعذر إلغاء الحجز');
    }

    closeCancelModal();
    renderBookings();
  } catch (error) {
    document.getElementById('cancelSubText').textContent = error.message;
  }
}

function goToDept() {
  localStorage.setItem('selectedDept', JSON.stringify({
    id: currentUser.departmentId,
    name: currentUser.departmentName,
    faculty: currentUser.facultyLabel || 'كلية العلوم'
  }));
  window.location.href = 'booking.html';
}

function logout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('selectedDept');
  window.location.href = '../index.html';
}
