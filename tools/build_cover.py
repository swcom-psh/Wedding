"""
표지(img/cover.jpg)의 사진 칸 교체 도구.

    python tools/build_cover.py --left 배경/원본/groom_cover.png
    python tools/build_cover.py --right 배경/원본/bride.jpg --right-cy 0.28

  - 배경/대문사진.png 의 두 사진 칸(하늘색 부분)에 사진을 채워 표지를 만듭니다.
  - 지정하지 않은 쪽 칸은 지금 표지(img/cover.jpg)의 사진을 그대로 둡니다.
  - --left-cy / --right-cy : 세로 위치 (0=위, 1=아래, 기본 .5)
  - index.html 의 cover.jpg 캐시 숫자(?v=)도 자동으로 올립니다.
"""
import argparse
import os
import re

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTER = os.path.join(ROOT, '배경', '대문사진.png')
COVER = os.path.join(ROOT, 'img', 'cover.jpg')
WINDOWS = {'left': (514, 1399), 'right': (1503, 2388)}   # 사진 칸 가로 범위 (대문사진 기준)
Y0, Y1 = 1697, 2816                                       # 사진 칸 세로 범위


def window_mask(arr, x0, x1):
    """사진 칸(하늘색 풍경)만 고르기. 칸 안에 갇힌 구름도 포함, 하트 스티커는 제외."""
    r, g, b = [arr[..., i].astype(int) for i in range(3)]
    red = (r > g + 40) & (r > b + 40)
    region = np.zeros(arr.shape[:2], bool); region[Y0:Y1, x0:x1] = True
    m = ((g > r + 8) | (b > r + 8)) & region
    filled = ndi.binary_fill_holes(np.pad(m, 1, constant_values=True))[1:-1, 1:-1]
    lab, n = ndi.label(filled & ~m)
    for i in range(1, n + 1):
        c = lab == i
        if not (red & c).any() and c.sum() < 60000:
            m |= c
    m = np.array(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--left'); ap.add_argument('--right')
    ap.add_argument('--left-cy', type=float, default=.5); ap.add_argument('--right-cy', type=float, default=.5)
    o = ap.parse_args()

    poster = np.array(Image.open(POSTER).convert('RGB'))
    out = poster.copy()
    keep = []                                     # 지금 표지에서 그대로 둘 칸
    for side, (x0, x1) in WINDOWS.items():
        path, cy = getattr(o, side), getattr(o, f'{side}_cy')
        m = window_mask(poster, x0, x1)
        if not path:
            keep.append(m); continue
        im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        ph = np.array(ImageOps.fit(im, (x1 - x0, Y1 - Y0), Image.LANCZOS, centering=(.5, cy)))
        sub = m[Y0:Y1, x0:x1]
        out[Y0:Y1, x0:x1][sub] = ph[sub]

    img = Image.fromarray(out)
    img.thumbnail((1200, 1800), Image.LANCZOS)
    if keep and os.path.exists(COVER):
        old = Image.open(COVER).convert('RGB').resize(img.size)
        km = np.zeros(poster.shape[:2], bool)
        for m in keep: km |= m
        km = Image.fromarray((km * 255).astype('uint8')).resize(img.size, Image.LANCZOS)
        img = Image.composite(old, img, km)
    img.save(COVER, quality=88, optimize=True)

    html = os.path.join(ROOT, 'index.html')
    s = open(html, encoding='utf8').read()
    s = re.sub(r'img/cover\.jpg\?v=(\d+)', lambda m: f'img/cover.jpg?v={int(m.group(1)) + 1}', s)
    open(html, 'w', encoding='utf8').write(s)
    print('완료:', COVER, img.size)


if __name__ == '__main__':
    main()
