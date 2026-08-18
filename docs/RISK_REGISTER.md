# AURA — Risk Register (Revised)

## 1. Risk Matrix

| | Low Impact | Medium Impact | High Impact | Critical |
|---|---|---|---|---|
| **High Prob** | | | R02 (time) | |
| **Medium Prob** | | R04, R06 | R01, R03 | R05 |
| **Low Prob** | | R07 | | |

---

## 2. Risks

### R01 — CV Pipeline Produces Flat Defect Scores

| | |
|---|---|
| **Probability** | Medium |
| **Impact** | High |
| **Description** | Template diff produces similar defect scores for all images — can't distinguish PASS/FAIL/RECHECK |
| **Mitigation** | Pre-test pipeline on 5+ images in Phase 2 before integrating. Tune threshold parameter in `cv2.threshold()` and `min_area` filter. Select images that produce clearly different scores. |
| **Fallback L1** | Use synthetic PCB images with controlled defect severity (guaranteed to produce score variation). |
| **Fallback L2** | Scenario-guided ROI analysis: run real OpenCV only on the annotated defect region, ensuring localized analysis. |
| **Fallback L3** | Hardcode scenario results with disclaimer "Analysis simulated for demonstration". Preserves architecture story. |

### R02 — Time Overrun (One-Day Build)

| | |
|---|---|
| **Probability** | High |
| **Impact** | High |
| **Description** | Implementation takes longer than available time. |
| **Mitigation** | Strict P0/P1/P2 tiers. P2 is already removed. P1 drops at first sign of delay. |
| **Drop order** | (1) Heatmap overlay → (2) Simulated sensors → (3) SQLite → (4) Canvas animation (use static images) → (5) Timeline view (show text log) → (6) Explanation panel (show raw reasoning) |
| **Minimum viable** | Backend API + WebSocket + minimal HTML showing RECHECK cycle with text output. The RECHECK story must work even if the UI is bare. |

### R03 — RECHECK Second Observation Looks Same as First

| | |
|---|---|
| **Probability** | Medium |
| **Impact** | High |
| **Description** | Judges see no visual difference between observations, undermining the RECHECK story. |
| **Mitigation** | Use a different test image for obs 2 (or apply visible crop + contrast enhancement). Show both images side-by-side in the frontend. Display the different defect scores prominently. |
| **Fallback** | Use synthetic images where obs 2 is clearly zoomed/enhanced. |

### R04 — Dataset Download Fails

| | |
|---|---|
| **Probability** | Medium |
| **Impact** | Medium |
| **Description** | Cannot download DeepPCB images, or images don't work well with pipeline. |
| **Mitigation** | Bundle curated subset in the repository (10-15 small images). |
| **Fallback** | Synthetic PCB image generator using OpenCV drawing primitives. Works 100% offline. |

### R05 — Demo Machine Environment Issues

| | |
|---|---|
| **Probability** | Medium |
| **Impact** | Critical |
| **Description** | Python version conflicts, missing dependencies, antivirus blocking. |
| **Mitigation** | Pin all dependencies in `requirements.txt`. Test on clean venv. Use `opencv-python-headless` (no GUI dependencies). Minimal dependency count. |
| **Fallback** | Pre-recorded demo video as absolute last resort. |

### R06 — Judges Think It's Scripted

| | |
|---|---|
| **Probability** | Medium |
| **Impact** | Medium |
| **Description** | Demo appears to follow a predetermined script without real analysis. |
| **Mitigation** | (1) Show different scenarios with different outcomes. (2) Display real feature values that change per image. (3) Show processing time (proves real computation). (4) Let judges choose scenarios. (5) Explanation panel shows feature breakdown. |

### R07 — WebSocket Drops During Demo

| | |
|---|---|
| **Probability** | Low |
| **Impact** | Medium |
| **Description** | WebSocket disconnects, freezing the UI. |
| **Mitigation** | Auto-reconnect with state resync via REST API. "Refresh" button. |

---

## 3. Drop Order (When Time Runs Short)

When time pressure hits, drop features in this exact order:

```
First to drop:
  1. SQLite persistence (use in-memory dict)
  2. Defect heatmap overlay (P1)
  3. Simulated sensors (P1)
  4. Smooth robot animation (use instant position updates)

Then if still short:
  5. Canvas cell visualization (show images + text)
  6. Timeline component (show text log)
  7. Explanation panel (show raw reasoning array)

NEVER drop:
  ✗ OpenCV analysis
  ✗ Defect scoring
  ✗ RECHECK trigger
  ✗ Evidence fusion
  ✗ WebSocket state streaming
  ✗ Three scenarios
```
