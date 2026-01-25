/**
 * SafeSense - Posture Detection Model
 * Core algorithms for real-time posture analysis using MediaPipe Pose landmarks
 */

class PostureDetector {
  constructor() {
    // IMPROVED Thresholds (more forgiving, less false positives)
    this.thresholds = {
      slouch: {
        good: 155,      // > 155° = good posture (was 160)
        warning: 140,   // 140-155° = warning (was 150)
        danger: 140     // < 140° = danger (was 150)
      },
      forwardHead: {
        good: 3,        // < 3 inches forward = good (was 2)
        warning: 5,     // 3-5 inches = warning (was 4)
        danger: 5       // > 5 inches = danger (was 4)
      },
      shoulderImbalance: {
        good: 15,       // < 15° difference = good (was 10)
        warning: 25,    // 15-25° = warning (was 20)
        danger: 25      // > 25° = danger (was 20)
      },
      neckTilt: {
        good: 15,       // < 15° = good (was 10)
        warning: 25,    // 15-25° = warning (was 20)
        danger: 25      // > 25° = danger (was 20)
      }
    };

    // State tracking with SMOOTHING
    this.postureHistory = [];
    this.maxHistoryLength = 90; // 90 frames (~3 seconds at 30fps) - MORE SMOOTHING
    this.currentState = 'unknown';
    this.fatigueScore = 0;
    this.sessionStartTime = Date.now();
    
    // NEW: Alert debouncing - don't spam alerts
    this.lastAlertTime = {};
    this.alertCooldown = 5000; // 5 seconds between same alert type
    
    // NEW: Confidence tracking - need consistent bad posture
    this.badPostureFrames = 0;
    this.requiredBadFrames = 30; // Need 30 frames (~1 sec) of bad posture
  }

  /**
   * Main analysis function - call this for each frame
   * @param {Object} landmarks - MediaPipe pose landmarks (33 points)
   * @returns {Object} Analysis results with alerts
   */
  analyze(landmarks) {
    if (!landmarks || landmarks.length < 33) {
      return { error: 'Invalid landmarks' };
    }

    // Extract key points
    const keypoints = this.extractKeypoints(landmarks);
    
    // Calculate all metrics
    const metrics = {
      slouchAngle: this.calculateSlouchAngle(keypoints),
      forwardHeadDistance: this.calculateForwardHead(keypoints),
      shoulderImbalance: this.calculateShoulderImbalance(keypoints),
      neckTilt: this.calculateNeckTilt(keypoints)
    };

    // Determine posture state
    const state = this.determinePostureState(metrics);
    
    // Update history and calculate fatigue
    this.updateHistory(metrics);
    const fatigue = this.calculateFatigue();

    // Generate alerts
    const alerts = this.generateAlerts(state, metrics, fatigue);

    return {
      state,
      metrics,
      fatigue,
      alerts,
      timestamp: Date.now()
    };
  }

  /**
   * Extract key body landmarks for analysis
   */
  extractKeypoints(landmarks) {
    return {
      nose: landmarks[0],
      leftEye: landmarks[2],
      rightEye: landmarks[5],
      leftEar: landmarks[7],
      rightEar: landmarks[8],
      leftShoulder: landmarks[11],
      rightShoulder: landmarks[12],
      leftHip: landmarks[23],
      rightHip: landmarks[24],
      leftKnee: landmarks[25],
      rightKnee: landmarks[26]
    };
  }

  /**
   * Calculate slouch angle (shoulder to hip angle from vertical)
   * Good posture: ~170-180°, Slouching: <150°
   */
  calculateSlouchAngle(keypoints) {
    const shoulder = this.midpoint(keypoints.leftShoulder, keypoints.rightShoulder);
    const hip = this.midpoint(keypoints.leftHip, keypoints.rightHip);

    // Calculate angle from vertical
    const dx = shoulder.x - hip.x;
    const dy = shoulder.y - hip.y;
    
    // Angle in degrees (0° = perfectly vertical)
    let angle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
    
    // Convert to posture angle (180° = perfect, lower = worse)
    angle = 180 - angle;
    
    return Math.round(angle);
  }

  /**
   * Calculate forward head posture
   * Measures horizontal distance between ear and shoulder
   */
  calculateForwardHead(keypoints) {
    const ear = this.midpoint(keypoints.leftEar, keypoints.rightEar);
    const shoulder = this.midpoint(keypoints.leftShoulder, keypoints.rightShoulder);

    // Calculate horizontal distance (normalized by shoulder width)
    const shoulderWidth = this.distance(keypoints.leftShoulder, keypoints.rightShoulder);
    const forwardDistance = Math.abs(ear.x - shoulder.x);
    
    // Convert to inches (approximate - assumes ~18 inch shoulder width)
    const distanceInInches = (forwardDistance / shoulderWidth) * 18;
    
    return Math.round(distanceInInches * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate shoulder height imbalance
   * Detects if one shoulder is elevated compared to the other
   */
  calculateShoulderImbalance(keypoints) {
    const leftY = keypoints.leftShoulder.y;
    const rightY = keypoints.rightShoulder.y;
    
    // Calculate height difference as angle
    const shoulderWidth = Math.abs(keypoints.leftShoulder.x - keypoints.rightShoulder.x);
    const heightDiff = Math.abs(leftY - rightY);
    
    const angle = Math.atan2(heightDiff, shoulderWidth) * 180 / Math.PI;
    
    return Math.round(angle * 10) / 10;
  }

  /**
   * Calculate neck tilt (side-to-side)
   */
  calculateNeckTilt(keypoints) {
    const nose = keypoints.nose;
    const shoulder = this.midpoint(keypoints.leftShoulder, keypoints.rightShoulder);
    
    // Calculate tilt angle from vertical
    const dx = nose.x - shoulder.x;
    const dy = nose.y - shoulder.y;
    
    const angle = Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
    
    return Math.round(angle * 10) / 10;
  }

  /**
   * Determine overall posture state based on metrics
   * NOW WITH SMOOTHING AND CONFIDENCE CHECKING
   */
  determinePostureState(metrics) {
    let dangerCount = 0;
    let warningCount = 0;

    // Check slouch
    if (metrics.slouchAngle < this.thresholds.slouch.danger) {
      dangerCount++;
    } else if (metrics.slouchAngle < this.thresholds.slouch.warning) {
      warningCount++;
    }

    // Check forward head
    if (metrics.forwardHeadDistance > this.thresholds.forwardHead.danger) {
      dangerCount++;
    } else if (metrics.forwardHeadDistance > this.thresholds.forwardHead.warning) {
      warningCount++;
    }

    // Check shoulder imbalance
    if (metrics.shoulderImbalance > this.thresholds.shoulderImbalance.danger) {
      dangerCount++;
    } else if (metrics.shoulderImbalance > this.thresholds.shoulderImbalance.warning) {
      warningCount++;
    }

    // Check neck tilt
    if (metrics.neckTilt > this.thresholds.neckTilt.danger) {
      dangerCount++;
    } else if (metrics.neckTilt > this.thresholds.neckTilt.warning) {
      warningCount++;
    }

    // NEW: Determine raw state
    let rawState = 'good';
    if (dangerCount >= 2) rawState = 'danger';
    else if (dangerCount >= 1 || warningCount >= 2) rawState = 'warning';
    
    // NEW: Confidence checking - need consistent bad posture
    if (rawState === 'danger' || rawState === 'warning') {
      this.badPostureFrames++;
    } else {
      this.badPostureFrames = 0; // Reset if posture improves
    }
    
    // NEW: Only return bad state if we've seen it consistently
    if (this.badPostureFrames < this.requiredBadFrames) {
      // Not confident yet - keep previous good state or return good
      if (this.currentState === 'good' || this.currentState === 'unknown') {
        return 'good';
      }
    }
    
    return rawState;
  }

  /**
   * Update posture history for trend analysis
   */
  updateHistory(metrics) {
    this.postureHistory.push({
      ...metrics,
      timestamp: Date.now()
    });

    // Keep only recent history
    if (this.postureHistory.length > this.maxHistoryLength) {
      this.postureHistory.shift();
    }
  }

  /**
   * Calculate fatigue score based on posture degradation over time
   */
  calculateFatigue() {
    if (this.postureHistory.length < 10) {
      return 0; // Not enough data
    }

    // Get average posture quality over last 10 frames vs first 10 frames
    const recent = this.postureHistory.slice(-10);
    const initial = this.postureHistory.slice(0, 10);

    const recentAvg = recent.reduce((sum, h) => sum + h.slouchAngle, 0) / recent.length;
    const initialAvg = initial.reduce((sum, h) => sum + h.slouchAngle, 0) / initial.length;

    // Calculate degradation (0-100 scale)
    const degradation = Math.max(0, initialAvg - recentAvg);
    const fatigueScore = Math.min(100, (degradation / 30) * 100); // 30° degradation = 100% fatigue

    // Also factor in time (fatigue increases with session length)
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    const timeFactor = Math.min(1, sessionMinutes / 45); // 45 min = max time factor

    this.fatigueScore = Math.round(fatigueScore * 0.7 + timeFactor * 30); // Weighted average

    return this.fatigueScore;
  }

  /**
   * Generate user-friendly alerts based on analysis
   * NOW WITH DEBOUNCING - NO SPAM!
   */
  generateAlerts(state, metrics, fatigue) {
    const alerts = [];
    const now = Date.now();

    // Helper: Check if alert is on cooldown
    const canShowAlert = (alertType) => {
      if (!this.lastAlertTime[alertType]) return true;
      return (now - this.lastAlertTime[alertType]) > this.alertCooldown;
    };

    // Helper: Mark alert as shown
    const markAlertShown = (alertType) => {
      this.lastAlertTime[alertType] = now;
    };

    // Posture alerts - ONLY if state is danger AND consistent
    if (state === 'danger' && this.badPostureFrames >= this.requiredBadFrames) {
      if (metrics.slouchAngle < this.thresholds.slouch.danger && canShowAlert('slouch')) {
        alerts.push({
          severity: 'danger',
          type: 'slouch',
          message: 'SLOUCHING DETECTED',
          action: 'Sit up straight and pull shoulders back',
          icon: '⚠️'
        });
        markAlertShown('slouch');
      }
      if (metrics.forwardHeadDistance > this.thresholds.forwardHead.danger && canShowAlert('forwardHead')) {
        alerts.push({
          severity: 'danger',
          type: 'forwardHead',
          message: 'FORWARD HEAD POSTURE',
          action: 'Pull your head back over shoulders',
          icon: '⚠️'
        });
        markAlertShown('forwardHead');
      }
      if (metrics.shoulderImbalance > this.thresholds.shoulderImbalance.danger && canShowAlert('imbalance')) {
        alerts.push({
          severity: 'danger',
          type: 'imbalance',
          message: 'SHOULDER IMBALANCE',
          action: 'Level your shoulders',
          icon: '⚠️'
        });
        markAlertShown('imbalance');
      }
    } else if (state === 'warning' && this.badPostureFrames >= this.requiredBadFrames) {
      // Only show warning if not recently shown
      if (canShowAlert('posture')) {
        alerts.push({
          severity: 'warning',
          type: 'posture',
          message: 'Posture needs attention',
          action: 'Check your alignment',
          icon: '⚡'
        });
        markAlertShown('posture');
      }
    }

    // Fatigue alerts - HIGHER THRESHOLDS
    if (fatigue > 80 && canShowAlert('fatigue-high')) {
      alerts.push({
        severity: 'danger',
        type: 'fatigue',
        message: 'HIGH FATIGUE DETECTED',
        action: 'Take a break and stretch',
        icon: '😴'
      });
      markAlertShown('fatigue-high');
    } else if (fatigue > 60 && canShowAlert('fatigue-med')) {
      alerts.push({
        severity: 'warning',
        type: 'fatigue',
        message: 'Fatigue building up',
        action: 'Consider taking a break soon',
        icon: '💤'
      });
      markAlertShown('fatigue-med');
    }

    // Time-based reminder - LESS FREQUENT
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    if (sessionMinutes > 45 && sessionMinutes % 20 < 0.1 && canShowAlert('break')) {
      alerts.push({
        severity: 'info',
        type: 'break',
        message: 'Time for a break',
        action: 'Stand up and move around',
        icon: '🚶'
      });
      markAlertShown('break');
    }

    return alerts;
  }

  /**
   * Helper: Calculate midpoint between two points
   */
  midpoint(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      z: (p1.z + p2.z) / 2
    };
  }

  /**
   * Helper: Calculate distance between two points
   */
  distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Reset session (for new monitoring session)
   */
  reset() {
    this.postureHistory = [];
    this.fatigueScore = 0;
    this.sessionStartTime = Date.now();
    this.currentState = 'unknown';
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    if (this.postureHistory.length === 0) {
      return { error: 'No data' };
    }

    const sessionDuration = (Date.now() - this.sessionStartTime) / 60000; // minutes

    // Calculate time in each state
    const stateCounts = { good: 0, warning: 0, danger: 0 };
    this.postureHistory.forEach(h => {
      const state = this.determinePostureState(h);
      stateCounts[state]++;
    });

    // Calculate averages
    const avgSlouchAngle = this.postureHistory.reduce((sum, h) => sum + h.slouchAngle, 0) / this.postureHistory.length;
    const avgForwardHead = this.postureHistory.reduce((sum, h) => sum + h.forwardHeadDistance, 0) / this.postureHistory.length;

    return {
      duration: Math.round(sessionDuration),
      postureQuality: {
        good: Math.round((stateCounts.good / this.postureHistory.length) * 100),
        warning: Math.round((stateCounts.warning / this.postureHistory.length) * 100),
        danger: Math.round((stateCounts.danger / this.postureHistory.length) * 100)
      },
      averages: {
        slouchAngle: Math.round(avgSlouchAngle),
        forwardHeadDistance: Math.round(avgForwardHead * 10) / 10
      },
      finalFatigueScore: this.fatigueScore,
      totalFrames: this.postureHistory.length
    };
  }
}

// Export for use in web app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PostureDetector;
}