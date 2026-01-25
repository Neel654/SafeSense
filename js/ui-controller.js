/**
 * SafeSense UI Controller
 * Handles all UI updates across the three modes
 */

class UIController {
  constructor() {
    this.currentMode = null;
    this.sessionTimer = null;
    this.sessionStartTime = null;
    this.activeAlerts = new Map();
    
    this.elements = {};
  }

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      // Status
      statusIndicator: document.getElementById('status-indicator'),
      statusOverlay: document.getElementById('status-overlay'),
      modeOverlay: document.getElementById('mode-overlay'),
      
      // GYM elements
      symmetryScore: document.getElementById('symmetry-score'),
      symmetryBar: document.getElementById('symmetry-bar'),
      leftScore: document.getElementById('left-score'),
      rightScore: document.getElementById('right-score'),
      repCount: document.getElementById('rep-count'),
      formQuality: document.getElementById('form-quality'),
      formStatus: document.getElementById('form-status'),
      sessionTimeGym: document.getElementById('session-time-gym'),
      
      // DRIVE elements
      alertnessLevel: document.getElementById('alertness-level'),
      alertnessBar: document.getElementById('alertness-bar'),
      headPosition: document.getElementById('head-position'),
      headStatus: document.getElementById('head-status'),
      eyesStatus: document.getElementById('eyes-status'),
      blinkRate: document.getElementById('blink-rate'),
      drowsyCount: document.getElementById('drowsy-count'),
      sessionTimeDrive: document.getElementById('session-time-drive'),
      breakReminder: document.getElementById('break-reminder'),
      
      // LIFE elements
      lifeStatus: document.getElementById('life-status'),
      lifeStatusDetail: document.getElementById('life-status-detail'),
      mobilityScore: document.getElementById('mobility-score'),
      mobilityBar: document.getElementById('mobility-bar'),
      movementStatus: document.getElementById('movement-status'),
      lastActivity: document.getElementById('last-activity'),
      sessionTimeLife: document.getElementById('session-time-life'),
      
      // General
      alertsContainer: document.getElementById('alerts-container'),
      currentModeBadge: document.getElementById('current-mode-badge'),
      metricsTitle: document.getElementById('metrics-title'),
      tipText: document.getElementById('tip-text')
    };
  }

  /**
   * Set the active mode and update UI accordingly
   */
  setMode(mode) {
    this.currentMode = mode;
    this.cacheElements();
    
    // Hide all mode metrics
    document.querySelectorAll('.mode-metrics').forEach(el => {
      el.classList.add('hidden');
    });
    
    // Show current mode metrics
    const metricsEl = document.getElementById(`${mode}-metrics`);
    if (metricsEl) {
      metricsEl.classList.remove('hidden');
    }
    
    // Update mode badge
    if (this.elements.currentModeBadge) {
      this.elements.currentModeBadge.textContent = mode.toUpperCase();
      this.elements.currentModeBadge.className = `mode-badge ${mode}`;
    }
    
    // Update metrics title
    if (this.elements.metricsTitle) {
      const titles = {
        gym: '🏋️ Gym Metrics',
        drive: '🚗 Drive Metrics', 
        life: '👴 Life Metrics'
      };
      this.elements.metricsTitle.textContent = titles[mode] || 'Live Metrics';
    }
    
    // Update tips
    this.updateTips(mode);
    
    // Update mode overlay
    this.updateModeOverlay(mode);
    
    // Set voice engine mode
    window.voiceEngine?.setMode(mode);
  }

  /**
   * Update mode-specific overlay on video
   */
  updateModeOverlay(mode) {
    const overlay = this.elements.modeOverlay;
    if (!overlay) return;

    const overlays = {
      gym: `
        <div class="overlay-stat">
          <span class="overlay-label">SYMMETRY</span>
          <span class="overlay-value" id="overlay-symmetry">100%</span>
        </div>
        <div class="overlay-stat">
          <span class="overlay-label">REPS</span>
          <span class="overlay-value" id="overlay-reps">0</span>
        </div>
      `,
      drive: `
        <div class="overlay-stat alertness">
          <span class="overlay-label">ALERTNESS</span>
          <span class="overlay-value" id="overlay-alertness">100%</span>
        </div>
      `,
      life: `
        <div class="overlay-stat">
          <span class="overlay-label">STATUS</span>
          <span class="overlay-value" id="overlay-life-status">SAFE</span>
        </div>
      `
    };

    overlay.innerHTML = overlays[mode] || '';
  }

  /**
   * Update tips panel
   */
  updateTips(mode) {
    const tips = {
      gym: "💡 Keep movements symmetrical. I'll call out if one side is lagging!",
      drive: "💡 Keep your head up and eyes forward. I'll alert you if you're getting drowsy.",
      life: "💡 Move naturally. I'll detect any falls and call for help if needed."
    };

    if (this.elements.tipText) {
      this.elements.tipText.textContent = tips[mode] || '';
    }
  }

  // ==================
  // GYM MODE UPDATES
  // ==================

  updateGymMetrics(state) {
    if (this.currentMode !== 'gym') return;

    // Symmetry score
    if (this.elements.symmetryScore) {
      this.elements.symmetryScore.textContent = `${state.symmetryScore}%`;
    }
    if (this.elements.symmetryBar) {
      this.elements.symmetryBar.style.width = `${state.symmetryScore}%`;
      this.elements.symmetryBar.className = `metric-bar-fill ${
        state.symmetryScore >= 85 ? 'good' : 
        state.symmetryScore >= 70 ? 'warning' : 'danger'
      }`;
    }

    // Left/Right scores
    if (this.elements.leftScore) {
      this.elements.leftScore.textContent = state.leftScore;
    }
    if (this.elements.rightScore) {
      this.elements.rightScore.textContent = state.rightScore;
    }

    // Rep count
    if (this.elements.repCount) {
      this.elements.repCount.textContent = state.repCount;
    }

    // Form quality
    if (this.elements.formQuality) {
      this.elements.formQuality.textContent = state.formQuality;
      this.elements.formQuality.className = `metric-value ${
        state.formQuality === 'EXCELLENT' ? 'text-good' :
        state.formQuality === 'GOOD' ? 'text-good' :
        state.formQuality === 'FAIR' ? 'text-warning' : 'text-danger'
      }`;
    }

    // Form status
    if (this.elements.formStatus) {
      const statuses = {
        'EXCELLENT': 'Perfect form! Keep it up!',
        'GOOD': 'Good form, stay focused',
        'FAIR': 'Watch your symmetry',
        'POOR': 'Slow down, check form',
        'READY': 'Start exercising to analyze'
      };
      this.elements.formStatus.textContent = statuses[state.formQuality] || '';
    }

    // Update overlay
    const overlaySym = document.getElementById('overlay-symmetry');
    if (overlaySym) overlaySym.textContent = `${state.symmetryScore}%`;
    
    const overlayReps = document.getElementById('overlay-reps');
    if (overlayReps) overlayReps.textContent = state.repCount;

    // Update status indicator
    this.updateStatusIndicator(
      state.symmetryScore >= 85 ? 'good' : 
      state.symmetryScore >= 70 ? 'warning' : 'danger',
      state.formQuality
    );
  }

  // ==================
  // DRIVE MODE UPDATES
  // ==================

  updateDriveMetrics(state) {
    if (this.currentMode !== 'drive') return;

    // Alertness level - text
    if (this.elements.alertnessLevel) {
      this.elements.alertnessLevel.textContent = `${state.alertnessLevel}%`;
    }
    
    // Alertness bar - FIXED: properly update width and color
    if (this.elements.alertnessBar) {
      // Update width
      this.elements.alertnessBar.style.width = `${state.alertnessLevel}%`;
      
      // Determine color class based on alertness level
      let colorClass = 'good';
      if (state.alertnessLevel < 40) {
        colorClass = 'danger';
      } else if (state.alertnessLevel < 70) {
        colorClass = 'warning';
      }
      
      // Set classes - remove old color classes, add new one
      this.elements.alertnessBar.className = `metric-bar-fill alertness-bar ${colorClass}`;
    }

    // Head position
    if (this.elements.headPosition) {
      this.elements.headPosition.textContent = state.headPosition;
      this.elements.headPosition.className = `metric-value ${
        state.headPosition === 'UPRIGHT' ? 'text-good' :
        state.headPosition === 'WARNING' ? 'text-warning' : 
        state.headPosition === 'DANGER' ? 'text-danger' : ''
      }`;
    }
    if (this.elements.headStatus) {
      const statuses = {
        'UPRIGHT': 'Good position',
        'DROPPING': 'Head dropping...',
        'WARNING': 'Stay alert!',
        'DANGER': 'WAKE UP!'
      };
      this.elements.headStatus.textContent = statuses[state.headPosition] || 'Monitoring...';
    }

    // Eyes status
    if (this.elements.eyesStatus) {
      this.elements.eyesStatus.textContent = state.eyesStatus;
      this.elements.eyesStatus.className = `metric-value ${
        state.eyesStatus === 'OPEN' ? 'text-good' :
        state.eyesStatus === 'MICRO-SLEEP' ? 'text-danger pulse' : 'text-warning'
      }`;
    }

    // Drowsy events
    if (this.elements.drowsyCount) {
      this.elements.drowsyCount.textContent = state.drowsyEvents;
      if (state.drowsyEvents > 0) {
        this.elements.drowsyCount.classList.add('text-danger');
      }
    }

    // Break reminder
    if (this.elements.breakReminder) {
      this.elements.breakReminder.textContent = state.breakReminder;
    }

    // Update overlay
    const overlayAlert = document.getElementById('overlay-alertness');
    if (overlayAlert) {
      overlayAlert.textContent = `${state.alertnessLevel}%`;
      overlayAlert.className = `overlay-value ${
        state.alertnessLevel >= 70 ? '' : 
        state.alertnessLevel >= 40 ? 'warning' : 'danger pulse'
      }`;
    }

    // Update status indicator
    this.updateStatusIndicator(
      state.alertnessLevel >= 70 ? 'good' : 
      state.alertnessLevel >= 40 ? 'warning' : 'danger',
      state.headPosition === 'UPRIGHT' ? 'Alert' : state.headPosition
    );
  }

  // ==================
  // LIFE MODE UPDATES  
  // ==================

  updateLifeMetrics(state) {
    if (this.currentMode !== 'life') return;

    // Status
    if (this.elements.lifeStatus) {
      this.elements.lifeStatus.textContent = state.status;
      this.elements.lifeStatus.className = `metric-value ${
        state.status === 'SAFE' ? 'text-good' :
        state.status === 'EMERGENCY' ? 'text-danger pulse' :
        state.status === 'CHECKING' ? 'text-warning' : ''
      }`;
    }
    if (this.elements.lifeStatusDetail) {
      this.elements.lifeStatusDetail.textContent = state.statusDetail;
    }

    // Mobility score
    if (this.elements.mobilityScore) {
      this.elements.mobilityScore.textContent = `${state.mobilityScore}%`;
    }
    if (this.elements.mobilityBar) {
      this.elements.mobilityBar.style.width = `${state.mobilityScore}%`;
    }

    // Movement status
    if (this.elements.movementStatus) {
      this.elements.movementStatus.textContent = state.movementDetected ? 'YES' : 'NO';
      this.elements.movementStatus.className = `metric-value ${
        state.movementDetected ? 'text-good' : 'text-warning'
      }`;
    }

    // Last activity
    if (this.elements.lastActivity) {
      this.elements.lastActivity.textContent = state.lastActivity;
    }

    // Update overlay
    const overlayStatus = document.getElementById('overlay-life-status');
    if (overlayStatus) {
      overlayStatus.textContent = state.status;
      overlayStatus.className = `overlay-value ${
        state.status === 'SAFE' ? '' :
        state.status === 'EMERGENCY' ? 'danger pulse' : 'warning'
      }`;
    }

    // Update status indicator
    this.updateStatusIndicator(
      state.status === 'SAFE' ? 'good' : 
      state.status === 'EMERGENCY' ? 'danger' : 'warning',
      state.status
    );
  }

  // ==================
  // COMMON UPDATES
  // ==================

  updateStatusIndicator(state, text) {
    const indicator = this.elements.statusIndicator;
    if (!indicator) return;

    indicator.className = `status-indicator ${state}`;
    
    const iconEl = indicator.querySelector('.status-icon');
    const textEl = indicator.querySelector('.status-text');

    if (iconEl) {
      iconEl.textContent = state === 'good' ? '✓' : 
                          state === 'warning' ? '⚠' : '⚠';
    }
    if (textEl) {
      textEl.textContent = text;
    }
  }

  /**
   * Update session timer
   */
  updateSessionTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const timeElements = [
      this.elements.sessionTimeGym,
      this.elements.sessionTimeDrive,
      this.elements.sessionTimeLife
    ];

    timeElements.forEach(el => {
      if (el) el.textContent = timeStr;
    });
  }

  /**
   * Start session timer
   */
  startSessionTimer() {
    this.sessionStartTime = Date.now();
    
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    this.sessionTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.updateSessionTime(elapsed);
    }, 1000);
  }

  /**
   * Stop session timer
   */
  stopSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  /**
   * Show alert notification
   */
  showAlert(alert) {
    const container = this.elements.alertsContainer;
    if (!container) return;

    const key = `${alert.type}-${alert.severity}`;
    if (this.activeAlerts.has(key)) return;

    const alertEl = document.createElement('div');
    alertEl.className = `alert ${alert.severity}`;
    alertEl.innerHTML = `
      <div class="alert-icon">${this.getAlertIcon(alert.severity)}</div>
      <div class="alert-content">
        <div class="alert-title">${alert.message}</div>
      </div>
      <button class="alert-close">×</button>
    `;

    container.appendChild(alertEl);
    this.activeAlerts.set(key, alertEl);

    // Close button
    alertEl.querySelector('.alert-close').onclick = () => {
      this.dismissAlert(key, alertEl);
    };

    // Auto-dismiss (except emergency)
    if (alert.severity !== 'emergency') {
      setTimeout(() => {
        this.dismissAlert(key, alertEl);
      }, 5000);
    }
  }

  getAlertIcon(severity) {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      danger: '🚨',
      emergency: '🆘'
    };
    return icons[severity] || '⚠️';
  }

  dismissAlert(key, element) {
    if (element && element.parentNode) {
      element.style.animation = 'slideOut 0.3s forwards';
      setTimeout(() => {
        element.parentNode?.removeChild(element);
        this.activeAlerts.delete(key);
      }, 300);
    }
  }

  clearAlerts() {
    if (this.elements.alertsContainer) {
      this.elements.alertsContainer.innerHTML = '';
    }
    this.activeAlerts.clear();
  }

  /**
   * Reset UI state
   */
  reset() {
    this.stopSessionTimer();
    this.clearAlerts();
    this.updateSessionTime(0);
  }
}

// Global instance
window.uiController = new UIController();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}