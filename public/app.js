const issueList = document.querySelector('#issue-list');
const form = document.querySelector('#issue-form');
const formMessage = document.querySelector('#form-message');
const toast = document.querySelector('#toast');
let issues = [];
let activeFilter = 'All';
let toastTimer;
let refreshTimer;

const safe = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const initials = (category) => ({ Internet: 'IT', Classroom: 'CL', Facilities: 'FM', Safety: 'SA', Other: 'OT' }[category] || 'OT');
const priorityRank = { High: 0, Medium: 1, Low: 2 };

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function getVisibleIssues() {
  const query = document.querySelector('#issue-search').value.trim().toLowerCase();
  const category = document.querySelector('#category-filter').value;
  const sort = document.querySelector('#sort-order').value;
  const visible = issues.filter((issue) => {
    const matchesStatus = activeFilter === 'All' || issue.status === activeFilter;
    const matchesCategory = category === 'All' || issue.category === category;
    const haystack = `${issue.title} ${issue.description} ${issue.location} ${issue.category}`.toLowerCase();
    return matchesStatus && matchesCategory && (!query || haystack.includes(query));
  });

  return visible.sort((a, b) => {
    if (sort === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || new Date(b.created_at) - new Date(a.created_at);
    const direction = sort === 'oldest' ? 1 : -1;
    return direction * (new Date(a.created_at) - new Date(b.created_at));
  });
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter').forEach((tab) => {
    const active = tab.dataset.filter === filter;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  render();
}

function renderNotifications() {
  const list = document.querySelector('#notification-list');
  const unread = localStorage.getItem('campusfix.notificationsRead') !== 'yes';
  const active = issues.filter((issue) => issue.status !== 'Resolved');
  const dot = document.querySelector('#notification-dot');
  dot.classList.toggle('has-notifications', unread && active.length > 0);
  if (!active.length) {
    list.innerHTML = '<div class="notification-empty">You’re all caught up. No requests need attention.</div>';
    return;
  }
  list.innerHTML = active.slice(0, 4).map((issue) => `<button class="notification-item" data-notification-filter="${safe(issue.status)}"><span class="notification-symbol ${issue.status === 'Open' ? 'notice-open' : 'notice-progress'}">${issue.status === 'Open' ? '!' : '↗'}</span><span><strong>${safe(issue.title)}</strong><small>${safe(issue.status)} · ${safe(issue.location)}</small></span></button>`).join('');
  if (active.length > 4) list.insertAdjacentHTML('beforeend', `<div class="notification-more">+ ${active.length - 4} more active requests</div>`);
}

function render() {
  const counts = issues.reduce((acc, issue) => ({ ...acc, [issue.status]: (acc[issue.status] || 0) + 1 }), {});
  document.querySelector('#open-total').textContent = counts.Open || 0;
  document.querySelector('#progress-total').textContent = counts['In Progress'] || 0;
  document.querySelector('#resolved-total').textContent = counts.Resolved || 0;
  document.querySelector('#nav-open-count').textContent = counts.Open || 0;
  document.querySelector('#issue-count').textContent = issues.length;
  document.querySelector('#all-filter-count').textContent = issues.length;
  const visible = getVisibleIssues();
  document.querySelector('#showing-label').textContent = `Showing ${visible.length} of ${issues.length} ${issues.length === 1 ? 'request' : 'requests'}`;
  renderNotifications();

  if (!visible.length) {
    const hasFilters = activeFilter !== 'All' || document.querySelector('#issue-search').value || document.querySelector('#category-filter').value !== 'All';
    issueList.innerHTML = hasFilters
      ? '<div class="empty-state"><span>⌕</span><strong>No matching requests</strong><p>Try changing your search or filters.</p><button class="clear-filters" id="clear-filters">Clear filters</button></div>'
      : '<div class="empty-state"><span>✳</span><strong>No requests yet</strong><p>New campus reports will appear here.</p><a href="#new-request" class="clear-filters">Report an issue</a></div>';
    return;
  }

  issueList.innerHTML = visible.map((issue) => {
    const statusClass = issue.status.toLowerCase().replace(' ', '-');
    const priorityClass = issue.priority.toLowerCase();
    const nextStatus = issue.status === 'Open' ? 'In Progress' : issue.status === 'In Progress' ? 'Resolved' : 'Open';
    const actionLabel = issue.status === 'Resolved' ? 'Reopen' : issue.status === 'Open' ? 'Start work' : 'Resolve';
    return `<article class="issue-row">
      <div class="issue-avatar avatar-${initials(issue.category).toLowerCase()}">${initials(issue.category)}</div>
      <div class="issue-main"><div class="issue-title-line"><h3 title="${safe(issue.title)}">${safe(issue.title)}</h3><span class="priority ${priorityClass}"><i></i>${safe(issue.priority)}</span></div>
      <div class="issue-meta"><span class="category-label">${safe(issue.category)}</span><span class="meta-sep">·</span><span>⌖ ${safe(issue.location)}</span><span class="meta-sep">·</span><span>${formatDate(issue.created_at)}</span></div><p class="issue-description">${safe(issue.description)}</p></div>
      <div class="issue-side"><span class="status-badge ${statusClass}"><i></i>${safe(issue.status)}</span><button class="row-action" data-id="${Number(issue.id)}" data-status="${nextStatus}" aria-label="${actionLabel}: ${safe(issue.title)}">${actionLabel} <span>→</span></button></div>
    </article>`;
  }).join('');
}

async function checkHealth(showToast = false) {
  const pill = document.querySelector('#service-pill');
  const score = document.querySelector('#pulse-score');
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('Service check failed');
    const health = await response.json();
    const ready = health.status === 'ok' && health.database === 'connected';
    pill.classList.toggle('service-down', !ready);
    pill.innerHTML = `<i></i> ${ready ? 'All systems up' : 'Database unavailable'}`;
    score.textContent = ready ? 'Good' : 'Check';
    if (showToast) notify(ready ? 'API and database are healthy' : 'Database connection needs attention');
  } catch (_error) {
    pill.classList.add('service-down');
    pill.innerHTML = '<i></i> Service unavailable';
    score.textContent = 'Check';
    if (showToast) notify('CampusFix health check failed');
  }
}

async function loadIssues({ quiet = false } = {}) {
  if (!quiet) issueList.innerHTML = '<div class="loading-state">Loading campus requests…</div>';
  try {
    const response = await fetch('/api/issues', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load requests');
    issues = await response.json();
    render();
  } catch (_error) {
    if (!quiet) issueList.innerHTML = '<div class="empty-state"><span>!</span><strong>Could not connect</strong><p>Check that CampusFix and its database are running, then refresh.</p><button class="clear-filters" id="retry-load">Try again</button></div>';
  }
}

function closeMenus(except) {
  [['notifications-menu', 'notifications-button'], ['profile-menu', 'top-profile-trigger']].forEach(([menuId, triggerId]) => {
    const menu = document.getElementById(menuId);
    if (menuId !== except) {
      menu.hidden = true;
      document.getElementById(triggerId).setAttribute('aria-expanded', 'false');
      if (menuId === 'profile-menu') document.querySelector('#profile-trigger').setAttribute('aria-expanded', 'false');
    }
  });
}

function toggleMenu(menuId, triggerId) {
  const menu = document.getElementById(menuId);
  const opening = menu.hidden;
  closeMenus(menuId);
  menu.hidden = !opening;
  document.getElementById(triggerId).setAttribute('aria-expanded', String(opening));
  if (menuId === 'profile-menu') document.querySelector('#profile-trigger').setAttribute('aria-expanded', String(opening));
}

function exportCsv() {
  const rows = getVisibleIssues();
  if (!rows.length) return notify('There are no requests to export');
  const columns = ['id', 'title', 'description', 'category', 'location', 'priority', 'status', 'created_at'];
  const csv = [columns.join(','), ...rows.map((issue) => columns.map((key) => `"${String(issue[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('
');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `campusfix-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(`Exported ${rows.length} request${rows.length === 1 ? '' : 's'}`);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.innerHTML = 'Sending…';
  formMessage.textContent = '';
  formMessage.classList.remove('error');
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch('/api/issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send report.');
    form.reset();
    document.querySelector('#priority').value = 'Medium';
    formMessage.textContent = 'Your report has been sent. Thank you!';
    localStorage.removeItem('campusfix.notificationsRead');
    notify('Issue reported successfully');
    setFilter('All');
    await loadIssues({ quiet: true });
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add('error');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send report <span>↗</span>';
  }
});

document.querySelectorAll('.filter').forEach((tab) => tab.addEventListener('click', () => setFilter(tab.dataset.filter)));
document.querySelectorAll('.clickable-stat').forEach((card) => {
  const activate = () => { setFilter(card.dataset.status); document.querySelector('#issues').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  card.addEventListener('click', activate);
  card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
});
document.querySelector('#issue-search').addEventListener('input', render);
document.querySelector('#category-filter').addEventListener('change', render);
document.querySelector('#sort-order').addEventListener('change', render);

issueList.addEventListener('click', async (event) => {
  if (event.target.closest('#clear-filters')) {
    setFilter('All');
    document.querySelector('#issue-search').value = '';
    document.querySelector('#category-filter').value = 'All';
    render();
    return;
  }
  if (event.target.closest('#retry-load')) return loadIssues();
  const button = event.target.closest('.row-action');
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/issues/${button.dataset.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not update status.');
    localStorage.removeItem('campusfix.notificationsRead');
    notify(`Request marked ${result.status.toLowerCase()}`);
    await loadIssues({ quiet: true });
  } catch (error) {
    notify(error.message);
    button.disabled = false;
  }
});

document.querySelector('#refresh-button').addEventListener('click', async () => { await Promise.all([loadIssues(), checkHealth()]); notify('Workspace refreshed'); });
document.querySelector('#export-button').addEventListener('click', exportCsv);
document.querySelector('#dismiss-tip').addEventListener('click', () => { document.querySelector('.tip-card').remove(); localStorage.setItem('campusfix.tipDismissed', 'yes'); });
if (localStorage.getItem('campusfix.tipDismissed') === 'yes') document.querySelector('.tip-card').remove();

document.querySelector('#notifications-button').addEventListener('click', () => toggleMenu('notifications-menu', 'notifications-button'));
document.querySelector('#top-profile-trigger').addEventListener('click', () => toggleMenu('profile-menu', 'top-profile-trigger'));
document.querySelector('#profile-trigger').addEventListener('click', () => toggleMenu('profile-menu', 'top-profile-trigger'));
document.querySelector('#mark-read').addEventListener('click', () => { localStorage.setItem('campusfix.notificationsRead', 'yes'); renderNotifications(); });
document.querySelector('#notification-list').addEventListener('click', (event) => {
  const item = event.target.closest('[data-notification-filter]');
  if (!item) return;
  closeMenus();
  setFilter(item.dataset.notificationFilter);
  document.querySelector('#issues').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#profile-refresh').addEventListener('click', async () => { closeMenus(); await Promise.all([loadIssues(), checkHealth()]); notify('Workspace refreshed'); });
document.querySelector('#profile-status').addEventListener('click', async () => { closeMenus(); await checkHealth(true); });
document.addEventListener('click', (event) => { if (!event.target.closest('.menu-anchor') && !event.target.closest('#profile-trigger')) closeMenus(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenus(); });

const navLabels = { dashboard: 'Overview', issues: 'All requests', 'new-request': 'Report an issue' };
document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', () => {
  document.querySelectorAll('[data-nav]').forEach((item) => item.classList.toggle('active', item === link));
  document.querySelector('#breadcrumb-label').textContent = navLabels[link.dataset.nav];
}));

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
loadIssues();
checkHealth();
refreshTimer = setInterval(() => { if (!document.hidden) { loadIssues({ quiet: true }); checkHealth(); } }, 60000);
window.addEventListener('beforeunload', () => clearInterval(refreshTimer));