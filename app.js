const CATEGORIES = ['Feature', 'Bug', 'Improvement', 'Research', 'Documentation', 'Chore'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Testing', 'Completed', 'Blocked'];
const KEY = 'taskManager.tasks.v1';

let tasks = JSON.parse(localStorage.getItem(KEY) || '[]');
let editingId = null;
const INBOX_KEY = 'taskManager.inbox.v1';
let inbox = JSON.parse(localStorage.getItem(INBOX_KEY) || '[]');
let triagingId = null;
const saveInbox = () => localStorage.setItem(INBOX_KEY, JSON.stringify(inbox));

const $ = (s) => document.querySelector(s);
const save = () => localStorage.setItem(KEY, JSON.stringify(tasks));
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function fill(sel, items, allLabel) {
  sel.replaceChildren();
  if (allLabel) sel.append(new Option(allLabel, ''));
  items.forEach((i) => sel.append(new Option(i, i)));
}
fill($('#fStatus'), STATUSES, 'All statuses');
fill($('#fPriority'), PRIORITIES, 'All priorities');
fill($('#fCategory'), CATEGORIES, 'All categories');
fill($('[name=category]'), CATEGORIES);
fill($('[name=priority]'), PRIORITIES);
fill($('[name=status]'), STATUSES);
$('[name=priority]').value = 'Medium';
$('[name=status]').value = 'To Do';

// Resolve a dependency reference (#id or title) to a task, if it exists.
function resolveDep(ref) {
  if (ref.startsWith('#')) return tasks.find((t) => String(t.id) === ref.slice(1));
  return tasks.find((t) => t.title.toLowerCase() === ref.toLowerCase());
}
function openDeps(t) {
  return t.dependencies.filter((d) => {
    const dep = resolveDep(d);
    return dep && dep.status !== 'Completed';
  });
}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function render() {
  const q = $('#search').value.toLowerCase();
  const fs = $('#fStatus').value, fp = $('#fPriority').value, fc = $('#fCategory').value;
  const shown = tasks
    .filter((t) => (!fs || t.status === fs) && (!fp || t.priority === fp) && (!fc || t.category === fc))
    .filter((t) => !q || `${t.title} ${t.description} ${t.assignee}`.toLowerCase().includes(q))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));

  const board = $('#board');
  board.replaceChildren();
  if (!shown.length) board.append(el('p', 'No tasks yet. Create one to get started.', 'empty'));

  shown.forEach((t) => {
    const card = el('article', undefined, `card ${t.priority}`);
    card.append(el('h3', `#${t.id} ${t.title}`));
    const badges = el('div', undefined, 'badges');
    [t.category, t.priority, t.status].forEach((b) => badges.append(el('span', b, 'badge')));
    if (t.estimate) badges.append(el('span', `${t.estimate}h`, 'badge'));
    const open = openDeps(t);
    if (open.length) badges.append(el('span', `Waiting on ${open.length}`, 'badge warn'));
    card.append(badges);
    if (t.assignee) card.append(el('small', `Assignee: ${t.assignee}`));
    if (t.description) card.append(el('p', t.description));
    const ul = el('ul');
    t.criteria.forEach((c) => ul.append(el('li', c)));
    card.append(ul);
    if (t.dependencies.length) card.append(el('small', `Dependencies: ${t.dependencies.join(', ')}`));
    if (t.notes) card.append(el('small', `Notes: ${t.notes}`));
    if (open.length && t.status !== 'Blocked' && t.status !== 'Completed')
      card.append(el('small', `Next: resolve ${open[0]} or mark Blocked.`));
    else if (t.status !== 'Completed') {
      const next = STATUSES[Math.min(STATUSES.indexOf(t.status) + 1, 5)];
      if (t.status === 'Blocked') card.append(el('small', 'Next: clear the blocker and move to In Progress.'));
      else card.append(el('small', `Next: move to ${next}.`));
    }

    const row = el('div', undefined, 'row');
    const sel = el('select');
    sel.setAttribute('aria-label', 'Change status');
    fill(sel, STATUSES);
    sel.value = t.status;
    sel.onchange = () => { t.status = sel.value; save(); render(); };
    const edit = el('button', 'Edit');
    edit.onclick = () => openForm(t);
    const del = el('button', 'Delete');
    del.onclick = () => { if (confirm('Delete this task?')) { tasks = tasks.filter((x) => x !== t); save(); render(); } };
    row.append(sel, edit, del);
    card.append(row);
    board.append(card);
  });
}

function openForm(t, inboxItem) {
  editingId = t ? t.id : null;
  triagingId = inboxItem ? inboxItem.id : null;
  const f = $('#form');
  f.reset();
  $('#formTitle').textContent = t ? `Edit task #${t.id}` : 'New task';
  if (t) {
    f.title.value = t.title; f.category.value = t.category; f.priority.value = t.priority;
    f.status.value = t.status; f.assignee.value = t.assignee; f.estimate.value = t.estimate || '';
    f.description.value = t.description; f.criteria.value = t.criteria.join('\n');
    f.dependencies.value = t.dependencies.join('\n'); f.notes.value = t.notes;
  } else {
    f.priority.value = 'Medium'; f.status.value = 'To Do';
    if (inboxItem) f.title.value = inboxItem.text;
  }
  $('#formDlg').showModal();
}

$('#form').addEventListener('submit', (e) => {
  const f = e.target;
  const data = {
    title: f.title.value.trim(), category: f.category.value, priority: f.priority.value,
    status: f.status.value, assignee: f.assignee.value.trim(),
    estimate: f.estimate.value ? Number(f.estimate.value) : null,
    description: f.description.value.trim(), criteria: lines(f.criteria.value),
    dependencies: lines(f.dependencies.value), notes: f.notes.value.trim(),
  };
  if (!data.title || !data.criteria.length) { e.preventDefault(); return; }
  if (editingId) Object.assign(tasks.find((t) => t.id === editingId), data);
  else tasks.push({ id: Math.max(0, ...tasks.map((t) => t.id)) + 1, ...data });
  if (triagingId) { inbox = inbox.filter((i) => i.id !== triagingId); saveInbox(); triagingId = null; }
  save(); render(); renderInbox();
});

function renderInbox() {
  $('#inboxCount').textContent = inbox.filter((i) => !i.read).length;
  const ul = $('#inboxList');
  ul.replaceChildren();
  inbox.forEach((i) => {
    const li = el('li');
    const triage = el('button', 'Triage');
    triage.onclick = () => openForm(null, i);
    const del = el('button', 'Discard');
    del.onclick = () => { inbox = inbox.filter((x) => x !== i); saveInbox(); renderInbox(); };
    const text = el('span', i.text);
    text.tabIndex = 0;
    text.onclick = () => {
      // INTENTIONAL BUG: item is marked read and saved, but the inbox is not
      // re-rendered, so the "Unread" badge and the unread count stay stale.
      i.read = true;
      saveInbox();
    };
    li.append(text);
    if (!i.read) li.append(el('span', 'Unread', 'badge unread'));
    li.append(triage, del);
    ul.append(li);
  });
}

$('#inboxForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#inboxInput').value.trim();
  if (!text) return;
  inbox.push({ id: Math.max(0, ...inbox.map((i) => i.id)) + 1, text, read: false });
  saveInbox(); $('#inboxInput').value = ''; renderInbox();
});

function report() {
  const out = [`STATUS REPORT - ${new Date().toLocaleDateString()}`, `Total tasks: ${tasks.length}`, ''];
  const done = tasks.filter((t) => t.status === 'Completed').length;
  out.push(`Progress: ${done}/${tasks.length} completed (${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%)`, '');
  STATUSES.forEach((s) => {
    const list = tasks.filter((t) => t.status === s);
    out.push(`${s}: ${list.length}`);
    list.forEach((t) => out.push(`  - #${t.id} [${t.priority}] ${t.title}`));
  });
  const risk = tasks.filter((t) => t.status !== 'Completed' && (t.status === 'Blocked' || openDeps(t).length));
  out.push('', 'Blockers / risks:');
  if (!risk.length) out.push('  None');
  risk.forEach((t) => out.push(`  - #${t.id} ${t.title}${openDeps(t).length ? ` (waiting on ${openDeps(t).join(', ')})` : ''}`));
  const est = tasks.filter((t) => t.status !== 'Completed').reduce((n, t) => n + (t.estimate || 0), 0);
  out.push('', `Remaining estimated effort: ${est}h`);
  return out.join('\n');
}

$('#newBtn').onclick = () => openForm();
$('#cancelBtn').onclick = () => $('#formDlg').close();
$('#formDlg').addEventListener('close', () => { triagingId = null; });
$('#reportBtn').onclick = () => { $('#reportText').textContent = report(); $('#reportDlg').showModal(); };
$('#closeReport').onclick = () => $('#reportDlg').close();
$('#copyBtn').onclick = () => navigator.clipboard.writeText($('#reportText').textContent);
['#search', '#fStatus', '#fPriority', '#fCategory'].forEach((s) => $(s).addEventListener('input', render));

render();
renderInbox();
