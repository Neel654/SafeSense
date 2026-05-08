# 🛡️ SafeSense
> **Universal Biomechanics Platform** — protecting you in the gym, on the road, and at home using AI and client‑side sensors. [page:0]

[![Live Demo](https://img.shields.io/badge/DEMO-Run%20Live%20App-success?style=for-the-badge&logo=netlify)](https://delightful-tartufo-573112.netlify.app/) [page:0]  
[![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)  
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-blue?style=for-the-badge&logo=google)](https://google.github.io/mediapipe/)  
[![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)  

---

## 🚀 Try it out

You can use SafeSense instantly on the live deployment: [page:0]  
👉 **https://delightful-tartufo-573112.netlify.app/** [page:0]

Allow **Camera** and **Motion Sensor** permissions when prompted so the AI features can run on‑device.

---

## 💡 Inspiration

Modern phones and laptops already have powerful sensors and cameras. SafeSense uses those everyday devices to improve **safety and health** without extra hardware — helping: [page:0]

- Older adults living alone  
- Drivers on long, tiring trips  
- Athletes training without a spotter  

Your device becomes a real‑time **safety companion**, no wearables required. [page:0]

---

## 🤖 What it does

SafeSense is a **multi‑modal web app** that runs entirely in the browser and offers three protection modes. [page:0]

### 1. 🏋️ GYM Mode (Form Correction)

- **Tech:** MediaPipe Pose computer vision. [page:0]  
- **Function:** Tracks your skeleton in real time through the webcam and monitors exercise form. [page:0]  
- **Features:** [page:0]  
  - **Rep counting** based on motion phases  
  - **Symmetry checks** to catch left/right leaning  
  - **Voice coach** using text‑to‑speech for live cues (for example, “Keep your back straight!”, “Push evenly!”)

### 2. 🚗 DRIVE Mode (Fatigue Detection)

- **Tech:** MediaPipe facial landmark tracking. [page:0]  
- **Function:** Watches for signs of drowsiness while you drive. [page:0]  
- **Features:** [page:0]  
  - **Head‑drop detection** when your chin falls toward your chest  
  - **Micro‑sleep detection** from extended eye closure or low movement  
  - **Loud alarms and visual flashes** to jolt you awake

### 3. ❤️ LIFE Mode (Fall Detection)

- **Tech:** DeviceMotion API (accelerometer and gyroscope). [page:0]  
- **Function:** Runs on a phone in your pocket to detect dangerous falls. [page:0]  
- **Features:** [page:0]  
  - **3‑phase algorithm:** Free‑fall → Impact → Stillness  
  - **Emergency countdown:** 60‑second timer if a fall is detected  
  - **Simulated 911 call** if there is no response

---

## 🛠️ Tech Stack

SafeSense is a **lightweight, privacy‑first static web app**. All AI runs in your browser; no raw video is sent to any server. [page:0]

- **Core:** HTML5, CSS3, vanilla JavaScript (ES6+). [page:0]  
- **AI models:** MediaPipe Pose and Face Mesh. [page:0]  
- **Browser APIs:** [page:0]  
  - `MediaStream` API for camera access  
  - `DeviceMotion` API for accelerometer data  
  - `Web Speech` API for real‑time voice feedback  
- **Deployment:** Netlify static hosting. [page:0]

---

## ⚙️ How to run locally

If you prefer to run it yourself instead of using the live link: [page:0]

1. **Clone the repository**  
   ```bash
   git clone https://github.com/your-username/safesense.git
   cd safesense
   ```

2. **Start a local server**  
   Because SafeSense uses camera and motion sensors, it must run over **HTTPS or localhost**. Opening `index.html` directly as a file will block sensor access. [page:0]  

   **Using Python:**  
   ```bash
   python -m http.server 8000
   ```  

   **Using VS Code:**  
   - Right‑click `index.html`  
   - Choose **“Open with Live Server”**

3. **Open the app**  
   - Go to `http://localhost:8000` in your browser.  
   - For **LIFE Mode** on mobile: put your phone and computer on the same Wi‑Fi, find your computer’s IP, and open `http://YOUR_IP_ADDRESS:8000` on your phone. [page:0]

---

## 🧪 Testing guide (for judges)

- **LIFE Mode – Fall Detection** [page:0]  
  1. Open the app on your phone.  
  2. Choose **“Life Mode.”**  
  3. Shake the phone hard, then quickly place it flat on a table.  
  4. After a short delay, the fall alarm and countdown should start.

- **DRIVE Mode – Drowsiness** [page:0]  
  1. Open the app on your laptop and choose **“Drive Mode.”**  
  2. Look into the camera.  
  3. Slowly drop your chin toward your chest and hold it to simulate nodding off.

---

## 🧠 Challenges

- **Sensor noise:** In LIFE Mode, separating “running or bumping the phone” from **real falls** was hard. The solution was a small state machine that checks for **impact followed by stillness**, not just a single spike. [page:0]  
- **Performance and privacy:** Running computer vision in the browser can be heavy. SafeSense tunes MediaPipe settings to balance FPS and accuracy while keeping all processing local to the device. [page:0]

---

## 🏅 Accomplishments

- Built a mini **“physics engine”** over pose landmarks, using velocity and force‑style cues rather than only raw keypoints. [page:0]  
- Integrated **voice feedback** so users can rely on audio cues while driving or lifting instead of watching the screen. [page:0]

---

## ⏭️ What’s next

- **SMS integration:** Use something like Twilio to text contacts with GPS coordinates after a confirmed fall. [page:0]  
- **More exercises:** Extend GYM Mode for squats, deadlifts, bench press, and more. [page:0]  
- **PWA support:** Turn SafeSense into an installable app with offline support. [page:0]

---

<p align="center">
  Made with ❤️ by the SafeSense Team
</p>
