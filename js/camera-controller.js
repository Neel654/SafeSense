/**
 * SafeSense Camera Controller
 * Handles camera access and MediaPipe Pose integration
 * Routes pose data to the appropriate mode analyzer
 */

class CameraController {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.pose = null;
    this.isRunning = false;
    this.animationFrame = null;
    this.currentMode = 'gym';
    
    this.onReady = null;
  }

  /**
   * Initialize with DOM elements
   */
  init() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas?.getContext('2d');
    
    this.setupButtons();
  }

  /**
   * Setup button event listeners
   */
  setupButtons() {
    const startBtn = document.getElementById('start-camera');
    const stopBtn = document.getElementById('stop-camera');

    if (startBtn) {
      startBtn.addEventListener('click', () => this.start());
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stop());
    }
  }

  /**
   * Set the active mode
   */
  setMode(mode) {
    this.currentMode = mode;
    console.log(`📷 Camera mode set to: ${mode}`);
  }

  /**
   * Initialize MediaPipe Pose
   */
  async initPose() {
    return new Promise((resolve, reject) => {
      try {
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
        
        console.log('✅ MediaPipe Pose initialized');
        resolve();
      } catch (error) {
        console.error('❌ MediaPipe init error:', error);
        reject(error);
      }
    });
  }

  /**
   * Start camera and pose detection
   */
  async start() {
    try {
      console.log('📷 Starting camera...');

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

      // Set canvas size
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      // Start processing
      this.isRunning = true;
      this.processFrame();

      // Update UI
      document.getElementById('start-camera')?.classList.add('hidden');
      document.getElementById('stop-camera')?.classList.remove('hidden');
      
      // Start session timer
      window.uiController?.startSessionTimer();
      
      // Reset analyzers
      window.biomechanicsEngine?.reset();
      window.gymAnalyzer?.reset();
      window.driveAnalyzer?.reset();
      window.lifeAnalyzer?.reset();

      console.log('✅ Camera started');

    } catch (error) {
      console.error('❌ Camera error:', error);
      alert('Unable to access camera. Please ensure camera permissions are granted.');
    }
  }

  /**
   * Stop camera
   */
  stop() {
    console.log('📷 Stopping camera...');
    
    this.isRunning = false;

    // Stop video stream
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }

    // Cancel animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Clear canvas
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update UI
    document.getElementById('start-camera')?.classList.remove('hidden');
    document.getElementById('stop-camera')?.classList.add('hidden');
    
    // Stop timer
    window.uiController?.stopSessionTimer();
    window.uiController?.reset();

    console.log('✅ Camera stopped');
  }

  /**
   * Process video frame
   */
  async processFrame() {
    if (!this.isRunning) return;

    await this.pose.send({ image: this.video });
    
    this.animationFrame = requestAnimationFrame(() => this.processFrame());
  }

  /**
   * Handle pose detection results
   */
  onPoseResults(results) {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw video
    this.ctx.save();
    this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

    if (results.poseLandmarks) {
      // Draw skeleton
      this.drawSkeleton(results.poseLandmarks);
      
      // Analyze with biomechanics engine
      const biomechanics = window.biomechanicsEngine?.analyze(results.poseLandmarks);
      
      if (biomechanics) {
        // Route to appropriate analyzer based on mode
        this.routeToAnalyzer(biomechanics);
      }
    }

    this.ctx.restore();
  }

  /**
   * Route biomechanics data to the correct analyzer
   */
  routeToAnalyzer(biomechanics) {
    let state;
    
    switch (this.currentMode) {
      case 'gym':
        state = window.gymAnalyzer?.analyze(biomechanics);
        if (state) {
          window.uiController?.updateGymMetrics(state);
          if (state.corrections?.length > 0) {
            state.corrections.forEach(c => {
              window.uiController?.showAlert({
                type: c.type,
                severity: c.priority === 'high' ? 'warning' : 'info',
                message: c.type.replace(/([A-Z])/g, ' $1').toUpperCase()
              });
            });
          }
        }
        break;
        
      case 'drive':
        state = window.driveAnalyzer?.analyze(biomechanics);
        if (state) {
          window.uiController?.updateDriveMetrics(state);
          if (state.alerts?.length > 0) {
            state.alerts.forEach(a => window.uiController?.showAlert(a));
          }
        }
        break;
        
      case 'life':
        state = window.lifeAnalyzer?.analyze(biomechanics);
        if (state) {
          window.uiController?.updateLifeMetrics(state);
        }
        break;
    }
  }

  /**
   * Draw pose skeleton
   */
  drawSkeleton(landmarks) {
    // Connections
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
      [0, 7], [0, 8]
    ];

    // Get colors based on mode
    const colors = this.getModeColors();

    // Draw connections
    this.ctx.strokeStyle = colors.skeleton;
    this.ctx.lineWidth = 3;

    connections.forEach(([start, end]) => {
      const startPt = landmarks[start];
      const endPt = landmarks[end];

      if (startPt && endPt && startPt.visibility > 0.5 && endPt.visibility > 0.5) {
        this.ctx.beginPath();
        this.ctx.moveTo(startPt.x * this.canvas.width, startPt.y * this.canvas.height);
        this.ctx.lineTo(endPt.x * this.canvas.width, endPt.y * this.canvas.height);
        this.ctx.stroke();
      }
    });

    // Draw landmarks
    landmarks.forEach((landmark, idx) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * this.canvas.width;
        const y = landmark.y * this.canvas.height;

        // Color code body parts
        let color = colors.default;
        if (idx >= 0 && idx <= 10) color = colors.head;
        else if ([11, 13, 15].includes(idx)) color = colors.leftArm;
        else if ([12, 14, 16].includes(idx)) color = colors.rightArm;
        else if (idx >= 23 && idx <= 28) color = colors.legs;

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
        this.ctx.fill();

        // White border
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    });
  }

  /**
   * Get mode-specific colors
   */
  getModeColors() {
    const modeColors = {
      gym: {
        skeleton: '#00FF88',
        head: '#FF6B6B',
        leftArm: '#4ECDC4',
        rightArm: '#FFE66D',
        legs: '#95E1D3',
        default: '#00FF88'
      },
      drive: {
        skeleton: '#00D4FF',
        head: '#FF4757',  // Red for head (important in drive mode)
        leftArm: '#5F27CD',
        rightArm: '#5F27CD',
        legs: '#576574',
        default: '#00D4FF'
      },
      life: {
        skeleton: '#A8E6CF',
        head: '#FFD93D',
        leftArm: '#6BCB77',
        rightArm: '#6BCB77',
        legs: '#4D96FF',
        default: '#A8E6CF'
      }
    };

    return modeColors[this.currentMode] || modeColors.gym;
  }
}

// Global instance
window.cameraController = new CameraController();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CameraController;
}