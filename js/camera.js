/**
 * SafeSense - Camera Controller
 * Handles camera access and MediaPipe Pose integration
 */

class CameraController {
  constructor(postureDetector, uiController) {
    this.postureDetector = postureDetector;
    this.uiController = uiController;
    
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.pose = null;
    this.camera = null;
    this.isRunning = false;
    this.animationFrame = null;
    
    this.setupButtons();
  }

  /**
   * Setup button event listeners
   */
  setupButtons() {
    const startButton = document.getElementById('start-camera');
    const stopButton = document.getElementById('stop-camera');
    
    startButton.addEventListener('click', () => this.start());
    stopButton.addEventListener('click', () => this.stop());
  }

  /**
   * Initialize MediaPipe Pose
   */
  async initPose() {
    this.pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results) => this.onPoseResults(results));
  }

  /**
   * Start camera and pose detection
   */
  async start() {
    try {
      // Initialize pose if not done
      if (!this.pose) {
        await this.initPose();
      }

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      this.video.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      // Set canvas size to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      // Start processing
      this.isRunning = true;
      this.processFrame();

      // Update UI
      document.getElementById('start-camera').classList.add('hidden');
      document.getElementById('stop-camera').classList.remove('hidden');
      
      // Start session timer
      this.uiController.startSessionTimer();
      this.postureDetector.reset();

    } catch (error) {
      console.error('Camera access error:', error);
      alert('Unable to access camera. Please ensure camera permissions are granted.');
    }
  }

  /**
   * Stop camera and pose detection
   */
  stop() {
    this.isRunning = false;

    // Stop video stream
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }

    // Cancel animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update UI
    document.getElementById('start-camera').classList.remove('hidden');
    document.getElementById('stop-camera').classList.add('hidden');
    
    // Stop session timer
    this.uiController.stopSessionTimer();
    
    // Reset UI
    this.uiController.resetSession();
  }

  /**
   * Process video frame
   */
  async processFrame() {
    if (!this.isRunning) return;

    // Send frame to MediaPipe
    await this.pose.send({ image: this.video });

    // Continue processing
    this.animationFrame = requestAnimationFrame(() => this.processFrame());
  }

  /**
   * Handle pose detection results
   */
  onPoseResults(results) {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw video frame
    this.ctx.save();
    this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

    // Draw pose landmarks if detected
    if (results.poseLandmarks) {
      this.drawPoseLandmarks(results.poseLandmarks);
      
      // Analyze posture
      const analysis = this.postureDetector.analyze(results.poseLandmarks);
      
      // Update UI with results
      this.uiController.updateCameraMetrics(analysis);
      
      // Show alerts
      if (analysis.alerts && analysis.alerts.length > 0) {
        analysis.alerts.forEach(alert => {
          this.uiController.showAlert(alert);
        });
      }
    }

    this.ctx.restore();
  }

  /**
   * Draw pose landmarks on canvas
   */
  drawPoseLandmarks(landmarks) {
    // Define connections for skeleton
    const connections = [
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left arm
      [11, 13], [13, 15],
      // Right arm
      [12, 14], [14, 16],
      // Left leg
      [23, 25], [25, 27],
      // Right leg
      [24, 26], [26, 28],
      // Face
      [0, 1], [1, 2], [2, 3], [3, 7],
      [0, 4], [4, 5], [5, 6], [6, 8]
    ];

    // Draw connections
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 2;

    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      if (start && end) {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x * this.canvas.width, start.y * this.canvas.height);
        this.ctx.lineTo(end.x * this.canvas.width, end.y * this.canvas.height);
        this.ctx.stroke();
      }
    });

    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * this.canvas.width;
      const y = landmark.y * this.canvas.height;

      // Different colors for different body parts
      let color = '#00FF00';
      if (index >= 0 && index <= 10) color = '#FF0000'; // Head
      else if (index >= 11 && index <= 16) color = '#0000FF'; // Arms
      else if (index >= 23 && index <= 28) color = '#FFFF00'; // Legs

      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CameraController;
}