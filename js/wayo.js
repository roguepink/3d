// 和と洋の分け方:家の雰囲気(和風の家/洋風の家/和洋まざり)・部屋(和室/洋室)・物と材料の印(和/洋/どちらでも)
// 印はここにまとめる(各カタログのファイルは触らない)。印のない物は 'both'(どちらでも)。
// 一覧は「部屋に合う物+どちらでも」を先に、反対側は「ほかも見る」にまとめる(隠しきらない)。
import { catalogEntry } from './items.js';

export const WAYO = {
  // 置く物(カテゴリ「和の家具」の物は、ここに無くても全部 'wa')
  items: {
    // 窓まわり
    shoji: 'wa', roller: 'yo', shade: 'yo', pleats: 'yo', blind: 'yo', vblind: 'yo',
    // 照明
    chandelier: 'yo', downlight: 'yo', wallLight: 'yo', floorLamp: 'yo',
    // 家具
    bed: 'yo', sofa: 'yo', chair: 'yo', table: 'yo', counter: 'yo', closet: 'yo', standMirror: 'yo', coatRack: 'yo',
    // 壁かざり
    tv: 'yo', niche: 'yo', stringLights: 'yo', wallShelf: 'yo',
    // みどり(昭和の家にもあった ゴムの木・幸福の木・パキラ・サンスベリア・ガジュマル・丸い木は どちらでも)
    monstera: 'yo', umbellata: 'yo', olive: 'yo', strelitzia: 'yo', everfresh: 'yo',
  },
  floor: {
    tatami: 'wa', tatami_old: 'wa', tokoita: 'wa', engawa: 'wa', araidashi: 'wa', enkou_hinoki: 'wa', enkou_sugi: 'wa', uzukuri_sugi: 'wa', jiita_matsu: 'wa', keyaki: 'wa',
    oak: 'yo', walnut: 'yo', whiteash: 'yo', herring: 'yo', grayoak: 'yo', marble: 'yo', concrete: 'yo',
    tile_w: 'yo', tile_g: 'yo', tile_t: 'yo', tile_k: 'yo', carpet_b: 'yo', carpet_g: 'yo', carpet_w: 'yo',
    ub_floor_g: 'yo', ub_floor_b: 'yo', ub_floor_w: 'yo', // 浴室(ユニットバス)は洋室あつかい
  },
  wall: {
    juraku: 'wa', sunakabe_g: 'wa', sunakabe_b: 'wa', plaster: 'wa', sao: 'wa', sao_light: 'wa',
    wp_white: 'yo', wp_warm: 'yo', wp_gray: 'yo', wp_tex: 'yo', wp_stripe: 'yo', wp_blue: 'yo', wp_green: 'yo', wp_navy: 'yo', wp_floral: 'yo',
    wp_beige: 'yo', wp_greige: 'yo', wp_pink: 'yo', wp_dark: 'yo', wp_wood: 'yo', panel: 'yo', brick: 'yo', brick_w: 'yo', concrete_w: 'yo',
    ub_white: 'yo', ub_beige: 'yo', ub_stone: 'yo', ub_wood: 'yo', ub_navy: 'yo', ub_black: 'yo', ub_ceil: 'yo',
  },
  // 天井:ここに書いた id はそのまま。書いていない id は ceilingWayo のきまり(sao… / tenjo_… は和、ほかは壁の印)
  ceiling: {},
  // 戸の種類(間取りの「戸の種類」)
  door: { fusuma: 'wa', shoji: 'wa', koshi: 'wa', glassdoor: 'wa', swing: 'yo', slide: 'both' },
};

// 天井専用の材料(SURFACE_LIB.wall に入っているが、壁タブには出さない)。和室の天井タブではこの順で先頭に
export const CEIL_ORDER = ['sao', 'sao_fukiyose', 'tenjo_mesukashi', 'tenjo_shikime', 'tenjo_ajiro', 'tenjo_gou', 'tenjo_kogumi', 'tenjo_oriage', 'tenjo_yoshizu', 'tenjo_mokume'];
export function isCeilOnly(id) { return /^(sao|tenjo_)/.test(id || ''); }
// 天井専用の物を先に(CEIL_ORDER の順、知らない id はそのあと)、ほかはもとの順
export function ceilFirst(list, getId = x => x.id) {
  const rank = x => { const i = CEIL_ORDER.indexOf(getId(x)); return i >= 0 ? i : isCeilOnly(getId(x)) ? CEIL_ORDER.length : CEIL_ORDER.length + 1; };
  return list.map((x, i) => [x, i]).sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1])).map(x => x[0]);
}

// 天井の材料の印(親が textures.js に天井の材料を足しても、名前のきまりで分かる)
export function ceilingWayo(id) {
  if (!id) return 'both';
  if (WAYO.ceiling[id]) return WAYO.ceiling[id];
  if (/^(sao|tenjo_)/.test(id)) return 'wa';
  return WAYO.wall[id] || 'both';
}

// 印を調べる。kind = 'items' | 'floor' | 'wall' | 'ceiling' | 'door'
export function wayoOf(kind, id) {
  if (kind === 'ceiling') return ceilingWayo(id);
  if (kind === 'items') { if (WAYO.items[id]) return WAYO.items[id]; const e = catalogEntry(id); return e && e.cat === '和の家具' ? 'wa' : 'both'; }
  return (WAYO[kind] && WAYO[kind][id]) || 'both';
}

// 家の雰囲気(古い保存は 'mix')
export const HOUSE_MOODS = [['mix', '和洋まざり'], ['wa', '和風の家'], ['yo', '洋風の家']];
export function houseMood(project) { const v = project && project.settings && project.settings.wayo; return v === 'wa' || v === 'yo' ? v : 'mix'; }
export function houseMoodName(project) { const m = houseMood(project); return HOUSE_MOODS.find(x => x[0] === m)[1]; }

// 部屋が和室か:room.wa があれば和室。room.yo(洋室と決めた印)があれば洋室。
// どちらもなければ、和風の家なら和室・それ以外は洋室(古い保存も今までどおり)
export function roomIsWa(room, project) {
  if (!room) return false;
  if (room.wa) return true;
  if (room.yo) return false;
  return houseMood(project) === 'wa';
}

// 一覧を「合う物+どちらでも」(main)と「反対側」(more)に分ける。合う物を先に、あとはもとの順。
// getId は一覧の1つから id を取る関数
export function sortByWayo(list, isWa, kind, getId = x => x.id) {
  const want = isWa ? 'wa' : 'yo', other = isWa ? 'yo' : 'wa';
  const main = [], both = [], more = [];
  for (const x of list) { const w = wayoOf(kind, getId(x)); if (w === other) more.push(x); else if (w === want) main.push(x); else both.push(x); }
  return { main: main.concat(both), more };
}

// 新しい部屋の既定の床・壁・天井
export const WA_FINISH = { floor: { lib: 'tatami' }, wall: { lib: 'juraku' }, ceiling: { lib: 'sao' } };
export const YO_FINISH = { floor: { lib: 'oak' }, wall: { lib: 'wp_white' }, ceiling: { color: '#f7f6f2' } };

// 部屋の床・壁・天井が、和(isWa=true)/洋 にそろっているか(反対側の物が1つでもあれば false)
export function finishMatches(room, isWa) {
  const other = isWa ? 'yo' : 'wa';
  const f = room.floor && room.floor.lib ? wayoOf('floor', room.floor.lib) : (isWa ? 'yo' : 'both');
  if (f === other) return false;
  const n = (room.poly || []).length || 4; const walls = room.walls || {};
  for (let e = 0; e < n; e++) { const s = walls[e]; const w = s && s.lib ? wayoOf('wall', s.lib) : (isWa ? 'yo' : 'both'); if (w === other) return false; }
  const c = room.ceiling && room.ceiling.lib ? ceilingWayo(room.ceiling.lib) : (isWa ? 'yo' : 'both');
  return c !== other;
}

// 部屋の床・壁・天井を和/洋の既定にする
export function applyFinish(room, isWa) {
  const F = isWa ? WA_FINISH : YO_FINISH; const n = (room.poly || []).length || 4;
  room.floor = { ...F.floor }; room.ceiling = { ...F.ceiling }; room.walls = room.walls || {};
  for (let e = 0; e < n; e++) room.walls[e] = { ...F.wall };
}

// 部屋を和室/洋室にする(作りの印だけ。床・壁・天井は変えない)
export function setRoomWa(room, isWa, project) {
  if (isWa) { room.wa = room.wa || { wood: 'wood_medium' }; delete room.yo; }
  else { delete room.wa; if (houseMood(project) === 'wa') room.yo = 1; else delete room.yo; }
}
