let currentUser = null;
let currentFolderId = null;
let currentFiles = [];
let currentView = localStorage.getItem('driveView') || 'grid';
let selectedFile = null;
let renameTargetId = null;
let isSearchMode = false;
let currentSort = localStorage.getItem('driveSort') || 'name_asc';

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
function updateThemeIcons() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.getElementById('icon-sun')?.classList.toggle('hidden', dark);
  document.getElementById('icon-moon')?.classList.toggle('hidden', !dark);
}
updateThemeIcons();
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcons();
});

function showToast(msg, type = 'default') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fileIcon(f) {
  if (f.type === 'folder') return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  const m = f.mime_type || '';
  if (m.startsWith('image/')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  if (m.startsWith('video/')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
  if (m.startsWith('audio/')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  if (m === 'application/pdf') return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>';
  if (m.includes('zip') || m.includes('tar') || m.includes('rar') || m.includes('7z')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
  if (m.includes('word') || m.includes('document')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>';
  if (m.includes('sheet') || m.includes('excel')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>';
  if (m.includes('presentation') || m.includes('powerpoint')) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  if (m.startsWith('text/') || ['js','ts','py','json','html','css','md'].some(e => (f.name||'').endsWith('.'+e))) return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
}

function handleSort(val) {
  currentSort = val;
  localStorage.setItem('driveSort', val);
  renderFiles(currentFiles);
}

function openProfileModal() {
  document.getElementById('profile-name-input').value = currentUser.name;
  document.getElementById('profile-email-input').value = currentUser.email;
  document.getElementById('profile-old-password-input').value = '';
  document.getElementById('profile-password-input').value = '';
  document.getElementById('profile-modal').classList.remove('hidden');
}

async function updateProfile() {
  const name = document.getElementById('profile-name-input').value.trim();
  const email = document.getElementById('profile-email-input').value.trim();
  const oldPassword = document.getElementById('profile-old-password-input').value;
  const password = document.getElementById('profile-password-input').value;
  if (!name || !email) return showToast('Name and email are required', 'error');
  if (password && !oldPassword) return showToast('Old password is required to change password', 'error');

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, oldPassword, password })
    });
    if (!res.ok) throw await res.json();
    showToast('Profile updated successfully', 'success');
    document.getElementById('profile-modal').classList.add('hidden');
    currentUser.name = name;
    currentUser.email = email;
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = name.charAt(0).toUpperCase();
  } catch (e) {
    showToast(e.error || 'Failed to update profile', 'error');
  }
}

async function init() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location.href = '/'; return; }
    const { user } = await res.json();
    currentUser = user;
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = user.name.charAt(0).toUpperCase();
    loadFiles();
    loadStorage();
  } catch { window.location.href = '/'; }
}

async function loadStorage() {
  try {
    const res = await fetch('/api/files/storage');
    const { used, limit } = await res.json();
    const pct = Math.min(100, (used / limit) * 100).toFixed(1);
    document.getElementById('storage-text').textContent = `${formatBytes(used)} of ${formatBytes(limit)} used`;
    document.getElementById('storage-fill').style.width = pct + '%';
  } catch {}
}

async function loadFiles(folderId = null) {
  isSearchMode = false;
  currentFolderId = folderId;
  document.getElementById('search-input').value = '';
  try {
    const url = folderId ? `/api/files?parent_id=${folderId}` : '/api/files';
    const res = await fetch(url);
    const { files } = await res.json();
    currentFiles = files;
    renderFiles(files);
    updateBreadcrumb(folderId);
  } catch { showToast('Failed to load files', 'error'); }
}

async function updateBreadcrumb(folderId) {
  const el = document.getElementById('breadcrumb');
  if (!folderId) {
    el.innerHTML = `<span class="breadcrumb-item current">My Drive</span>`;
    return;
  }
  const res = await fetch(`/api/files/breadcrumb?folder_id=${folderId}`);
  const { breadcrumb } = await res.json();
  let html = `<span class="breadcrumb-item" data-action="nav-root">My Drive</span>`;
  breadcrumb.forEach((crumb, i) => {
    html += `<span class="breadcrumb-sep">/</span>`;
    if (i === breadcrumb.length - 1) {
      html += `<span class="breadcrumb-item current">${escHtml(crumb.name)}</span>`;
    } else {
      html += `<span class="breadcrumb-item" data-action="nav-folder" data-id="${crumb.id}">${escHtml(crumb.name)}</span>`;
    }
  });
  el.innerHTML = html;
}

function setView(v) {
  currentView = v;
  localStorage.setItem('driveView', v);
  renderFiles(currentFiles);
}

function sortFilesList(files) {
  const sorted = [...files];
  sorted.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    switch (currentSort) {
      case 'name_asc': return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'date_desc': return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      case 'date_asc': return new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
      case 'size_desc': return (b.size || 0) - (a.size || 0);
      case 'size_asc': return (a.size || 0) - (b.size || 0);
      default: return a.name.localeCompare(b.name);
    }
  });
  return sorted;
}

function renderFiles(files) {
  const area = document.getElementById('content-area');
  if (!files.length) {
    area.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <div style="font-size:14px;font-weight:500;">${isSearchMode ? 'No files found' : 'This folder is empty'}</div>
        <div style="font-size:12px;">${isSearchMode ? 'Try a different search term.' : 'Upload files or create a folder to get started.'}</div>
      </div>`;
    return;
  }

  const sortedFiles = sortFilesList(files);
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = currentSort;

  if (currentView === 'grid') {
    area.innerHTML = `<div class="files-grid">${sortedFiles.map(f => gridCard(f)).join('')}</div>`;
  } else {
    area.innerHTML = `<div class="files-list">${sortedFiles.map(f => listRow(f)).join('')}</div>`;
  }
  addFileEventListeners();
}

function gridCard(f) {
  return `<div class="file-card" data-id="${f.id}" data-type="${f.type}">
    ${f.is_public ? '<div class="file-shared-badge" title="Shared"></div>' : ''}
    <span class="file-icon">${fileIcon(f)}</span>
    <div class="file-name truncate">${escHtml(f.name)}</div>
    <div class="file-meta">${f.type === 'folder' ? 'Folder' : formatBytes(f.size)}</div>
  </div>`;
}

function listRow(f) {
  return `<div class="file-row" data-id="${f.id}" data-type="${f.type}">
    <div class="file-row-icon">${fileIcon(f)}</div>
    <div class="file-row-name truncate">${escHtml(f.name)}${f.is_public ? ' <span style="color:var(--blue);font-size:11px;">● shared</span>' : ''}</div>
    <div class="file-row-meta">${formatBytes(f.size)}</div>
    <div class="file-row-meta" style="min-width:100px">${formatDate(f.updated_at)}</div>
    <div class="file-row-actions">
      <button class="btn btn-ghost btn-sm btn-icon" data-action="ctx-more" data-id="${f.id}" title="More">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addFileEventListeners() {
  document.querySelectorAll('.file-card, .file-row').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const type = el.dataset.type;
      const file = currentFiles.find(f => f.id === id);
      if (type === 'folder') { loadFiles(id); }
      else if (file) { openPreview(file); }
    });
  });
}

let searchTimeout = null;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) { loadFiles(currentFolderId); return; }
  searchTimeout = setTimeout(() => doSearch(q), 300);
});

async function doSearch(q) {
  isSearchMode = true;
  try {
    const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}`);
    const { files } = await res.json();
    currentFiles = files;
    document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item current">Search results for "${escHtml(q)}"</span>`;
    renderFiles(files);
  } catch {}
}

function navigateToRoot() {
  document.getElementById('nav-my-drive').classList.add('active');
  document.getElementById('nav-shared').classList.remove('active');
  loadFiles(null);
}

async function navigateShared() {
  document.getElementById('nav-shared').classList.add('active');
  document.getElementById('nav-my-drive').classList.remove('active');
  isSearchMode = true;
  try {
    const res = await fetch('/api/files?parent_id=null');
    const { files } = await res.json();
    const shared = files.filter(f => f.is_public);
    currentFiles = shared;
    document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item current">Shared by me</span>`;
    renderFiles(shared);
  } catch {}
}

document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', (e) => { if (e.target.files.length) uploadFiles(e.target.files); });

const contentArea = document.getElementById('content-area');
document.body.addEventListener('dragover', (e) => { e.preventDefault(); contentArea.classList.add('drop-active'); });
document.body.addEventListener('dragleave', () => contentArea.classList.remove('drop-active'));
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  contentArea.classList.remove('drop-active');
  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

async function uploadFiles(fileList) {
  const progressWrap = document.getElementById('upload-progress-wrap');
  const formData = new FormData();
  for (const f of fileList) formData.append('files', f);
  if (currentFolderId) formData.append('parent_id', currentFolderId);

  const item = document.createElement('div');
  item.className = 'upload-item';
  item.innerHTML = `<div class="upload-item-name">Uploading ${fileList.length} file${fileList.length>1?'s':''}…</div><div class="upload-bar"><div class="upload-bar-fill" id="upbar" style="width:0%"></div></div>`;
  progressWrap.appendChild(item);

  try {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) item.querySelector('#upbar').style.width = ((e.loaded/e.total)*100)+'%';
    };
    await new Promise((resolve, reject) => {
      xhr.onload = () => { if (xhr.status === 200) resolve(); else reject(JSON.parse(xhr.responseText)); };
      xhr.onerror = reject;
      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);
    });
    showToast(`${fileList.length} file${fileList.length>1?'s':''} uploaded`, 'success');
    loadFiles(currentFolderId);
    loadStorage();
  } catch (err) {
    showToast(err?.error || 'Upload failed', 'error');
  } finally {
    setTimeout(() => item.remove(), 1000);
    document.getElementById('file-input').value = '';
  }
}

function showNewFolderModal() {
  document.getElementById('folder-name-input').value = '';
  document.getElementById('folder-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('folder-name-input').focus(), 50);
}
async function createFolder() {
  const name = document.getElementById('folder-name-input').value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/files/folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent_id: currentFolderId }) });
    if (!res.ok) throw await res.json();
    document.getElementById('folder-modal').classList.add('hidden');
    showToast('Folder created', 'success');
    loadFiles(currentFolderId);
  } catch (e) { showToast(e.error || 'Failed to create folder', 'error'); }
}
document.getElementById('folder-name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') createFolder(); });

function openCtxMenu(e, fileId) {
  e.preventDefault(); e.stopPropagation();
  selectedFile = currentFiles.find(f => f.id === fileId);
  if (!selectedFile) return;
  const menu = document.getElementById('context-menu');
  const isFolder = selectedFile.type === 'folder';
  document.getElementById('ctx-open').style.display = isFolder ? 'none' : 'flex';
  document.getElementById('ctx-download').style.display = isFolder ? 'none' : 'flex';
  document.getElementById('ctx-share').style.display = isFolder ? 'none' : 'flex';
  document.getElementById('ctx-share-label').textContent = selectedFile.is_public ? 'Remove share link' : 'Create share link';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
  menu.classList.remove('hidden');
}
document.addEventListener('click', () => document.getElementById('context-menu').classList.add('hidden'));

document.getElementById('ctx-open').addEventListener('click', () => { if (selectedFile) openPreview(selectedFile); });
document.getElementById('ctx-download').addEventListener('click', () => { if (selectedFile) window.location.href = `/api/files/${selectedFile.id}/download`; });
document.getElementById('ctx-share').addEventListener('click', () => { if (selectedFile) toggleShare(selectedFile); });
document.getElementById('ctx-rename').addEventListener('click', () => { if (selectedFile) openRenameModal(selectedFile); });
document.getElementById('ctx-delete').addEventListener('click', () => { if (selectedFile) deleteFile(selectedFile); });

async function toggleShare(file) {
  try {
    const res = await fetch(`/api/files/${file.id}/share`, { method: 'POST' });
    const data = await res.json();
    if (data.is_public) {
      const link = `${window.location.origin}/share/${data.share_token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      showToast('Share link copied to clipboard!', 'success');
    } else {
      showToast('Share link removed', 'default');
    }
    loadFiles(currentFolderId);
  } catch { showToast('Failed to update share', 'error'); }
}

function openRenameModal(file) {
  renameTargetId = file.id;
  document.getElementById('rename-input').value = file.name;
  document.getElementById('rename-modal').classList.remove('hidden');
  setTimeout(() => { const i = document.getElementById('rename-input'); i.focus(); i.select(); }, 50);
}
async function doRename() {
  const name = document.getElementById('rename-input').value.trim();
  if (!name || !renameTargetId) return;
  try {
    const res = await fetch(`/api/files/${renameTargetId}/rename`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw await res.json();
    document.getElementById('rename-modal').classList.add('hidden');
    showToast('Renamed successfully', 'success');
    loadFiles(currentFolderId);
  } catch (e) { showToast(e.error || 'Rename failed', 'error'); }
}
document.getElementById('rename-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doRename(); });

async function deleteFile(file) {
  if (!confirm(`Delete "${file.name}"?${file.type==='folder'?' All contents will be deleted.':''}`)) return;
  try {
    const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
    if (!res.ok) throw await res.json();
    showToast('Deleted', 'default');
    loadFiles(currentFolderId);
    loadStorage();
  } catch (e) { showToast(e.error || 'Delete failed', 'error'); }
}

function openPreview(file) {
  const overlay = document.getElementById('preview-overlay');
  const body = document.getElementById('preview-body');
  const title = document.getElementById('preview-title');
  const dlBtn = document.getElementById('preview-download-btn');
  title.textContent = file.name;
  dlBtn.href = `/api/files/${file.id}/download`;
  dlBtn.download = file.name;
  const src = `/api/files/${file.id}/preview`;
  const m = file.mime_type || '';

  const extMatch = file.name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  const isImage = m.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext);
  const isVideo = m.startsWith('video/') || ['mp4','webm','ogg','mov','avi','mkv'].includes(ext);
  const isAudio = m.startsWith('audio/') || ['mp3','wav','ogg','flac','m4a','aac'].includes(ext);
  const isPdf = m === 'application/pdf' || ext === 'pdf';
  const textExts = ['txt','md','js','ts','jsx','tsx','py','json','html','css','scss','sass','less','sh','bash','zsh','yml','yaml','xml','csv','java','cpp','c','cs','go','rs','php','rb','swift','kt','sql','ini','cfg','conf','env','log'];
  const isText = m.startsWith('text/') || textExts.includes(ext);
  const isZip = m.includes('zip') || ext === 'zip';

  if (isImage) {
    body.innerHTML = `<img src="${src}" alt="${escHtml(file.name)}" style="max-width:100%;max-height:calc(100vh - 140px);object-fit:contain;border-radius:var(--radius);box-shadow:var(--shadow-lg);" />`;
  } else if (isVideo) {
    body.innerHTML = `<video controls autoplay style="max-width:100%;max-height:calc(100vh - 140px);border-radius:var(--radius);box-shadow:var(--shadow-lg);background:#000;"><source src="${src}" type="${m || 'video/mp4'}" />Your browser does not support video.</video>`;
  } else if (isAudio) {
    body.innerHTML = `<div style="background:var(--surface);padding:40px;border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;align-items:center;gap:20px;min-width:300px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      <audio controls autoplay style="width:100%;"><source src="${src}" type="${m || 'audio/mp3'}" />Your browser does not support audio.</audio>
    </div>`;
  } else if (isPdf) {
    body.innerHTML = `<iframe src="${src}" title="${escHtml(file.name)}" style="width:100%;height:calc(100vh - 140px);border:none;border-radius:var(--radius);background:#fff;box-shadow:var(--shadow-lg);"></iframe>`;
  } else if (isText) {
    body.innerHTML = `<div style="background:var(--surface);width:100%;height:calc(100vh - 140px);padding:24px;border-radius:var(--radius-lg);overflow:auto;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-lg);"><div class="spinner" style="width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;"></div></div>`;
    fetch(src).then(r => r.text()).then(text => {
      body.innerHTML = `<div style="background:var(--surface);width:100%;height:calc(100vh - 140px);padding:24px;border-radius:var(--radius-lg);overflow:auto;box-shadow:var(--shadow-lg);border:1px solid var(--border);">
        <pre style="white-space:pre-wrap; word-wrap:break-word; font-family:'Menlo','Monaco','Courier New',monospace; font-size:13px; line-height:1.6; margin:0; color:var(--text);">${escHtml(text)}</pre>
      </div>`;
    }).catch(() => {
      body.innerHTML = `<div style="color:var(--danger)">Failed to load text</div>`;
    });
  } else if (isZip) {
    body.innerHTML = `<div style="background:var(--surface);width:100%;max-width:800px;height:calc(100vh - 140px);padding:0;border-radius:var(--radius-lg);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);border:1px solid var(--border);">
      <div style="padding:16px 24px;border-bottom:1px solid var(--border);background:var(--surface-2);display:flex;align-items:center;gap:12px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted)"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        <span style="font-weight:600;font-size:14px;color:var(--text);">Archive Contents</span>
      </div>
      <div id="zip-contents" style="flex:1;overflow:auto;padding:12px;display:flex;align-items:center;justify-content:center;">
        <div class="spinner" style="width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;"></div>
      </div>
    </div>`;
    fetch(`/api/files/${file.id}/preview-zip`).then(r => r.json()).then(data => {
      if (!data.success) {
        document.getElementById('zip-contents').innerHTML = `<div style="color:var(--danger);padding:24px;text-align:center;">Failed to read ZIP. Maybe it is corrupted.</div>`;
        return;
      }
      let h = `<div style="display:flex;flex-direction:column;gap:4px;width:100%;height:100%;justify-content:flex-start;">`;
      if (data.entries.length === 0) h += `<div style="padding:24px;text-align:center;color:var(--text-muted);">Empty archive</div>`;

      const sortedEntries = data.entries.sort((a,b) => {
        if(a.isDirectory && !b.isDirectory) return -1;
        if(!a.isDirectory && b.isDirectory) return 1;
        return a.entryName.localeCompare(b.entryName);
      });

      sortedEntries.forEach(e => {
        const icon = e.isDirectory
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--blue);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
        h += `<div style="display:flex;align-items:center;padding:10px 16px;border-radius:6px;transition:background 0.2s;">
          <div style="display:flex;align-items:center;justify-content:center;margin-right:12px;">${icon}</div>
          <div style="flex:1;font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(e.entryName)}">${escHtml(e.entryName)}</div>
          <div style="font-size:12px;color:var(--text-muted);flex-shrink:0;margin-left:16px;">${e.isDirectory ? '--' : formatBytes(e.size)}</div>
        </div>`;
      });
      h += `</div>`;
      document.getElementById('zip-contents').innerHTML = h;
    }).catch(() => {
      document.getElementById('zip-contents').innerHTML = `<div style="color:var(--danger);padding:24px;text-align:center;">Network error while fetching archive.</div>`;
    });
  } else {
    body.innerHTML = `<div class="preview-unsupported">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div style="color:#fff;margin-top:12px;font-size:14px;">Preview not available</div>
      <div style="color:#aaa;font-size:12px;margin-top:4px;">${escHtml(file.name)}</div>
    </div>`;
  }
  overlay.classList.remove('hidden');
}
function closePreview() {
  document.getElementById('preview-overlay').classList.add('hidden');
  document.getElementById('preview-body').innerHTML = '';
}
document.getElementById('preview-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('preview-overlay')) closePreview();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePreview(); });

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

function updateViewButtons() {
  document.getElementById('view-grid').style.color = currentView === 'grid' ? 'var(--text)' : 'var(--text-muted)';
  document.getElementById('view-list').style.color = currentView === 'list' ? 'var(--text)' : 'var(--text-muted)';
}
const _origSetView = setView;
window.setView = function(v) { _origSetView(v); updateViewButtons(); };
updateViewButtons();

init();

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'open-profile') openProfileModal();
  else if (action === 'nav-root') navigateToRoot();
  else if (action === 'nav-shared') navigateShared();
  else if (action === 'nav-folder') loadFiles(target.dataset.id);
  else if (action === 'new-folder') showNewFolderModal();
  else if (action === 'set-view-grid') setView('grid');
  else if (action === 'set-view-list') setView('list');
  else if (action === 'close-folder-modal') document.getElementById('folder-modal').classList.add('hidden');
  else if (action === 'create-folder') createFolder();
  else if (action === 'close-rename-modal') document.getElementById('rename-modal').classList.add('hidden');
  else if (action === 'save-rename') doRename();
  else if (action === 'close-preview') closePreview();
  else if (action === 'close-profile') document.getElementById('profile-modal').classList.add('hidden');
  else if (action === 'save-profile') updateProfile();
  else if (action === 'ctx-more') {
    e.stopPropagation();
    openCtxMenu(e, target.dataset.id);
  }
});

document.addEventListener('contextmenu', (e) => {
  const fileEl = e.target.closest('.file-card, .file-row');
  if (fileEl) {
    e.preventDefault();
    openCtxMenu(e, fileEl.dataset.id);
  }
});

const sortSelect = document.getElementById('sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => handleSort(e.target.value));
}
