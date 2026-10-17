"""
갤러리 사진 만들기 도구.

웨딩사진 폴더의 숫자 이름 사진(1.jpg, 2.jpg, ... N.jpg)을 번호 순서대로 갤러리에 넣습니다.
사진을 추가·교체·삭제한 뒤 이것만 실행하면 됩니다.

    python tools/build_gallery.py

하는 일
  - 웨딩사진/숫자.jpg|jpeg|png|webp 를 찾아 번호 순으로 정렬
  - img/gallery/NN.jpg (크게 보기, 긴 변 1600px) 와 img/gallery/thumb/NN.jpg (목록, 640px) 생성
  - 더 이상 없는 번호의 이미지는 삭제
  - img/gallery/gallery.js 에 사진 목록을 기록 (사진이 바뀌면 주소 뒤 ?v= 값도 바뀌어 캐시 문제 없음)
  - index.html 에서 gallery.js 를 불러오는 주소의 ?v= 도 갱신

필요한 것: Python, Pillow   (pip install pillow)
"""
import hashlib
import json
import os
import re

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '웨딩사진')
OUT = os.path.join(ROOT, 'img', 'gallery')
THUMB = os.path.join(OUT, 'thumb')
PAT = re.compile(r'^(\d+)\.(jpe?g|png|webp)$', re.I)


def main():
    os.makedirs(THUMB, exist_ok=True)
    found = {}
    for f in os.listdir(SRC):
        m = PAT.match(f)
        if m:
            found[int(m.group(1))] = os.path.join(SRC, f)
    nums = sorted(found)
    if not nums:
        raise SystemExit('웨딩사진 폴더에 1.jpg 같은 숫자 이름 사진이 없습니다.')

    items = []
    for n in nums:
        name = f'{n:02d}.jpg'
        im = ImageOps.exif_transpose(Image.open(found[n])).convert('RGB')
        big = im.copy(); big.thumbnail((1600, 1600), Image.LANCZOS)
        big.save(os.path.join(OUT, name), quality=82, optimize=True, progressive=True)
        sm = im.copy(); sm.thumbnail((640, 640), Image.LANCZOS)
        sm.save(os.path.join(THUMB, name), quality=80, optimize=True)
        h = hashlib.md5(open(found[n], 'rb').read()).hexdigest()[:8]
        items.append({'file': name, 'v': h})
        print(f'  {n:>3} -> img/gallery/{name}')

    keep = {it['file'] for it in items}
    for d in (OUT, THUMB):
        for f in os.listdir(d):
            if f.lower().endswith('.jpg') and f not in keep:
                os.remove(os.path.join(d, f))

    with open(os.path.join(OUT, 'gallery.js'), 'w', encoding='utf8') as fp:
        fp.write('// tools/build_gallery.py 가 자동으로 만든 파일입니다. 직접 고치지 마세요.\n')
        fp.write('window.GALLERY = ' + json.dumps(items, ensure_ascii=False) + ';\n')

    ver = hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]
    html = os.path.join(ROOT, 'index.html')
    s = open(html, encoding='utf8').read()
    s = re.sub(r'img/gallery/gallery\.js(\?v=[\w]+)?', f'img/gallery/gallery.js?v={ver}', s)
    open(html, 'w', encoding='utf8').write(s)
    print(f'완료: 사진 {len(items)}장')


if __name__ == '__main__':
    main()
