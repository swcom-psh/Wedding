"""
방명록 카드 이미지 처리 스크립트
배경/댓글달기 1~10.jpg 원본에서 배경을 투명하게 분리(Cutout/Alpha matting)하여
img/ 폴더에 웹 최적화된 방명록 카드 투명 PNG로 저장합니다.
"""
import os
import cv2
import numpy as np
from PIL import Image

SRC_DIR = r'd:\coding\Wedding\배경'
IMG_DIR = r'd:\coding\Wedding\img'

def load_img(path):
    with open(path, 'rb') as f:
        return cv2.imdecode(np.asarray(bytearray(f.read()), dtype=np.uint8), cv2.IMREAD_COLOR)

def process_card(num):
    src_path = os.path.join(SRC_DIR, f'댓글달기{num}.jpg')
    if not os.path.exists(src_path):
        print(f'File not found: {src_path}')
        return None

    bgr = load_img(src_path)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]

    # 코너 배경색 추정
    corners = [
        rgb[10:50, 10:50],
        rgb[10:50, w-50:w-10],
        rgb[h-50:h-10, 10:50],
        rgb[h-50:h-10, w-50:w-10]
    ]
    corner_bg = np.median([c.mean(axis=(0, 1)) for c in corners], axis=0)
    diff = np.linalg.norm(rgb.astype(float) - corner_bg, axis=2)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # 배경 영역 감지 (어두운 버건디/브라운 계열)
    bg_mask = (diff < 35) | (hsv[:, :, 2] < 60)
    fg_candidates = ~bg_mask

    # 상단 핀터레스트 로고 제거 (y < 160 상단 영역 배제)
    fg_candidates[:160, :int(w * 0.55)] = False

    # 연결 요소 분석 (가장 큰 카드가 전경)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(fg_candidates.astype(np.uint8), connectivity=8)
    if num_labels <= 1:
        print(f'Card {num}: no components found')
        return None

    largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    card_mask = (labels == largest_label).astype(np.uint8) * 255

    # 카드 외곽선 검출 및 내부 채우기 (카드 안의 리본, 클립, 글씨 등 보존)
    contours, hierarchy = cv2.findContours(card_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    card_outer = np.zeros_like(card_mask)
    cv2.drawContours(card_outer, contours, -1, 255, -1)

    # 레이스 외곽 구멍(lace holes) 중 배경색과 일치하는 부분만 투명화
    lace_holes = (card_outer == 255) & (diff < 26)
    final_mask = card_outer.copy()
    final_mask[lace_holes] = 0

    # 테두리 안티에일리어싱 (부드러운 가장자리)
    final_mask_float = cv2.GaussianBlur(final_mask, (5, 5), 1.2) / 255.0

    # 카드 바운딩 박스 크롭
    y_idx, x_idx = np.where(final_mask > 20)
    ymin, ymax = y_idx.min(), y_idx.max()
    xmin, xmax = x_idx.min(), x_idx.max()

    cw, ch = xmax - xmin, ymax - ymin
    rgba = np.dstack([rgb, (final_mask_float * 255).astype(np.uint8)])
    cropped = rgba[ymin:ymax, xmin:xmax]

    out_im = Image.fromarray(cropped)
    # 가로 720px로 리사이즈하여 웹 성능 최적화
    target_w = 720
    target_h = int(ch * (target_w / cw))
    resized = out_im.resize((target_w, target_h), Image.LANCZOS)

    out_name = f'gb-card-{num}.png'
    out_path = os.path.join(IMG_DIR, out_name)
    resized.save(out_path)
    print(f'Saved {out_name} ({target_w}x{target_h}, ratio={target_w/target_h:.3f})')
    return target_w, target_h

def main():
    os.makedirs(IMG_DIR, exist_ok=True)
    for i in range(1, 11):
        process_card(i)

    # 의미 있는 이름으로도 복사
    named_copies = [
        ('gb-card-1.png', 'gb-ribbon.png'),
        ('gb-card-2.png', 'gb-clip.png'),
        ('gb-card-3.png', 'gb-vintage.png'),
        ('gb-card-4.png', 'gb-mini-ribbon.png'),
        ('gb-card-7.png', 'gb-elegance.png'),
        ('gb-card-9.png', 'gb-classic.png'),
    ]
    for src, dst in named_copies:
        sp = os.path.join(IMG_DIR, src)
        dp = os.path.join(IMG_DIR, dst)
        if os.path.exists(sp):
            Image.open(sp).save(dp)
            print(f'Copied {src} -> {dst}')

if __name__ == '__main__':
    main()
