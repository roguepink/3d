// 保存(スマホの中のデータベース IndexedDB)
const DB = 'oheya3d', STORE = 'projects';
function open() { return new Promise((res, rej) => { const q = indexedDB.open(DB, 1); q.onupgradeneeded = () => { q.result.createObjectStore(STORE, { keyPath: 'id' }); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function tx(mode, fn) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => res(r && r.result !== undefined ? r.result : r); t.onerror = () => rej(t.error); }); }
export async function saveProject(p, id = 'current') { const rec = { id, name: p.name || '部屋', updated: Date.now(), data: JSON.stringify(p) }; await tx('readwrite', s => s.put(rec)); return rec; }
export async function loadProject(id = 'current') { const r = await tx('readonly', s => s.get(id)); return r && r.data ? JSON.parse(r.data) : null; }
export async function listProjects() { const all = await tx('readonly', s => s.getAll()); return (all || []).map(r => ({ id: r.id, name: r.name, updated: r.updated, size: r.data.length })).sort((a, b) => b.updated - a.updated); }
export async function deleteProject(id) { await tx('readwrite', s => s.delete(id)); }
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
export async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; } }
  download(blob, name); return 'downloaded';
}
