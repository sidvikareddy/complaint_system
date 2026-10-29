if (!Auth.require('admin')) throw new Error('redirecting');

document.getElementById('welcome').textContent = Auth.user.name;

const statsEl = document.getElementById('stats');
const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const filterStatus = document.getElementById('filterStatus');
const filterCategory = document.getElementById('filterCategory');
const filterPriority = document.getElementById('filterPriority');

const modalBg = document.getElementById('modalBg');
const mTitle = document.getElementById('mTitle');
const mDesc = document.getElementById('mDesc');
const mEvidence = document.getElementById('mEvidence');
const mStatus = document.getElementById('mStatus');
const mRemarks = document.getElementById('mRemarks');
const mAlert = document.getElementById('mAlert');
const mHistory = document.getElementById('mHistory');
const mDepartment = document.getElementById('mDepartment');
const mAssignee = document.getElementById('mAssignee');
const mNotes = document.getElementById('mNotes');
const mNote = document.getElementById('mNote');
const mAddNote = document.getElementById('mAddNote');

let complaints = [];
let currentId = null;
let staff = [];

function renderAssignees(selectedId = '') {
  const department = mDepartment.value;
  const matchingStaff = staff.filter((person) => person.department === department);
  mAssignee.innerHTML = '<option value="">Unassigned</option>' +
    matchingStaff
      .map((person) => `<option value="${person._id}">${esc(person.name)} · ${esc(person.department)}</option>`)
      .join('');
  if (matchingStaff.some((person) => person._id === selectedId)) mAssignee.value = selectedId;
}

function statClass(s) {
  return { Pending: 'pending', 'In Progress': 'progress', Resolved: 'resolved', Rejected: 'rejected' }[s] || '';
}

async function loadStats() {
  const s = await api('/admin/analytics');
  const status = {
    Pending: s.pending,
    'In Progress': s.inProgress,
    Resolved: s.resolved,
    Rejected: s.rejected
  };
  statsEl.innerHTML =
    `<div class="stat total"><div class="lbl">Total Complaints</div><div class="num">${s.total}</div></div>` +
    Object.keys(status)
      .map((k) => `<div class="stat ${statClass(k)}"><div class="lbl">${esc(k)}</div><div class="num">${status[k]}</div></div>`)
      .join('');
}

async function loadComplaints() {
  const params = new URLSearchParams();
  if (searchEl.value.trim()) params.set('search', searchEl.value.trim());
  if (filterStatus.value) params.set('status', filterStatus.value);
  if (filterCategory.value) params.set('category', filterCategory.value);
  if (filterPriority.value) params.set('priority', filterPriority.value);

  try {
    params.set('page', '1');
    params.set('limit', '100');
    const result = await api('/admin/complaints?' + params.toString());
    complaints = result.items;
    renderRows();
  } catch (err) {
    rowsEl.innerHTML = `<tr><td colspan="8" class="empty">${esc(err.message)}</td></tr>`;
  }
}

function renderRows() {
  if (!complaints.length) {
    rowsEl.innerHTML = '<tr><td colspan="8" class="empty">No complaints found.</td></tr>';
    return;
  }
  rowsEl.innerHTML = complaints
    .map(
      (c) => `
    <tr>
      <td>${fmtDate(c.createdAt)}</td>
      <td>${esc(c.student ? c.student.name : 'Deleted user')}<br /><small>${esc(c.student ? c.student.email : '')}</small></td>
      <td><strong>${esc(c.title)}</strong><br /><small>${esc(c.location)}</small></td>
      <td><span class="badge cat">${esc(c.category)}</span></td>
      <td>${esc(c.priority)}</td>
      <td>${badge(c.status)}</td>
      <td>${esc(c.assignment && c.assignment.department ? c.assignment.department : 'Unassigned')}</td>
      <td><button class="small" data-id="${c._id}">Update</button></td>
    </tr>`
    )
    .join('');
}

rowsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (btn) openModal(btn.dataset.id);
});

async function openModal(id) {
  const c = await api(`/complaints/${id}`);
  if (!c) return;
  currentId = id;
  mTitle.textContent = c.title;
  mDesc.textContent = c.description;
  mEvidence.innerHTML = (c.evidence || []).map((file) => `<a href="${esc(file.url)}" target="_blank" rel="noopener">View evidence: ${esc(file.originalName)}</a>`).join('');
  mStatus.value = c.status;
  mRemarks.value = c.adminRemarks || '';
  mDepartment.value = c.assignment && c.assignment.department ? c.assignment.department : 'General';
  const assignedName = c.assignment && c.assignment.assignedName;
  const displayAssignee = assignedName ? staff.find((person) => person.name === assignedName) : null;
  renderAssignees(
    c.assignment && c.assignment.assignedTo
      ? c.assignment.assignedTo._id
      : displayAssignee
        ? displayAssignee._id
        : ''
  );
  hideAlert(mAlert);
  mHistory.innerHTML = c.history
    .map((h) => `<li>${badge(h.status)} ${h.remarks ? esc(h.remarks) : ''}<div class="when">${fmtDate(h.changedAt)}${h.changedBy ? ` · ${esc(h.changedBy.name)} (${esc(h.changedBy.role)})` : ''}</div></li>`)
    .join('');
  mNotes.innerHTML = (c.internalNotes || []).length
    ? c.internalNotes.map((n) => `<li>${esc(n.body)}<div class="when">${fmtDate(n.createdAt)} · ${esc(n.author ? n.author.name : 'Staff')}</div></li>`).join('')
    : '<li class="empty">No internal notes.</li>';
  mNote.value = '';
  modalBg.classList.add('show');
}

function closeModal() {
  modalBg.classList.remove('show');
  currentId = null;
}

document.getElementById('mCancel').addEventListener('click', closeModal);
modalBg.addEventListener('click', (e) => { if (e.target === modalBg) closeModal(); });

document.getElementById('mSave').addEventListener('click', async () => {
  hideAlert(mAlert);
  try {
    await api(`/admin/complaints/${currentId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: mStatus.value, remarks: mRemarks.value, rejectionReason: mStatus.value === 'Rejected' ? mRemarks.value : undefined, department: mDepartment.value, assignedTo: mAssignee.value || null })
    });
    closeModal();
    await Promise.all([loadStats(), loadComplaints()]);
  } catch (err) {
    showAlert(mAlert, err.message);
  }
});

mAddNote.addEventListener('click', async () => {
  hideAlert(mAlert);
  try {
    if (!mNote.value.trim()) throw new Error('Enter an internal note first');
    const note = await api(`/complaints/${currentId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: mNote.value })
    });
    mNotes.insertAdjacentHTML('beforeend', `<li>${esc(note.body)}<div class="when">${fmtDate(note.createdAt)} · ${esc(note.author ? note.author.name : Auth.user.name)}</div></li>`);
    mNote.value = '';
  } catch (err) {
    showAlert(mAlert, err.message);
  }
});

mDepartment.addEventListener('change', () => renderAssignees());
document.getElementById('applyBtn').addEventListener('click', loadComplaints);
document.getElementById('resetBtn').addEventListener('click', () => {
  searchEl.value = '';
  filterStatus.value = '';
  filterCategory.value = '';
  filterPriority.value = '';
  loadComplaints();
});
searchEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadComplaints(); });
filterPriority.addEventListener('change', loadComplaints);

(async function init() {
  const [meta, staffList] = await Promise.all([api('/complaints/meta'), api('/auth/staff')]);
  staff = [...staffList, ...(meta.displayStaff || []).map((person) => ({
    _id: person.id,
    name: person.name,
    department: person.department
  }))];
  meta.statuses.forEach((s) => {
    filterStatus.insertAdjacentHTML('beforeend', `<option>${esc(s)}</option>`);
    mStatus.insertAdjacentHTML('beforeend', `<option>${esc(s)}</option>`);
  });
  meta.categories.forEach((c) => filterCategory.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`));
  const departments = [...new Set([
    ...meta.departments,
    ...staff.filter((person) => person.department).map((person) => person.department)
  ])];
  departments.forEach((d) => mDepartment.insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(d)}</option>`));
  renderAssignees();
  await Promise.all([loadStats(), loadComplaints()]);
})();

setInterval(loadStats, 30000);
