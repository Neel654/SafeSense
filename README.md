# 🛡️ SafeSense
> **Universal Biomechanics Platform** — protecting you in the gym, on the road, and at home using AI and client-side sensors.

[![Live Demo](https://img.shields.io/badge/DEMO-Run%20Live%20App-success?style=for-the-badge&logo=netlify)](https://delightful-tartufo-573112.netlify.app/)
[![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-blue?style=for-the-badge&logo=google)](https://google.github.io/mediapipe/)
[![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)

![SafeSense Banner](https://via.placeholder.com/1200x600?text=SafeSense+Universal+Biomechanics+Platform)

## 🚀 Try it out!
You can test the application immediately on our live deployment:  
👉 **[https://delightful-tartufo-573112.netlify.app/](https://delightful-tartufo-573112.netlify.app/)**

*(Note: Please allow Camera and Motion Sensor permissions when prompted to test the AI features.)*

---

## 💡 Inspiration
We wanted to leverage the sensors already available in everyone's pockets and laptops to save lives and improve health. Whether it's an elderly person living alone, a driver on a long haul, or an athlete training solo, **SafeSense** turns your device into a real-time guardian without needing expensive wearables.

## 🤖 What it does
SafeSense is a multi-modal web application that runs entirely in the browser. It features three distinct protection modes:

### 1. 🏋️ GYM Mode (Form Correction)
* **Technology:** Computer Vision (MediaPipe Pose).
* **Function:** Analyzes your skeletal structure in real-time via webcam.
* **Features:**
    * **Rep Counting:** Automatically counts reps based on movement phases.
    * **Symmetry Analysis:** Detects if you are leaning too much to the left or right.
    * **Voice Coach:** Speaks real-time corrections (e.g., "Keep your back straight!", "Push evenly!").

### 2. 🚗 DRIVE Mode (Fatigue Detection)
* **Technology:** Facial Landmark Tracking (MediaPipe).
* **Function:** Monitors driver alertness via webcam.
* **Features:**
    * **Head Drop Detection:** Identifies when a driver nods off (chin drops to chest).
    * **Micro-Sleep Events:** Detects extended eye closure or lack of movement.
    * **Alarms:** Triggers loud audio alarms and visual strobes to wake the driver.

### 3. ❤️ LIFE Mode (Fall Detection)
* **Technology:** Device Motion API (Accelerometer/Gyroscope).
* **Function:** Designed for mobile phones carried in a pocket.
* **Features:**
    * **3-Phase Algorithm:** Detects Free Fall -> Impact -> Stillness.
    * **Emergency Protocol:** If a fall is detected, it initiates a 60-second countdown.
    * **Simulated 911:** "Calls" emergency services if the user remains unresponsive.

---

## 🛠️ Tech Stack

We built SafeSense as a **Lightweight, Privacy-Focused Static Web App**. No video data is ever sent to a server—all processing happens locally on your device using WebAssembly.

* **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **AI Model:** Google MediaPipe Pose & Face Mesh.
* **Browser APIs:**
    * `MediaStream API` (Camera access).
    * `DeviceMotion API` (Accelerometer access).
    * `Web Speech API` (Text-to-Speech feedback).
* **Deployment:** Netlify.

---

## ⚙️ How to Run Locally

If you prefer to run the code on your own machine instead of the live link:

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/your-username/safesense.git](https://github.com/your-username/safesense.git)
    cd safesense
    ```

2.  **Start a Local Server**
    *Critical: Because this project uses Camera and Sensors, it must be served via HTTPS or localhost. Opening `index.html` as a file will block sensor access.*

    **Using Python:**
    ```bash
    python -m http.server 8000
    ```
    **Using VS Code:**
    Right-click `index.html` and select **"Open with Live Server"**.

3.  **Access the App**
    Open `http://localhost:8000` in your browser.
    * For **Life Mode** (Mobile), ensure your phone and computer are on the same WiFi, find your computer's IP address, and visit `http://YOUR_IP_ADDRESS:8000`.

---

## 🧪 Testing Instructions for Judges

* **To Test Life Mode (Fall Detection):**
    1. Open the app on your phone.
    2. Select "Life Mode".
    3. Shake the phone hard (simulating impact) and then **immediately place it flat on a table** (simulating unconsciousness/stillness).
    4. Wait 3 seconds for the alarm to trigger.
    
* **To Test Drive Mode:**
    1. Select "Drive Mode" on your laptop.
    2. Look at the camera.
    3. Slowly lower your chin to your chest and hold it there to simulate falling asleep.

---

## 🧠 Challenges we ran into
* **Sensor Noise:** In *Life Mode*, differentiating between a person jogging (high impact) and falling (impact + stillness) was difficult. We solved this by implementing a state machine that specifically looks for "Impact" followed immediately by "Stillness."
* **Privacy & Performance:** Running AI models in the browser can be heavy. We optimized the MediaPipe settings to balance FPS vs. accuracy, ensuring no data leaves the user's device.

## 🏅 Accomplishments that we're proud of
* **The "Physics Engine":** We didn't just track points; we calculated velocity and force vectors from the raw skeletal data to determine *how fast* someone is moving.
* **Voice Integration:** The app talks back to you! Integrating the Web Speech API makes the app usable without looking at the screen (crucial for driving and working out).

## ⏭️ What's next for SafeSense
* **SMS Integration:** Hooking up Twilio API to actually text emergency contacts with GPS coordinates during a fall.
* **More Exercises:** Expanding Gym Mode to support squats, deadlifts, and bench press.
* **PWA Support:** Making the app installable so it works offline.

---

<p align="center">
  Made with ❤️ by the SafeSense Team
</p>
