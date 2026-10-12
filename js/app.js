/* =========================================================
   Kiosk 설정
   ========================================================= */
const KIOSK = {
  IDLE_SECONDS: 60   // 이 시간(초) 동안 터치가 없으면 인트로로 돌아가고 입력값을 초기화
};

/* =========================================================
   Utils
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const won = n => n.toLocaleString('ko-KR') + '원';
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => !!a && !!b && a.toDateString() === b.toDateString();
const fmtDate = d => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;

const BOOK_DAYS = 7;                     // 오늘부터 7일간 예약 가능
const HOURS_WEEKDAY = [6, 23];           // 평일 06:00~23:00
const HOURS_WEEKEND = [9, 18];           // 토·일(공휴일) 09:00~18:00
const rangeOf = d => (d && isWeekend(d)) ? HOURS_WEEKEND : HOURS_WEEKDAY;

const ICON = {
  back: '<svg style="width:1.375rem;height:1.375rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  menu: '<svg style="width:1.375rem;height:1.375rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  user: '<svg style="width:0.875rem;height:0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  cal:  '<svg style="width:0.8125rem;height:0.8125rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" style="width:1rem;height:1rem" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  clock:'<svg style="width:0.8125rem;height:0.8125rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  seat: '<svg style="width:0.875rem;height:0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" style="width:1rem;height:0.75rem" rx="1"/><path d="M4 20h16"/></svg>',
  wonI: '<svg style="width:0.875rem;height:0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6l4 13 5-11 5 11 4-13M2 11h20M2 14h20"/></svg>',
  person:'<svg style="width:1.375rem;height:1.375rem" viewBox="0 0 24 24" fill="#1d2a44"><circle cx="12" cy="4.5" r="2.5"/><path d="M5 8h14v2.5h-5V22h-2.5v-6h-1v6H8V10.5H5z"/></svg>'
};

/* toast */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* confirm modal */
function confirmModal(title, rows) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML =
    `<dl>${rows.map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
     <p class="modal-desc">위 내용으로 예약하시겠습니까?</p>`;
  $('#modal').hidden = false;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-modal-cancel]')) $('#modal').hidden = true;
  if (e.target.closest('[data-modal-ok]')) { $('#modal').hidden = true; toast('예약이 완료되었습니다. (데모)'); }
});

/* =========================================================
   Components
   ========================================================= */
const appbar = title => `
  <header class="appbar">
    <button type="button" class="appbar-btn" data-back aria-label="뒤로가기">${ICON.back}</button>
    <h1>${title}</h1>
    <button type="button" class="appbar-btn" data-menu aria-label="전체메뉴">${ICON.menu}</button>
  </header>`;

const legend = (withOff = true) => `
  <div class="legend">
    <span><i class="lg booked"></i>예약</span>
    <span><i class="lg sel"></i>선택</span>
    ${withOff ? '<span><i class="lg off"></i>예약불가</span>' : ''}
  </div>`;

const infoBlock = (title, items) => `
  <div class="card info">
    <h3 class="info-title">${title}</h3>
    ${items.map(([t, b]) => `<div class="info-item"><h4>${t}</h4><div class="info-box">${b}</div></div>`).join('')}
  </div>`;

/* 단일 선택 버튼 그룹 */
function Options(el, items, { value = null, onChange = () => {} } = {}) {
  let v = value;
  const render = () => {
    el.innerHTML = items.map(it =>
      `<button type="button" class="opt ${it === v ? 'is-selected' : ''}" data-v="${it}" aria-pressed="${it === v}">${it}</button>`).join('');
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('.opt'); if (!b) return;
    v = b.dataset.v; render(); onChange(v);
  });
  render();
  return { get value() { return v; } };
}

/* 달력 : 오늘 ~ BOOK_DAYS 일만 선택 가능 */
function Calendar(el, { onSelect = () => {} } = {}) {
  const today = startOfDay(new Date());
  const last = addDays(today, BOOK_DAYS - 1);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = null;

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let html = `
      <div class="cal-nav">
        <button type="button" class="cal-arrow" data-dir="-1" aria-label="이전 달">◀</button>
        <strong>${y}.${pad(m + 1)}</strong>
        <button type="button" class="cal-arrow" data-dir="1" aria-label="다음 달">▶</button>
      </div>
      <div class="cal-week">${['일','월','화','수','목','금','토'].map((w, i) =>
        `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>
      <div class="cal-grid">`;
    for (let i = 0; i < firstDow; i++) html += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d), dow = date.getDay();
      const disabled = date < today || date > last;
      const cls = [dow === 0 ? 'sun' : dow === 6 ? 'sat' : '', sameDay(date, selected) ? 'is-selected' : ''].join(' ');
      html += `<button type="button" class="cal-day ${cls}" data-d="${d}" ${disabled ? 'disabled' : ''} aria-label="${m + 1}월 ${d}일">${d}</button>`;
    }
    el.innerHTML = html + '</div>';
  }
  el.addEventListener('click', e => {
    const nav = e.target.closest('[data-dir]');
    if (nav) { view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.dir), 1); render(); return; }
    const b = e.target.closest('.cal-day');
    if (b && !b.disabled) {
      selected = new Date(view.getFullYear(), view.getMonth(), Number(b.dataset.d));
      render(); onSelect(selected);
    }
  });
  render();
  return { get value() { return selected; } };
}

/* 시간 슬롯 : 이용시간(N시간) 만큼 연속 선택 */
function Slots(el, { getDate, getHours = () => 1, booked = () => [], label, labelFmt, onChange = () => {} }) {
  let start = null;
  function state(h) {
    const d = getDate();
    if (!d) return 'off';
    const now = new Date();
    if (sameDay(d, now) && h <= now.getHours()) return 'off';
    if (booked(d).includes(h)) return 'booked';
    return 'ok';
  }
  function render() {
    const d = getDate(), [open, close] = rangeOf(d), n = getHours();
    if (label) label.textContent = labelFmt(d, open, close);
    let html = '';
    for (let h = open; h < close; h++) {
      const s = state(h);
      const sel = start !== null && h >= start && h < start + n;
      html += `<button type="button" class="slot ${s !== 'ok' ? s : ''} ${sel ? 'is-selected' : ''}" data-h="${h}" ${s !== 'ok' ? 'disabled' : ''}>${pad(h)}:00 ~ ${pad(h + 1)}:00</button>`;
    }
    el.innerHTML = html;
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('.slot'); if (!b || b.disabled) return;
    const h = Number(b.dataset.h), n = getHours(), [, close] = rangeOf(getDate());
    for (let i = 0; i < n; i++) {
      if (h + i >= close || state(h + i) !== 'ok') { toast(`${pad(h)}:00부터 ${n}시간 연속 예약할 수 없습니다.`); return; }
    }
    start = h; render(); onChange();
  });
  render();
  return { render, reset() { start = null; render(); }, get value() { return start; } };
}

/* =========================================================
   이용안내 문구 (시안 기준)
   ========================================================= */
const INFO_COMMON = {
  hours: `- 평일 : 06:00~23:00(월요일~금요일)<br>- 토요일/일요일 (공휴일): 09:00~18:00<br>- 휴관일 : <span class="warn">1,3,5주 일요일</span>`,
  target: `- 전입 신고된 입주민만 가능<br>- 피트니스센터 방문 후<br><strong>주민운동시설 동의서 작성이 필수</strong>입니다.<br>- 동의서는 최초 1회만 작성하며,<br>미작성 시 시설 이용이 제한될 수 있습니다.`
};

const INFO_GOLF = infoBlock('이용안내', [
  ['시설소개', `<strong>[필독] 자동연장 및 해지/중도해약 안내</strong><br>- 별도의 해지 신청이 없을 경우 <strong>매월 자동연장됩니다</strong><br>- 다음 달 이용을 원하지 않으시는 경우 반드시 <strong>매월 23일부터 말일까지</strong> 해지 신청을 완료해 주시기 바랍니다.<br>- 해지 신청은 <strong>전화 또는 피트니스센터 방문</strong>을 통해서만 가능합니다.<br><span class="warn">※ 어플을 통한 해지는 불가합니다.</span><br>- 정해진 해지 기간이 지난 후에는 원칙적으로 취소 및 중도해약이 불가합니다.`],
  ['이용방법', `- 입주민 안면(얼굴) 인식 등록 후 이용<br>- 해지 신청: 매월 23일~말일(전화 또는 방문)<br><span class="warn">※ 해지 기간 내 신청하지 않을 경우 다음 달 자동연장됩니다.</span>`],
  ['운영시간', INFO_COMMON.hours],
  ['이용대상', INFO_COMMON.target],
  ['이용요금', `- 월권 등록(요금표 참조)<br>- 추가 1회 3,000원(이용시간 60분)<br>- 취소 및 환불 : 안내데스크 방문(전화 취소 불가)<br>- 레슨 상품은 별도 부과<br>(안내데스크 문의 및 신청 접수)`],
  ['요금부과', `- 결제금액은 세대 관리비로 부과되며, 결제내역은 APP에서 확인할 수 있습니다.`]
]);

const INFO_SCREEN = infoBlock('운영안내', [
  ['시설소개', `- 입주민 전용 스크린골프 클럽`],
  ['이용방법', `- 입주민 안면(얼굴) 인식 등록 후 이용<br>- 모바일 18홀 예약 인증 후 출입<br>- 9홀 이용 : 데스크 문의`],
  ['운영시간', INFO_COMMON.hours],
  ['이용대상', INFO_COMMON.target],
  ['이용요금', `- 18홀 : 1인 1회 10,000원(이용시간 60분)<br>- 9홀 이용 : 데스크 방문<br>- 취소 및 환불 : 1일전 모바일 취소 가능<br>/ 그외 안내데스크 방문<br>- 인원별 예약 방법<br>- 1인 이용: 1시간 선택<br>- 2인 이용: 2시간 선택 or<br>각각 1시간씩 이어서 선택<br>(예: 101호 6시 + 102호 7시)<br>- 연습이 필요하시면 10~20분 전<br>미리 방문해 주세요.`],
  ['요금부과', `<strong>[주의사항]</strong><br>- 18홀 이용시간은 1시간입니다.<br>다음 회원님을 위해 예약시간 초과 이용은<br>절대 불가합니다.<br>- 결제금액은 세대 관리비로 부과되며,<br>결제내역은 APP 또는 커뮤니티센터<br>안내데스크에서 확인가능`]
]);

/* 키즈카페 : 시안 없음 → 내용 입력 필요 */
const TODO = '<span class="todo">※ 시안 미제공 — 내용 입력 필요</span>';
const INFO_KIDS = infoBlock('운영안내', [
  ['시설소개', TODO], ['이용방법', TODO], ['운영시간', TODO], ['이용대상', TODO], ['이용요금', TODO]
]);

const INFO_READING = infoBlock('이용안내', [
  ['시설소개', `- 주민편의 독서실 문화시설`],
  ['이용방법', `- 입주민 안면(얼굴) 인식 등록 후 이용<br>- 모바일 앱 신규, 재등록, 일권<br>지정좌석 예약`],
  ['운영시간', '<span class="todo">※ 시안에서 잘려 확인 불가 — 내용 입력 필요</span>']
]);

/* =========================================================
   Page : 골프 타석 배정
   ========================================================= */
function initGolf() {
  const sec = $('#golf');
  sec.innerHTML = appbar('시설예약') + `
    <main class="page">
      <div class="page-head"><h2>골프 타석 배정</h2><p>타석과 상품, 이용시간을 차례로 선택해 주세요.</p></div>
      <div class="card"><h3 class="step"><b>1</b>타석을 선택하세요</h3><div class="bay-grid" data-bays></div></div>
      <div class="card"><h3 class="step"><b>2</b>상품을 선택하세요</h3><div class="opt-grid cols-2" data-products></div></div>
      <div class="card"><h3 class="step"><b>3</b>이용시간을 선택하세요</h3>${legend()}<p class="op-hours" data-op></p><div class="slot-grid" data-slots></div></div>
      ${INFO_GOLF}
    </main>
    <div class="bottom-bar"><button type="button" class="btn-submit" data-submit>골프타석예약</button></div>`;

  // 타석 데이터 (9번 = 좌타석, 10~15번 = GDR)
  const BAYS = Array.from({ length: 15 }, (_, i) => ({ no: i + 1, tag: i + 1 === 9 ? '좌' : i + 1 >= 10 ? 'GDR' : '' }));
  let bay = null;
  const bayEl = $('[data-bays]', sec);
  const nextTime = () => { const h = new Date().getHours() + 1; return h < HOURS_WEEKDAY[1] ? `${pad(h)}:00` : '마감'; };
  const renderBays = () => {
    const t = nextTime();
    bayEl.innerHTML = BAYS.map(b => `
      <button type="button" class="bay ${b.no === bay ? 'is-selected' : ''}" data-bay="${b.no}" aria-pressed="${b.no === bay}">
        ${b.tag ? `<em class="tag">${b.tag}</em>` : ''}<strong>${b.no}번</strong><span>${t}</span>
      </button>`).join('');
  };
  bayEl.addEventListener('click', e => {
    const b = e.target.closest('.bay'); if (!b) return;
    bay = Number(b.dataset.bay); renderBays();
  });
  renderBays();

  const product = Options($('[data-products]', sec), ['골프60분']);
  const today = () => startOfDay(new Date());
  const slots = Slots($('[data-slots]', sec), {
    getDate: today,
    label: $('[data-op]', sec),
    labelFmt: (d, o, c) => `운영시간 : ${pad(o)}:00~${pad(c)}:00`
  });

  $('[data-submit]', sec).addEventListener('click', () => {
    if (!bay) return toast('타석을 선택해 주세요.');
    if (!product.value) return toast('상품을 선택해 주세요.');
    if (slots.value === null) return toast('이용시간을 선택해 주세요.');
    confirmModal('골프 타석 배정 확인', [
      ['타석', `${bay}번`], ['상품', product.value], ['날짜', fmtDate(today())],
      ['이용시간', `${pad(slots.value)}:00 ~ ${pad(slots.value + 1)}:00`]
    ]);
  });
}

/* =========================================================
   Page : 룸 예약 (스크린골프 / 키즈카페 공통 템플릿)
   ========================================================= */
function initRoomPage(cfg) {
  const sec = $('#' + cfg.id);
  sec.innerHTML = appbar('시설예약') + `
    <main class="page">
      <div class="page-head"><h2>${cfg.title}</h2><p>${cfg.desc}</p></div>
      <div class="card"><h3 class="step"><b>1</b>룸을 선택하세요</h3><div class="opt-grid cols-2" data-rooms></div></div>
      <div class="card"><h3 class="step"><b>2</b>시간을 선택하세요</h3><div class="opt-grid cols-4" data-hours></div></div>
      <div class="card"><h3 class="step"><b>3</b>날짜를 선택하세요</h3><div data-cal></div></div>
      <div class="card"><h3 class="step"><b>4</b>이용시간</h3>${legend()}<p class="op-hours" data-op></p><div class="slot-grid" data-slots></div></div>
      ${cfg.info}
    </main>
    <div class="bottom-bar"><button type="button" class="btn-submit" data-submit>${cfg.submit}</button></div>`;

  let date = null, slots;
  const rooms = Options($('[data-rooms]', sec), cfg.rooms, { onChange: () => slots.reset() });
  const hrs = Options($('[data-hours]', sec), ['1시간', '2시간', '3시간', '4시간'], { value: '1시간', onChange: () => slots.reset() });
  Calendar($('[data-cal]', sec), { onSelect: d => { date = d; slots.reset(); } });
  slots = Slots($('[data-slots]', sec), {
    getDate: () => date,
    getHours: () => parseInt(hrs.value, 10),
    booked: cfg.booked,
    label: $('[data-op]', sec),
    labelFmt: (d, o, c) => !d ? '날짜를 먼저 선택해 주세요.' : `${isWeekend(d) ? '토·일' : '월~금'} ${pad(o)}:00-${pad(c)}:00`
  });

  $('[data-submit]', sec).addEventListener('click', () => {
    if (!rooms.value) return toast('룸을 선택해 주세요.');
    if (!date) return toast('날짜를 선택해 주세요.');
    if (slots.value === null) return toast('이용시간을 선택해 주세요.');
    const n = parseInt(hrs.value, 10);
    confirmModal(cfg.title + ' 확인', [
      ['룸', rooms.value], ['날짜', fmtDate(date)],
      ['이용시간', `${pad(slots.value)}:00 ~ ${pad(slots.value + n)}:00 (${n}시간)`]
    ]);
  });
}

/* =========================================================
   Page : 독서실 일권 예약
   ========================================================= */
function initReading() {
  const sec = $('#reading');
  // 배치도 (시안 좌표 그대로) — 0 은 빈칸
  const LEFT  = [[[12,13,14],[15,16,17]], [[18,19,20],[21,22,23]], [[24,25,26],[27,28,29]], [[30,31,32]]];
  const RIGHT = [[[11,10],[9,8]], [[0,7],[6,5]], [[4,3],[2,1]]];
  const desk = g => `<div class="desk">${g.map((row, i) =>
    `<div class="desk-row">${row.map(n => n
      ? `<button type="button" class="mseat" data-seat="${n}" aria-label="${n}번 좌석">${n}</button>`
      : '<span class="mseat empty"></span>').join('')}</div>${i === 0 && g.length > 1 ? '<i class="desk-line"></i>' : ''}`).join('')}</div>`;

  sec.innerHTML = appbar('시설예약') + `
    <main class="page">
      <div class="page-head"><h2>독서실 일권 예약</h2><p>독서실과 날짜를 고른 뒤 배치도를 보고 좌석을 선택해 주세요.</p></div>
      <div class="card"><h3 class="step"><b>1</b>독서실 선택</h3><div class="opt-grid cols-2" data-rooms></div></div>
      <div class="card"><h3 class="step"><b>2</b>날짜 선택</h3><div data-cal></div></div>
      <div class="card"><h3 class="step"><b>3</b>독서실 배치도</h3>
        <div class="seatmap">
          <div class="map-col">${LEFT.map(desk).join('')}</div>
          <div class="map-col">${RIGHT.map(desk).join('')}</div>
          <span class="exit-tag">출입구</span>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center"><h3 class="step" style="margin:0"><b>4</b>독서실 좌석선택</h3>${legend(false)}</div>
        <div data-seats></div>
      </div>
      ${INFO_READING}
    </main>
    <div class="bottom-bar"><button type="button" class="btn-submit" data-submit>다음</button></div>`;

  const BOOKED = [3, 8, 15, 22, 27];   // 샘플 데이터 (API 연동 시 교체)
  let date = null, seat = null;
  const room = Options($('[data-rooms]', sec), ['독서실남자'], { onChange: () => { seat = null; paint(); } });
  Calendar($('[data-cal]', sec), { onSelect: d => { date = d; seat = null; paint(); } });

  function paint() {
    const ready = room.value && date;
    $$('.mseat[data-seat]', sec).forEach(s => {
      const n = Number(s.dataset.seat);
      s.classList.toggle('booked', !!ready && BOOKED.includes(n));
      s.classList.toggle('is-selected', n === seat);
    });
    $('[data-seats]', sec).innerHTML = ready
      ? `<div class="seat-grid">${Array.from({ length: 32 }, (_, i) => i + 1).map(n => {
          const b = BOOKED.includes(n);
          return `<button type="button" class="seat ${b ? 'booked' : ''} ${n === seat ? 'is-selected' : ''}" data-pick="${n}" ${b ? 'disabled' : ''}>${n}</button>`;
        }).join('')}</div>`
      : '<p class="placeholder">독서실과 날짜를 선택하면 표시됩니다.</p>';
  }
  sec.addEventListener('click', e => {
    const t = e.target.closest('[data-pick], .mseat[data-seat]'); if (!t) return;
    const n = Number(t.dataset.pick || t.dataset.seat);
    if (!(room.value && date)) return toast('독서실과 날짜를 먼저 선택해 주세요.');
    if (BOOKED.includes(n)) return toast('이미 예약된 좌석입니다.');
    seat = n; paint();
  });
  paint();

  $('[data-submit]', sec).addEventListener('click', () => {
    if (!room.value) return toast('독서실을 선택해 주세요.');
    if (!date) return toast('날짜를 선택해 주세요.');
    if (!seat) return toast('좌석을 선택해 주세요.');
    confirmModal('독서실 일권 예약 확인', [['독서실', room.value], ['날짜', fmtDate(date)], ['좌석', `${seat}번`]]);
  });
}

/* =========================================================
   Page : 이용내역 (결제 / 수강 / 이용 / 골프)
   ========================================================= */
// 샘플 데이터 (시안 기준, API 연동 시 교체)
const HISTORY = {
  pay: [],
  course: [
    { path: ['골프', '스크린타석', '1개월'], status: '수강종료', period: '26/08/01~26/08/31', amount: 20000, user: '테스트홍' },
    { path: ['헬스', '1개월'],               status: '수강종료', period: '26/07/01~26/07/31', amount: 12000, user: '테스트홍' }
  ],
  usage: [
    { no: 2, name: '독서실월권',  price: 30000, user: '테스트홍', period: '26/07/01~26/07/31', time: '06:00 ~ 02:00', seat: '1' },
    { no: 2, name: '게스트룸1박', price: 30000, user: '테스트홍', period: '26/06/28~26/06/29', time: '15:00 ~ 11:00', seat: '1' },
    { no: 2, name: '게스트룸1박', price: 30000, user: '테스트홍', period: '26/06/27~26/06/28', time: '15:00 ~ 11:00', seat: '1' },
    { no: 2, name: '독서실일권',  price: 2000,  user: '테스트홍', period: '-', time: '-', seat: '-' }
  ]
};
const TABS = [['pay', '결제내역'], ['course', '수강내역'], ['usage', '이용내역'], ['golf', '골프내역']];
const NOW = new Date();
let payMonth = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
let golfYear = NOW.getFullYear();
let openMonth = NOW.getMonth() + 1;
let currentTab = 'usage';

const PANELS = {
  pay() {
    const y = payMonth.getFullYear(), m = payMonth.getMonth();
    const isCur = y === NOW.getFullYear() && m === NOW.getMonth();
    const total = HISTORY.pay.reduce((s, p) => s + p.amount, 0);
    return `
      <div class="month-nav">
        <button type="button" data-act="pay-prev" aria-label="이전 달">◀</button>
        <span>${y}년 ${pad(m + 1)}월</span>
        <button type="button" data-act="pay-next" aria-label="다음 달" ${isCur ? 'disabled' : ''}>▶</button>
      </div>
      <div class="sec-head" style="margin-top:1rem"><h2>결제 요약</h2></div>
      ${HISTORY.pay.length ? '' : '<div class="empty">등록된 내역이 없습니다.</div>'}
      <div class="total"><span>₩ 총 결제금액</span><strong>${won(total)}</strong></div>
      <p class="note"><b>※</b> 결제취소 및 영수증발급은 <b>고객센터</b>를 통해 문의해주세요.</p>`;
  },
  course() {
    const list = HISTORY.course;
    return `
      <div class="sec-head"><h2>수강내역</h2><span class="count">총 ${list.length}건</span></div>
      ${list.map(c => `
        <article class="hcard">
          <div class="hcard-head">
            <span class="course-icon" aria-hidden="true">${ICON.person}</span>
            <strong class="course-path">${c.path.join(' <i>▶</i> ')}</strong>
            <span class="status">${c.status}</span>
          </div>
          <dl>
            <div class="row"><dt>${ICON.cal} 이용기간</dt><dd>${c.period}</dd></div>
            <div class="row"><dt>${ICON.wonI} 이용금액</dt><dd>${won(c.amount)}</dd></div>
            <div class="row"><dt>${ICON.user} 이용자</dt><dd>${c.user}</dd></div>
          </dl>
        </article>`).join('')}
      <p class="note"><b>※</b> 수강취소 및 변경은 <b>고객센터</b>를 통해 문의해주세요.</p>`;
  },
  usage() {
    const list = HISTORY.usage;
    return `
      <div class="sec-head"><h2>이용내역</h2><span class="count">총 ${list.length}건</span></div>
      ${list.map(u => `
        <article class="hcard">
          <div class="hcard-head"><span class="num">${u.no}</span><strong>${u.name}</strong><span class="price">${won(u.price)}</span></div>
          <div class="row"><dt>${ICON.user} 이용자</dt><dd>${u.user}</dd></div>
          <div class="pills"><span class="pill">${ICON.cal} ${u.period}</span><span class="pill">${ICON.clock} ${u.time}</span></div>
          <div class="row"><dt>${ICON.seat} 좌석/룸</dt><dd>${u.seat}</dd></div>
          <div class="row"><dt>${ICON.wonI} 결제금액</dt><dd>${won(u.price)}</dd></div>
        </article>`).join('')}`;
  },
  golf() {
    const cy = NOW.getFullYear();
    const maxM = golfYear === cy ? NOW.getMonth() + 1 : 12;
    let html = `
      <div class="year-nav">
        <button type="button" class="ybtn" data-act="year-prev" aria-label="이전 해">◀</button>
        <span>${golfYear}년</span>
        <button type="button" class="ybtn" data-act="year-next" aria-label="다음 해" ${golfYear >= cy ? 'disabled' : ''}>▶</button>
      </div>`;
    for (let m = maxM; m >= 1; m--) {
      const open = openMonth === m;
      html += `<button type="button" class="mbar" data-act="month" data-m="${m}" aria-expanded="${open}">${golfYear}년 ${pad(m)}월</button>
               ${open ? '<div class="mbody">› 등록된 예약이 없습니다</div>' : ''}`;
    }
    return html;
  }
};

function initHistory() {
  const sec = $('#history');
  sec.innerHTML = appbar('시설예약') + `
    <nav class="tabs" role="tablist">
      ${TABS.map(([k, t]) => `<button type="button" class="tab" role="tab" data-tab="${k}">${t}</button>`).join('')}
    </nav>
    <main class="hist" data-panel role="tabpanel"></main>`;

  sec.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { history.replaceState(null, '', '#history/' + tab.dataset.tab); renderTab(tab.dataset.tab); return; }
    const act = e.target.closest('[data-act]'); if (!act || act.disabled) return;
    const a = act.dataset.act;
    if (a === 'pay-prev') payMonth = new Date(payMonth.getFullYear(), payMonth.getMonth() - 1, 1);
    if (a === 'pay-next') payMonth = new Date(payMonth.getFullYear(), payMonth.getMonth() + 1, 1);
    if (a === 'year-prev') { golfYear--; openMonth = null; }
    if (a === 'year-next') { golfYear++; openMonth = null; }
    if (a === 'month') { const m = Number(act.dataset.m); openMonth = openMonth === m ? null : m; }
    renderTab(currentTab);
  });
}

function renderTab(key) {
  if (!PANELS[key]) key = 'usage';
  currentTab = key;
  const sec = $('#history');
  $$('.tab', sec).forEach(t => {
    const on = t.dataset.tab === key;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on);
  });
  const panel = $('[data-panel]', sec);
  panel.className = 'hist' + (key === 'golf' ? ' golf-hist' : '');
  panel.innerHTML = PANELS[key]();
}

/* =========================================================
   Router / Global events
   ========================================================= */
const ROUTES = ['intro', 'home', 'golf', 'screen', 'kids', 'reading', 'history'];
function route() {
  const [id, param] = (location.hash.slice(1) || 'intro').split('/');
  const target = ROUTES.includes(id) ? id : 'intro';
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === target));
  if (target === 'history') renderTab(param || 'usage');
  $('#drawer').hidden = true;
  $('#modal').hidden = true;
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) location.hash = 'home';
  if (e.target.closest('[data-menu]')) $('#drawer').hidden = false;
  if (e.target.closest('[data-close]')) $('#drawer').hidden = true;
  if (e.target.closest('[data-soon]')) toast('준비 중인 서비스입니다.');
  if (e.target.closest('[data-top]')) window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#drawer').hidden = true; $('#modal').hidden = true; }
});

/* init */
initGolf();
initRoomPage({
  id: 'screen', title: '스크린골프 예약', desc: '룸과 시간, 날짜를 차례로 선택한 뒤 이용시간을 골라 주세요.',
  rooms: ['1룸', '2룸'], submit: '등록', info: INFO_SCREEN,
  booked: d => d.getDate() % 2 ? [19] : [10, 20]          // 샘플 예약 데이터
});
initRoomPage({
  id: 'kids', title: '키즈카페 예약', desc: '룸과 시간, 날짜를 차례로 선택한 뒤 이용시간을 골라 주세요.',
  rooms: ['1룸', '2룸'], submit: '등록', info: INFO_KIDS,   // 룸 구성 확인 필요
  booked: () => [14]                                         // 샘플 예약 데이터
});
initReading();
initHistory();
window.addEventListener('hashchange', route);
route();

/* =========================================================
   Kiosk : 무입력 시 인트로 복귀
   ========================================================= */
let idleTimer;
function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(goIntro, KIOSK.IDLE_SECONDS * 1000);
}
function goIntro() {
  if ((location.hash.slice(1) || 'intro') === 'intro') { resetIdle(); return; }
  // 해시를 인트로로 바꾼 뒤 새로고침 → 선택했던 값까지 모두 초기화
  location.replace(location.pathname + location.search + '#intro');
  location.reload();
}
['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(ev =>
  window.addEventListener(ev, resetIdle, { passive: true }));
resetIdle();
