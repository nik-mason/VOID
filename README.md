# 🌌 VOID : Neon Rhythm Battle

A high-performance, visually stunning web-based rhythm game built with a sleek cyber-neon aesthetic.

![Game Preview](frontend/assets/preview.png) *(Note: Placeholder image description)*

## ✨ Key Features

### 💎 Next-Gen Visuals
- **Dynamic Note Entry**: Notes fly in from off-screen with custom rotation and ease-out cubic paths for a truly immersive experience.
- **Animated Core Notes**: Each note features a rotating diamond core with real-time scanline effects.
- **Impactful Feedback**: Frame-perfect screen shake, background flashes, and high-intensity particle explosions (60+ particles for Perfect hits!).
- **Neon Aesthetic**: A consistent, premium design language using HSL tailored colors and glassmorphism.

### 🎮 Gameplay Mechanics
- **Smart Auto-Sync**: Advanced audio analysis detects the actual start of sound in MP3 files, ensuring pixel-perfect synchronization regardless of leading silence.
- **Customizable Settings**: 
  - Dynamic Entry Toggle
  - Note Speed (1.0x - 2.0x+)
  - Background Dimming
  - Customizable Key Mappings
- **Leniency System**: Optimized judgment windows for a rewarding yet challenging experience.

### 🛠️ Technical Excellence
- **Frontend**: Vanilla JavaScript and CSS for maximum performance and low latency.
- **Backend**: Flask-based server for song data management and leaderboards.
- **Responsive**: Fully playable on various screen sizes with adaptive layouts.

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Modern Web Browser (Chrome recommended for optimal performance)

### Installation & Run
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd VOID
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the server:
   ```bash
   python app.py
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## ⌨️ Controls (Default)
- **Lane 1**: `D`
- **Lane 2**: `F`
- **Lane 3**: `J`
- **Lane 4**: `K`
- **Settings**: Accessible via the gear icon on the main menu.

## 📂 Project Structure
- `/frontend`: All client-side assets (JS, CSS, HTML, Songs).
- `/backend`: Flask API and data providers.
- `/backend/json`: Song charts and rankings data.

---
Created by **Antigravity** (AI Assistant) for the ultimate rhythm gaming experience.
