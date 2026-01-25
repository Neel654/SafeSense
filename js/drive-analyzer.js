/**
 * SafeSense DRIVE Analyzer v2.0
 * Stream B: Fatigue & Drowsiness Detection
 * 
 * IMPROVED: Less sensitive, more accurate
 * - Starts at 100% alertness
 * - Only drops for REAL head drops (not small movements)
 * - Requires sustained bad posture to trigger
 * 
 * Detects:
 * - Head drops (nodding off) - ONLY significant drops
 * - Micro-sleep events
 * 
 * Outputs:
 * - LOUD ALARMS when drowsy
 * - Break reminders
 * - Alertness score
 */

class DriveAnalyzer {
  constructor() {
    this.state = {
      alertnessLevel: 100,
      headPosition: 'UPRIGHT',
      eyesStatus: 'OPEN',
      drowsyEvents: 0,
      microSleepDetected: false,
      sessionStart: null,
      lastBreakReminder: null,
      
      // Head tracking
      headYHistory: [],
      headDropStreak: 0,
      lastHeadDropWarning: 0,
      baselineHeadY: null,
      baselineSet: false,
      calibrationFrames: 0,
      
      // Drowsiness scoring
      alertnessHistory: [],
      
      // Time tracking
      driveTimeMinutes: 0,
      breakInterval: 120,  // Recommend break every 2 hours
    };

    // RELAXED THRESHOLDS - Less sensitive!
    this.thresholds = {
      // Head drop detection - MUCH more forgiving
      headDropThreshold: 0.15,      // Was 0.08 - now needs 15% drop (significant nod)
      headDropWarningTime: 2500,    // 2.5 sec of dropping = warning
      headDropDangerTime: 4000,     // 4 sec of dropping = danger
      
      // Calibration
      calibrationFrames: 60,        // 2 seconds to calibrate baseline
      
      // Cooldowns
      warningCooldown: 8000,        // 8 sec between warnings (was 5)
      emergencyCooldown: 15000,     // 15 sec between emergencies (was 10)
    };
  }

  /**
   * Main analysis function
   */
  analyze(biomechanics) {
    if (!biomechanics) return this.getState();

    const now = Date.now();
    
    // Start session
    if (!this.state.sessionStart) {
      this.state.sessionStart = now;
    }

    // Update drive time
    this.state.driveTimeMinutes = Math.floor((now - this.state.sessionStart) / 60000);

    // 1. Calibrate or analyze head position
    if (!this.state.baselineSet) {
      this.calibrateBaseline(biomechanics.head);
    } else {
      this.analyzeHeadPosition(biomechanics.head, now);
    }

    // 2. Calculate alertness (ONLY based on confirmed issues)
    this.calculateAlertness(now);

    // 3. Check for break reminder
    this.checkBreakReminder(now);

    // 4. Generate alerts
    const alerts = this.generateAlerts(now);

    return {
      ...this.getState(),
      alerts
    };
  }

  /**
   * Calibrate baseline head position (first 2 seconds)
   */
  calibrateBaseline(head) {
    if (!head || head.noseY === undefined) return;
    
    this.state.headYHistory.push(head.noseY);
    this.state.calibrationFrames++;
    
    // Need 60 frames (~2 seconds) to calibrate
    if (this.state.calibrationFrames >= this.thresholds.calibrationFrames) {
      // Use median as baseline (more robust than average)
      const sorted = [...this.state.headYHistory].sort((a, b) => a - b);
      this.state.baselineHeadY = sorted[Math.floor(sorted.length / 2)];
      this.state.baselineSet = true;
      this.state.headYHistory = []; // Clear calibration data
      
      console.log(`[Drive] Baseline calibrated: ${this.state.baselineHeadY.toFixed(3)}`);
    }
  }

  /**
   * Analyze head position for nodding off
   * IMPROVED: Only triggers for SIGNIFICANT, SUSTAINED head drops
   */
  analyzeHeadPosition(head, now) {
    if (!head || head.noseY === undefined) return;
    
    const currentY = head.noseY;
    const baseline = this.state.baselineHeadY;
    
    // Calculate how much head has dropped (positive = dropped down)
    // In normalized coords, higher Y = lower on screen = head dropped
    const headDrop = currentY - baseline;
    
    // Store recent history for smoothing
    this.state.headYHistory.push({
      y: currentY,
      drop: headDrop,
      timestamp: now
    });
    
    // Keep last 90 frames (3 seconds)
    if (this.state.headYHistory.length > 90) {
      this.state.headYHistory.shift();
    }

    // Calculate smoothed drop (average of last 15 frames = 0.5 sec)
    const recentDrops = this.state.headYHistory.slice(-15);
    const smoothedDrop = recentDrops.reduce((sum, h) => sum + h.drop, 0) / recentDrops.length;

    // DETECTION: Is head significantly dropped?
    if (smoothedDrop > this.thresholds.headDropThreshold) {
      this.state.headDropStreak++;
      
      // Calculate how long head has been dropped
      const dropDuration = this.state.headDropStreak * (1000 / 30); // ~33ms per frame
      
      if (dropDuration > this.thresholds.headDropDangerTime) {
        this.state.headPosition = 'DANGER';
        this.state.microSleepDetected = true;
      } else if (dropDuration > this.thresholds.headDropWarningTime) {
        this.state.headPosition = 'WARNING';
      } else {
        this.state.headPosition = 'DROPPING';
      }
    } else {
      // Head is upright - quickly reset if was just a glance down
      this.state.headDropStreak = Math.max(0, this.state.headDropStreak - 3);
      
      if (this.state.headDropStreak === 0) {
        this.state.headPosition = 'UPRIGHT';
        this.state.microSleepDetected = false;
      }
    }
    
    // Eyes status - simplified, just mirror head position
    // (Real eye tracking would need face mesh which we don't have)
    this.state.eyesStatus = this.state.headPosition === 'UPRIGHT' ? 'OPEN' : 
                           this.state.headPosition === 'DANGER' ? 'CLOSING' : 'OPEN';
  }

  /**
   * Calculate overall alertness level
   * FIXED: Returns to 100% when head is upright!
   */
  calculateAlertness(now) {
    // If head is UPRIGHT, alertness should be 100%!
    if (this.state.headPosition === 'UPRIGHT') {
      this.state.alertnessLevel = 100;
    } 
    // Only reduce alertness when there's an active issue
    else if (this.state.headPosition === 'DANGER') {
      this.state.alertnessLevel = 50;
    } 
    else if (this.state.headPosition === 'WARNING') {
      this.state.alertnessLevel = 75;
    }
    else if (this.state.headPosition === 'DROPPING') {
      // Small dip while dropping, but not a big deal
      this.state.alertnessLevel = 90;
    }

    // Store history
    this.state.alertnessHistory.push({
      score: this.state.alertnessLevel,
      timestamp: now
    });

    if (this.state.alertnessHistory.length > 300) {
      this.state.alertnessHistory.shift();
    }
  }

  /**
   * Check if break reminder needed
   */
  checkBreakReminder(now) {
    if (this.state.driveTimeMinutes >= this.state.breakInterval) {
      if (!this.state.lastBreakReminder || 
          now - this.state.lastBreakReminder > 30 * 60 * 1000) {
        this.state.needsBreak = true;
        this.state.lastBreakReminder = now;
      }
    }
  }

  /**
   * Generate alerts and voice warnings
   */
  generateAlerts(now) {
    const alerts = [];

    // EMERGENCY: Micro-sleep / prolonged head drop
    if (this.state.headPosition === 'DANGER') {
      if (!this.state.lastEmergency || 
          now - this.state.lastEmergency > this.thresholds.emergencyCooldown) {
        alerts.push({
          type: 'microSleep',
          severity: 'emergency',
          message: 'WAKE UP! HEAD DROP DETECTED!'
        });
        window.voiceEngine?.driveWarning('drowsy');
        this.state.drowsyEvents++;
        this.state.lastEmergency = now;
        
        // Show drowsy modal
        this.showDrowsyModal();
      }
    }
    
    // WARNING: Head starting to drop significantly
    else if (this.state.headPosition === 'WARNING') {
      if (!this.state.lastHeadDropWarning || 
          now - this.state.lastHeadDropWarning > this.thresholds.warningCooldown) {
        alerts.push({
          type: 'headDrop',
          severity: 'warning',
          message: 'Stay alert! Head dropping.'
        });
        window.voiceEngine?.driveWarning('headDrop');
        this.state.lastHeadDropWarning = now;
      }
    }

    // INFO: Break reminder
    if (this.state.needsBreak) {
      alerts.push({
        type: 'breakReminder',
        severity: 'info',
        message: 'Consider taking a break'
      });
      window.voiceEngine?.driveWarning('breakReminder');
      this.state.needsBreak = false;
    }

    return alerts;
  }

  /**
   * Show drowsy alert modal
   */
  showDrowsyModal() {
    const modal = document.getElementById('drowsy-modal');
    if (modal) {
      modal.classList.remove('hidden');
      
      // Auto-hide after 10 seconds if not dismissed
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 10000);
    }
  }

  /**
   * Get current state for UI
   */
  getState() {
    const breakTimeRemaining = Math.max(0, this.state.breakInterval - this.state.driveTimeMinutes);
    
    return {
      alertnessLevel: this.state.alertnessLevel,
      headPosition: this.state.headPosition,
      eyesStatus: this.state.eyesStatus,
      drowsyEvents: this.state.drowsyEvents,
      driveTimeMinutes: this.state.driveTimeMinutes,
      breakReminder: breakTimeRemaining > 60 
        ? `Break in ${Math.floor(breakTimeRemaining / 60)}h ${breakTimeRemaining % 60}m`
        : breakTimeRemaining > 0 
          ? `Break in ${breakTimeRemaining}m`
          : 'Take a break!',
      sessionDuration: this.state.driveTimeMinutes * 60
    };
  }

  /**
   * Get session summary
   */
  getSummary() {
    const avgAlertness = this.state.alertnessHistory.length > 0
      ? this.state.alertnessHistory.reduce((sum, h) => sum + h.score, 0) / 
        this.state.alertnessHistory.length
      : 100;

    return {
      totalDriveTime: this.state.driveTimeMinutes,
      drowsyEvents: this.state.drowsyEvents,
      averageAlertness: Math.round(avgAlertness),
      safetyRating: this.state.drowsyEvents === 0 ? 'EXCELLENT' :
                    this.state.drowsyEvents <= 2 ? 'FAIR' : 'POOR'
    };
  }

  reset() {
    this.state = {
      alertnessLevel: 100,
      headPosition: 'UPRIGHT',
      eyesStatus: 'OPEN',
      drowsyEvents: 0,
      microSleepDetected: false,
      sessionStart: null,
      lastBreakReminder: null,
      headYHistory: [],
      headDropStreak: 0,
      lastHeadDropWarning: 0,
      baselineHeadY: null,
      baselineSet: false,
      calibrationFrames: 0,
      alertnessHistory: [],
      driveTimeMinutes: 0,
      breakInterval: 120,
    };
  }
}

// Global instance
window.driveAnalyzer = new DriveAnalyzer();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DriveAnalyzer;
}