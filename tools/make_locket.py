"""
로켓 목걸이(하트 두 개)에 들어가는 사진을 바꾸는 도구.

사용법 (PowerShell 또는 터미널, 폴더: D:\\coding\\Wedding)
    python tools/make_locket.py 웨딩사진/아기사진1.jpg 웨딩사진/아기사진5.jpg

  - 첫 번째 사진이 왼쪽 하트, 두 번째 사진이 오른쪽 하트에 들어갑니다.
  - 얼굴이 하트 안에서 어색하게 잘리면 '자르는 영역'을 직접 지정하세요.
        --lbox 왼쪽사진에서_자를_영역    --rbox 오른쪽사진에서_자를_영역
    영역은  x1,y1,x2,y2  (원본 사진 기준 픽셀, 왼쪽위 → 오른쪽아래) 입니다.
    정사각형에 가깝게, 얼굴이 가운데 오도록 잡으세요. 사진 밖으로 나가도 되며,
    나간 부분은 가장자리 색으로 채워집니다.
        예) python tools/make_locket.py a.jpg b.jpg --rbox -100,40,900,1040
  - 사진 크기는 보통 '이미지 뷰어'에서 마우스를 올리면 표시됩니다.
  - 결과는 img/locket.png 로 저장되고, index.html 의 캐시 숫자(?v=)도 자동으로 1 올라갑니다.
    (미리 보고 싶으면 --out 미리보기.png 를 붙이세요. 이때는 사이트 파일을 건드리지 않습니다.)

필요한 것: Python, Pillow, numpy, scipy   (pip install pillow numpy scipy)
"""
import argparse
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, '배경', '2.png')      # 빈 로켓 이미지 (사진 자리에 풍경이 들어있는 파일)


def parse_box(s):
    if not s:
        return None
    v = [int(float(t)) for t in s.split(',')]
    if len(v) != 4:
        sys.exit('영역은 x1,y1,x2,y2 네 개 숫자여야 합니다. 예: 100,50,900,850')
    return v


def load(path, box):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    if box is None:                                   # 지정하지 않으면 가운데 정사각형
        s = min(im.size)
        box = [(im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2]
    x1, y1, x2, y2 = box
    pad = max(0, -x1, -y1, x2 - im.width, y2 - im.height)
    if pad:
        arr = np.pad(np.array(im), ((pad, pad), (pad, pad), (0, 0)), mode='edge')
        im = Image.fromarray(arr)
        x1, y1, x2, y2 = x1 + pad, y1 + pad, x2 + pad, y2 + pad
    return im.crop((x1, y1, x2, y2))


def main():
    ap = argparse.ArgumentParser(description='로켓 목걸이 사진 교체')
    ap.add_argument('left', help='왼쪽 하트에 넣을 사진')
    ap.add_argument('right', help='오른쪽 하트에 넣을 사진')
    ap.add_argument('--lbox', help='왼쪽 사진 자를 영역 x1,y1,x2,y2')
    ap.add_argument('--rbox', help='오른쪽 사진 자를 영역 x1,y1,x2,y2')
    ap.add_argument('--out', help='미리보기로만 저장할 파일 (지정하면 사이트 파일은 그대로)')
    a = ap.parse_args()

    faces = [load(a.left, parse_box(a.lbox)), load(a.right, parse_box(a.rbox))]
    if not os.path.exists(TEMPLATE):
        sys.exit(f'빈 로켓 이미지가 없습니다: {TEMPLATE}')

    t = np.array(Image.open(TEMPLATE).convert('RGBA'))
    r, g, b = [t[..., i].astype(int) for i in range(3)]
    al = t[..., 3]
    window = ((g > r + 8) | (b > r + 8)) & (al > 200)             # 사진이 들어갈 자리(풍경 부분)
    lab, n = ndi.label(ndi.binary_fill_holes(window))
    boxes = ndi.find_objects(lab)
    order = sorted(range(n), key=lambda i: boxes[i][1].start)[:2]  # 왼쪽 → 오른쪽
    if len(order) < 2:
        sys.exit('로켓 이미지에서 사진 자리 두 곳을 찾지 못했습니다.')

    out = t.copy()
    for face, i in zip(faces, order):
        sl = boxes[i]
        comp = (lab[sl] == i + 1)
        h, w = comp.shape
        ph = np.array(ImageOps.fit(face, (w, h), Image.LANCZOS, centering=(.5, .5)))
        m = np.array(Image.fromarray((comp * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
        m &= al[sl] > 0
        reg = out[sl]
        reg[..., :3][m] = ph[m]
        reg[..., 3][m] = 255
    img = Image.fromarray(out)
    img = img.resize((1000, int(img.height * 1000 / img.width)), Image.LANCZOS)

    if a.out:
        bg = Image.new('RGBA', img.size, (109, 22, 32, 255))
        bg.alpha_composite(img)
        bg.convert('RGB').save(a.out, quality=88)
        print('미리보기 저장:', a.out)
        return

    img.save(os.path.join(ROOT, 'img', 'locket.png'), optimize=True)
    html = os.path.join(ROOT, 'index.html')
    s = open(html, encoding='utf8').read()
    s = re.sub(r'\?v=(\d+)', lambda m: f'?v={int(m.group(1)) + 1}', s)
    open(html, 'w', encoding='utf8').write(s)
    print('완료: img/locket.png 를 새로 만들었고 캐시 숫자를 올렸습니다.')


if __name__ == '__main__':
    main()
