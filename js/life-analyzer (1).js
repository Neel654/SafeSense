/**
 * SafeSense LIFE Analyzer  
 * Stream C: Fall Detection & Emergency Response
 * 
 * Detects:
 * - Sudden falls (rapid position change)
 * - Post-fall stillness (person not moving after impact)
 * - Extended inactivity
 * 
 * Outputs:
 * - SIREN + Voice warning
 * - 60-second countdown
 * - Simulated 911 call
 */

class LifeAnalyzer {
  constructor() {
    this.state = {
      status: 'SAFE',
      mobilityScore: 100,
      movementDetected: true,
      lastActivity: Date.now(),
      sessionStart: null,
      fallDetected: false,
      emergencyActive: false,
      emergencyCountdown: 60,
      countdownInterval: null,
      
      // Position tracking
      positionHistory: [],
      baselinePosition: null,
      
      // Fall detection
      velocityHistory: [],
      impactDetected: false,
      stillnessStreak: 0,
      stillnessThreshold: 90,  // 3 seconds at 30fps
      fallThreshold: 0.15,     // Rapid movement threshold
      
      // Activity monitoring  
      lastSignificantMovement: Date.now(),
      inactivityWarningTime: 30000,  // 30 seconds
      inactivityDangerTime: 60000,   // 60 seconds
    };

    this.config = {
      fallDetectionSensitivity: 0.12,
      stillnessConfirmationTime: 2000,  // 2 sec stillness after fall = emergency
      countdownDuration: 60,
      emergencyNumber: '911'
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

    // Skip if emergency already active
    if (this.state.emergencyActive) {
      return this.getState();
    }

    // 1. Track position
    this.trackPosition(biomechanics, now);

    // 2. Detect falls
    this.detectFall(biomechanics, now);

    // 3. Monitor activity
    this.monitorActivity(now);

    // 4. Calculate mobility score
    this.calculateMobility();

    // 5. Update status
    this.updateStatus(now);

    return this.getState();
  }

  /**
   * Track body position over time
   */
  trackPosition(biomechanics, now) {
    const position = biomechanics.position;
    const head = biomechanics.head;
    
    // Store position
    this.state.positionHistory.push({
      centerY: position.centerY,
      noseY: head.noseY,
      timestamp: now
    });

    // Keep last 90 frames (3 seconds)
    if (this.state.positionHistory.length > 90) {
      this.state.positionHistory.shift();
    }

    // Set baseline
    if (!this.state.baselinePosition && this.state.positionHistory.length >= 30) {
      const recent = this.state.positionHistory.slice(-30);
      this.state.baselinePosition = {
        centerY: recent.reduce((sum, p) => sum + p.centerY, 0) / recent.length,
        noseY: recent.reduce((sum, p) => sum + p.noseY, 0) / recent.length
      };
    }
  }

  /**
   * Detect fall events
   */
  detectFall(biomechanics, now) {
    if (this.state.positionHistory.length < 10) return;

    const recent = this.state.positionHistory.slice(-5);
    const older = this.state.positionHistory.slice(-15, -10);

    if (older.length < 3) return;

    // Calculate vertical velocity (how fast body is moving down)
    const recentY = recent.reduce((sum, p) => sum + p.noseY, 0) / recent.length;
    const olderY = older.reduce((sum, p) => sum + p.noseY, 0) / older.length;
    const velocity = (recentY - olderY);  // Positive = moving down

    // Store velocity
    this.state.velocityHistory.push({
      velocity,
      timestamp: now
    });

    if (this.state.velocityHistory.length > 30) {
      this.state.velocityHistory.shift();
    }

    // FALL DETECTION: Rapid downward movement
    if (velocity > this.config.fallDetectionSensitivity) {
      this.state.impactDetected = true;
      this.state.impactTime = now;
      console.log('⚠️ Impact detected! Velocity:', velocity);
    }

    // Check for stillness after impact
    if (this.state.impactDetected) {
      const timeSinceImpact = now - this.state.impactTime;
      
      // Check if person is still (not moving)
      const recentVelocities = this.state.velocityHistory.slice(-15);
      const avgMovement = recentVelocities.reduce((sum, v) => sum + Math.abs(v.velocity), 0) / 
                          recentVelocities.length;

      if (avgMovement < 0.02) {  // Very little movement
        this.state.stillnessStreak++;
      } else {
        // Movement detected - person is okay
        this.state.stillnessStreak = 0;
        this.state.impactDetected = false;
        this.state.lastActivity = now;
      }

      // FALL CONFIRMED: Impact + 2 seconds of stillness
      if (timeSinceImpact > this.config.stillnessConfirmationTime && 
          this.state.stillnessStreak > 60) {  // ~2 seconds
        this.triggerEmergency('FALL DETECTED');
      }
    }

    // Track general movement for activity monitoring
    if (Math.abs(velocity) > 0.03) {
      this.state.lastSignificantMovement = now;
      this.state.movementDetected = true;
    }
  }

  /**
   * Monitor for extended inactivity
   */
  monitorActivity(now) {
    const timeSinceMovement = now - this.state.lastSignificantMovement;

    if (timeSinceMovement > this.state.inactivityDangerTime) {
      // Extended inactivity - possible emergency
      this.state.movementDetected = false;
      
      // Don't trigger emergency for inactivity alone in camera mode
      // (person might just be sitting still)
      // This would be more relevant with motion sensors
    } else if (timeSinceMovement > this.state.inactivityWarningTime) {
      this.state.movementDetected = false;
    } else {
      this.state.movementDetected = true;
    }
  }

  /**
   * Calculate mobility score
   */
  calculateMobility() {
    if (this.state.velocityHistory.length < 10) {
      this.state.mobilityScore = 100;
      return;
    }

    // Mobility based on overall movement level
    const recentMovement = this.state.velocityHistory.slice(-30);
    const avgMovement = recentMovement.reduce((sum, v) => sum + Math.abs(v.velocity), 0) / 
                        recentMovement.length;

    // Scale to 0-100
    this.state.mobilityScore = Math.min(100, Math.round(avgMovement * 500));
  }

  /**
   * Update overall status
   */
  updateStatus(now) {
    if (this.state.emergencyActive) {
      this.state.status = 'EMERGENCY';
    } else if (this.state.impactDetected) {
      this.state.status = 'CHECKING';
    } else if (!this.state.movementDetected) {
      this.state.status = 'INACTIVE';
    } else {
      this.state.status = 'SAFE';
    }

    // Update last activity timestamp
    this.state.lastActivity = this.state.movementDetected ? now : this.state.lastActivity;
  }

  /**
   * TRIGGER EMERGENCY PROTOCOL
   */
  triggerEmergency(reason) {
    if (this.state.emergencyActive) return;

    console.log('🚨 EMERGENCY TRIGGERED:', reason);
    
    this.state.emergencyActive = true;
    this.state.fallDetected = true;
    this.state.status = 'EMERGENCY';
    this.state.emergencyCountdown = this.config.countdownDuration;

    // Play siren and announce
    window.voiceEngine?.lifeAlert('fallDetected');
    
    // Show emergency modal
    this.showEmergencyModal();

    // Start countdown
    this.startCountdown();
  }

  /**
   * Start emergency countdown
   */
  startCountdown() {
    // Clear any existing countdown
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
    }

    this.state.countdownInterval = setInterval(() => {
      this.state.emergencyCountdown--;
      
      // Update UI
      const countdownEl = document.getElementById('countdown');
      if (countdownEl) {
        countdownEl.textContent = this.state.emergencyCountdown;
      }

      // Voice countdown at intervals
      if (this.state.emergencyCountdown === 45 || 
          this.state.emergencyCountdown === 30 ||
          this.state.emergencyCountdown === 15 ||
          this.state.emergencyCountdown <= 10) {
        window.voiceEngine?.lifeAlert('countdownUpdate', this.state.emergencyCountdown);
      }

      // Time's up - call emergency
      if (this.state.emergencyCountdown <= 0) {
        this.callEmergency();
      }
    }, 1000);
  }

  /**
   * Cancel emergency (person pressed "I'm OK")
   */
  cancelEmergency() {
    console.log('✅ Emergency cancelled by user');
    
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }

    this.state.emergencyActive = false;
    this.state.fallDetected = false;
    this.state.impactDetected = false;
    this.state.stillnessStreak = 0;
    this.state.status = 'SAFE';
    this.state.emergencyCountdown = this.config.countdownDuration;

    // Hide modal
    const modal = document.getElementById('emergency-modal');
    if (modal) {
      modal.classList.add('hidden');
    }

    // Voice confirmation
    window.voiceEngine?.lifeAlert('cancelled');
  }

  /**
   * CALL EMERGENCY SERVICES (Simulated)
   */
  callEmergency() {
    console.log('📞 CALLING 911...');
    
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }

    // Voice announcement
    window.voiceEngine?.lifeAlert('calling911');

    // In production, this would:
    // 1. Call actual emergency services
    // 2. Send GPS location
    // 3. Notify emergency contacts
    // 4. Keep line open

    // For demo, show alert
    setTimeout(() => {
      alert(
        '🚨 EMERGENCY SERVICES CONTACTED 🚨\n\n' +
        'Calling: 911\n' +
        'Location: [GPS would be sent]\n' +
        'Status: Fall detected, no response\n\n' +
        '(This is a DEMO - In production, real 911 would be called)'
      );
      
      // Reset after demo
      this.cancelEmergency();
    }, 2000);
  }

  /**
   * Show emergency modal
   */
  showEmergencyModal() {
    const modal = document.getElementById('emergency-modal');
    if (modal) {
      modal.classList.remove('hidden');
      
      // Setup cancel button
      const cancelBtn = document.getElementById('cancel-emergency');
      if (cancelBtn) {
        cancelBtn.onclick = () => this.cancelEmergency();
      }

      // Setup call now button
      const callBtn = document.getElementById('call-now');
      if (callBtn) {
        callBtn.onclick = () => this.callEmergency();
      }
    }
  }

  /**
   * Get current state for UI
   */
  getState() {
    const now = Date.now();
    const timeSinceActivity = now - this.state.lastActivity;
    
    let lastActivityText = 'Just now';
    if (timeSinceActivity > 60000) {
      lastActivityText = `${Math.floor(timeSinceActivity / 60000)}m ago`;
    } else if (timeSinceActivity > 10000) {
      lastActivityText = `${Math.floor(timeSinceActivity / 1000)}s ago`;
    }

    return {
      status: this.state.status,
      statusDetail: this.getStatusDetail(),
      mobilityScore: this.state.mobilityScore,
      movementDetected: this.state.movementDetected,
      lastActivity: lastActivityText,
      fallDetected: this.state.fallDetected,
      emergencyActive: this.state.emergencyActive,
      emergencyCountdown: this.state.emergencyCountdown,
      sessionDuration: this.state.sessionStart 
        ? Math.floor((now - this.state.sessionStart) / 1000)
        : 0
    };
  }

  /**
   * Get detailed status message
   */
  getStatusDetail() {
    switch (this.state.status) {
      case 'SAFE':
        return 'Monitoring active';
      case 'CHECKING':
        return 'Checking for movement...';
      case 'INACTIVE':
        return 'No movement detected';
      case 'EMERGENCY':
        return 'Emergency protocol active!';
      default:
        return 'Monitoring...';
    }
  }

  /**
   * Get session summary
   */
  getSummary() {
    return {
      monitoringDuration: this.state.sessionStart 
        ? Math.floor((Date.now() - this.state.sessionStart) / 60000)
        : 0,
      fallsDetected: this.state.fallDetected ? 1 : 0,
      averageMobility: this.state.mobilityScore,
      status: this.state.status
    };
  }

  reset() {
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
    }

    this.state = {
      status: 'SAFE',
      mobilityScore: 100,
      movementDetected: true,
      lastActivity: Date.now(),
      sessionStart: null,
      fallDetected: false,
      emergencyActive: false,
      emergencyCountdown: 60,
      countdownInterval: null,
      positionHistory: [],
      baselinePosition: null,
      velocityHistory: [],
      impactDetected: false,
      stillnessStreak: 0,
      stillnessThreshold: 90,
      fallThreshold: 0.15,
      lastSignificantMovement: Date.now(),
      inactivityWarningTime: 30000,
      inactivityDangerTime: 60000,
    };
  }
}

// Global instance
window.lifeAnalyzer = new LifeAnalyzer();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LifeAnalyzer;
}