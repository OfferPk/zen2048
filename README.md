# Zen2048 🧘✨

> A sleek, calm, offline 2048 tile merge puzzle with customizable grid sizes, harmonic Web Audio chimes, and multi-step undo.

[![CI](https://github.com/OfferPk/zen2048/actions/workflows/ci.yml/badge.svg)](https://github.com/OfferPk/zen2048/actions/workflows/ci.yml)
[![Pages](https://github.com/OfferPk/zen2048/actions/workflows/pages.yml/badge.svg)](https://offerpk.github.io/zen2048/)
[![Android](https://github.com/OfferPk/zen2048/actions/workflows/android.yml/badge.svg)](https://github.com/OfferPk/zen2048/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🌐 Live Web Demo

Play immediately in your browser:  
👉 **[https://offerpk.github.io/zen2048/](https://offerpk.github.io/zen2048/)**

100% offline via PWA Service Worker caching. Installable directly to your home screen on Android, iOS, Windows, and macOS.

---

## 📱 Android APK Download

- **GitHub Actions Debug APK**: Download the latest build directly from [Android Build Artifacts](https://github.com/OfferPk/zen2048/actions/workflows/android.yml) (Artifact name: `zen2048-apk`).
- **Releases**: Tagged releases include standalone APK assets under [GitHub Releases](https://github.com/OfferPk/zen2048/releases).

---

## 📸 Screenshots

| Desktop View | Mobile Touch | Theme Selection |
| :---: | :---: | :---: |
| _[ Zen Dark 4x4 Grid ]_ | _[ Responsive Mobile View ]_ | _[ Sunset Warm & Light Themes ]_ |

---

## ✨ Features

- **Multiple Grid Dimensions**:
  - Fast 3×3 (Brutal quick matches)
  - Classic 4×4 (Standard 2048)
  - Expansive 5×5 (Relaxing tactical play)
  - Master 6×6 (Deep puzzle challenges)
- **Harmonic Procedural Audio**: Musical bell chimes synthesized locally on your device via the Web Audio API with pitch ascending with higher merged tiles + gentle haptics.
- **Multi-Step Undo**: Make a tactical miscalculation? Step backward and rethink your moves at any time.
- **Endless Gameplay**: Once you hit 2048, keep merging toward 4096, 8192, and beyond.
- **Responsive Controls**: Natural touchscreen swipe gestures with velocity thresholds + Keyboard controls (Arrow keys and WASD).
- **Themes**: Zen Dark, Sunset Warm, and Clean Light.
- **Local Statistics**: Records games played, victories, highest tile reached, and all-time scores.
- **100% Offline & Private**: Zero data collected, no ads, no trackers, no external network dependencies.

---

## 🛠️ Local Development & Build

### Prerequisites
- Node.js >= 20
- npm >= 10

### Setup
```bash
git clone https://github.com/OfferPk/zen2048.git
cd zen2048
npm install
```

### Run Tests
```bash
npm test
```

### Build Web Assets
```bash
npm run build
```
This builds and copies all runtime assets into `www/`.

### Android Build (Capacitor)
```bash
npx cap sync android
cd android
./gradlew assembleDebug
```
The debug APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2026 OfferPk.
