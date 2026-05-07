const API_BASE = '/api';

let currentUser = {};
let selectedDept = {};
let availableSlots = [];
let professorGroups = [];
let pendingDoc = null;
let selectedDuration = null;
let selectedPurpose = '';
let selectedSlot = null;

window.addEventListener('DOMContentLoaded', async () => {
  currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  selectedDept = JSON.parse(localStorage.getItem('selectedDept') || '{}');

  if (!currentUser.dbStudentId) {
    window.location.href = '../index.html';
    return;
  }

  setupHeader();
  await loadAvailableSlots();
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

  const deptName = selectedDept.name || currentUser.departmentName || 'القسم';
  const facultyName = currentUser.facultyLabel || 'كلية العلوم';

  document.getElementById('deptNameTitle').textContent = 'قسم ' + deptName;
  document.getElementById('deptFacultyLabel').textContent = facultyName;
  document.getElementById('deptTypePill').textContent = 'قسم الطالب';
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('ar-EG');
}

function formatDateShort(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(value) {
  if (!value) return '-';
  if (typeof value === 'string') {
    const match = value.match(/(\d{2}:\d{2})/);
    return match ? match[1] : value.slice(0, 5);
  }
  return String(value).slice(0, 5);
}

function getInitials(name) {
  return (name || 'دكتور')
    .replace(/د\.\s*|أ\.د\.\s*/g, '')
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('');
}

async function loadAvailableSlots() {
  const grid = document.getElementById('doctorsGrid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888">⏳ جاري تحميل المواعيد المتاحة من قاعدة البيانات...</div>`;

  try {
    const response = await fetch(`${API_BASE}/students/${currentUser.dbStudentId}/available-slots`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'تعذر تحميل المواعيد');
    }

    availableSlots = result.slots || [];
    professorGroups = groupSlotsByProfessor(availableSlots);
    document.getElementById('deptCountPill').textContent = professorGroups.length + ' دكاترة متاحون';
    renderDoctors(professorGroups);
  } catch (error) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#e24b4a">⚠️ ${error.message}</div>`;
  }
}

function groupSlotsByProfessor(slots) {
  const map = new Map();

  slots.forEach(slot => {
    if (!map.has(slot.professor_id)) {
      map.set(slot.professor_id, {
        id: slot.professor_id,
        name: slot.professor_name,
        subject: slot.course_name || slot.type_name || 'مواعيد أكاديمية',
        department: slot.department_name_ar,
        rating: 4.8,
        reviews: 100,
        color: '#378ADD',
        slots: []
      });
    }

    map.get(slot.professor_id).slots.push(slot);
  });

  return Array.from(map.values());
}

function renderDoctors(list) {
  const grid = document.getElementById('doctorsGrid');
  const priorities = ['priority-1', 'priority-2', 'priority-3'];
  const priorityLabels = ['أولوية عالية', 'أولوية متوسطة', 'أولوية عادية'];

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:44px;color:#888">
      <div style="font-size:42px;margin-bottom:12px">📅</div>
      <div style="font-weight:700;margin-bottom:6px">لا توجد مواعيد متاحة حاليًا</div>
      <div>أضف TimeSlots في قاعدة البيانات لدكاترة قسمك.</div>
    </div>`;
    return;
  }

  grid.innerHTML = '';

  list.forEach((doc, i) => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.style.animationDelay = (i * 0.07) + 's';

    const stars = '★'.repeat(Math.floor(doc.rating));
    const initials = getInitials(doc.name);
    const priIdx = Math.min(Math.floor(i / Math.ceil(list.length / 3)), 2);

    card.innerHTML = `
      <div class="doc-top">
        <div class="doc-av" style="background:${doc.color}">${initials}</div>
        <div style="flex:1">
          <div class="doc-name">${doc.name}</div>
          <div class="doc-sub">${doc.subject}</div>
          <div class="doc-stars">${stars} <span>${doc.rating} (${doc.reviews} تقييم)</span></div>
        </div>
      </div>
      <div class="availability-row">
        <div class="avail-dot" style="background:#22c55e"></div>
        <div class="avail-text">${doc.slots.length} موعد متاح</div>
        <span class="priority-badge ${priorities[priIdx]}">${priorityLabels[priIdx]}</span>
      </div>
      <div class="book-panel">
        <button class="book-btn" onclick="openBookModal(${doc.id})">
          احجز موعداً مع ${doc.name}
        </button>
      </div>`;

    grid.appendChild(card);
  });
}

function openBookModal(docId) {
  pendingDoc = professorGroups.find(d => d.id === docId);
  if (!pendingDoc) return;

  selectedDuration = null;
  selectedPurpose = '';
  selectedSlot = null;

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('confirmBtn').disabled = true;
  document.getElementById('slotsWrap').innerHTML = '<div class="slots-placeholder">اختر مدة لا تقل عن 30 دقيقة لتظهر المواعيد المتاحة</div>';

  const durations = [...new Set(
    pendingDoc.slots
      .map(s => Number(s.duration_minutes))
      .filter(mins => mins >= 30)
  )].sort((a, b) => a - b);

  const durationChips = document.getElementById('durationChips');

  if (!durations.length) {
    durationChips.innerHTML = '<div class="slots-placeholder">لا توجد مدد متاحة 30 دقيقة أو أكثر لهذا الدكتور</div>';
  } else {
    durationChips.innerHTML = durations.map(mins =>
      `<div class="chip" onclick="selectDuration(${mins}, this)">${mins} دقيقة</div>`
    ).join('');
  }

  document.getElementById('mAvatar').textContent = getInitials(pendingDoc.name);
  document.getElementById('mAvatar').style.background = pendingDoc.color;
  document.getElementById('mDocName').textContent = pendingDoc.name;
  document.getElementById('mDocSub').textContent = pendingDoc.subject;

  document.getElementById('bookModal').classList.add('open');
}

function selectDuration(mins, el) {
  const duration = Number(mins);

  if (duration < 30) {
    showToast('أقل مدة متاحة للحجز هي 30 دقيقة');
    return;
  }

  selectedDuration = duration;
  selectedSlot = null;

  document.querySelectorAll('#durationChips .chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  renderSlots(duration);
  checkConfirmReady();
}

function renderSlots(durationMins) {
  if (!pendingDoc) return;

  const slots = pendingDoc.slots.filter(s => Number(s.duration_minutes) === Number(durationMins));
  const wrap = document.getElementById('slotsWrap');

  if (!slots.length) {
    wrap.innerHTML = '<div class="slots-placeholder">لا توجد مواعيد متاحة بهذه المدة لهذا الدكتور</div>';
    return;
  }

  wrap.innerHTML = '<div class="slots-grid">' +
    slots.map(s => `
      <div class="slot-block" onclick="selectSlot(${s.slot_id}, this)">
        <div class="slot-time">${formatTime(s.start_time)}</div>
        <div class="slot-end">${formatDateShort(s.slot_date)} ← ${formatTime(s.end_time)}</div>
      </div>
    `).join('') +
    '</div>';
}

function selectPurpose(p, el) {
  selectedPurpose = p;
  document.querySelectorAll('#purposeChips .chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  checkConfirmReady();
}

function selectSlot(slotId, el) {
  selectedSlot = pendingDoc.slots.find(s => Number(s.slot_id) === Number(slotId));
  document.querySelectorAll('.slot-block:not(.booked)').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  checkConfirmReady();
}

function checkConfirmReady() {
  document.getElementById('confirmBtn').disabled = !(selectedDuration && selectedPurpose && selectedSlot);
}

async function confirmBooking() {
  if (!pendingDoc || !selectedSlot) return;

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'جاري الحجز...';

  try {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentUser.dbStudentId,
        slot_id: selectedSlot.slot_id
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'تعذر إتمام الحجز');
    }

    closeModal();

    document.getElementById('successSubText').textContent = `تم تأكيد موعدك مع ${pendingDoc.name} — احرص على الحضور في الوقت المحدد.`;
    document.getElementById('successInfo').innerHTML = `
      <div class="info-row"><span class="info-key">الدكتور</span><span class="info-val">${pendingDoc.name}</span></div>
      <div class="info-row"><span class="info-key">الغرض</span><span class="info-val">${selectedPurpose}</span></div>
      <div class="info-row"><span class="info-key">التاريخ</span><span class="info-val">${formatDate(selectedSlot.slot_date)}</span></div>
      <div class="info-row"><span class="info-key">من الساعة</span><span class="info-val">${formatTime(selectedSlot.start_time)}</span></div>
      <div class="info-row"><span class="info-key">حتى الساعة</span><span class="info-val">${formatTime(selectedSlot.end_time)}</span></div>
      <div class="info-row"><span class="info-key">نوع الموعد</span><span class="info-val">${selectedSlot.type_name || '-'}</span></div>
      <div class="info-row"><span class="info-key">الطالب</span><span class="info-val">${currentUser.name || 'الطالب'}</span></div>`;

    document.getElementById('successModal').classList.add('open');
    showToast('تم الحجز مع ' + pendingDoc.name);

    await loadAvailableSlots();
  } catch (error) {
    showToast(error.message);
  } finally {
    btn.textContent = 'تأكيد الحجز';
    checkConfirmReady();
  }
}

function closeModal() {
  document.getElementById('bookModal').classList.remove('open');
}

function closeSuccess() {
  document.getElementById('successModal').classList.remove('open');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function goBack() {
  window.location.href = 'departments.html';
}

function logout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('selectedDept');
  window.location.href = '../index.html';
}
