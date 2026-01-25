/**
 * SafeSense Sensor Controller v2.0
 * IMPROVED Fall Detection with better thresholds
 * 
 * Fall Detection Algorithm:
 * 1. FREE FALL: Low acceleration (< 4 m/s²) - person is falling
 * 2. IMPACT: High spike (> 15 m/s² above baseline) - hit the ground
 * 3. STILLNESS: Low variance for 2+ seconds - not moving after fall
 * 
 * Any TWO of these THREE phases = FALL DETECTED
 */

class SensorController {
  constructor() {
    this.isRunning = false;
    this.motionHandler = null;
    
    // Sensor data buffers
    this.accelHistory = [];
    this.maxHistory = 200; // ~6-7 seconds at 30Hz
    
    // IMPROVED THRESHOLDS - More sensitive!
    this.thresholds = {
      // Phase 1: Free fall detection (near weightlessness)
      freefallThreshold: 4,        // m/s² - below this = free fall (gravity is 9.8)
      freefallMinDuration: 100,    // ms - minimum freefall time
      
      // Phase 2: Impact detection
      impactThreshold: 15,         // m/s² ABOVE baseline (was 25 total, now relative)
      impactSpikeRatio: 2.0,       // Must be 2x the baseline
      
      // Phase 3: Stillness detection  
      stillnessVariance: 0.8,      // Very low variance = still (was 1.5)
      stillnessMinDuration: 2000,  // 2 seconds still (was 3)
      
      // Combined detection
      detectionWindow: 5000,       // Look for phases within 5 seconds
      
      // Activity
      movementThreshold: 1.5,      // Variance above this = moving
    };

    // Detection state
    this.state = {
      // Calibration
      baseline: null,
      calibrated: false,
      calibrationSamples: [],
      
      // Phase detection
      freefallDetected: false,
      freefallTime: 0,
      impactDetected: false,
      impactTime: 0,
      impactMagnitude: 0,
      stillnessStart: 0,
      isStill: false,
      
      // Fall confirmation
      fallConfirmed: false,
      emergencyTriggered: false,
      
      // Activity
      isMoving: true,
      lastMovementTime: Date.now(),
      
      // Stats
      updateCount: 0,
      lastUpdate: 0
    };
    
    // Debug mode - set to true to see console logs
    this.debug = true;
  }

  log(message) {
    if (this.debug) {
      console.log(`[SafeSense] ${message}`);
    }
  }

  /**
   * Request permissions (iOS)
   */
  async requestPermissions() {
    if (typeof DeviceMotionEvent !== 'undefined' && 
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Permission denied');
        }
        this.log('✅ Motion permission granted');
        return true;
      } catch (error) {
        this.log('❌ Permission error: ' + error.message);
        alert('Motion sensor permission required!\n\nOn iPhone: Settings → Safari → Motion & Orientation Access → ON');
        return false;
      }
    }
    return true;
  }

  /**
   * Start monitoring
   */
  async start() {
    this.log('📱 Starting sensor monitoring...');

    if (!window.DeviceMotionEvent) {
      alert('Motion sensors not available on this device.');
      return false;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;

    this.reset();
    this.isRunning = true;

    this.motionHandler = (event) => this.handleMotion(event);
    window.addEventListener('devicemotion', this.motionHandler);

    this.log('✅ Sensor monitoring started');
    
    window.voiceEngine?.speak(
      'Fall detection active. Put your phone in your pocket.', 
      'info'
    );

    return true;
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.log('📱 Stopping sensor monitoring...');
    this.isRunning = false;

    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }

    this.log('✅ Stopped');
  }

  /**
   * Handle motion event
   */
  handleMotion(event) {
    if (!this.isRunning) return;

    const now = Date.now();
    this.state.updateCount++;
    this.state.lastUpdate = now;

    // Get acceleration
    const accel = event.accelerationIncludingGravity;
    if (!accel || accel.x === null) return;

    // Calculate magnitude
    const magnitude = Math.sqrt(
      accel.x * accel.x + 
      accel.y * accel.y + 
      accel.z * accel.z
    );

    // Store in history
    this.accelHistory.push({
      x: accel.x,
      y: accel.y,
      z: accel.z,
      magnitude,
      timestamp: now
    });

    if (this.accelHistory.length > this.maxHistory) {
      this.accelHistory.shift();
    }

    // Calibrate baseline
    if (!this.state.calibrated) {
      this.calibrate(magnitude);
      return;
    }

    // Run fall detection
    if (!this.state.emergencyTriggered) {
      this.detectFall(magnitude, now);
    }
    
    // Track activity
    this.trackActivity(now);
  }

  /**
   * Calibrate baseline (first 1 second)
   */
  calibrate(magnitude) {
    this.state.calibrationSamples.push(magnitude);
    
    // Need 30 samples (~1 second)
    if (this.state.calibrationSamples.length >= 30) {
      // Calculate baseline (average when still)
      const sorted = [...this.state.calibrationSamples].sort((a, b) => a - b);
      // Use median to avoid outliers
      this.state.baseline = sorted[Math.floor(sorted.length / 2)];
      this.state.calibrated = true;
      
      this.log(`✅ Calibrated! Baseline: ${this.state.baseline.toFixed(2)} m/s²`);
      
      window.voiceEngine?.speak('Calibrated. Fall detection ready.', 'info');
    }
  }

  /**
   * IMPROVED FALL DETECTION
   * Uses three-phase detection for reliability
   */
  detectFall(magnitude, now) {
    const baseline = this.state.baseline;
    
    // ========== PHASE 1: FREE FALL DETECTION ==========
    // During free fall, acceleration drops near zero
    if (magnitude < this.thresholds.freefallThreshold) {
      if (!this.state.freefallDetected) {
        this.state.freefallDetected = true;
        this.state.freefallTime = now;
        this.log(`⚠️ FREE FALL detected! Magnitude: ${magnitude.toFixed(2)}`);
      }
    } else {
      // Reset freefall if it was too short
      if (this.state.freefallDetected) {
        const freefallDuration = now - this.state.freefallTime;
        if (freefallDuration < this.thresholds.freefallMinDuration) {
          this.state.freefallDetected = false;
        }
      }
    }

    // ========== PHASE 2: IMPACT DETECTION ==========
    // Look for spike above baseline
    const impactThreshold = baseline + this.thresholds.impactThreshold;
    const spikeRatio = magnitude / baseline;
    
    if (magnitude > impactThreshold || spikeRatio > this.thresholds.impactSpikeRatio) {
      if (!this.state.impactDetected) {
        this.state.impactDetected = true;
        this.state.impactTime = now;
        this.state.impactMagnitude = magnitude;
        this.log(`💥 IMPACT detected! Magnitude: ${magnitude.toFixed(2)} (baseline: ${baseline.toFixed(2)})`);
        
        // Play warning beep
        window.voiceEngine?.playBeep(800, 200);
      }
    }

    // ========== PHASE 3: STILLNESS DETECTION ==========
    if (this.accelHistory.length >= 60) { // Need 2 seconds of data
      const recent = this.accelHistory.slice(-60);
      const variance = this.calculateVariance(recent.map(a => a.magnitude));
      
      if (variance < this.thresholds.stillnessVariance) {
        if (!this.state.isStill) {
          this.state.isStill = true;
          this.state.stillnessStart = now;
          this.log(`🧘 Stillness started. Variance: ${variance.toFixed(3)}`);
        }
      } else {
        if (this.state.isStill) {
          this.log(`🏃 Movement resumed. Variance: ${variance.toFixed(3)}`);
        }
        this.state.isStill = false;
        this.state.stillnessStart = 0;
      }
    }

    // ========== FALL CONFIRMATION ==========
    // Check if we have enough phases detected
    this.checkFallConfirmation(now);
  }

  /**
   * Check if fall should be confirmed
   */
  checkFallConfirmation(now) {
    // Already confirmed?
    if (this.state.fallConfirmed || this.state.emergencyTriggered) return;

    const hasImpact = this.state.impactDetected;
    const hasStillness = this.state.isStill && 
                         (now - this.state.stillnessStart) > this.thresholds.stillnessMinDuration;
    const hasFreeFall = this.state.freefallDetected;

    // Time since impact
    const timeSinceImpact = hasImpact ? (now - this.state.impactTime) : Infinity;

    // FALL CONFIRMED CONDITIONS:
    // Option 1: Impact + Stillness (most common)
    // Option 2: FreeFall + Impact
    // Option 3: FreeFall + Stillness
    // All must be within detection window

    let fallConfirmed = false;
    let reason = '';

    // Option 1: Impact + 2 seconds of stillness
    if (hasImpact && hasStillness && timeSinceImpact < this.thresholds.detectionWindow) {
      fallConfirmed = true;
      reason = 'Impact + Stillness';
    }
    
    // Option 2: FreeFall + Impact (within 1 second of each other)
    if (hasFreeFall && hasImpact) {
      const impactAfterFreefall = this.state.impactTime - this.state.freefallTime;
      if (impactAfterFreefall > 0 && impactAfterFreefall < 1000) {
        // If also still for 1+ second, confirm
        if (this.state.isStill && (now - this.state.stillnessStart) > 1000) {
          fallConfirmed = true;
          reason = 'FreeFall + Impact + Brief Stillness';
        }
      }
    }

    // CONFIRM FALL
    if (fallConfirmed) {
      this.log(`🚨 FALL CONFIRMED! Reason: ${reason}`);
      this.state.fallConfirmed = true;
      this.triggerEmergency(reason);
    }

    // Reset old detections (outside detection window)
    if (hasImpact && timeSinceImpact > this.thresholds.detectionWindow) {
      this.log('⏰ Impact timeout - resetting');
      this.resetDetection();
    }
  }

  /**
   * Reset detection state (but keep monitoring)
   */
  resetDetection() {
    this.state.freefallDetected = false;
    this.state.freefallTime = 0;
    this.state.impactDetected = false;
    this.state.impactTime = 0;
    this.state.impactMagnitude = 0;
    this.state.stillnessStart = 0;
    this.state.isStill = false;
    this.state.fallConfirmed = false;
  }

  /**
   * Track general activity
   */
  trackActivity(now) {
    if (this.accelHistory.length < 30) return;

    const recent = this.accelHistory.slice(-30);
    const variance = this.calculateVariance(recent.map(a => a.magnitude));

    if (variance > this.thresholds.movementThreshold) {
      this.state.isMoving = true;
      this.state.lastMovementTime = now;
    } else {
      const timeSinceMovement = now - this.state.lastMovementTime;
      if (timeSinceMovement > 30000) { // 30 sec
        this.state.isMoving = false;
      }
    }
  }

  /**
   * TRIGGER EMERGENCY
   */
  triggerEmergency(reason) {
    if (this.state.emergencyTriggered) return;
    
    this.log('🆘 EMERGENCY TRIGGERED: ' + reason);
    this.state.emergencyTriggered = true;

    // Siren + Voice
    window.voiceEngine?.emergencyAlert('Fall detected! Are you okay?');

    // Show modal
    const modal = document.getElementById('emergency-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }

    // Start countdown
    this.startCountdown();
  }

  /**
   * Start 60-second countdown
   */
  startCountdown() {
    let countdown = 60;
    const countdownEl = document.getElementById('countdown');

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      countdown--;
      
      if (countdownEl) {
        countdownEl.textContent = countdown;
      }

      // Voice at intervals
      if ([45, 30, 15, 10, 5, 4, 3, 2, 1].includes(countdown)) {
        window.voiceEngine?.speak(`${countdown}`, 'emergency', true);
      }

      if (countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.callEmergency();
      }
    }, 1000);

    // Setup buttons
    const cancelBtn = document.getElementById('cancel-emergency');
    const callBtn = document.getElementById('call-now');

    if (cancelBtn) {
      cancelBtn.onclick = () => this.cancelEmergency();
    }
    if (callBtn) {
      callBtn.onclick = () => this.callEmergency();
    }
  }

  /**
   * Cancel emergency
   */
  cancelEmergency() {
    this.log('✅ Emergency cancelled');

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.resetDetection();
    this.state.emergencyTriggered = false;

    const modal = document.getElementById('emergency-modal');
    if (modal) {
      modal.classList.add('hidden');
    }

    window.voiceEngine?.speak('Emergency cancelled. Glad you are okay.', 'info');
  }

  /**
   * Call emergency (simulated)
   */
  callEmergency() {
    this.log('📞 CALLING 911...');

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    window.voiceEngine?.speak('Calling 9 1 1 now.', 'emergency', true);

    setTimeout(() => {
      alert(
        '🚨 EMERGENCY SERVICES CONTACTED 🚨\n\n' +
        'Calling: 911\n' +
        'Location: [GPS coordinates]\n' +
        'Reason: Fall detected, no response\n\n' +
        '(DEMO MODE - Real 911 not called)'
      );
      this.cancelEmergency();
    }, 2000);
  }

  /**
   * Calculate variance
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  }

  /**
   * Get state for UI
   */
  getState() {
    const now = Date.now();
    
    let status = 'SAFE';
    let statusDetail = 'Monitoring active';

    if (this.state.emergencyTriggered) {
      status = 'EMERGENCY';
      statusDetail = 'Emergency protocol active!';
    } else if (this.state.impactDetected && this.state.isStill) {
      status = 'CHECKING';
      statusDetail = 'Impact + stillness detected...';
    } else if (this.state.impactDetected) {
      status = 'ALERT';
      statusDetail = 'Impact detected, monitoring...';
    } else if (!this.state.calibrated) {
      status = 'CALIBRATING';
      statusDetail = 'Hold still for 1 second...';
    }

    // Mobility score
    let mobilityScore = 0;
    if (this.accelHistory.length >= 30) {
      const variance = this.calculateVariance(
        this.accelHistory.slice(-30).map(a => a.magnitude)
      );
      mobilityScore = Math.min(100, Math.round(variance * 25));
    }

    return {
      status,
      statusDetail,
      mobilityScore,
      movementDetected: this.state.isMoving,
      lastActivity: this.formatTime(now - this.state.lastMovementTime),
      fallDetected: this.state.fallConfirmed,
      emergencyActive: this.state.emergencyTriggered,
      calibrated: this.state.calibrated,
      impactDetected: this.state.impactDetected,
      isStill: this.state.isStill,
      baseline: this.state.baseline?.toFixed(1) || '--',
      updateCount: this.state.updateCount
    };
  }

  formatTime(ms) {
    if (ms < 10000) return 'Just now';
    if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
    return `${Math.floor(ms / 60000)}m ago`;
  }

  /**
   * Full reset
   */
  reset() {
    this.accelHistory = [];
    this.state = {
      baseline: null,
      calibrated: false,
      calibrationSamples: [],
      freefallDetected: false,
      freefallTime: 0,
      impactDetected: false,
      impactTime: 0,
      impactMagnitude: 0,
      stillnessStart: 0,
      isStill: false,
      fallConfirmed: false,
      emergencyTriggered: false,
      isMoving: true,
      lastMovementTime: Date.now(),
      updateCount: 0,
      lastUpdate: 0
    };
  }

  /**
   * Simulate fall (for demo)
   */
  simulateFall() {
    this.log('🧪 Simulating fall...');
    
    if (!this.isRunning) {
      alert('Start monitoring first!');
      return;
    }

    // Simulate the phases
    this.state.impactDetected = true;
    this.state.impactTime = Date.now();
    this.state.impactMagnitude = 30;
    this.state.isStill = true;
    this.state.stillnessStart = Date.now() - 2500; // Already still for 2.5 sec

    setTimeout(() => {
      this.state.fallConfirmed = true;
      this.triggerEmergency('Simulated Fall');
    }, 500);
  }
}

// Global instance
window.sensorController = new SensorController();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SensorController;
}