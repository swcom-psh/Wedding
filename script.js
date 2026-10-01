(() => {
  // ===== 설정 (여기만 고치면 돼요) =====
  const CFG = {
    date: new Date('2027-02-13T12:10:00+09:00'),
    venueName: '원주 빌라드아모르',           // 지도 검색어로도 사용
    uploadEndpoint: '',                // 구글 앱스 스크립트 웹 앱 URL (비우면 업로드 버튼은 '준비 중')
    uploadToken: '',                   // apps-script/Code.gs 의 TOKEN 과 같은 값
    uploadMax: 10,                     // 한 번에 올릴 수 있는 최대 장수
    naverMapKey: '',                   // 네이버 지도 API 키(ncpKeyId). 비우면 구글 지도로 표시
    address: '강원 원주시 북원로 2888',
    bgm: '',                           // 배경음악 파일 경로 (예: 'audio/bgm.mp3')
  };

  // ===== 갤러리 =====
  const photos = ['1231','0560','1337','1430','1514','0005','1804','1690','1857','1897','0537'];
  const stamps = document.getElementById('stamps');
  photos.forEach((n, i) => {
    const d = document.createElement('div');
    d.className = 'stamp';
    d.style.setProperty('--r', ((i * 37) % 5 - 2) * .8 + 'deg');
    d.innerHTML = `<img loading="lazy" src="img/ace_${n}.jpg" alt="웨딩 사진 ${i + 1}">`;
    d.addEventListener('click', () => openLb(i));
    stamps.appendChild(d);
  });

  // ===== 크게 보기 (확대/축소는 막음) =====
  const lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img'), lbCount = lb.querySelector('.lb-count');
  let cur = 0;
  function showLb(i){
    cur = (i + photos.length) % photos.length;
    lbImg.src = `img/ace_${photos[cur]}.jpg`;
    lbCount.textContent = `${cur + 1} / ${photos.length}`;
  }
  function openLb(i){ showLb(i); lb.hidden = false; document.body.classList.add('lb-open'); }
  function closeLb(){ lb.hidden = true; document.body.classList.remove('lb-open'); }
  lb.querySelector('.lb-close').addEventListener('click', (e) => { e.stopPropagation(); closeLb(); });
  lb.querySelector('.lb-prev').addEventListener('click', (e) => { e.stopPropagation(); showLb(cur - 1); });
  lb.querySelector('.lb-next').addEventListener('click', (e) => { e.stopPropagation(); showLb(cur + 1); });
  lb.addEventListener('click', closeLb);
  // 핀치 확대 / 더블탭 확대 차단 (iOS Safari 포함)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => lb.addEventListener(t, e => e.preventDefault()));
  lb.addEventListener('dblclick', e => e.preventDefault());
  lb.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  let lx = null;
  lb.addEventListener('touchstart', e => { lx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (lx === null) return;
    const dx = e.changedTouches[0].clientX - lx; lx = null;
    if (Math.abs(dx) > 50) { e.preventDefault(); showLb(cur + (dx < 0 ? 1 : -1)); }
  });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') showLb(cur - 1);
    if (e.key === 'ArrowRight') showLb(cur + 1);
  });

  // ===== 달력 =====
  const cal = document.getElementById('cal');
  const y = CFG.date.getFullYear(), m = CFG.date.getMonth(), day = CFG.date.getDate();
  const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
  let html = `<h3>${m + 1}월</h3><table><tr>${'일월화수목금토'.split('').map(c => `<th>${c}</th>`).join('')}</tr><tr>`;
  for (let i = 0; i < first; i++) html += '<td></td>';
  for (let d = 1; d <= last; d++) {
    if ((first + d - 1) % 7 === 0 && d > 1) html += '</tr><tr>';
    html += `<td class="${d === day ? 'd' : ''}">${d}</td>`;
  }
  cal.innerHTML = html + '</tr></table>';

  // ===== 카운트다운 =====
  const $ = (id) => document.getElementById(id), pad = (n) => String(n).padStart(2, '0');
  function tick(){
    let diff = CFG.date - Date.now();
    if (diff < 0) diff = 0;
    const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, mi = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
    $('cd-d').textContent = pad(d); $('cd-h').textContent = pad(h); $('cd-m').textContent = pad(mi); $('cd-s').textContent = pad(s);
    $('dday').innerHTML = diff ? `상현 ♥ 가경의 결혼식이 <strong>${d}일</strong> 남았습니다.` : '오늘, 결혼합니다 ♥';
  }
  tick(); setInterval(tick, 1000);

  const toast = $('toast');
  // ===== 지도 링크 =====
  const q = encodeURIComponent(CFG.venueName);
  $('lk-naver').href = `https://map.naver.com/p/search/${q}`;
  $('lk-tmap').href = '#';
  $('lk-tmap').addEventListener('click', (e) => {
    e.preventDefault();
    const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
    if (!ios && !android) { toast.textContent = 'T MAP은 모바일에서 열 수 있어요'; toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { toast.hidden = true; toast.textContent = '복사되었어요'; }, 2000); return; }
    const t = Date.now();
    location.href = `tmap://search?name=${q}`;
    setTimeout(() => { if (!document.hidden && Date.now() - t < 2500) location.href = ios ? 'https://apps.apple.com/kr/app/id431589174' : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku'; }, 1500);
  });
  $('lk-google').href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  // ===== 네이버 지도 (키가 있을 때만) =====
  if (CFG.naverMapKey) {
    const mapBox = $('map');
    const sc = document.createElement('script');
    sc.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CFG.naverMapKey}&submodules=geocoder`;
    sc.onload = () => {
      naver.maps.Service.geocode({ query: CFG.address }, (status, res) => {
        if (status !== naver.maps.Service.Status.OK || !res.v2.addresses.length) return;
        const a = res.v2.addresses[0], pos = new naver.maps.LatLng(a.y, a.x);
        mapBox.innerHTML = '';
        const map = new naver.maps.Map(mapBox, { center: pos, zoom: 16, scaleControl: false, mapDataControl: false });
        new naver.maps.Marker({ position: pos, map });
      });
    };
    document.head.appendChild(sc);
  }
  // ===== 하객 사진 업로드 (구글 드라이브로 자동 전송) =====
  const upBtn = $('upload-btn'), upInput = $('upload-input'), upStatus = $('upload-status'), upName = $('upload-name');
  const say = (msg, err) => { upStatus.textContent = msg; upStatus.classList.toggle('err', !!err); };
  // 긴 변 2400px, JPEG로 줄여서 전송 (폰 사진 용량 줄이기)
  async function shrink(file){
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .88));
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  }
  upBtn.addEventListener('click', () => {
    if (!CFG.uploadEndpoint) { say('사진 업로드는 곧 열릴 예정이에요'); return; }
    upInput.click();
  });
  upInput.addEventListener('change', async () => {
    let files = [...upInput.files].filter(f => f.type.startsWith('image/'));
    upInput.value = '';
    if (!files.length) return;
    if (files.length > CFG.uploadMax) { files = files.slice(0, CFG.uploadMax); say(`한 번에 최대 ${CFG.uploadMax}장까지 올릴 수 있어요. 앞의 ${CFG.uploadMax}장만 올릴게요.`); await new Promise(r => setTimeout(r, 1800)); }
    upBtn.disabled = true;
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      say(`업로드 중... (${i + 1}/${files.length})`);
      try {
        const data = await shrink(files[i]);
        const res = await fetch(CFG.uploadEndpoint, { method: 'POST', body: JSON.stringify({ token: CFG.uploadToken, name: upName.value.trim(), index: i + 1, mime: 'image/jpeg', data }) });
        const j = await res.json();
        j.ok ? ok++ : fail++;
      } catch (e) { fail++; }
    }
    upBtn.disabled = false;
    if (fail) say(`${ok}장 업로드 완료, ${fail}장은 실패했어요. 잠시 후 다시 시도해 주세요.`, true);
    else say(`${ok}장 업로드 완료! 소중한 사진 감사합니다 ♥`);
  });

  // ===== 슬라이더 =====
  const slider = $('slider'), track = slider.querySelector('.track'), n = track.children.length, dots = $('dots');
  let idx = 0;
  for (let i = 0; i < n; i++) dots.appendChild(document.createElement('i'));
  function go(i){
    idx = (i + n) % n;
    track.style.transform = `translateX(${-idx * 100}%)`;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === idx));
  }
  slider.querySelector('.prev').onclick = () => go(idx - 1);
  slider.querySelector('.next').onclick = () => go(idx + 1);
  let sx = null;
  track.addEventListener('touchstart', e => sx = e.touches[0].clientX, { passive: true });
  track.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); sx = null; });
  go(0);

  // ===== 계좌 복사 =====
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) {}
    toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => toast.hidden = true, 1600);
  }));

  // ===== 스크롤 등장 =====
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ===== BGM (파일 지정 시에만 버튼 표시) =====
  if (CFG.bgm) {
    const a = $('bgm'), btn = $('bgm-btn');
    a.src = CFG.bgm; btn.hidden = false;
    btn.addEventListener('click', () => { if (a.paused) { a.play(); btn.classList.add('on'); } else { a.pause(); btn.classList.remove('on'); } });
  }
})();
