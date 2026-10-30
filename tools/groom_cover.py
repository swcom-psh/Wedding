"""
표지 왼쪽 신랑 사진 만들기: 신랑만 분리해서 스튜디오 흰 커튼 배경에 자연스럽게 합성.

    python tools/groom_cover.py            → 배경/원본/groom_cover.png 생성 (표지 합성용)

입력
  웨딩사진/신랑사진.jpg   신랑 원본
  웨딩사진/15.jpg         같은 스튜디오의 흰 커튼 사진 (사람 없는 윗부분만 배경으로 사용)
필요: pip install pillow numpy opencv-python-headless "rembg[cpu]"
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '웨딩사진', '신랑사진.jpg')
CURTAIN = os.path.join(ROOT, '웨딩사진', '15.jpg')
OUT_DIR = os.path.join(ROOT, '배경', '원본')
MASK = os.path.join(OUT_DIR, 'groom_mask.png')

# 표지에 쓸 영역 (얼굴~상반신, 신부 사진과 얼굴 크기가 비슷하도록) — 원본 픽셀 기준 x1, y1, x2, y2
BOX = (584, 1495, 2141, 3465)


def main():
    src = ImageOps.exif_transpose(Image.open(SRC)).convert('RGB')
    W, H = src.size
    rgb = np.array(src).astype(np.float32)

    # 1) 사람 윤곽 (머리카락 결까지 잡는 인물 전용 모델, 한 번 만들면 저장해서 재사용)
    if os.path.exists(MASK):
        a0 = np.array(Image.open(MASK)).astype(np.float32) / 255
    else:
        from rembg import remove, new_session
        a0 = np.array(remove(src, session=new_session('birefnet-portrait'), only_mask=True)).astype(np.float32) / 255
        Image.fromarray((a0 * 255).astype('uint8')).save(MASK)
    # 모델 윤곽은 가장자리가 너무 넓게 흐려서(머리 둘레가 뿌옇게 번짐) 원래 머리선에 맞게 좁힘
    a = np.clip((a0 - .35) / .4, 0, 1)
    a = a * a * (3 - 2 * a)

    hm = (a0 > .5).astype(np.uint8)
    rows = np.where(hm[:, int(W * .3):int(W * .7)].any(1))[0]
    top = int(rows.min()) if len(rows) else 0

    # 팔·허리 사이로 보이는 어두운 커튼 조각 제거 (넥타이 아래 높이부터, 피부색은 유지)
    r, g = rgb[..., 0], rgb[..., 1]
    dark = (rgb.mean(2) < 115) & ~(r > g + 15)
    dark[:top + 820] = False
    a[dark] = 0
    a = cv2.GaussianBlur(a, (0, 0), .9)           # 칼로 자른 듯한 윤곽만 살짝 부드럽게

    # 가장자리 색: 뒤 커튼 색이 번지지 않게 안쪽(사람) 색으로 채움
    # 윤곽 바로 안쪽 몇 픽셀도 커튼 색이 섞여 있어서(얼굴·귀 테두리의 회색 선) 안쪽으로 좁힌 영역의 색을 씀
    solid = cv2.erode((a0 > .95).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
    num = cv2.GaussianBlur(rgb * solid[..., None], (0, 0), 18)
    den = cv2.GaussianBlur(solid, (0, 0), 18)[..., None] + 1e-6
    fg = np.where(((a > .02) & (solid < .5))[..., None], num / den, rgb)

    # 2) 배경: 15번 사진의 흰 커튼 (사람이 없는 윗부분). 커튼 주름은 세로라서 세로로 늘려도 자연스러움
    cur = ImageOps.exif_transpose(Image.open(CURTAIN)).convert('RGB')
    cw, ch = cur.size
    band = cur.crop((0, 0, cw, int(ch * .30)))
    k = H * 1.0 / band.height
    band = band.resize((int(band.width * k * .62), H), Image.LANCZOS)     # 주름 간격을 신랑 크기에 맞춤
    bg = Image.new('RGB', (W, H))
    x, flip = 0, False
    while x < W:
        bg.paste(ImageOps.mirror(band) if flip else band, (x, 0)); x += band.width; flip = not flip
    bg = cv2.GaussianBlur(np.array(bg).astype(np.float32), (0, 0), 5)      # 살짝 초점 밖 (심도)

    # 3) 빛 맞추기: 창가의 밝고 살짝 차가운 빛 → 사람 쪽 노란 실내 조명을 덜고 조금 밝게
    fg = fg * np.array([0.965, 1.0, 1.06]) * 1.06
    fg = np.clip((fg - 128) * .96 + 128, 0, 255)                          # 대비 살짝 낮춰 창가 빛처럼
    bg = bg * .93
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W * .5) / W) ** 2 + ((yy - H * .45) / H) ** 2)
    bg *= (1.05 - .28 * d)[..., None]                                       # 은은한 비네팅

    # 4) 그림자: 사람 뒤 커튼에 아주 은은하게 (빛이 앞 왼쪽에서 오는 방향)
    sh = cv2.GaussianBlur(a0, (0, 0), 60)
    sh = cv2.warpAffine(sh, np.float32([[1, 0, 45], [0, 1, 25]]), (W, H))
    bg *= (1 - .16 * sh)[..., None]

    # 5) 라이트 랩: 밝은 배경 빛이 윤곽에 살짝 번지게 → 오려 붙인 느낌 줄이기
    bgb = cv2.GaussianBlur(bg, (0, 0), 30)
    inner = cv2.GaussianBlur(a, (0, 0), 10)
    wrap = np.clip(a - inner, 0, 1) * 1.6
    wrap = np.clip(wrap, 0, .35)
    wrap[:top + 560] = 0                          # 머리·얼굴은 제외 (밝은 빛이 섞이면 회색 테두리처럼 보임)
    wrap = wrap[..., None]
    fg = fg * (1 - wrap) + np.maximum(fg, bgb) * wrap

    out = fg * a[..., None] + bg * (1 - a[..., None])

    # 6) 입자감 통일: 배경에도 원본 사진 정도의 노이즈를 넣어 매끈한 '그림' 느낌 제거
    hp = rgb - cv2.GaussianBlur(rgb, (0, 0), 1.5)
    sigma = float(np.std(hp[a0 > .9]))
    noise = np.random.default_rng(7).normal(0, sigma * .9, (H, W, 1)).astype(np.float32)
    out += noise * (1 - a[..., None])

    img = Image.fromarray(np.clip(out, 0, 255).astype('uint8')).crop(BOX)
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, 'groom_cover.png'))
    print('완료', img.size, 'grain', round(sigma, 2))


if __name__ == '__main__':
    main()
