/*
 * 모바일 청첩장 스크립트
 *
 * 구성
 *   CFG ............ 설정 (날짜, 장소, 업로드, BGM 등 — 보통 여기만 고치면 됨)
 *   util ........... 공통 도우미 ($, toast, 스크롤 잠금, 진동 등)
 *   Motion ......... 스크롤 등장 애니메이션 (순차 등장 / 종류 지정)
 *   Intro .......... 표지 등장
 *   Gallery ........ 갤러리 목록 + 더보기
 *   Lightbox ....... 사진 크게 보기 (끌어서 넘기기·아래로 내려 닫기·뒤로가기로 닫기)
 *   Calendar ....... 달력 + 카운트다운
 *   Location ....... 지도 앱 링크 / 네이버 지도
 *   Slider ......... 안내사항 카드 (끌어서 넘기기·자동 넘김)
 *   Accordion ...... 계좌번호 펼치기 애니메이션
 *   Copy ........... 계좌 복사
 *   Sheet .......... 아래에서 올라오는 창 (방명록 글쓰기·전체보기·삭제)
 *   Guestbook ...... 방명록 (구글 스프레드시트에 저장)
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
    // 방명록 저장소 (구글 앱스 스크립트 웹 앱 — apps-script/Code.gs)
    guestbookEndpoint: 'https://script.google.com/macros/s/AKfycbzzSt8YDTWCB1wTmfj0hbjqtKirou_Qspla-VR3QOqoH0yQNsniYpVhhJhPmu3DjOLRVA/exec',
    guestbookToken: 'wd2027-k8Xp3mQ7vNa2LrT9', // apps-script/Code.gs 의 TOKEN 과 같은 값
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
    unlock() {
      document.body.classList.remove('locked'); document.body.style.top = '';
      // 부드러운 스크롤 설정 때문에 맨 위에서부터 내려오는 것처럼 보이지 않게, 원래 자리로 즉시 돌아감
      const html = document.documentElement, prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      scrollTo(0, this.y);
      requestAnimationFrame(() => { html.style.scrollBehavior = prev; });
    },
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

  // ===== 사진 크게 보기 (핀치 줌 · 더블 탭 줌 · 넘기기 · 끌어서 닫기) =====
  const Lightbox = (() => {
    const lb = $('lightbox'), stage = lb.querySelector('.lb-stage'), img = lb.querySelector('img'), count = lb.querySelector('.lb-count');
    let cur = 0, isOpen = false;

    // 줌 및 패닝 상태
    let scale = 1, panX = 0, panY = 0;
    let isPinching = false, pinchStartDist = 0, pinchStartScale = 1;
    let lastTapTime = 0;

    function applyTransform(withTransition = false) {
      img.style.transition = withTransition ? 'transform .28s cubic-bezier(.22, 1, .36, 1)' : 'none';
      img.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
    }

    function resetZoom(withTransition = false) {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform(withTransition);
    }

    function clampPan() {
      if (scale <= 1) {
        panX = 0;
        panY = 0;
        return;
      }
      const sW = stage.clientWidth;
      const sH = stage.clientHeight;
      const maxPanX = Math.max(0, (sW * scale - sW) / 2);
      const maxPanY = Math.max(0, (sH * scale - sH) / 2);
      panX = clamp(panX, -maxPanX, maxPanX);
      panY = clamp(panY, -maxPanY, maxPanY);
    }

    const preload = (i) => { const p = photos[(i + photos.length) % photos.length]; if (p) new Image().src = fullSrc(p); };

    function show(i, dir = 0) {
      resetZoom(false);
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
      resetZoom(false);
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
      resetZoom(false);
      ScrollLock.unlock();
      if (!fromPop && history.state && history.state.lb) history.back();
      const t = Gallery.thumbs()[cur]; if (t) t.focus({ preventScroll: true });
    }
    addEventListener('popstate', () => { if (isOpen) close(true); });

    lb.querySelector('.lb-close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    lb.querySelector('.lb-prev').addEventListener('click', (e) => { e.stopPropagation(); show(cur - 1, -1); });
    lb.querySelector('.lb-next').addEventListener('click', (e) => { e.stopPropagation(); show(cur + 1, 1); });

    // iOS 사파리 브라우저 기본 확대 제스처 차단 (대신 커스텀 핀치 줌 적용)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => {
      lb.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    });

    // 터치 이벤트: 핀치 줌, 더블 탭 확대/축소, 줌 시 패닝, 일반 시 좌우 넘기기 및 아래로 닫기
    let touchStartX = 0, touchStartY = 0;
    let startPanX = 0, startPanY = 0;
    let stageSwipeX = 0, stageSwipeY = 0, isStageDrag = false, stageAxis = '';

    stage.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;

      if (e.touches.length === 2) {
        // 두 손가락 핀치 줌 시작
        isPinching = true;
        isStageDrag = false;
        stage.style.transition = 'none';
        const t0 = e.touches[0], t1 = e.touches[1];
        pinchStartDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        pinchStartScale = scale;
        startPanX = panX;
        startPanY = panY;
        return;
      }

      if (e.touches.length === 1) {
        const now = Date.now();
        const t = e.touches[0];

        // 더블 탭 확대 / 축소 토글
        if (now - lastTapTime < 320) {
          e.preventDefault();
          lastTapTime = 0;
          if (scale > 1.1) {
            resetZoom(true);
          } else {
            const rect = stage.getBoundingClientRect();
            const tapX = t.clientX - rect.left - rect.width / 2;
            const tapY = t.clientY - rect.top - rect.height / 2;
            scale = 2.5;
            panX = -tapX * 1.5;
            panY = -tapY * 1.5;
            clampPan();
            applyTransform(true);
          }
          return;
        }
        lastTapTime = now;

        touchStartX = t.clientX;
        touchStartY = t.clientY;
        startPanX = panX;
        startPanY = panY;
        stageSwipeX = 0;
        stageSwipeY = 0;
        stageAxis = '';
        isStageDrag = true;
        stage.style.transition = 'none';
      }
    }, { passive: false });

    stage.addEventListener('touchmove', (e) => {
      if (e.target.closest('button')) return;

      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        if (pinchStartDist > 0) {
          scale = clamp(pinchStartScale * (dist / pinchStartDist), 0.8, 4.5);
          applyTransform(false);
        }
        return;
      }

      if (e.touches.length === 1 && isStageDrag) {
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (scale > 1.08) {
          // 확대 상태: 사진 내부 패닝 이동
          e.preventDefault();
          panX = startPanX + dx;
          panY = startPanY + dy;
          clampPan();
          applyTransform(false);
        } else {
          // 기본 1x 배율 상태: 좌우 스와이프 넘기기 또는 아래로 끌어 닫기
          if (!stageAxis && Math.hypot(dx, dy) > 8) {
            stageAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          }
          if (stageAxis === 'x') {
            e.preventDefault();
            stage.style.transform = `translateX(${dx}px)`;
            stageSwipeX = dx;
          } else if (stageAxis === 'y' && dy > 0) {
            e.preventDefault();
            stage.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy / 1500, .15)})`;
            lb.style.setProperty('--bg', String(clamp(.92 - dy / 600, .3, .92)));
            stageSwipeY = dy;
          }
        }
      }
    }, { passive: false });

    const handleTouchEnd = () => {
      if (isPinching) {
        isPinching = false;
        if (scale < 1.08) {
          resetZoom(true);
        } else if (scale > 4.0) {
          scale = 4.0;
          clampPan();
          applyTransform(true);
        } else {
          clampPan();
          applyTransform(true);
        }
        return;
      }

      if (isStageDrag) {
        isStageDrag = false;
        stage.style.transition = '';

        if (scale <= 1.08) {
          if (stageAxis === 'x' && Math.abs(stageSwipeX) > 50) {
            show(cur + (stageSwipeX < 0 ? 1 : -1), stageSwipeX < 0 ? 1 : -1);
          } else if (stageAxis === 'y' && stageSwipeY > 110) {
            close();
            return;
          }
          stage.style.transform = '';
          lb.style.removeProperty('--bg');
        } else {
          clampPan();
          applyTransform(true);
        }
      }
    };

    stage.addEventListener('touchend', handleTouchEnd);
    stage.addEventListener('touchcancel', handleTouchEnd);

    // PC 데스크톱 지원: 더블 클릭 확대, 마우스 휠 줌, 마우스 드래그
    stage.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      if (scale > 1.1) {
        resetZoom(true);
      } else {
        const rect = stage.getBoundingClientRect();
        const tapX = e.clientX - rect.left - rect.width / 2;
        const tapY = e.clientY - rect.top - rect.height / 2;
        scale = 2.5;
        panX = -tapX * 1.5;
        panY = -tapY * 1.5;
        clampPan();
        applyTransform(true);
      }
    });

    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.3 : -0.3;
      scale = clamp(scale + delta, 1.0, 4.0);
      if (scale <= 1.05) {
        resetZoom(true);
      } else {
        clampPan();
        applyTransform(true);
      }
    }, { passive: false });

    let mDown = false, mStartX = 0, mStartY = 0, mPanStartX = 0, mPanStartY = 0, mDragX = 0, mDragY = 0, mAxis = '';
    stage.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      mDown = true;
      mStartX = e.clientX;
      mStartY = e.clientY;
      mPanStartX = panX;
      mPanStartY = panY;
      mDragX = 0;
      mDragY = 0;
      mAxis = '';
      stage.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!mDown) return;
      const dx = e.clientX - mStartX;
      const dy = e.clientY - mStartY;
      mDragX = dx;
      mDragY = dy;

      if (scale > 1.08) {
        panX = mPanStartX + dx;
        panY = mPanStartY + dy;
        clampPan();
        applyTransform(false);
      } else {
        if (!mAxis && Math.hypot(dx, dy) > 8) mAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (mAxis === 'x') stage.style.transform = `translateX(${dx}px)`;
        if (mAxis === 'y' && dy > 0) {
          stage.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy / 1500, .15)})`;
          lb.style.setProperty('--bg', String(clamp(.92 - dy / 600, .3, .92)));
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (!mDown) return;
      mDown = false;
      stage.style.transition = '';
      if (scale <= 1.08) {
        if (mAxis === 'x' && Math.abs(mDragX) > 50) show(cur + (mDragX < 0 ? 1 : -1), mDragX < 0 ? 1 : -1);
        else if (mAxis === 'y' && mDragY > 110) { close(); return; }
        stage.style.transform = '';
        lb.style.removeProperty('--bg');
      } else {
        clampPan();
        applyTransform(true);
      }
    });

    // 배경 클릭 시 닫기 (확대되지 않은 상태일 때만)
    lb.addEventListener('click', (e) => {
      if ((e.target === lb || e.target === stage) && scale <= 1.08 && !stageSwipeX && !stageSwipeY) {
        close();
      }
    });

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

  // ===== 아래에서 올라오는 창 (방명록 글쓰기·전체보기·삭제) =====
  const Sheet = (() => {
    let openEl = null;
    function open(el) {
      if (openEl) close(true);
      openEl = el;
      ScrollLock.lock();
      el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
      history.pushState({ sheet: 1 }, '');
      const first = el.querySelector('input, textarea');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 350);
    }
    function close(fromPop) {
      if (!openEl) return;
      const el = openEl; openEl = null;
      el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
      ScrollLock.unlock();
      if (fromPop !== true && history.state && history.state.sheet) history.back();
    }
    $$('.sheet').forEach((el) => {
      el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    });
    addEventListener('popstate', () => { if (openEl) close(true); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && openEl) close(); });
    return { open, close };
  })();

  // ===== 방명록 =====
  (function Guestbook() {
    const list = $('gb-list'), grid = $('gb-grid');
    const prevBtn = $('gb-prev'), nextBtn = $('gb-next');
    const writeSheet = $('gb-write-sheet'), allSheet = $('gb-all-sheet'), delSheet = $('gb-del-sheet');
    const form = $('gb-form'), delForm = $('gb-del-form');
    const F = form.elements, D = delForm.elements;   // form.name 은 폼 자체 이름이라 입력칸은 elements 로 접근
    const PREVIEW = 20;             // 본문에 가로로 보여줄 글 수
    let items = [], delId = null;

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (t) => { const d = new Date(t); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`; };

    // 레이스, 편지지, 리본, 골드클립 등 다양한 감성 카드 템플릿을 순환하여 사용
    // 레이스, 편지지, 리본, 골드클립 등 다양한 감성 카드 템플릿
    // 방명록 글이 추가되어도 기존 글의 카드 배경 이미지가 바뀌지 않고 고정되도록 등록 순서 기반으로 영구 고정
    const GB_KINDS = ['clip', 'letter', 'ribbon', 'lace', 'vintage', 'mini-ribbon', 'elegance', 'classic'];
    const cardKindMap = new Map();
    try {
      const saved = JSON.parse(localStorage.getItem('gb_card_kinds') || '{}');
      for (const [k, v] of Object.entries(saved)) cardKindMap.set(k, v);
    } catch (_) {}

    function updateCardKinds(list) {
      const chrono = [...list].sort((a, b) => (a.time || 0) - (b.time || 0));
      let changed = false;
      chrono.forEach((it, idx) => {
        if (!cardKindMap.has(it.id)) {
          cardKindMap.set(it.id, GB_KINDS[idx % GB_KINDS.length]);
          changed = true;
        }
      });
      if (changed) {
        try {
          const obj = {};
          cardKindMap.forEach((v, k) => { obj[k] = v; });
          localStorage.setItem('gb_card_kinds', JSON.stringify(obj));
        } catch (_) {}
      }
    }

    function card(it) {
      const kind = cardKindMap.get(it.id) || GB_KINDS[0];
      return `<article class="gb-card ${kind}" data-id="${esc(it.id)}">
        <button type="button" class="gb-del" aria-label="${esc(it.name)}님의 글 삭제">×</button>
        <div class="gb-body">
          <p class="gb-text">${esc(it.message).replace(/\n/g, '<br>')}</p>
          <p class="gb-name">- ${esc(it.name)} -</p>
          <p class="gb-date">${fmt(it.time)}</p>
        </div>
      </article>`;
    }

    // 좌우 화살표 버튼 가시성 및 활성화 상태 갱신
    function updateNav() {
      if (!prevBtn || !nextBtn) return;
      const cards = list.querySelectorAll('.gb-card');
      if (cards.length <= 1) {
        prevBtn.hidden = true;
        nextBtn.hidden = true;
        return;
      }
      prevBtn.hidden = false;
      nextBtn.hidden = false;
      const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth - 4);
      const isStart = list.scrollLeft <= 4;
      const isEnd = list.scrollLeft >= maxScroll;
      prevBtn.disabled = isStart;
      nextBtn.disabled = isEnd;
      prevBtn.setAttribute('aria-disabled', String(isStart));
      nextBtn.setAttribute('aria-disabled', String(isEnd));
    }

    // 화살표 버튼 클릭 시 카드 1장 너비만큼 부드럽게 스크롤
    function scrollStep(dir) {
      const firstCard = list.querySelector('.gb-card');
      const step = firstCard ? (firstCard.offsetWidth + 14) : 260;
      list.scrollBy({ left: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' });
      haptic(10);
    }
    if (prevBtn) prevBtn.addEventListener('click', () => scrollStep(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollStep(1));
    list.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav);

    // 마우스 드래그 및 터치 스와이프로 가로 넘기기
    let isDown = false, startX = 0, scrollStart = 0, hasDragged = false;
    list.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.gb-del')) return;
      isDown = true;
      hasDragged = false;
      startX = e.clientX;
      scrollStart = list.scrollLeft;
      try { list.setPointerCapture(e.pointerId); } catch (_) {}
    });
    list.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dist = e.clientX - startX;
      if (Math.abs(dist) > 5) {
        hasDragged = true;
        list.classList.add('dragging');
      }
      list.scrollLeft = scrollStart - dist;
    });
    const endDrag = (e) => {
      if (!isDown) return;
      isDown = false;
      list.classList.remove('dragging');
      try { list.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);
    // 드래그 중 실수로 카드 내 클릭 방지
    list.addEventListener('click', (e) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // PC 마우스 휠로 가로 스크롤
    list.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY !== 0) {
        const canLeft = e.deltaY < 0 && list.scrollLeft > 2;
        const canRight = e.deltaY > 0 && list.scrollLeft < list.scrollWidth - list.clientWidth - 2;
        if (canLeft || canRight) {
          e.preventDefault();
          list.scrollBy({ left: e.deltaY * 1.5, behavior: 'auto' });
        }
      }
    }, { passive: false });

    function render() {
      updateCardKinds(items);
      if (!items.length) {
        list.innerHTML = '<p class="gb-empty">첫 번째 축하 메시지를 남겨주세요 ♥</p>';
      } else {
        list.innerHTML = items.slice(0, PREVIEW).map(card).join('');
        list.scrollLeft = 0;
      }
      grid.innerHTML = items.length ? items.map(card).join('') : '<p class="gb-empty dark">아직 남겨진 글이 없어요</p>';
      $('gb-all').hidden = items.length <= 1;
      requestAnimationFrame(updateNav);
    }

    async function load() {
      try {
        const res = await fetch(`${CFG.guestbookEndpoint}?action=list&t=${Date.now()}`);
        const j = await res.json();
        const server = Array.isArray(j.items) ? j.items : [];
        // 불러오는 사이에 방금 남긴 글이 있으면 사라지지 않게 합침
        const ids = new Set(server.map((it) => it.id));
        items = [...items.filter((it) => !ids.has(it.id)), ...server];
        render();
      } catch (e) {
        list.innerHTML = '<p class="gb-empty">방명록을 불러오지 못했어요. 잠시 후 다시 열어주세요.</p>';
      }
    }

    async function post(body) {
      const res = await fetch(CFG.guestbookEndpoint, { method: 'POST', body: JSON.stringify({ token: CFG.guestbookToken, ...body }) });
      return res.json();
    }

    // 글쓰기
    const len = form.querySelector('.gb-len'), msgEl = form.querySelector('.gb-msg'), submit = form.querySelector('[type=submit]');
    F.message.addEventListener('input', () => { len.textContent = `${F.message.value.length} / 300`; });
    F.pw.addEventListener('input', () => { F.pw.value = F.pw.value.replace(/\D/g, '').slice(0, 4); });
    $('gb-write').addEventListener('click', () => { msgEl.textContent = ''; Sheet.open(writeSheet); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = F.name.value.trim(), message = F.message.value.trim(), pw = F.pw.value;
      if (!name) { msgEl.textContent = '이름을 적어주세요'; F.name.focus(); return; }
      if (!message) { msgEl.textContent = '내용을 적어주세요'; F.message.focus(); return; }
      if (!/^\d{4}$/.test(pw)) { msgEl.textContent = '비밀번호는 숫자 4자리예요'; F.pw.focus(); return; }
      submit.disabled = true; submit.textContent = '남기는 중...'; msgEl.textContent = '';
      try {
        const j = await post({ action: 'add', name, message, pw });
        if (!j.ok) throw new Error(j.error || '');
        items.unshift(j.item); render();
        form.reset(); len.textContent = '0 / 300';
        Sheet.close(); haptic(15); toast('축하 메시지가 남겨졌어요 ♥');
        $('guestbook').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      } catch (err) {
        msgEl.textContent = err.message && err.message !== 'Failed to fetch' ? err.message : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
      } finally {
        submit.disabled = false; submit.textContent = '남기기';
      }
    });

    // 전체보기
    $('gb-all').addEventListener('click', () => Sheet.open(allSheet));

    // 삭제 (작성할 때 정한 비밀번호로)
    const delMsg = delForm.querySelector('.gb-msg'), delBtn = delForm.querySelector('[type=submit]');
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.gb-del'); if (!b) return;
      delId = b.closest('.gb-card').dataset.id;
      delForm.reset(); delMsg.textContent = '';
      Sheet.open(delSheet);
    });
    delForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!D.pw.value) { delMsg.textContent = '비밀번호를 적어주세요'; return; }
      delBtn.disabled = true; delBtn.textContent = '삭제하는 중...';
      try {
        const j = await post({ action: 'delete', id: delId, pw: D.pw.value });
        if (!j.ok) throw new Error(j.error || '');
        items = items.filter((it) => it.id !== delId); render();
        Sheet.close(); toast('글이 삭제되었어요');
      } catch (err) {
        delMsg.textContent = err.message && err.message !== 'Failed to fetch' ? err.message : '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.';
      } finally {
        delBtn.disabled = false; delBtn.textContent = '삭제하기';
      }
    });

    // 방명록 근처까지 스크롤하면 불러오기 (첫 화면을 빠르게)
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '600px 0px' });
      io.observe($('guestbook'));
    } else load();
  })();

  // ===== 배경음악 =====
  // 브라우저는 소리 자동재생을 막으므로, 처음 화면을 터치/클릭하는 순간 재생을 시작해요.
  (function Bgm() {
    if (!CFG.bgm) return;
    const a = $('bgm'), btn = $('bgm-btn');
    const TARGET = .7;
    a.src = CFG.bgm; a.volume = 0; btn.hidden = false;
    let wantPlay = true, started = false, resume = false;

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
    // 같은 청첩장을 탭 여러 개로 열어도 한 곳에서만 재생 (다른 탭이 재생을 시작하면 이 탭은 멈춤)
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel('wedding-bgm'), me = Math.random().toString(36).slice(2);
      a.addEventListener('play', () => ch.postMessage(me));
      ch.onmessage = (e) => { if (e.data !== me && !a.paused) { resume = false; cancelAnimationFrame(a._raf); a.pause(); } };
    }
    // 홈 화면으로 나가거나 탭을 바꾸면 멈췄다가, 돌아오면 이어서 재생
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { resume = !a.paused; a.pause(); }
      else if (resume && wantPlay) play().catch(() => { });
    });
  })();

  fadeInImages();
// 모바일 청첩장 본문 페이지의 의도치 않은 전체 화면 확대/축소(핀치 줌) 방지
  document.addEventListener('gesturestart', (e) => {
    if (!e.target.closest('#lightbox')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturechange', (e) => {
    if (!e.target.closest('#lightbox')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gestureend', (e) => {
    if (!e.target.closest('#lightbox')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1 && !e.target.closest('#lightbox')) {
      e.preventDefault();
    }
  }, { passive: false });
})();
