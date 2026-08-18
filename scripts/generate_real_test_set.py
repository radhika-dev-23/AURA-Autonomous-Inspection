"""
Generate real PCB test images for AURA inspection demo.

Source: Wikimedia Commons - SEG DVD 430 PCB photograph
License: CC BY-SA 3.0
Author: Raimond Spekking
URL: https://commons.wikimedia.org/wiki/File:SEG_DVD_430_-_Printed_circuit_board-4276.jpg
"""
import cv2
import numpy as np
import urllib.request
import os
import ssl

URL = 'https://upload.wikimedia.org/wikipedia/commons/a/a4/SEG_DVD_430_-_Printed_circuit_board-4276.jpg'
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data', 'pcb')

def download_image():
    print("Downloading Wikimedia PCB image...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (AURA-Hackathon/1.0)'})
    resp = urllib.request.urlopen(req, context=ctx)
    img_array = np.asarray(bytearray(resp.read()), dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    print(f"  Downloaded: {img.shape[1]}x{img.shape[0]}")
    return img

def create_datasets():
    img = download_image()

    # Resize to manageable width, keeping aspect ratio
    h, w = img.shape[:2]
    new_w = 1200
    new_h = int((new_w / w) * h)
    img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Crop to 800x600 centered on the IC area
    cy, cx = new_h // 2, new_w // 2
    crop_h, crop_w = 600, 800
    y1 = max(cy - crop_h // 2, 0)
    x1 = max(cx - crop_w // 2, 0)
    img = img[y1:y1+crop_h, x1:x1+crop_w]

    # Ensure exact size
    img = cv2.resize(img, (800, 600), interpolation=cv2.INTER_AREA)
    print(f"  Cropped to: {img.shape[1]}x{img.shape[0]}")

    # ── CLEAN TEMPLATE ──
    clean_path = os.path.join(DATA_DIR, 'templates', 'board_01_clean.jpg')
    cv2.imwrite(clean_path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"  Saved: {clean_path}")

    # Also save a copy as the "clean test" image (identical to template = PASS)
    clean_test_path = os.path.join(DATA_DIR, 'clean', 'board_01_clean.jpg')
    cv2.imwrite(clean_test_path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"  Saved: {clean_test_path}")

    # ── OBVIOUS DEFECT: Open Circuit ──
    # Simulate a break in a copper trace between IC pins
    # Draw a prominent dark gap across traces near the bottom of the large IC
    obvious_img = img.copy()

    # Find a trace-heavy area near the IC (bottom-center of image)
    # Draw a wide, dark horizontal band simulating a severed trace
    gap_y = 320  # Just below the main IC
    gap_x1, gap_x2 = 280, 420  # Across the trace area
    gap_thickness = 8

    # Draw the gap: erase the trace with PCB substrate color
    substrate_color = (45, 120, 35)  # Dark green PCB substrate
    cv2.rectangle(obvious_img, (gap_x1, gap_y - gap_thickness//2),
                  (gap_x2, gap_y + gap_thickness//2), substrate_color, -1)

    # Add subtle edge effects for realism
    cv2.line(obvious_img, (gap_x1, gap_y - gap_thickness//2),
             (gap_x2, gap_y - gap_thickness//2), (30, 90, 25), 1)
    cv2.line(obvious_img, (gap_x1, gap_y + gap_thickness//2),
             (gap_x2, gap_y + gap_thickness//2), (30, 90, 25), 1)

    obvious_path = os.path.join(DATA_DIR, 'test', 'board_01_obvious_defect.jpg')
    cv2.imwrite(obvious_path, obvious_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"  Saved: {obvious_path}")

    # ── SUBTLE DEFECT: Solder Bridge ──
    # Simulate a tiny solder bridge between two SMD pads
    subtle_img = img.copy()

    # Place the solder bridge near the small SMD components (bottom-right area)
    bridge_x, bridge_y = 420, 460  # Between SMD pads
    bridge_w, bridge_h = 12, 6

    # Draw a metallic-looking solder blob bridging two pads
    solder_color = (200, 200, 210)  # Bright metallic solder
    cv2.ellipse(subtle_img, (bridge_x, bridge_y), (bridge_w, bridge_h),
                0, 0, 360, solder_color, -1)
    # Add specular highlight
    cv2.ellipse(subtle_img, (bridge_x - 2, bridge_y - 1), (4, 2),
                0, 0, 360, (240, 240, 250), -1)

    subtle_path = os.path.join(DATA_DIR, 'test', 'board_01_subtle_defect.jpg')
    cv2.imwrite(subtle_path, subtle_img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"  Saved: {subtle_path}")

    # ── ZOOMED SUBTLE DEFECT (Recheck view) ──
    # Simulate camera moving closer + angling: crop tightly around the defect region
    # and apply a perspective warp to simulate 35° tilt
    zoomed_img = subtle_img.copy()

    # Crop a 400x300 region centered on the solder bridge
    crop_cx, crop_cy = bridge_x, bridge_y
    zx1 = max(crop_cx - 200, 0)
    zy1 = max(crop_cy - 150, 0)
    zx2 = min(zx1 + 400, 800)
    zy2 = min(zy1 + 300, 600)
    zoomed_crop = zoomed_img[zy1:zy2, zx1:zx2]

    # Scale up to 800x600 (simulates closer Z)
    zoomed_crop = cv2.resize(zoomed_crop, (800, 600), interpolation=cv2.INTER_CUBIC)

    # Apply perspective warp (simulates 35° camera tilt)
    rows, cols = zoomed_crop.shape[:2]
    pts1 = np.float32([[0, 0], [cols, 0], [0, rows], [cols, rows]])
    # Slight perspective shift - top narrows, bottom widens
    offset = 40
    pts2 = np.float32([[offset, 20], [cols - offset, 20],
                        [-offset//2, rows], [cols + offset//2, rows]])
    M = cv2.getPerspectiveTransform(pts1, pts2)
    zoomed_crop = cv2.warpPerspective(zoomed_crop, M, (cols, rows))

    # Simulate different lighting (angled = slightly warmer, more contrast)
    zoomed_crop = cv2.convertScaleAbs(zoomed_crop, alpha=1.15, beta=8)

    zoomed_path = os.path.join(DATA_DIR, 'test', 'board_01_subtle_defect_zoomed.jpg')
    cv2.imwrite(zoomed_path, zoomed_crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"  Saved: {zoomed_path}")

    print("\n✓ All test images generated successfully.")
    print(f"  Source: Wikimedia Commons (CC BY-SA 3.0)")
    print(f"  Author: Raimond Spekking")

if __name__ == "__main__":
    create_datasets()
