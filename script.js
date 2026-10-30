/*
 * 모바일 청첩장 스크립트
 *
 * 구성
 *   CFG ............ 설정 (날짜, 장소, 업로드, BGM 등 — 보통 여기만 고치면 됨)
 *   util ........... 공통 도우미 ($, toast, 스크롤 잠금, 진동 등)
 *   Motion ......... 스크롤 등장 애니메이션 (순차 등장 / 종류 지정)
 *   Intro .......... 표지 등장 + 아래로 스크롤 안내
 *   Gallery ........ 갤러리 목록 + 더보기
 *   Lightbox ....... 사진 크게 보기 (끌어서 넘기기·아래로 내려 닫기·뒤로가기로 닫기)
 *   Calendar ....... 달력 + 카운트다운
 *   Location ....... 지도 앱 링크 / 네이버 지도
 *   Slider ......... 안내사항 카드 (끌어서 넘기기·자동 넘김)
 *   Accordion ...... 계좌번호 펼치기 애니메이션
 *   Copy ........... 계좌 복사
 *   Upload ......... 하객 사진 업로드 (구글 드라이브)
 *   Bgm ............ 배경음악
 *
 * 애니메이션을 더하고 싶을 때
 *   - HTML 요소에 class="reveal" 을 붙이면 스크롤할 때 나타나요.
 *   - data-reveal="up | fade | zoom | left | right" 로 나타나는 방식을 고를 수 있어요. (기본: up)
 *   - 속도·곡선은 style.css 맨 위 :root 의 --ease, --dur 값으로 한 번에 바뀌어요.
 */
(() => {
  'use strict';

  // ===== 설정 =====
  const CFG = {
    date: new Date('2027-02-13T12:10:00+09:00'),
    venueName: '원주 빌라드아모르',            // 지도 검색어
    address: '강원 원주시 북원로 2888',
    naverMapKey: '',                           // 네이버 지도 API 키(ncpKeyId). 비우면 구글 지도로 표시
    uploadEndpoint: 'https://script.google.com/macros/s/AKfycbzzSt8YDTWCB1wTmfj0hbjqtKirou_Qspla-VR3QOqoH0yQNsniYpVhhJhPmu3DjOLRVA/exec',
    uploadToken: 'wd2027-k8Xp3mQ7vNa2LrT9',   // apps-script/Code.gs 의 TOKEN 과 같은 값
    uploadMax: 10,                             // 한 번에 올릴 수 있는 최대 장수
    bgm: 'audio/bgm.m4a',                      // 배경음악 파일 (비우면 버튼 숨김)
    galleryFirst: 12,                          // 갤러리 처음에 보여줄 사진 수 (3장 × 4줄)
    sliderAutoMs: 5000,                        // 안내사항 카드 자동 넘김 간격 (0이면 끔)
  };

  // ===== 공통 도우미 =====
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const haptic = (ms = 8) => {   // 안드로이드에서 짧은 진동 (사용자가 화면을 누른 뒤에만)
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive) return;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { }
  };

  const toastEl = $('toast');
  function toast(msg, ms = 1800) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  // 배경 스크롤 잠금 (iOS 에서도 뒤 페이지가 움직이지 않게 위치를 고정했다가 되돌림)
  const ScrollLock = {
    y: 0,
    lock() { this.y = scrollY; document.body.style.top = `-${this.y}px`; document.body.classList.add('locked'); },
    unlock() { document.body.classList.remove('locked'); document.body.style.top = ''; scrollTo(0, this.y); },
  };

  // ===== 스크롤 등장 애니메이션 =====
  const Motion = (() => {
    // 사진·액자류는 확대되며, 나머지는 아래에서 올라오며 등장
    $$('.reveal').forEach((el) => {
      if (el.dataset.reveal) return;
      if (el.matches('.wide-photo, .frame, .locket, .date-card, .cream-board, .map')) el.dataset.reveal = 'zoom';
    });
    if (reduceMotion || !('IntersectionObserver' in window)) {
      $$('.reveal').forEach((el) => el.classList.add('in'));
      return { watch() { } };
    }
    // 한 번에 화면에 들어온 요소들은 순서대로 조금씩 늦게 등장
    const io = new IntersectionObserver((entries) => {
      const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      shown.forEach((el, i) => {
        el.style.setProperty('--d', `${Math.min(i, 6) * 90}ms`);
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    const watch = (els) => els.forEach((el) => io.observe(el));
    watch($$('.reveal'));
    return { watch };
  })();

  // 이미지가 로드되면 부드럽게 나타나게 (깜빡임 방지)
  function fadeInImages(root = document) {
    $$('img', root).forEach((img) => {
      if (img.closest('#lightbox') || img.dataset.fade) return;
      img.dataset.fade = '1';
      const done = () => img.classList.add('loaded');
      if (img.complete && img.naturalWidth) done();
      else { img.classList.add('fade-img'); img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
  }

  // ===== 표지 =====
  (function Intro() {
    const intro = $('intro'), cover = intro.querySelector('img');
    const ready = () => intro.classList.add('ready');
    cover.complete ? requestAnimationFrame(ready) : cover.addEventListener('load', ready, { once: true });
    setTimeout(ready, 2500);   // 이미지가 늦어도 표지는 보이게
    const hint = document.createElement('div');
    hint.className = 'scroll-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span>scroll</span><i></i>';
    intro.appendChild(hint);
    const onScroll = () => { if (scrollY > 40) { hint.classList.add('gone'); removeEventListener('scroll', onScroll); } };
    addEventListener('scroll', onScroll, { passive: true });
  })();

  // ===== 갤러리 =====
  // 사진 목록은 img/gallery/gallery.js (tools/build_gallery.py 로 생성)에서 읽어요
  const photos = (window.GALLERY || []).map((p) => ({ file: p.file, v: p.v, w: p.w || 3, h: p.h || 4 }));
  const thumbSrc = (p) => `img/gallery/thumb/${p.file}?v=${p.v}`;
  const fullSrc = (p) => `img/gallery/${p.file}?v=${p.v}`;

  const Gallery = (() => {
    const box = $('stamps'), moreBtn = $('more-btn');
    photos.forEach((p, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'stamp' + (i >= CFG.galleryFirst ? ' extra' : '');
      d.style.setProperty('--r', ((i * 37) % 5 - 2) * .8 + 'deg');
      if (p.w > p.h * 1.1) d.classList.add('wide');   // 가로 사진은 잘리지 않게 통째로
      d.setAttribute('aria-label', `웨딩 사진 ${i + 1} 크게 보기`);
      d.innerHTML = `<img loading="lazy" decoding="async" src="${thumbSrc(p)}" alt="">`;
      d.addEventListener('click', () => Lightbox.open(i, d));
      box.appendChild(d);
    });
    fadeInImages(box);

    const extra = photos.length - CFG.galleryFirst;
    if (extra > 0) {
      const label = (open) => { moreBtn.innerHTML = open ? '접기 <b>▴</b>' : '사진 더보기 <b>▾</b>'; moreBtn.setAttribute('aria-expanded', open); };
      moreBtn.hidden = false; label(false);
      moreBtn.addEventListener('click', () => {
        const open = !box.classList.contains('open');
        box.classList.toggle('open', open);
        label(open);
        haptic();
        if (open) $$('.stamp.extra', box).forEach((s, k) => s.style.setProperty('--d', `${Math.min(k, 12) * 45}ms`));
        else $('gallery').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    }
    return { thumbs: () => $$('.stamp', box) };
  })();

  // ===== 사진 크게 보기 =====
  const Lightbox = (() => {
    const lb = $('lightbox'), stage = lb.querySelector('.lb-stage'), img = lb.querySelector('img'), count = lb.querySelector('.lb-count');
    let cur = 0, isOpen = false;

    const preload = (i) => { const p = photos[(i + photos.length) % photos.length]; if (p) new Image().src = fullSrc(p); };

    function show(i, dir = 0) {
      cur = (i + photos.length) % photos.length;
      const src = fullSrc(photos[cur]);
      count.textContent = `${cur + 1} / ${photos.length}`;
      img.classList.remove('slide-l', 'slide-r');
      if (dir) { void img.offsetWidth; img.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); }
      img.src = src;
      preload(cur + 1); preload(cur - 1);
    }

    function open(i, fromEl) {
      if (isOpen) return;
      isOpen = true;
      show(i);
      // 누른 썸네일 위치에서 커지듯이 열리게
      if (fromEl) {
        const r = fromEl.getBoundingClientRect();
        lb.style.setProperty('--ox', `${r.left + r.width / 2}px`);
        lb.style.setProperty('--oy', `${r.top + r.height / 2}px`);
      }
      ScrollLock.lock();
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      history.pushState({ lb: 1 }, '');            // 휴대폰 뒤로가기 버튼으로 닫히게
    }

    function close(fromPop) {
      if (!isOpen) return;
      isOpen = false;
      lb.classList.remove('open');
      lb.setAttribute('aria-hidden', 'true');
      stage.style.transform = ''; lb.style.removeProperty('--bg');
      ScrollLock.unlock();
      if (!fromPop && history.state && history.state.lb) history.back();
      const t = Gallery.thumbs()[cur]; if (t) t.focus({ preventScroll: true });
    }
    addEventListener('popstate', () => { if (isOpen) close(true); });

    lb.querySelector('.lb-close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    lb.querySelector('.lb-prev').addEventListener('click', (e) => { e.stopPropagation(); show(cur - 1, -1); });
    lb.querySelector('.lb-next').addEventListener('click', (e) => { e.stopPropagation(); show(cur + 1, 1); });
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target === stage) close(); });

    // 확대 제스처 차단 (iOS Safari 포함)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => lb.addEventListener(t, (e) => e.preventDefault()));
    lb.addEventListener('dblclick', (e) => e.preventDefault());
    lb.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // 끌어서 넘기기 / 아래로 끌어 닫기
    let sx = 0, sy = 0, dx = 0, dy = 0, drag = false, axis = '';
    lb.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      drag = true; axis = ''; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      stage.style.transition = 'none';
    });
    lb.addEventListener('pointermove', (e) => {
      if (!drag) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'x') stage.style.transform = `translateX(${dx}px)`;
      if (axis === 'y' && dy > 0) {
        stage.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy / 1500, .15)})`;
        lb.style.setProperty('--bg', String(clamp(.92 - dy / 600, .3, .92)));
      }
    });
    const end = () => {
      if (!drag) return;
      drag = false;
      stage.style.transition = '';
      if (axis === 'x' && Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      if (axis === 'y' && dy > 110) { close(); return; }
      stage.style.transform = ''; lb.style.removeProperty('--bg');
    };
    lb.addEventListener('pointerup', end);
    lb.addEventListener('pointercancel', end);

    addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1, -1);
      if (e.key === 'ArrowRight') show(cur + 1, 1);
    });
    return { open, close };
  })();

  // ===== 달력 + 카운트다운 =====
  (function Calendar() {
    const y = CFG.date.getFullYear(), m = CFG.date.getMonth(), day = CFG.date.getDate();
    const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    let html = `<h3>${m + 1}월</h3><table><tr>${'일월화수목금토'.split('').map((c) => `<th>${c}</th>`).join('')}</tr><tr>`;
    for (let i = 0; i < first; i++) html += '<td></td>';
    for (let d = 1; d <= last; d++) {
      if ((first + d - 1) % 7 === 0 && d > 1) html += '</tr><tr>';
      html += `<td class="${d === day ? 'd' : ''}">${d}</td>`;
    }
    $('cal').innerHTML = html + '</tr></table>';

    const cells = { d: $('cd-d'), h: $('cd-h'), m: $('cd-m'), s: $('cd-s') };
    const set = (el, v) => {
      if (el.textContent === v) return;
      el.textContent = v;
      if (!reduceMotion) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    };
    function tick() {
      const diff = Math.max(0, CFG.date - Date.now());
      const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, mi = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
      set(cells.d, pad(d)); set(cells.h, pad(h)); set(cells.m, pad(mi)); set(cells.s, pad(s));
      $('dday').innerHTML = diff ? `상현 ♥ 가경의 결혼식이 <strong>${d}일</strong> 남았습니다.` : '오늘, 결혼합니다 ♥';
    }
    tick(); setInterval(tick, 1000);
  })();

  // ===== 오시는 길 =====
  (function Location() {
    const q = encodeURIComponent(CFG.venueName);
    $('lk-naver').href = `https://map.naver.com/p/search/${q}`;
    $('lk-google').href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    $('lk-tmap').href = '#';
    $('lk-tmap').addEventListener('click', (e) => {
      e.preventDefault();
      const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
      if (!ios && !android) { toast('T MAP은 모바일에서 열 수 있어요', 2000); return; }
      const t = Date.now();
      location.href = `tmap://search?name=${q}`;
      setTimeout(() => {
        if (!document.hidden && Date.now() - t < 2500) location.href = ios ? 'https://apps.apple.com/kr/app/id431589174' : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';
      }, 1500);
    });
    // 주소 복사 버튼은 Copy 에서 처리

    if (!CFG.naverMapKey) return;
    const sc = document.createElement('script');
    sc.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CFG.naverMapKey}&submodules=geocoder`;
    sc.onload = () => {
      naver.maps.Service.geocode({ query: CFG.address }, (status, res) => {
        if (status !== naver.maps.Service.Status.OK || !res.v2.addresses.length) return;
        const a = res.v2.addresses[0], pos = new naver.maps.LatLng(a.y, a.x), box = $('map');
        box.innerHTML = '';
        const map = new naver.maps.Map(box, { center: pos, zoom: 16, scaleControl: false, mapDataControl: false });
        new naver.maps.Marker({ position: pos, map });
      });
    };
    document.head.appendChild(sc);
  })();

  // ===== 안내사항 카드 =====
  (function Slider() {
    const slider = $('slider'), track = slider.querySelector('.track'), n = track.children.length, dots = $('dots');
    let idx = 0, timer = 0, visible = false;
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', `${i + 1}번째 안내`);
      b.addEventListener('click', () => { go(i); restart(); });
      dots.appendChild(b);
    }
    function go(i) {
      idx = (i + n) % n;
      track.style.transform = `translateX(${-idx * 100}%)`;
      [...dots.children].forEach((d, k) => { d.classList.toggle('on', k === idx); d.setAttribute('aria-current', k === idx); });
      [...track.children].forEach((s, k) => s.classList.toggle('active', k === idx));
    }
    const stop = () => clearInterval(timer);
    const restart = () => { stop(); if (CFG.sliderAutoMs && visible && !reduceMotion) timer = setInterval(() => go(idx + 1), CFG.sliderAutoMs); };
    slider.querySelector('.prev').addEventListener('click', () => { go(idx - 1); restart(); });
    slider.querySelector('.next').addEventListener('click', () => { go(idx + 1); restart(); });

    // 손가락을 따라 움직이다가 놓으면 맞춰지는 넘김
    let sx = 0, sy = 0, dx = 0, drag = false, axis = '';
    track.addEventListener('pointerdown', (e) => { drag = true; axis = ''; sx = e.clientX; sy = e.clientY; dx = 0; stop(); });
    track.addEventListener('pointermove', (e) => {
      if (!drag) return;
      dx = e.clientX - sx; const dy = e.clientY - sy;
      if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis !== 'x') return;
      track.classList.add('dragging');
      const edge = (idx === 0 && dx > 0) || (idx === n - 1 && dx < 0);
      track.style.transform = `translateX(calc(${-idx * 100}% + ${edge ? dx / 3 : dx}px))`;
    });
    const end = () => {
      if (!drag) return;
      drag = false; track.classList.remove('dragging');
      if (axis === 'x' && Math.abs(dx) > slider.offsetWidth * .18) go(idx + (dx < 0 ? 1 : -1));
      else go(idx);
      restart();
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('pointerleave', end);

    // 화면에 보일 때만 자동 넘김
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? restart() : stop(); }, { threshold: .4 }).observe(slider);
    }
    go(0);
  })();

  // ===== 계좌번호 펼치기 (높이 애니메이션) =====
  (function Accordion() {
    $$('details.acc').forEach((det) => {
      const sum = det.querySelector('summary'), body = det.querySelector('ul');
      sum.addEventListener('click', (e) => {
        if (reduceMotion) return;
        e.preventDefault();
        haptic();
        if (det.open) {
          body.style.height = body.scrollHeight + 'px';
          requestAnimationFrame(() => { body.style.height = '0px'; body.style.opacity = '0'; });
          body.addEventListener('transitionend', () => { det.open = false; body.style.height = body.style.opacity = ''; }, { once: true });
        } else {
          det.open = true;
          body.style.height = '0px'; body.style.opacity = '0';
          requestAnimationFrame(() => { body.style.height = body.scrollHeight + 'px'; body.style.opacity = '1'; });
          body.addEventListener('transitionend', () => { body.style.height = body.style.opacity = ''; }, { once: true });
        }
      });
    });
  })();

  // ===== 복사 (계좌번호·주소) =====
  (function Copy() {
    async function copy(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) { }
      const ta = document.createElement('textarea');          // 오래된 브라우저용
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
      ta.remove(); return ok;
    }
    $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await copy(b.dataset.copy);
      haptic(12);
      toast(ok ? '복사되었어요' : '복사하지 못했어요. 길게 눌러 복사해 주세요');
      if (!ok) return;
      const old = b.textContent;
      b.classList.add('copied'); b.textContent = '완료';
      setTimeout(() => { b.classList.remove('copied'); b.textContent = old; }, 1400);
    }));
  })();

  // ===== 하객 사진 업로드 (구글 드라이브로 자동 전송) =====
  (function Upload() {
    const btn = $('upload-btn'), input = $('upload-input'), status = $('upload-status'), name = $('upload-name');
    const say = (msg, err) => { status.textContent = msg; status.classList.toggle('err', !!err); };
    // 긴 변 2400px, JPEG로 줄여서 전송 (폰 사진 용량 줄이기)
    async function shrink(file) {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', .88));
      return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
    }
    btn.addEventListener('click', () => {
      if (!CFG.uploadEndpoint) { say('사진 업로드는 곧 열릴 예정이에요'); return; }
      input.click();
    });
    input.addEventListener('change', async () => {
      let files = [...input.files].filter((f) => f.type.startsWith('image/'));
      input.value = '';
      if (!files.length) return;
      if (files.length > CFG.uploadMax) {
        files = files.slice(0, CFG.uploadMax);
        say(`한 번에 최대 ${CFG.uploadMax}장까지 올릴 수 있어요. 앞의 ${CFG.uploadMax}장만 올릴게요.`);
        await new Promise((r) => setTimeout(r, 1800));
      }
      btn.disabled = true; btn.classList.add('busy');
      let ok = 0, fail = 0;
      for (let i = 0; i < files.length; i++) {
        say(`업로드 중... (${i + 1}/${files.length})`);
        btn.style.setProperty('--p', `${(i / files.length) * 100}%`);
        try {
          const data = await shrink(files[i]);
          const res = await fetch(CFG.uploadEndpoint, { method: 'POST', body: JSON.stringify({ token: CFG.uploadToken, name: name.value.trim(), index: i + 1, mime: 'image/jpeg', data }) });
          (await res.json()).ok ? ok++ : fail++;
        } catch (e) { fail++; }
      }
      btn.style.setProperty('--p', '100%');
      setTimeout(() => { btn.disabled = false; btn.classList.remove('busy'); btn.style.removeProperty('--p'); }, 400);
      haptic(20);
      if (fail) say(`${ok}장 업로드 완료, ${fail}장은 실패했어요. 잠시 후 다시 시도해 주세요.`, true);
      else say(`${ok}장 업로드 완료! 소중한 사진 감사합니다 ♥`);
    });
  })();

  // ===== 배경음악 =====
  // 브라우저는 소리 자동재생을 막으므로, 처음 화면을 터치/클릭하는 순간 재생을 시작해요.
  (function Bgm() {
    if (!CFG.bgm) return;
    const a = $('bgm'), btn = $('bgm-btn');
    const TARGET = .7;
    a.src = CFG.bgm; a.volume = 0; btn.hidden = false;
    let wantPlay = true, started = false;

    // 갑자기 크게 나오지 않도록 서서히 키우고, 끌 때도 서서히 줄임
    function fade(to, ms = 900, then) {
      if (reduceMotion) { a.volume = to; then && then(); return; }
      const from = a.volume, t0 = performance.now();
      cancelAnimationFrame(a._raf);
      const step = (t) => {
        const k = clamp((t - t0) / ms, 0, 1);
        a.volume = from + (to - from) * k;
        k < 1 ? (a._raf = requestAnimationFrame(step)) : then && then();
      };
      a._raf = requestAnimationFrame(step);
    }
    const play = () => a.play().then(() => { started = true; cleanup(); fade(TARGET); });
    const sync = () => btn.classList.toggle('on', !a.paused);
    a.addEventListener('play', sync); a.addEventListener('pause', sync);

    const evs = ['pointerdown', 'touchend', 'click', 'keydown'];
    const start = (e) => { if (started || !wantPlay || (e && e.target.closest('#bgm-btn'))) return; play().catch(() => { }); };
    const cleanup = () => evs.forEach((t) => document.removeEventListener(t, start, true));
    evs.forEach((t) => document.addEventListener(t, start, true));
    play().catch(() => { });   // 자동재생이 허용되는 환경이면 바로 재생

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic();
      if (a.paused) { wantPlay = true; play().catch(() => { }); }
      else { wantPlay = false; fade(0, 500, () => a.pause()); }
    });
    // 홈 화면으로 나가거나 탭을 바꾸면 멈췄다가, 돌아오면 이어서 재생
    let resume = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { resume = !a.paused; a.pause(); }
      else if (resume && wantPlay) play().catch(() => { });
    });
  })();

  fadeInImages();
})();
