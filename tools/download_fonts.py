# -*- coding: utf-8 -*-
import os
import urllib.request

FONTS_DIR = r"d:\coding\Wedding\tools\fonts"
os.makedirs(FONTS_DIR, exist_ok=True)

font_catalog = {
    "1_gowun_dodum": ("GowunDodum-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/gowundodum/GowunDodum-Regular.ttf"),
    "2_gowun_batang": ("GowunBatang-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/gowunbatang/GowunBatang-Regular.ttf"),
    "3_gaegu": ("Gaegu-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/Gaegu-Regular.ttf"),
    "4_dongle": ("Dongle-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/dongle/Dongle-Regular.ttf"),
    "5_hi_melody": ("HiMelody-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/himelody/HiMelody-Regular.ttf"),
    "6_gamja_flower": ("GamjaFlower-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/gamjaflower/GamjaFlower-Regular.ttf"),
    "7_poor_story": ("PoorStory-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/poorstory/PoorStory-Regular.ttf"),
    "8_yeon_sung": ("YeonSung-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/yeonsung/YeonSung-Regular.ttf"),
    "9_song_myung": ("SongMyung-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/songmyung/SongMyung-Regular.ttf"),
}

for key, (filename, url) in font_catalog.items():
    dest = os.path.join(FONTS_DIR, filename)
    if not os.path.exists(dest) or os.path.getsize(dest) < 1000:
        print(f"Downloading {filename}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp, open(dest, 'wb') as f:
                f.write(resp.read())
            print(f"Downloaded {filename}: {os.path.getsize(dest)} bytes")
        except Exception as e:
            print(f"Error downloading {filename}: {e}")
    else:
        print(f"Found {filename}: {os.path.getsize(dest)} bytes")

