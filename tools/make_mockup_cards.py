# -*- coding: utf-8 -*-
import os
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = r"d:\coding\Wedding"
TAPE_PATH = os.path.join(ROOT, "img", "tape.png")
BG_PATH = os.path.join(ROOT, "img", "bg-wine.jpg")
FONTS_DIR = os.path.join(ROOT, "tools", "fonts")
OUT_DIR = os.path.join(ROOT, "tools", "mockups_clean")
ARTIFACT_DIR = r"C:\Users\pshyu\.gemini\antigravity\brain\90308072-c840-4aae-9a8e-acf47a12716f\mockups"

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

# 5 lines
LINES = [
    (0.134, "해맑게 웃던 모습에 서로 반했고,"),
    (0.300, "그 웃음을 지켜보다보니"),
    (0.477, "이제는 서로가 없어서는 안될 존재가 되었습니다."),
    (0.650, "그 마음을 오래 지키기 위해"),
    (0.824, "이제 부부가 되려 합니다.")
]

# Candidates: (num, code, display_name, description, font_file, font_size)
CANDIDATES = [
    (1, "gowun_dodum", "고운돋움", "라벨기 인쇄 감성 · 단정하고 깔끔한 감성 고딕", "GowunDodum-Regular.ttf", 46),
    (2, "gowun_batang", "고운바탕", "시집·문학작품 같은 서정적이고 단아한 명조", "GowunBatang-Regular.ttf", 46),
    (3, "gaegu", "개구 (기존)", "자유롭고 귀여운 내추럴 손글씨", "Gaegu-Regular.ttf", 52),
    (4, "dongle", "동글", "둥글둥글 따뜻하고 아기자기한 볼펜체", "Dongle-Regular.ttf", 68),
    (5, "hi_melody", "하이멜로디", "소녀 일기장처럼 부드럽고 산뜻한 펜글씨", "HiMelody-Regular.ttf", 52),
    (6, "gamja_flower", "감자꽃", "또박또박 정성스럽게 쓴 일기장 손글씨", "GamjaFlower-Regular.ttf", 48),
    (7, "poor_story", "푸어스토리", "빈티지 다이어리 느낌의 내추럴 펜체", "PoorStory-Regular.ttf", 48),
    (8, "yeon_sung", "연성체", "붓펜 캘리 느낌의 따뜻하고 운치 있는 글씨", "YeonSung-Regular.ttf", 48),
    (9, "song_myung", "송명", "붓터치가 느껴지는 기품 있고 우아한 명조", "SongMyung-Regular.ttf", 48),
]

tape_raw = Image.open(TAPE_PATH).convert("RGBA")
tw, th = tape_raw.size

# Background tile
bg_tile = Image.open(BG_PATH).convert("RGB")

def render_single_mockup(cand):
    num, code, name, desc, font_file, fsize = cand
    font_path = os.path.join(FONTS_DIR, font_file)
    font = ImageFont.truetype(font_path, fsize)
    
    # Canvas: width = tw + 80 = 1080, height = th + 180 = 946
    cw, ch = tw + 80, th + 170
    
    # Tile wine bg
    canvas = Image.new("RGB", (cw, ch))
    for x in range(0, cw, bg_tile.width):
        for y in range(0, ch, bg_tile.height):
            canvas.paste(bg_tile, (x, y))
            
    # Paste tape
    tape_x = (cw - tw) // 2
    tape_y = 120
    canvas.paste(tape_raw, (tape_x, tape_y), tape_raw)
    
    draw = ImageDraw.Draw(canvas)
    
    # Title badge on top
    badge_x0, badge_y0 = 30, 20
    badge_x1, badge_y1 = cw - 30, 100
    # Rounded badge
    draw.rounded_rectangle([badge_x0, badge_y0, badge_x1, badge_y1], radius=12, fill=(40, 10, 15, 230), outline=(212, 175, 55), width=2)
    
    header_font = ImageFont.truetype(os.path.join(FONTS_DIR, "GowunDodum-Regular.ttf"), 30)
    sub_font = ImageFont.truetype(os.path.join(FONTS_DIR, "GowunDodum-Regular.ttf"), 20)
    
    draw.text((cw // 2, badge_y0 + 26), f"[{num}번] {name}", font=header_font, fill=(255, 245, 220), anchor="mm")
    draw.text((cw // 2, badge_y0 + 58), desc, font=sub_font, fill=(230, 210, 190), anchor="mm")
    
    # Text lines on tape
    for rel_y, line_text in LINES:
        ty = tape_y + int(th * rel_y)
        tx = cw // 2
        draw.text((tx, ty), line_text, font=font, fill=(44, 26, 18), anchor="mm")
        
    return canvas

rendered_images = []
for cand in CANDIDATES:
    img = render_single_mockup(cand)
    filename = f"mockup_{cand[0]}_{cand[1]}.jpg"
    out_path = os.path.join(OUT_DIR, filename)
    img.save(out_path, quality=93)
    
    # Also copy to artifact dir
    art_path = os.path.join(ARTIFACT_DIR, filename)
    img.save(art_path, quality=93)
    
    rendered_images.append((cand, img, out_path, art_path))
    print(f"Rendered {filename}")

# Generate a 3x3 compact comparison grid (or 3-column / 3-row)
# Let's create a 3x3 grid overview:
cols = 3
rows = 3
cell_w = 480
cell_h = int(946 * (480 / 1080))
grid_w = cell_w * cols + 40
grid_h = cell_h * rows + 60

grid_img = Image.new("RGB", (grid_w, grid_h), (25, 6, 9))
for idx, (cand, img, _, _) in enumerate(rendered_images):
    c = idx % cols
    r = idx // cols
    x = 20 + c * cell_w
    y = 30 + r * cell_h
    resized = img.resize((cell_w, cell_h), Image.Resampling.LANCZOS)
    grid_img.paste(resized, (x, y))

grid_path = os.path.join(OUT_DIR, "font_comparison_grid.jpg")
grid_img.save(grid_path, quality=92)
grid_art_path = os.path.join(ARTIFACT_DIR, "font_comparison_grid.jpg")
grid_img.save(grid_art_path, quality=92)
print("Grid image saved:", grid_art_path)

# Also generate two stacked comparison sheets for comfortable mobile/desktop scrolling:
# Sheet 1: 1~5
# Sheet 2: 6~9
def make_vertical_sheet(cands_indices, sheet_name):
    selected = [rendered_images[i] for i in cands_indices]
    sw = 800
    sh = int(946 * (800 / 1080)) * len(selected) + 20 * (len(selected) + 1)
    sheet = Image.new("RGB", (sw, sh), (20, 5, 8))
    cur_y = 20
    for cand, img, _, _ in selected:
        h = int(946 * (800 / 1080))
        res = img.resize((sw - 40, h), Image.Resampling.LANCZOS)
        sheet.paste(res, (20, cur_y))
        cur_y += h + 20
    s_path = os.path.join(OUT_DIR, sheet_name)
    sheet.save(s_path, quality=92)
    s_art = os.path.join(ARTIFACT_DIR, sheet_name)
    sheet.save(s_art, quality=92)
    print("Saved sheet:", s_art)

make_vertical_sheet([0, 1, 2, 3], "sheet_part1.jpg")
make_vertical_sheet([4, 5, 6, 7, 8], "sheet_part2.jpg")

print("All mockups successfully generated and copied to artifact directory!")

