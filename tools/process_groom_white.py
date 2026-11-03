# -*- coding: utf-8 -*-
import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = r"d:\coding\Wedding"
SRC_PATH = r"d:\coding\Wedding\웨딩사진\신랑사진_화이트.jpg"
CURTAIN_PATH = r"d:\coding\Wedding\웨딩사진\15.jpg"
MASK_PATH = r"d:\coding\Wedding\tools\rembg_mask.png"

# Load source image
src_img = Image.open(SRC_PATH).convert("RGB")
src_rgb = np.array(src_img).astype(np.float32)
H, W = src_rgb.shape[:2]

# Load rembg mask
mask_img = Image.open(MASK_PATH).convert("L")
mask = np.array(mask_img).astype(np.float32) / 255.0

# 1. Clean the suit body mask (y >= 340)
# Detect the dark drop shadow on the outer border of the suit
# Luminance: 0.299 R + 0.587 G + 0.114 B
lum = 0.299 * src_rgb[..., 0] + 0.587 * src_rgb[..., 1] + 0.114 * src_rgb[..., 2]

# Outer background mask (where original was white)
is_white_bg = (src_rgb[..., 0] > 248) & (src_rgb[..., 1] > 248) & (src_rgb[..., 2] > 248)

# Find pixels within distance of 8px from white background
dist_to_bg = cv2.distanceTransform(is_white_bg.astype(np.uint8), cv2.DIST_L2, 5)
dist_from_inside = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 5)

# On the suit (y >= 340):
# If a pixel has luminance < 170 and is within 7px of the outer edge, it's the artificial dark shadow!
# Note: Hands at y > 750 have skin tone (R > G > B, lum ~140-190).
# Let's check skin tone: (R > G + 15) & (G > B). We don't want to cut real fingers.
is_skin = (src_rgb[..., 0] > src_rgb[..., 1] + 12) & (src_rgb[..., 1] > src_rgb[..., 2] - 5)
is_shadow_fringe = (lum < 175) & ~is_skin & (dist_from_inside < 6.5)

# Clear shadow fringe from mask for y >= 340
clean_mask = mask.copy()
suit_region = np.zeros((H, W), dtype=bool)
suit_region[340:, :] = True
clean_mask[suit_region & is_shadow_fringe] = 0.0

# Morphological smoothing on clean_mask to remove small spikes/notches
clean_mask_bin = (clean_mask > 0.5).astype(np.uint8)
# Close small holes
clean_mask_bin = cv2.morphologyEx(clean_mask_bin, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
# Smooth edge with guided filter / bilateral / gaussian
clean_alpha = cv2.GaussianBlur(clean_mask_bin.astype(np.float32), (5, 5), 1.0)
# Ensure binary core is solid
solid_core = cv2.erode(clean_mask_bin, np.ones((7, 7), np.uint8)).astype(bool)
clean_alpha[solid_core] = 1.0

# 2. Edge color decontamination (color extension / defringing)
# For all edge pixels (0.01 < clean_alpha < 0.99), fill their RGB with the color of the solid foreground!
fg_rgb = src_rgb.copy()
# Erode solid foreground by 3px so we only sample true inner colors
sample_mask = cv2.erode(clean_mask_bin, np.ones((5, 5), np.uint8)).astype(bool)
# Normalized convolution for smooth color extension
num = cv2.GaussianBlur(fg_rgb * sample_mask[..., None], (0, 0), 12)
den = cv2.GaussianBlur(sample_mask.astype(np.float32), (0, 0), 12)[..., None] + 1e-6
extended_color = num / den

# Where alpha is semi-transparent, replace RGB with extended_color
edge_region = (clean_alpha > 0.01) & (clean_alpha < 0.98)
fg_decontaminated = np.where(edge_region[..., None], extended_color, fg_rgb)

# Save intermediate cutout with transparent background
rgba = np.dstack([fg_decontaminated, clean_alpha * 255]).clip(0, 255).astype(np.uint8)
Image.fromarray(rgba).save(r"d:\coding\Wedding\tools\clean_groom_cutout.png")
print("Saved clean_groom_cutout.png")

# 3. Create Studio Curtain Background (matching 15.jpg)
cur = ImageOps.exif_transpose(Image.open(CURTAIN_PATH)).convert("RGB")
cw, ch = cur.size
band = cur.crop((0, 0, cw, int(ch * 0.32)))
# Target canvas for groom: 885 x 1119 (the exact window size in poster)
TARGET_W, TARGET_H = 885, 1119

# Resize curtain band to fill TARGET_W, TARGET_H
k = TARGET_H * 1.0 / band.height
band_resized = band.resize((int(band.width * k * 0.55), TARGET_H), Image.LANCZOS)
bg_canvas = Image.new("RGB", (TARGET_W, TARGET_H))
cur_x = 0
flip = False
while cur_x < TARGET_W:
    tile = ImageOps.mirror(band_resized) if flip else band_resized
    bg_canvas.paste(tile, (cur_x, 0))
    cur_x += band_resized.width
    flip = not flip

# Soft depth of field blur on curtain
bg_arr = cv2.GaussianBlur(np.array(bg_canvas).astype(np.float32), (0, 0), 6)
# Match lighting: slight brightness and gentle radial vignette
bg_arr *= 0.98

# 4. Place groom onto the curtain background
# We want head top around y = 85, head width ~ 240
# Groom cutout: hair top is at y=160, chin at y=360 (height 200), width ~ 460
# Scale factor:
scale = 1.35
new_w = int(W * scale)
new_h = int(H * scale)

# Resize fg and alpha
fg_resized = cv2.resize(fg_decontaminated, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
alpha_resized = cv2.resize(clean_alpha, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

# We want hair top (was at y=160 -> now at 160 * 1.35 = 216) to be at y = 90
paste_y = 90 - int(160 * scale)
# Center horizontally: groom center is around x = 288 * scale = 388 -> want at 442
paste_x = (TARGET_W // 2) - int(288 * scale)

# Composite onto bg_canvas
out_canvas = bg_arr.copy()

# Compute overlap
src_y0 = max(0, -paste_y)
src_y1 = min(new_h, TARGET_H - paste_y)
src_x0 = max(0, -paste_x)
src_x1 = min(new_w, TARGET_W - paste_x)

dst_y0 = max(0, paste_y)
dst_y1 = dst_y0 + (src_y1 - src_y0)
dst_x0 = max(0, paste_x)
dst_x1 = dst_x0 + (src_x1 - src_x0)

fg_patch = fg_resized[src_y0:src_y1, src_x0:src_x1]
a_patch = alpha_resized[src_y0:src_y1, src_x0:src_x1, None]
bg_patch = out_canvas[dst_y0:dst_y1, dst_x0:dst_x1]

# Light wrap (subtle wrap around groom body to integrate with white background)
bgb = cv2.GaussianBlur(bg_patch, (0, 0), 25)
wrap = np.clip(cv2.GaussianBlur(a_patch[..., 0], (0, 0), 8) - cv2.GaussianBlur(a_patch[..., 0], (0, 0), 16), 0, 0.25)[..., None]
fg_blended = fg_patch * (1 - wrap) + np.maximum(fg_patch, bgb) * wrap

comp_patch = fg_blended * a_patch + bg_patch * (1 - a_patch)
out_canvas[dst_y0:dst_y1, dst_x0:dst_x1] = comp_patch

# Add delicate photographic film grain matching studio portrait
noise = np.random.default_rng(42).normal(0, 1.8, (TARGET_H, TARGET_W, 1)).astype(np.float32)
out_canvas = np.clip(out_canvas + noise, 0, 255).astype(np.uint8)

out_img = Image.fromarray(out_canvas)
out_path = r"d:\coding\Wedding\tools\test_groom_fitted.jpg"
out_img.save(out_path, quality=95)
print(f"Saved fitted groom window: {out_path} ({TARGET_W}x{TARGET_H})")
