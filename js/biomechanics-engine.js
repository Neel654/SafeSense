/**
 * SafeSense Biomechanics Engine
 * Core pose analysis utilities shared across all modes
 * Extracts meaningful metrics from MediaPipe landmarks
 */

class BiomechanicsEngine {
  constructor() {
    // MediaPipe landmark indices
    this.LANDMARKS = {
      NOSE: 0,
      LEFT_EYE_INNER: 1,
      LEFT_EYE: 2,
      LEFT_EYE_OUTER: 3,
      RIGHT_EYE_INNER: 4,
      RIGHT_EYE: 5,
      RIGHT_EYE_OUTER: 6,
      LEFT_EAR: 7,
      RIGHT_EAR: 8,
      MOUTH_LEFT: 9,
      MOUTH_RIGHT: 10,
      LEFT_SHOULDER: 11,
      RIGHT_SHOULDER: 12,
      LEFT_ELBOW: 13,
      RIGHT_ELBOW: 14,
      LEFT_WRIST: 15,
      RIGHT_WRIST: 16,
      LEFT_PINKY: 17,
      RIGHT_PINKY: 18,
      LEFT_INDEX: 19,
      RIGHT_INDEX: 20,
      LEFT_THUMB: 21,
      RIGHT_THUMB: 22,
      LEFT_HIP: 23,
      RIGHT_HIP: 24,
      LEFT_KNEE: 25,
      RIGHT_KNEE: 26,
      LEFT_ANKLE: 27,
      RIGHT_ANKLE: 28,
      LEFT_HEEL: 29,
      RIGHT_HEEL: 30,
      LEFT_FOOT_INDEX: 31,
      RIGHT_FOOT_INDEX: 32
    };

    // History for smoothing
    this.history = [];
    this.maxHistory = 30; // 1 second at 30fps
  }

  /**
   * Extract all relevant metrics from pose landmarks
   */
  analyze(landmarks) {
    if (!landmarks || landmarks.length < 33) {
      return null;
    }

    const metrics = {
      timestamp: Date.now(),
      
      // HEAD METRICS (for Drive Mode)
      head: this.analyzeHead(landmarks),
      
      // BODY SYMMETRY (for Gym Mode)
      symmetry: this.analyzeSymmetry(landmarks),
      
      // JOINT ANGLES (for all modes)
      angles: this.calculateJointAngles(landmarks),
      
      // BODY POSITION
      position: this.analyzePosition(landmarks),
      
      // RAW LANDMARKS (for custom analysis)
      raw: landmarks
    };

    // Store history for temporal analysis
    this.history.push(metrics);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return metrics;
  }

  /**
   * Analyze head position and orientation
   */
  analyzeHead(landmarks) {
    const nose = landmarks[this.LANDMARKS.NOSE];
    const leftEar = landmarks[this.LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[this.LANDMARKS.RIGHT_EAR];
    const leftEye = landmarks[this.LANDMARKS.LEFT_EYE];
    const rightEye = landmarks[this.LANDMARKS.RIGHT_EYE];
    const leftShoulder = landmarks[this.LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[this.LANDMARKS.RIGHT_SHOULDER];

    // Midpoints
    const earMid = this.midpoint(leftEar, rightEar);
    const eyeMid = this.midpoint(leftEye, rightEye);
    const shoulderMid = this.midpoint(leftShoulder, rightShoulder);

    // Head tilt (roll) - ear height difference
    const headTilt = Math.atan2(
      rightEar.y - leftEar.y,
      rightEar.x - leftEar.x
    ) * 180 / Math.PI;

    // Head nod (pitch) - vertical position relative to shoulders
    const headDrop = (earMid.y - shoulderMid.y) / this.distance(leftShoulder, rightShoulder);
    
    // Forward lean
    const forwardLean = (nose.z - shoulderMid.z);

    // Eye aspect ratio (for blink/drowsiness detection)
    const leftEyeOpen = this.calculateEyeAspectRatio(landmarks, 'left');
    const rightEyeOpen = this.calculateEyeAspectRatio(landmarks, 'right');
    const eyesOpen = (leftEyeOpen + rightEyeOpen) / 2;

    return {
      tilt: headTilt,           // Roll angle (side to side)
      drop: headDrop,           // How much head has dropped (nodding off)
      forwardLean: forwardLean, // Leaning forward
      eyesOpen: eyesOpen,       // Eye openness (0-1)
      noseY: nose.y,            // Vertical nose position
      isUpright: headDrop < 0.3 && Math.abs(headTilt) < 20
    };
  }

  /**
   * Calculate eye aspect ratio (proxy for eye openness)
   * Using available landmarks as approximation
   */
  calculateEyeAspectRatio(landmarks, side) {
    // MediaPipe doesn't give us detailed eye landmarks,
    // so we approximate using eye-ear distance changes
    const eyeIdx = side === 'left' ? this.LANDMARKS.LEFT_EYE : this.LANDMARKS.RIGHT_EYE;
    const earIdx = side === 'left' ? this.LANDMARKS.LEFT_EAR : this.LANDMARKS.RIGHT_EAR;
    
    const eye = landmarks[eyeIdx];
    const ear = landmarks[earIdx];
    
    // Use visibility as proxy for eye openness
    // When eyes close, visibility often drops
    return eye.visibility || 0.5;
  }

  /**
   * Analyze left/right body symmetry
   */
  analyzeSymmetry(landmarks) {
    const L = this.LANDMARKS;
    
    // Shoulder symmetry
    const shoulderHeightDiff = Math.abs(
      landmarks[L.LEFT_SHOULDER].y - landmarks[L.RIGHT_SHOULDER].y
    );
    
    // Elbow symmetry (position relative to shoulder)
    const leftElbowDist = this.distance(landmarks[L.LEFT_SHOULDER], landmarks[L.LEFT_ELBOW]);
    const rightElbowDist = this.distance(landmarks[L.RIGHT_SHOULDER], landmarks[L.RIGHT_ELBOW]);
    const elbowSymmetry = Math.min(leftElbowDist, rightElbowDist) / 
                          Math.max(leftElbowDist, rightElbowDist);

    // Wrist symmetry (height)
    const leftWristY = landmarks[L.LEFT_WRIST].y;
    const rightWristY = landmarks[L.RIGHT_WRIST].y;
    const wristHeightDiff = Math.abs(leftWristY - rightWristY);

    // Hip symmetry
    const hipHeightDiff = Math.abs(
      landmarks[L.LEFT_HIP].y - landmarks[L.RIGHT_HIP].y
    );

    // Knee symmetry
    const leftKneeAngle = this.calculateAngle(
      landmarks[L.LEFT_HIP],
      landmarks[L.LEFT_KNEE],
      landmarks[L.LEFT_ANKLE]
    );
    const rightKneeAngle = this.calculateAngle(
      landmarks[L.RIGHT_HIP],
      landmarks[L.RIGHT_KNEE],
      landmarks[L.RIGHT_ANKLE]
    );
    const kneeAngleDiff = Math.abs(leftKneeAngle - rightKneeAngle);

    // Calculate overall symmetry score (0-100)
    const shoulderScore = Math.max(0, 100 - shoulderHeightDiff * 500);
    const elbowScore = elbowSymmetry * 100;
    const wristScore = Math.max(0, 100 - wristHeightDiff * 300);
    const kneeScore = Math.max(0, 100 - kneeAngleDiff);

    const overallScore = (shoulderScore + elbowScore + wristScore + kneeScore) / 4;

    // Determine which side is lagging
    let laggingSide = null;
    if (wristHeightDiff > 0.05) {
      laggingSide = leftWristY > rightWristY ? 'left' : 'right';
    }

    return {
      overall: Math.round(overallScore),
      shoulder: Math.round(shoulderScore),
      elbow: Math.round(elbowScore),
      wrist: Math.round(wristScore),
      knee: Math.round(kneeScore),
      laggingSide: laggingSide,
      leftWristY: leftWristY,
      rightWristY: rightWristY,
      details: {
        shoulderHeightDiff,
        wristHeightDiff,
        kneeAngleDiff
      }
    };
  }

  /**
   * Calculate all major joint angles
   */
  calculateJointAngles(landmarks) {
    const L = this.LANDMARKS;

    return {
      // Arms
      leftElbow: this.calculateAngle(
        landmarks[L.LEFT_SHOULDER],
        landmarks[L.LEFT_ELBOW],
        landmarks[L.LEFT_WRIST]
      ),
      rightElbow: this.calculateAngle(
        landmarks[L.RIGHT_SHOULDER],
        landmarks[L.RIGHT_ELBOW],
        landmarks[L.RIGHT_WRIST]
      ),
      leftShoulder: this.calculateAngle(
        landmarks[L.LEFT_HIP],
        landmarks[L.LEFT_SHOULDER],
        landmarks[L.LEFT_ELBOW]
      ),
      rightShoulder: this.calculateAngle(
        landmarks[L.RIGHT_HIP],
        landmarks[L.RIGHT_SHOULDER],
        landmarks[L.RIGHT_ELBOW]
      ),

      // Legs
      leftKnee: this.calculateAngle(
        landmarks[L.LEFT_HIP],
        landmarks[L.LEFT_KNEE],
        landmarks[L.LEFT_ANKLE]
      ),
      rightKnee: this.calculateAngle(
        landmarks[L.RIGHT_HIP],
        landmarks[L.RIGHT_KNEE],
        landmarks[L.RIGHT_ANKLE]
      ),
      leftHip: this.calculateAngle(
        landmarks[L.LEFT_SHOULDER],
        landmarks[L.LEFT_HIP],
        landmarks[L.LEFT_KNEE]
      ),
      rightHip: this.calculateAngle(
        landmarks[L.RIGHT_SHOULDER],
        landmarks[L.RIGHT_HIP],
        landmarks[L.RIGHT_KNEE]
      ),

      // Spine (approximated)
      spine: this.calculateSpineAngle(landmarks)
    };
  }

  /**
   * Calculate spine angle (torso vertical alignment)
   */
  calculateSpineAngle(landmarks) {
    const shoulderMid = this.midpoint(
      landmarks[this.LANDMARKS.LEFT_SHOULDER],
      landmarks[this.LANDMARKS.RIGHT_SHOULDER]
    );
    const hipMid = this.midpoint(
      landmarks[this.LANDMARKS.LEFT_HIP],
      landmarks[this.LANDMARKS.RIGHT_HIP]
    );

    // Angle from vertical
    const angle = Math.atan2(
      shoulderMid.x - hipMid.x,
      hipMid.y - shoulderMid.y
    ) * 180 / Math.PI;

    return angle;
  }

  /**
   * Analyze overall body position
   */
  analyzePosition(landmarks) {
    const L = this.LANDMARKS;
    
    const shoulderMid = this.midpoint(
      landmarks[L.LEFT_SHOULDER],
      landmarks[L.RIGHT_SHOULDER]
    );
    const hipMid = this.midpoint(
      landmarks[L.LEFT_HIP],
      landmarks[L.RIGHT_HIP]
    );

    // Standing vs sitting detection
    const torsoLength = this.distance(shoulderMid, hipMid);
    const leftLegLength = this.distance(landmarks[L.LEFT_HIP], landmarks[L.LEFT_ANKLE]);
    const rightLegLength = this.distance(landmarks[L.RIGHT_HIP], landmarks[L.RIGHT_ANKLE]);
    const avgLegLength = (leftLegLength + rightLegLength) / 2;

    // If legs are bent significantly, likely sitting
    const leftKneeAngle = this.calculateAngle(
      landmarks[L.LEFT_HIP],
      landmarks[L.LEFT_KNEE],
      landmarks[L.LEFT_ANKLE]
    );
    const isSitting = leftKneeAngle < 120;

    return {
      centerX: (shoulderMid.x + hipMid.x) / 2,
      centerY: (shoulderMid.y + hipMid.y) / 2,
      torsoLength,
      isSitting,
      isStanding: !isSitting && avgLegLength > torsoLength * 0.8
    };
  }

  /**
   * Get velocity/acceleration of a landmark over time
   */
  getLandmarkVelocity(landmarkIndex) {
    if (this.history.length < 2) return { x: 0, y: 0, z: 0, magnitude: 0 };

    const current = this.history[this.history.length - 1].raw[landmarkIndex];
    const previous = this.history[this.history.length - 2].raw[landmarkIndex];
    const dt = (this.history[this.history.length - 1].timestamp - 
                this.history[this.history.length - 2].timestamp) / 1000;

    if (dt === 0) return { x: 0, y: 0, z: 0, magnitude: 0 };

    const velocity = {
      x: (current.x - previous.x) / dt,
      y: (current.y - previous.y) / dt,
      z: (current.z - previous.z) / dt
    };
    velocity.magnitude = Math.sqrt(velocity.x**2 + velocity.y**2 + velocity.z**2);

    return velocity;
  }

  /**
   * Detect sudden movements (for fall detection)
   */
  detectSuddenMovement(threshold = 2) {
    const noseVel = this.getLandmarkVelocity(this.LANDMARKS.NOSE);
    const hipVel = this.getLandmarkVelocity(this.LANDMARKS.LEFT_HIP);
    
    return noseVel.magnitude > threshold || hipVel.magnitude > threshold;
  }

  // ===================
  // UTILITY FUNCTIONS
  // ===================

  calculateAngle(p1, p2, p3) {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x**2 + v1.y**2);
    const mag2 = Math.sqrt(v2.x**2 + v2.y**2);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cos) * 180 / Math.PI;
  }

  midpoint(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      z: ((p1.z || 0) + (p2.z || 0)) / 2
    };
  }

  distance(p1, p2) {
    return Math.sqrt(
      (p1.x - p2.x)**2 + 
      (p1.y - p2.y)**2 + 
      ((p1.z || 0) - (p2.z || 0))**2
    );
  }

  reset() {
    this.history = [];
  }
}

// Global instance
window.biomechanicsEngine = new BiomechanicsEngine();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BiomechanicsEngine;
}