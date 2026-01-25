/**
 * SafeSense - Sensor Controller
 * Handles device motion sensors and gait analysis
 */

class SensorController {
  constructor(motionAnalyzer, uiController) {
    this.motionAnalyzer = motionAnalyzer;
    this.uiController = uiController;
    
    this.isRunning = false;
    this.updateInterval = null;
    this.motionHandler = null;
    
    this.setupButtons();
  }

  /**
   * Setup button event listeners
   */
  setupButtons() {
    const startButton = document.getElementById('start-sensors');
    const stopButton = document.getElementById('stop-sensors');
    
    startButton.addEventListener('click', () => this.start());
    stopButton.addEventListener('click', () => this.stop());
  }

  /**
   * Request sensor permissions (iOS)
   */
  async requestPermissions() {
    // iOS 13+ requires permission for motion sensors
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Motion sensor permission denied');
        }
      } catch (error) {
        console.error('Permission error:', error);
        alert('Motion sensor permission is required for this feature.');
        return false;
      }
    }
    return true;
  }

  /**
   * Start motion sensor monitoring
   */
  async start() {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Check if motion sensors are available
      if (!window.DeviceMotionEvent) {
        alert('Motion sensors not available on this device.');
        return;
      }

      // Start listening to motion events
      this.motionHandler = (event) => this.handleMotion(event);
      window.addEventListener('devicemotion', this.motionHandler);

      // Start regular UI updates
      this.updateInterval = setInterval(() => {
        this.updateUI();
      }, 1000); // Update every second

      this.isRunning = true;
      this.motionAnalyzer.reset();

      // Update UI
      document.getElementById('start-sensors').classList.add('hidden');
      document.getElementById('stop-sensors').classList.remove('hidden');
      
      // Start session timer
      this.uiController.startSessionTimer();

    } catch (error) {
      console.error('Sensor start error:', error);
      alert('Unable to start motion sensors: ' + error.message);
    }
  }

  /**
   * Stop motion sensor monitoring
   */
  stop() {
    this.isRunning = false;

    // Stop listening to motion events
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }

    // Stop UI updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Update UI
    document.getElementById('start-sensors').classList.remove('hidden');
    document.getElementById('stop-sensors').classList.add('hidden');
    
    // Stop session timer
    this.uiController.stopSessionTimer();
    
    // Reset UI
    this.uiController.resetSession();
  }

  /**
   * Handle device motion event
   */
  handleMotion(event) {
    if (!this.isRunning) return;

    // Get accelerometer data (including gravity)
    const accel = event.accelerationIncludingGravity;
    
    if (!accel || accel.x === null || accel.y === null || accel.z === null) {
      return; // No sensor data available
    }

    // Process acceleration data
    const data = {
      x: accel.x || 0,
      y: accel.y || 0,
      z: accel.z || 0,
      timestamp: Date.now()
    };

    this.motionAnalyzer.processAccelerometer(data);
  }

  /**
   * Update UI with analysis results
   */
  updateUI() {
    if (!this.isRunning) return;

    // Get analysis from motion analyzer
    const analysis = this.motionAnalyzer.getAnalysis();

    // Update UI metrics
    this.uiController.updateSensorMetrics(analysis);

    // Handle fall detection
    if (analysis.fallDetected) {
      this.uiController.showEmergencyModal();
    }

    // Show alerts
    if (analysis.alerts && analysis.alerts.length > 0) {
      analysis.alerts.forEach(alert => {
        this.uiController.showAlert(alert);
      });
    }
  }

  /**
   * Test if sensors are available
   */
  static testSensorAvailability() {
    const tests = {
      devicemotion: 'DeviceMotionEvent' in window,
      deviceorientation: 'DeviceOrientationEvent' in window,
      permissions: typeof DeviceMotionEvent !== 'undefined' && 
                   typeof DeviceMotionEvent.requestPermission === 'function'
    };

    console.log('Sensor availability:', tests);
    return tests.devicemotion;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SensorController;
}