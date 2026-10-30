/**
 * 청첩장 방명록 저장소 (구글 앱스 스크립트)
 * 방명록 글은 내 구글 드라이브의 스프레드시트 "청첩장 방명록"에 저장됩니다. (처음 글이 올라올 때 자동 생성)
 *
 * 배포 방법 (이미 배포한 적이 있으면 URL을 그대로 쓰기 위해 '새 버전'으로)
 *   1. 이 코드를 앱스 스크립트 편집기에 통째로 붙여넣고 저장
 *   2. 상단 [배포] > [배포 관리] > 연필(수정) > 버전: '새 버전' > [배포]
 *      (처음이라면 [배포] > [새 배포] > 유형 '웹 앱', 실행: 나, 액세스: 모든 사용자)
 *   3. 권한 허용 창이 뜨면 허용 (스프레드시트 만들기 권한)
 *
 * 관리
 *   - 스프레드시트에서 줄을 지우거나 deleted 칸에 TRUE 를 적으면 청첩장에서 사라집니다.
 *   - ADMIN_PW 를 정해두면, 청첩장에서 어떤 글이든 그 비밀번호로 지울 수 있습니다. (스팸 정리용)
 */
const TOKEN = 'wd2027-k8Xp3mQ7vNa2LrT9';   // script.js 의 CFG.guestbookToken 과 같은 값
const ADMIN_PW = '';                        // 관리자 삭제 비밀번호 (비우면 사용 안 함)
const SHEET_NAME = '청첩장 방명록';
const MAX_NAME = 12, MAX_MSG = 300;

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    ss.getSheets()[0].appendRow(['id', 'time', 'name', 'message', 'pwHash', 'deleted']);
    props.setProperty('SHEET_ID', ss.getId());
  }
  return ss.getSheets()[0];
}

function hash_(pw, id) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id + ':' + pw, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(s, max) {
  return String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// 글 목록 (최신순)
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action !== 'list') return out_({ ok: true, msg: 'wedding guestbook' });
  const rows = sheet_().getDataRange().getValues().slice(1);
  const items = rows
    .filter(function (r) { return r[0] && r[5] !== true && String(r[5]).toUpperCase() !== 'TRUE'; })
    .map(function (r) { return { id: String(r[0]), time: new Date(r[1]).getTime(), name: String(r[2]), message: String(r[3]) }; })
    .sort(function (a, b) { return b.time - a.time; });
  return out_({ ok: true, items: items });
}

// 글쓰기 / 삭제
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad request' }); }
  if (d.token !== TOKEN) return out_({ ok: false, error: 'forbidden' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    if (d.action === 'add') {
      const name = clean_(d.name, MAX_NAME), message = clean_(d.message, MAX_MSG), pw = String(d.pw || '');
      if (!name || !message) return out_({ ok: false, error: '이름과 내용을 적어주세요' });
      if (!/^\d{4}$/.test(pw)) return out_({ ok: false, error: '비밀번호는 숫자 4자리예요' });
      const id = Utilities.getUuid().slice(0, 12), now = new Date();
      sh.appendRow([id, now, name, message, hash_(pw, id), false]);
      return out_({ ok: true, item: { id: id, time: now.getTime(), name: name, message: message } });
    }
    if (d.action === 'delete') {
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== String(d.id)) continue;
        const pw = String(d.pw || '');
        const okPw = hash_(pw, rows[i][0]) === rows[i][4] || (ADMIN_PW && pw === ADMIN_PW);
        if (!okPw) return out_({ ok: false, error: '비밀번호가 맞지 않아요' });
        sh.getRange(i + 1, 6).setValue(true);
        return out_({ ok: true });
      }
      return out_({ ok: false, error: '이미 지워진 글이에요' });
    }
    return out_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}
