# Stria Systems Edge Case Audit Report
**Date:** 2026-06-12
**Tool:** edge-case-audit.cjs (Playwright + Chromium)
**Scope:** 7 pages × 9 viewports = 63 test combinations
**Live URL:** https://striasystems.com
**Local Dev Server:** http://localhost:5176

---

## Executive Summary

| Metric | Baseline (2026-06-11) | Current (2026-06-12) | Delta |
|--------|----------------------|---------------------|-------|
| **Critical** | 0 | 0 | **0** ✅ |
| **High** | 261 | 225 | **-36** ✅ Improved |
| **Medium** | 347 | 399 | **+52** ⚠️ New detections |

**Overall: No critical/high regressions. High-severity issues reduced by 36 (edge-padding fixes). Medium-severity increased by 52 due to new code-overflow detections and additional small-text findings.**

---

## 🔴 Critical Regressions: **NONE** ✅

---

## 🟠 High Regressions: **NONE** ✅

---

## 🟡 Medium Regressions: 52 new detections

| Page | Viewport | Delta | Primary New Issue Types |
|------|----------|-------|------------------------|
| docs | mobile-320 | +6 | **3× code-overflow** + 3× small-text |
| docs | mobile-375 | +2 | small-text |
| docs | mobile-480 | +2 | small-text |
| platform | mobile-320 | +4 | **1× code-overflow** + 3× small-text |
| platform | mobile-375 | +3 | small-text |
| platform | mobile-480 | +3 | small-text |
| forge | mobile-320 | +4 | **1× code-overflow** + 3× small-text |
| forge | mobile-375 | +4 | small-text |
| forge | mobile-480 | +3 | small-text |
| trace | mobile-320 | +3 | small-text |
| trace | mobile-375 | +3 | small-text |
| trace | mobile-480 | +3 | small-text |
| demo | mobile-320 | +3 | **4× input-zoom** (pre-existing, now detected) |
| demo | mobile-375 | +3 | **4× input-zoom** |
| demo | mobile-480 | +3 | **4× input-zoom** |
| home | mobile-320 | +1 | small-text |
| home | mobile-375 | +1 | small-text |
| home | mobile-480 | +1 | small-text |

### New Issue Details

#### **code-overflow** (Medium) — NEW DETECTIONS
These are code blocks (`<pre>`/`<code>`) wider than their container on mobile viewports. Category marked as **"requiresDesignDecision"** in baseline.

- **docs @ mobile-320**: 3 code blocks overflow (code snippets in documentation)
- **platform @ mobile-320**: 1 code block overflow
- **forge @ mobile-320**: 1 code block overflow

*Recommendation: Add `overflow-x: auto` to code containers or redesign code presentation for mobile.*

#### **input-zoom** (Medium) — NOW DETECTED ON DEMO PAGE
Form inputs with `font-size: 15px < 16px` on mobile, triggering iOS viewport zoom on focus.

- **demo @ mobile-320/375/480**: 4 inputs each (name, email, company, message fields)

*Fix: Set `font-size: 16px` on all form inputs.*

#### **small-text** (Medium) — ADDITIONAL DETECTIONS
Text elements < 14px on mobile viewports. The audit detected additional instances, likely due to new content or stricter traversal.

---

## ✅ Improvements: 36 High-Severity Issues Resolved

| Page | Viewports | Fixed Issue | Before | After |
|------|-----------|-------------|--------|-------|
| home | mobile-320/375/480 | edge-padding | 11 high | 10 high |
| trace | mobile-320/375/480 | edge-padding | 11 high | 9 high |
| forge | mobile-320/375/480 | edge-padding | 11-12 high | 9 high |
| platform | mobile-320/375/480 | edge-padding | 12 high | 9 high |
| docs | mobile-320/375/480 | edge-padding | 11-12 high | 10 high |
| demo | mobile-320/375/480 | edge-padding | 11 high | 9 high |

**Root cause:** Footer/header/containers with 0px horizontal padding now have proper padding on mobile viewports.

---

## 📊 Per-Page Summary (Mobile Viewports)

### Home (`/`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 10 | 11 | 1 edge-padding, 10 small-text, 10 touch-target |
| mobile-375 | 0 | 10 | 11 | Same |
| mobile-480 | 0 | 10 | 11 | Same |

### Trace (`/trace`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 9 | 23 | 11 small-text (11-13px), 9 touch-target |
| mobile-375 | 0 | 9 | 23 | Same |
| mobile-480 | 0 | 9 | 23 | Same |

### Forge (`/forge`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 9 | 30 | 18 small-text, 9 touch-target, **1 code-overflow** |
| mobile-375 | 0 | 9 | 30 | Same |
| mobile-480 | 0 | 9 | 29 | Same |

### Platform (`/platform`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 9 | 37 | 26 small-text (10-13px), 9 touch-target, **1 code-overflow** |
| mobile-375 | 0 | 9 | 36 | Same |
| mobile-480 | 0 | 9 | 36 | Same |

### Architecture (`/architecture`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 11 | 10 | No change from baseline |
| mobile-375 | 0 | 11 | 10 | No change |
| mobile-480 | 0 | 11 | 10 | No change |

### Docs (`/trace/documentation`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 10 | 13 | 9 small-text, 7 touch-target, **3 code-overflow** |
| mobile-375 | 0 | 10 | 10 | 7 small-text, 7 touch-target |
| mobile-480 | 0 | 10 | 10 | Same |

### Demo (`/demo`)
| Viewport | Critical | High | Medium | Notes |
|----------|----------|------|--------|-------|
| mobile-320 | 0 | 9 | 12 | 7 small-text, 9 touch-target, **4 input-zoom** |
| mobile-375 | 0 | 9 | 12 | Same |
| mobile-480 | 0 | 9 | 12 | Same |

---

## 🎯 Action Items

### Priority 1: Fix input-zoom on Demo page (High impact, easy fix)
```css
/* Add to global styles or demo page styles */
input, textarea, select {
  font-size: 16px; /* Prevents iOS zoom on focus */
}
```

### Priority 2: Address code-overflow on Docs/Platform/Forge (Design decision needed)
```css
/* Option A: Allow horizontal scroll on code blocks */
pre, code {
  overflow-x: auto;
  max-width: 100%;
}

/* Option B: Responsive font-size for code on mobile */
@media (max-width: 768px) {
  pre, code { font-size: 12px; }
}
```

### Priority 3: Continue edge-padding fixes (In progress - 36/261 resolved)
The remaining 225 high-severity edge-padding issues are primarily:
- Footer containers (0px padding)
- Header/nav containers
- Band/section containers

---

## 📁 Artifacts

- **Full audit results:** `audit-results-2026-06-12.json`
- **Baseline:** `.github/context/edge-case-baseline.json`
- **Audit script:** `edge-case-audit.cjs`

---

## Next Steps

1. **No GitHub issue needed** — no critical/high regressions detected
2. **Update baseline** if the edge-padding improvements are intentional (recommended)
3. **Fix input-zoom on demo page** — quick win for mobile UX
4. **Review code-overflow on docs/platform/forge** — design decision required

---

*Report generated by stria-edge-case-guardian automated audit*