/**
 * SafeSense GYM Analyzer
 * Stream A: Form & Injury Prevention
 * 
 * Detects:
 * - Left/Right asymmetry during lifts
 * - Rep counting with tempo analysis
 * - Form breakdown from fatigue
 * 
 * Outputs:
 * - Voice corrections ("PUSH YOUR LEFT SIDE!")
 * - Symmetry scores
 * - Rep counts
 */

class GymAnalyzer {
  constructor() {
    this.state = {
      repCount: 0,
      currentPhase: 'ready',  // ready, up, down
      lastPhaseChange: 0,
      symmetryHistory: [],
      formQuality: 'READY',
      warnings: [],
      sessionStart: null,
      
      // Rep detection
      wristYHistory: [],
      repThreshold: 0.05,  // Movement threshold for rep detection
      minRepDuration: 500, // Minimum ms for valid rep
      lastRepTime: 0,
      
      // Asymmetry tracking
      asymmetryStreak: 0,
      lastAsymmetryWarning: 0,
      asymmetryThreshold: 15, // % difference to trigger warning
      
      // Tempo tracking
      repDurations: [],
      idealTempo: [1500, 3000], // 1.5-3 second reps
    };

    this.config = {
      smoothingWindow: 5,
      warningCooldown: 3000,
      repDetectionSensitivity: 0.04
    };
  }

  /**
   * Main analysis function - called every frame
   */
  analyze(biomechanics) {
    if (!biomechanics) return this.getState();

    const now = Date.now();
    
    // Start session if not started
    if (!this.state.sessionStart) {
      this.state.sessionStart = now;
    }

    // 1. Track wrist positions for rep detection
    this.trackWristMovement(biomechanics);

    // 2. Detect reps
    this.detectReps(now);

    // 3. Analyze symmetry
    this.analyzeSymmetry(biomechanics, now);

    // 4. Analyze tempo
    this.analyzeTempo();

    // 5. Determine form quality
    this.determineFormQuality();

    // 6. Generate voice corrections
    const corrections = this.generateCorrections(now);

    return {
      ...this.getState(),
      corrections
    };
  }

  /**
   * Track wrist movement for rep detection
   */
  trackWristMovement(biomechanics) {
    const avgWristY = (biomechanics.symmetry.leftWristY + biomechanics.symmetry.rightWristY) / 2;
    
    this.state.wristYHistory.push({
      y: avgWristY,
      leftY: biomechanics.symmetry.leftWristY,
      rightY: biomechanics.symmetry.rightWristY,
      timestamp: Date.now()
    });

    // Keep last 30 frames
    if (this.state.wristYHistory.length > 30) {
      this.state.wristYHistory.shift();
    }
  }

  /**
   * Detect rep completion using wrist position changes
   */
  detectReps(now) {
    if (this.state.wristYHistory.length < 10) return;

    const history = this.state.wristYHistory;
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);

    if (older.length < 5) return;

    const recentAvgY = recent.reduce((sum, h) => sum + h.y, 0) / recent.length;
    const olderAvgY = older.reduce((sum, h) => sum + h.y, 0) / older.length;
    const movement = recentAvgY - olderAvgY;

    // Detect phase transitions
    const wasGoingUp = this.state.currentPhase === 'up';
    const wasGoingDown = this.state.currentPhase === 'down';
    
    // Movement threshold
    const threshold = this.config.repDetectionSensitivity;

    if (movement < -threshold && this.state.currentPhase !== 'up') {
      // Wrists moving up (in normalized coords, lower Y = higher position)
      this.state.currentPhase = 'up';
      this.state.lastPhaseChange = now;
    } else if (movement > threshold && this.state.currentPhase === 'up') {
      // Coming back down - count rep if enough time passed
      const repDuration = now - this.state.lastPhaseChange;
      
      if (repDuration > this.state.minRepDuration && now - this.state.lastRepTime > 800) {
        this.state.repCount++;
        this.state.repDurations.push(repDuration);
        this.state.lastRepTime = now;
        this.state.currentPhase = 'down';
        
        // Keep only last 10 rep durations
        if (this.state.repDurations.length > 10) {
          this.state.repDurations.shift();
        }

        // Voice rep count every 5 reps or first 3
        if (this.state.repCount <= 3 || this.state.repCount % 5 === 0) {
          window.voiceEngine?.gymCorrection('repCount', this.state.repCount);
        }
      }
    }
  }

  /**
   * Analyze left/right symmetry
   */
  analyzeSymmetry(biomechanics, now) {
    const symmetry = biomechanics.symmetry;
    
    // Store symmetry history
    this.state.symmetryHistory.push({
      score: symmetry.overall,
      laggingSide: symmetry.laggingSide,
      wristDiff: symmetry.details.wristHeightDiff,
      timestamp: now
    });

    // Keep last 60 entries (2 seconds)
    if (this.state.symmetryHistory.length > 60) {
      this.state.symmetryHistory.shift();
    }

    // Check for persistent asymmetry
    if (symmetry.overall < (100 - this.state.asymmetryThreshold)) {
      this.state.asymmetryStreak++;
    } else {
      this.state.asymmetryStreak = Math.max(0, this.state.asymmetryStreak - 2);
    }
  }

  /**
   * Analyze rep tempo
   */
  analyzeTempo() {
    if (this.state.repDurations.length < 2) return;

    const avgDuration = this.state.repDurations.reduce((a, b) => a + b, 0) / 
                        this.state.repDurations.length;
    
    const [minTempo, maxTempo] = this.state.idealTempo;

    if (avgDuration < minTempo) {
      this.state.tempoWarning = 'TOO_FAST';
    } else if (avgDuration > maxTempo) {
      this.state.tempoWarning = 'TOO_SLOW';
    } else {
      this.state.tempoWarning = null;
    }
  }

  /**
   * Determine overall form quality
   */
  determineFormQuality() {
    const avgSymmetry = this.state.symmetryHistory.length > 0
      ? this.state.symmetryHistory.slice(-30).reduce((sum, h) => sum + h.score, 0) / 
        Math.min(30, this.state.symmetryHistory.length)
      : 100;

    if (avgSymmetry >= 85) {
      this.state.formQuality = 'EXCELLENT';
    } else if (avgSymmetry >= 70) {
      this.state.formQuality = 'GOOD';
    } else if (avgSymmetry >= 55) {
      this.state.formQuality = 'FAIR';
    } else {
      this.state.formQuality = 'POOR';
    }
  }

  /**
   * Generate voice corrections
   */
  generateCorrections(now) {
    const corrections = [];

    // 1. Asymmetry correction (most important for injury prevention!)
    if (this.state.asymmetryStreak > 15 && // ~0.5 seconds of asymmetry
        now - this.state.lastAsymmetryWarning > this.config.warningCooldown) {
      
      const recentHistory = this.state.symmetryHistory.slice(-15);
      const leftLagCount = recentHistory.filter(h => h.laggingSide === 'left').length;
      const rightLagCount = recentHistory.filter(h => h.laggingSide === 'right').length;

      if (leftLagCount > rightLagCount && leftLagCount > 10) {
        corrections.push({ type: 'leftLag', priority: 'high' });
        window.voiceEngine?.gymCorrection('leftLag');
        this.state.lastAsymmetryWarning = now;
        this.state.asymmetryStreak = 0;
      } else if (rightLagCount > leftLagCount && rightLagCount > 10) {
        corrections.push({ type: 'rightLag', priority: 'high' });
        window.voiceEngine?.gymCorrection('rightLag');
        this.state.lastAsymmetryWarning = now;
        this.state.asymmetryStreak = 0;
      }
    }

    // 2. Tempo correction
    if (this.state.tempoWarning === 'TOO_FAST' && this.state.repCount > 3) {
      if (!this.state.lastTempoWarning || now - this.state.lastTempoWarning > 10000) {
        corrections.push({ type: 'tooFast', priority: 'medium' });
        window.voiceEngine?.gymCorrection('tooFast');
        this.state.lastTempoWarning = now;
      }
    }

    // 3. Positive reinforcement (occasionally)
    if (this.state.formQuality === 'EXCELLENT' && 
        this.state.repCount > 0 && 
        this.state.repCount % 10 === 0) {
      corrections.push({ type: 'goodRep', priority: 'low' });
      window.voiceEngine?.gymCorrection('goodRep');
    }

    return corrections;
  }

  /**
   * Get current state for UI
   */
  getState() {
    const currentSymmetry = this.state.symmetryHistory.length > 0
      ? this.state.symmetryHistory[this.state.symmetryHistory.length - 1].score
      : 100;

    const leftScore = this.state.symmetryHistory.length > 0
      ? Math.round(100 - (this.state.symmetryHistory[this.state.symmetryHistory.length - 1].wristDiff * 200))
      : '--';

    const rightScore = leftScore;

    return {
      repCount: this.state.repCount,
      symmetryScore: Math.round(currentSymmetry),
      leftScore: leftScore,
      rightScore: rightScore,
      formQuality: this.state.formQuality,
      currentPhase: this.state.currentPhase,
      tempoWarning: this.state.tempoWarning,
      sessionDuration: this.state.sessionStart 
        ? Math.floor((Date.now() - this.state.sessionStart) / 1000)
        : 0
    };
  }

  /**
   * Get session summary
   */
  getSummary() {
    return {
      totalReps: this.state.repCount,
      averageSymmetry: this.state.symmetryHistory.length > 0
        ? Math.round(this.state.symmetryHistory.reduce((sum, h) => sum + h.score, 0) / 
                     this.state.symmetryHistory.length)
        : 0,
      formQuality: this.state.formQuality,
      avgRepDuration: this.state.repDurations.length > 0
        ? Math.round(this.state.repDurations.reduce((a, b) => a + b, 0) / 
                     this.state.repDurations.length)
        : 0,
      sessionDuration: this.state.sessionStart 
        ? Math.floor((Date.now() - this.state.sessionStart) / 1000)
        : 0
    };
  }

  reset() {
    this.state = {
      repCount: 0,
      currentPhase: 'ready',
      lastPhaseChange: 0,
      symmetryHistory: [],
      formQuality: 'READY',
      warnings: [],
      sessionStart: null,
      wristYHistory: [],
      repThreshold: 0.05,
      minRepDuration: 500,
      lastRepTime: 0,
      asymmetryStreak: 0,
      lastAsymmetryWarning: 0,
      asymmetryThreshold: 15,
      repDurations: [],
      idealTempo: [1500, 3000],
    };
  }
}

// Global instance
window.gymAnalyzer = new GymAnalyzer();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GymAnalyzer;
}