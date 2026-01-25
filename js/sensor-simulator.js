// js/sensor-simulator.js
// 🎮 SENSOR SIMULATOR - Test gait analysis without a phone!

class SensorSimulator {
  constructor(motionAnalyzer, uiController) {
    this.analyzer = motionAnalyzer;
    this.ui = uiController;
    this.isSimulating = false;
    this.simulationInterval = null;
    this.currentScenario = null;
    this.stepPhase = 0;
    
    // Simulation parameters
    this.scenarios = {
      normalWalk: {
        name: "Normal Walking",
        description: "Healthy, regular gait pattern",
        baseAccel: 9.8,
        stepAmplitude: 3.5,
        stepFrequency: 1.8, // steps per second
        variance: 0.15,
        asymmetry: 0.05
      },
      
      irregularGait: {
        name: "Irregular Gait",
        description: "Uneven steps, possible injury",
        baseAccel: 9.8,
        stepAmplitude: 4.2,
        stepFrequency: 1.4,
        variance: 0.45, // High variance = irregular
        asymmetry: 0.25
      },
      
      fatigued: {
        name: "Fatigued Walking",
        description: "Tired, degrading pattern",
        baseAccel: 9.8,
        stepAmplitude: 2.8,
        stepFrequency: 1.2,
        variance: 0.35,
        asymmetry: 0.15,
        degradation: true
      },
      
      elderlyGait: {
        name: "Elderly Gait Pattern",
        description: "Slower, cautious steps",
        baseAccel: 9.8,
        stepAmplitude: 2.2,
        stepFrequency: 1.0,
        variance: 0.30,
        asymmetry: 0.20
      },
      
      preFall: {
        name: "Pre-Fall Warning",
        description: "Unstable, high fall risk",
        baseAccel: 9.8,
        stepAmplitude: 5.0,
        stepFrequency: 1.6,
        variance: 0.60,
        asymmetry: 0.40,
        includeStumble: true
      },
      
      actualFall: {
        name: "Fall Event",
        description: "Simulates a fall detection",
        triggerFall: true,
        fallDelay: 3000 // Fall after 3 seconds
      }
    };
    
    this.timeStarted = 0;
    this.dataPoints = [];
  }

  // Generate realistic accelerometer data
  generateAccelerometerData(scenario, elapsed) {
    const s = this.scenarios[scenario];
    
    if (s.triggerFall && elapsed > s.fallDelay) {
      // Simulate fall: huge spike then near-zero
      return this.generateFallData(elapsed - s.fallDelay);
    }
    
    // Calculate step phase (0 to 2π for each step cycle)
    const stepPeriod = 1000 / s.stepFrequency;
    this.stepPhase = (elapsed % stepPeriod) / stepPeriod * Math.PI * 2;
    
    // Base gravity
    let y = s.baseAccel;
    
    // Add step pattern (sinusoidal with harmonics for realism)
    const stepSignal = Math.sin(this.stepPhase) * s.stepAmplitude;
    const harmonic2 = Math.sin(this.stepPhase * 2) * s.stepAmplitude * 0.3;
    const harmonic3 = Math.sin(this.stepPhase * 3) * s.stepAmplitude * 0.1;
    
    y += stepSignal + harmonic2 + harmonic3;
    
    // Add variance/noise
    const noise = (Math.random() - 0.5) * s.variance * s.stepAmplitude;
    y += noise;
    
    // Lateral movement (x-axis) - asymmetry shows here
    let x = Math.sin(this.stepPhase) * s.stepAmplitude * 0.4;
    x += (Math.random() - 0.5) * s.asymmetry * 3;
    
    // Forward/back movement (z-axis)
    let z = Math.cos(this.stepPhase) * s.stepAmplitude * 0.3;
    z += (Math.random() - 0.5) * s.variance * 2;
    
    // Degradation over time (fatigue)
    if (s.degradation) {
      const fatigueMultiplier = 1 + (elapsed / 30000) * 0.5; // Gets worse over 30s
      x *= fatigueMultiplier;
      z *= fatigueMultiplier;
    }
    
    // Occasional stumble
    if (s.includeStumble && Math.random() < 0.02) {
      x += (Math.random() - 0.5) * 8;
      y += (Math.random() - 0.5) * 6;
    }
    
    return {
      x: x,
      y: y,
      z: z,
      timestamp: Date.now()
    };
  }

  generateFallData(fallElapsed) {
    if (fallElapsed < 200) {
      // Initial destabilization
      return {
        x: (Math.random() - 0.5) * 10,
        y: 9.8 + (Math.random() - 0.5) * 5,
        z: (Math.random() - 0.5) * 10,
        timestamp: Date.now()
      };
    } else if (fallElapsed < 500) {
      // Free fall + impact (HUGE spike)
      const impactIntensity = 20 + Math.random() * 15;
      return {
        x: (Math.random() - 0.5) * impactIntensity,
        y: impactIntensity + Math.random() * 10,
        z: (Math.random() - 0.5) * impactIntensity,
        timestamp: Date.now()
      };
    } else {
      // Post-fall (person on ground, minimal movement)
      return {
        x: (Math.random() - 0.5) * 0.5,
        y: 9.8 + (Math.random() - 0.5) * 0.3,
        z: (Math.random() - 0.5) * 0.5,
        timestamp: Date.now()
      };
    }
  }

  startSimulation(scenarioKey) {
    if (this.isSimulating) {
      this.stopSimulation();
    }
    
    this.currentScenario = scenarioKey;
    this.isSimulating = true;
    this.timeStarted = Date.now();
    this.dataPoints = [];
    
    const scenario = this.scenarios[scenarioKey];
    console.log(`🎮 Starting simulation: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    // Update UI to show simulation mode
    this.showSimulationIndicator(scenario.name);
    
    // Generate data at 50Hz (every 20ms) - realistic sensor rate
    this.simulationInterval = setInterval(() => {
      const elapsed = Date.now() - this.timeStarted;
      const data = this.generateAccelerometerData(scenarioKey, elapsed);
      
      this.dataPoints.push(data);
      
      // Feed to motion analyzer
      if (this.analyzer) {
        this.analyzer.processMotionData(data);
        
        // Update UI with results
        const analysis = this.analyzer.getAnalysis();
        if (this.ui) {
          this.ui.updateSensorMetrics(analysis);
          
          // Check for fall
          if (analysis.fallDetected) {
            this.ui.showFallAlert();
          }
        }
      }
      
    }, 20); // 50Hz
    
    return scenario;
  }

  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.isSimulating = false;
    this.hideSimulationIndicator();
    console.log(`🎮 Simulation stopped. Generated ${this.dataPoints.length} data points.`);
    
    return this.getSimulationSummary();
  }

  getSimulationSummary() {
    if (!this.analyzer) return null;
    
    const analysis = this.analyzer.getAnalysis();
    return {
      scenario: this.currentScenario,
      duration: Date.now() - this.timeStarted,
      dataPoints: this.dataPoints.length,
      results: analysis
    };
  }

  showSimulationIndicator(scenarioName) {
    // Add visual indicator that we're in simulation mode
    let indicator = document.getElementById('simulation-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'simulation-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: linear-gradient(135deg, #9333ea, #db2777);
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        font-weight: bold;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);
        animation: pulse 2s infinite;
      `;
      document.body.appendChild(indicator);
      
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `;
      document.head.appendChild(style);
    }
    indicator.innerHTML = `🎮 SIMULATING: ${scenarioName}`;
    indicator.style.display = 'block';
  }

  hideSimulationIndicator() {
    const indicator = document.getElementById('simulation-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // Get available scenarios for UI
  getScenarios() {
    return Object.entries(this.scenarios).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description
    }));
  }
}

// Export for use
window.SensorSimulator = SensorSimulator;