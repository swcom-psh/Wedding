# -*- coding: utf-8 -*-
"""
갤러리 사진 생성기

웨딩사진 폴더의 번호 붙은 사진(1.jpg, 2.jpg, ... N.jpg)을 번호 순으로 갤러리에 넣습니다.
사진 추가/교체/삭제 후 이것만 실행하면 됩니다:

    python tools/build_gallery.py

하는 일:
  - 웨딩사진/*.jpg|jpeg|png|webp 를 찾아 번호 순으로 정렬
  - img/gallery/NN.jpg (큰 사진, 긴 변 1600px) 및 img/gallery/thumb/NN.jpg (썸네일, 640px) 생성
  - 더 이상 없는 번호의 이미지는 삭제
  - img/gallery/gallery.js 에 사진 목록 저장 (내용 바뀔 때마다 ?v= 가 바뀌어 캐시 자동 갱신)
  - index.html 의 gallery.js 불러오는 주소 ?v= 도 갱신
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
        raise SystemExit('웨딩사진 폴더에 1.jpg 형식의 사진이 없습니다.')

    items = []
    for n in nums:
        name = f'{n:02d}.jpg'
        im = ImageOps.exif_transpose(Image.open(found[n])).convert('RGB')
        big = im.copy()
        big.thumbnail((1600, 1600), Image.LANCZOS)
        big.save(os.path.join(OUT, name), quality=82, optimize=True, progressive=True)
        sm = im.copy()
        sm.thumbnail((640, 640), Image.LANCZOS)
        sm.save(os.path.join(THUMB, name), quality=80, optimize=True)
        h = hashlib.md5(open(found[n], 'rb').read()).hexdigest()[:8]
        items.append({'file': name, 'v': h, 'w': im.width, 'h': im.height})
        print(f'  {n:>3} -> img/gallery/{name} (hash: {h}, {im.width}x{im.height})')

    keep = {it['file'] for it in items}
    for d in (OUT, THUMB):
        for f in os.listdir(d):
            if f.lower().endswith('.jpg') and f not in keep:
                os.remove(os.path.join(d, f))

    with open(os.path.join(OUT, 'gallery.js'), 'w', encoding='utf8', newline='\n') as fp:
        fp.write('// tools/build_gallery.py 가 자동 생성한 파일입니다. 직접 고치지 마세요.\n')
        fp.write('window.GALLERY = ' + json.dumps(items, ensure_ascii=False) + ';\n')

    ver = hashlib.md5(json.dumps(items).encode()).hexdigest()[:8]
    html = os.path.join(ROOT, 'index.html')
    with open(html, 'r', encoding='utf8') as fp:
        s = fp.read()
    s = re.sub(r'img/gallery/gallery\.js(\?v=[\w]+)?', f'img/gallery/gallery.js?v={ver}', s)
    with open(html, 'w', encoding='utf8', newline='\n') as fp:
        fp.write(s)
    print(f'완료: 총 {len(items)}장, gallery.js?v={ver}')


if __name__ == '__main__':
    main()
