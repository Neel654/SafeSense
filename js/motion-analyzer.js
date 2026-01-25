/**
 * SafeSense - Motion & Gait Analysis Model
 * Analyzes accelerometer and gyroscope data for fall risk and fatigue detection
 */

class MotionAnalyzer {
  constructor() {
    // Thresholds for motion patterns
    this.thresholds = {
      stepRegularity: {
        good: 0.15,      // < 15% variance = regular gait
        warning: 0.25,   // 15-25% = slightly irregular
        danger: 0.25     // > 25% = unstable gait
      },
      stepFrequency: {
        normal: [1.5, 2.5],  // steps per second (90-150 steps/min)
        slow: 1.5,
        fast: 2.5
      },
      fallRisk: {
        low: 30,
        medium: 50,
        high: 70
      },
      suddenMovement: 15,  // m/s² threshold for fall detection
      stillness: 0.5       // m/s² threshold for stationary detection
    };

    // State tracking
    this.motionHistory = [];
    this.maxHistoryLength = 150; // ~5 seconds at 30Hz
    this.steps = [];
    this.lastStepTime = 0;
    this.baselineAcceleration = null;
    this.isWalking = false;
    this.isStationary = true;
    this.fallDetected = false;
  }

  /**
   * Process accelerometer data
   * @param {Object} data - {x, y, z, timestamp} in m/s²
   */
  processAccelerometer(data) {
    // Calculate total acceleration magnitude
    const magnitude = Math.sqrt(
      data.x * data.x + 
      data.y * data.y + 
      data.z * data.z
    );

    // Store in history
    this.motionHistory.push({
      ...data,
      magnitude,
      timestamp: data.timestamp || Date.now()
    });

    // Trim history
    if (this.motionHistory.length > this.maxHistoryLength) {
      this.motionHistory.shift();
    }

    // Set baseline if needed
    if (!this.baselineAcceleration && this.motionHistory.length > 30) {
      this.calculateBaseline();
    }

    // Detect activity state
    this.detectActivityState();

    // Detect steps if walking
    if (this.isWalking) {
      this.detectStep(magnitude, data.timestamp);
    }

    // Check for fall
    this.checkForFall(magnitude);
  }

  /**
   * Calculate baseline acceleration (for user's normal movement)
   */
  calculateBaseline() {
    const recent = this.motionHistory.slice(-30);
    const avgMagnitude = recent.reduce((sum, d) => sum + d.magnitude, 0) / recent.length;
    
    this.baselineAcceleration = {
      magnitude: avgMagnitude,
      variance: this.calculateVariance(recent.map(d => d.magnitude))
    };
  }

  /**
   * Detect if user is walking, stationary, or in other activity
   */
  detectActivityState() {
    if (this.motionHistory.length < 30) return;

    const recent = this.motionHistory.slice(-30);
    const avgMagnitude = recent.reduce((sum, d) => sum + d.magnitude, 0) / recent.length;
    const variance = this.calculateVariance(recent.map(d => d.magnitude));

    // Stationary: low variance, near gravity (9.8 m/s²)
    if (variance < this.thresholds.stillness && Math.abs(avgMagnitude - 9.8) < 1) {
      this.isStationary = true;
      this.isWalking = false;
    }
    // Walking: medium variance, rhythmic pattern
    else if (variance > 1 && variance < 8) {
      this.isStationary = false;
      this.isWalking = true;
    }
    // Other activity
    else {
      this.isStationary = false;
      this.isWalking = false;
    }
  }

  /**
   * Detect individual steps from acceleration peaks
   */
  detectStep(magnitude, timestamp) {
    if (!this.baselineAcceleration) return;

    // Look for peaks above baseline
    const threshold = this.baselineAcceleration.magnitude + 2; // 2 m/s² above baseline
    const timeSinceLastStep = timestamp - this.lastStepTime;

    // Detect step: magnitude spike + reasonable time gap (200-800ms)
    if (magnitude > threshold && timeSinceLastStep > 200 && timeSinceLastStep < 800) {
      this.steps.push({
        timestamp,
        magnitude,
        timeSinceLastStep
      });

      this.lastStepTime = timestamp;

      // Keep only recent steps (last 20)
      if (this.steps.length > 20) {
        this.steps.shift();
      }
    }
  }

  /**
   * Check for sudden acceleration indicating a fall
   */
  checkForFall(magnitude) {
    if (magnitude > this.thresholds.suddenMovement) {
      // High acceleration detected - possible fall
      this.fallDetected = true;
      
      // Reset after 2 seconds
      setTimeout(() => {
        this.fallDetected = false;
      }, 2000);
    }
  }

  /**
   * Analyze gait quality and calculate risk scores
   */
  analyzeGait() {
    if (this.steps.length < 5) {
      return {
        error: 'Insufficient step data',
        stepsDetected: this.steps.length
      };
    }

    // Calculate step timing statistics
    const stepIntervals = this.steps.map(s => s.timeSinceLastStep);
    const avgInterval = stepIntervals.reduce((sum, i) => sum + i, 0) / stepIntervals.length;
    const variance = this.calculateVariance(stepIntervals);
    const coefficient = Math.sqrt(variance) / avgInterval; // Coefficient of variation

    // Calculate step frequency (steps per second)
    const frequency = 1000 / avgInterval; // Convert ms to seconds

    // Determine regularity
    let regularity = 'good';
    if (coefficient > this.thresholds.stepRegularity.danger) {
      regularity = 'danger';
    } else if (coefficient > this.thresholds.stepRegularity.warning) {
      regularity = 'warning';
    }

    // Calculate fall risk score (0-100)
    let fallRisk = 0;
    
    // Factor 1: Step irregularity (40% weight)
    fallRisk += Math.min(40, coefficient * 100);
    
    // Factor 2: Abnormal frequency (30% weight)
    const [normalMin, normalMax] = this.thresholds.stepFrequency.normal;
    if (frequency < normalMin || frequency > normalMax) {
      fallRisk += 30;
    }
    
    // Factor 3: High variance in step magnitude (30% weight)
    const magnitudes = this.steps.map(s => s.magnitude);
    const magnitudeVariance = this.calculateVariance(magnitudes);
    fallRisk += Math.min(30, magnitudeVariance * 3);

    fallRisk = Math.min(100, Math.round(fallRisk));

    // Determine risk level
    let riskLevel = 'low';
    if (fallRisk > this.thresholds.fallRisk.high) {
      riskLevel = 'high';
    } else if (fallRisk > this.thresholds.fallRisk.medium) {
      riskLevel = 'medium';
    }

    return {
      stepsDetected: this.steps.length,
      stepFrequency: Math.round(frequency * 100) / 100, // steps/second
      stepsPerMinute: Math.round(frequency * 60),
      avgStepInterval: Math.round(avgInterval),
      regularity,
      coefficient: Math.round(coefficient * 1000) / 1000,
      fallRisk,
      riskLevel
    };
  }

  /**
   * Detect fatigue based on motion degradation
   */
  detectFatigue() {
    if (this.motionHistory.length < 100) {
      return { fatigue: 0, message: 'Collecting baseline data...' };
    }

    // Compare recent motion to baseline
    const recent = this.motionHistory.slice(-50);
    const earlier = this.motionHistory.slice(0, 50);

    // Calculate motion intensity for both periods
    const recentIntensity = recent.reduce((sum, d) => sum + Math.abs(d.magnitude - 9.8), 0) / recent.length;
    const earlierIntensity = earlier.reduce((sum, d) => sum + Math.abs(d.magnitude - 9.8), 0) / earlier.length;

    // Fatigue = reduction in movement intensity
    const reduction = Math.max(0, earlierIntensity - recentIntensity);
    const fatigueScore = Math.min(100, Math.round((reduction / earlierIntensity) * 100));

    let level = 'none';
    let message = 'Energy levels normal';

    if (fatigueScore > 60) {
      level = 'high';
      message = 'High fatigue detected - take a break';
    } else if (fatigueScore > 40) {
      level = 'medium';
      message = 'Moderate fatigue building';
    } else if (fatigueScore > 20) {
      level = 'low';
      message = 'Slight fatigue detected';
    }

    return {
      fatigue: fatigueScore,
      level,
      message
    };
  }

  /**
   * Get comprehensive motion analysis
   */
  getAnalysis() {
    const analysis = {
      timestamp: Date.now(),
      activityState: {
        isWalking: this.isWalking,
        isStationary: this.isStationary
      },
      fallDetected: this.fallDetected
    };

    // Add gait analysis if walking
    if (this.isWalking && this.steps.length >= 5) {
      analysis.gait = this.analyzeGait();
    }

    // Add fatigue detection
    analysis.fatigue = this.detectFatigue();

    // Generate alerts
    analysis.alerts = this.generateAlerts(analysis);

    return analysis;
  }

  /**
   * Generate alerts based on motion analysis
   */
  generateAlerts(analysis) {
    const alerts = [];

    // Fall alert (HIGHEST PRIORITY)
    if (this.fallDetected) {
      alerts.push({
        severity: 'emergency',
        type: 'fall',
        message: 'FALL DETECTED',
        action: 'Emergency services will be notified if you don\'t respond',
        icon: '🆘'
      });
    }

    // Gait alerts
    if (analysis.gait) {
      if (analysis.gait.riskLevel === 'high') {
        alerts.push({
          severity: 'danger',
          type: 'gait',
          message: 'UNSTABLE GAIT DETECTED',
          action: 'Walk carefully and find support',
          icon: '⚠️'
        });
      } else if (analysis.gait.riskLevel === 'medium') {
        alerts.push({
          severity: 'warning',
          type: 'gait',
          message: 'Irregular walking pattern',
          action: 'Be cautious of your surroundings',
          icon: '⚡'
        });
      }

      // Abnormal speed alerts
      if (analysis.gait.stepFrequency < this.thresholds.stepFrequency.slow) {
        alerts.push({
          severity: 'warning',
          type: 'speed',
          message: 'Walking very slowly',
          action: 'Consider taking a break',
          icon: '🐢'
        });
      }
    }

    // Fatigue alerts
    if (analysis.fatigue.level === 'high') {
      alerts.push({
        severity: 'danger',
        type: 'fatigue',
        message: 'HIGH FATIGUE',
        action: 'Stop and rest immediately',
        icon: '😴'
      });
    } else if (analysis.fatigue.level === 'medium') {
      alerts.push({
        severity: 'warning',
        type: 'fatigue',
        message: 'Fatigue building',
        action: 'Plan to take a break soon',
        icon: '💤'
      });
    }

    return alerts;
  }

  /**
   * Helper: Calculate variance
   */
  calculateVariance(values) {
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return squareDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Reset for new session
   */
  reset() {
    this.motionHistory = [];
    this.steps = [];
    this.lastStepTime = 0;
    this.baselineAcceleration = null;
    this.isWalking = false;
    this.isStationary = true;
    this.fallDetected = false;
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    if (this.steps.length === 0) {
      return { error: 'No step data collected' };
    }

    const totalSteps = this.steps.length;
    const gaitAnalysis = this.analyzeGait();
    const fatigueAnalysis = this.detectFatigue();

    return {
      totalSteps,
      avgStepFrequency: gaitAnalysis.stepFrequency,
      gaitQuality: gaitAnalysis.regularity,
      fallRiskScore: gaitAnalysis.fallRisk,
      finalFatigueScore: fatigueAnalysis.fatigue,
      fallsDetected: this.fallDetected ? 1 : 0
    };
  }
}

// Export for use in web app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MotionAnalyzer;
}