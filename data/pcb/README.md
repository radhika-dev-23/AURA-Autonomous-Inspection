# PCB Image Dataset

## Source
The PCB photograph used as the base image for AURA's inspection demos
is sourced from Wikimedia Commons.

**Image:** SEG DVD 430 — Printed circuit board-4276.jpg  
**Author:** Raimond Spekking  
**License:** CC BY-SA 3.0  
**URL:** https://commons.wikimedia.org/wiki/File:SEG_DVD_430_-_Printed_circuit_board-4276.jpg

## Generated Test Images

The following test images are procedurally derived from the source photograph
to demonstrate AURA's OpenCV-based defect detection capabilities:

| File | Description |
|------|-------------|
| `templates/board_01_clean.jpg` | Clean template (800×600 crop of original) |
| `clean/board_01_clean.jpg` | Identical to template (for PASS scenario) |
| `test/board_01_obvious_defect.jpg` | Simulated open circuit (horizontal gap in traces) |
| `test/board_01_subtle_defect.jpg` | Simulated solder bridge (small metallic blob between pads) |
| `test/board_01_subtle_defect_zoomed.jpg` | Perspective-warped close-up of subtle defect (simulates camera reposition) |

## Runtime Artifacts

These files are generated during inspection by the OpenCV pipeline:

| File | Description |
|------|-------------|
| `test/current_diff.jpg` | Grayscale absolute difference (template vs test) |
| `test/current_heatmap.jpg` | JET colormap visualization of the difference |

## Generation Script

Run `scripts/generate_real_test_set.py` to regenerate all test images from the source.
