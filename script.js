(() => {
  // ===== 설정 (여기만 고치면 돼요) =====
  const CFG = {
    date: new Date('2027-02-13T12:10:00+09:00'),
    venueName: '원주 빌라드아모르',           // 지도 검색어로도 사용
    uploadLink: '',                    // 하객 사진 업로드 링크 (구글 드라이브 등)
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
    d.addEventListener('click', () => openLb(`img/ace_${n}.jpg`));
    stamps.appendChild(d);
  });
  const lb = document.getElementById('lightbox');
  function openLb(src){ lb.querySelector('img').src = src; lb.hidden = false; }
  lb.addEventListener('click', () => lb.hidden = true);

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
  $('lk-kakao').href = `https://map.kakao.com/link/search/${q}`;
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
  if (CFG.uploadLink) $('upload-link').href = CFG.uploadLink;

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
