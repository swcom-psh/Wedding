/**
 * 하객 사진 업로드 받는 구글 앱스 스크립트
 * 사진이 내 구글 드라이브의 FOLDER_NAME 폴더에 자동 저장됩니다.
 *
 * 배포: 상단 [배포] > [새 배포] > 유형 "웹 앱"
 *   - 다음 사용자로 실행: 나
 *   - 액세스 권한: 모든 사용자
 * 배포 후 나오는 "웹 앱 URL"을 script.js 의 CFG.uploadEndpoint 에 넣으세요.
 */
const FOLDER_NAME = '청첩장 하객사진';
const TOKEN = '여기에-아무-긴-문자열';      // script.js 의 CFG.uploadToken 과 같은 값
const MAX_BYTES = 12 * 1024 * 1024;        // 사진 1장 최대 용량(디코딩 후)

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out_({ ok: false, error: 'forbidden' });
    if (!d.data || !/^image\//.test(d.mime || '')) return out_({ ok: false, error: 'bad file' });
    const bytes = Utilities.base64Decode(d.data);
    if (bytes.length > MAX_BYTES) return out_({ ok: false, error: 'too large' });
    const stamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
    const ext = d.mime === 'image/png' ? 'png' : 'jpg';
    const name = stamp + '_' + String(d.name || 'guest').replace(/[^\w가-힣-]/g, '').slice(0, 20) + '_' + (d.index || 0) + '.' + ext;
    getFolder_().createFile(Utilities.newBlob(bytes, d.mime, name));
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() { return out_({ ok: true, msg: 'wedding upload endpoint' }); }
