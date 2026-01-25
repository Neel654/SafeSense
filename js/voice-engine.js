/**
 * SafeSense Voice Engine
 * Text-to-Speech system for real-time voice corrections and alerts
 * THIS IS THE KEY - Voice feedback when you can't look at a screen!
 */

class VoiceEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.enabled = true;
    this.speaking = false;
    this.queue = [];
    this.lastSpoken = {};
    this.cooldowns = {
      correction: 3000,    // 3 sec between same correction
      warning: 2000,       // 2 sec between warnings  
      emergency: 0,        // No cooldown for emergencies
      encouragement: 10000 // 10 sec between encouragements
    };
    
    // Voice settings per mode
    this.voiceProfiles = {
      gym: { rate: 1.1, pitch: 1.0, volume: 1.0 },      // Coach voice
      drive: { rate: 1.3, pitch: 1.2, volume: 1.0 },    // Urgent voice
      life: { rate: 0.9, pitch: 0.9, volume: 1.0 }      // Calm voice
    };
    
    this.currentProfile = 'gym';
    this.voice = null;
    
    this.init();
  }

  init() {
    // Wait for voices to load
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoice();
    }
    this.loadVoice();
  }

  loadVoice() {
    const voices = this.synth.getVoices();
    // Prefer English voices
    this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                 voices.find(v => v.lang.startsWith('en')) ||
                 voices[0];
    console.log('🔊 Voice loaded:', this.voice?.name);
  }

  setMode(mode) {
    this.currentProfile = mode;
    console.log(`🔊 Voice profile set to: ${mode}`);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.synth.cancel();
    }
    return this.enabled;
  }

  /**
   * Speak with priority and cooldown management
   */
  speak(text, priority = 'correction', force = false) {
    if (!this.enabled && priority !== 'emergency') return;
    
    // Check cooldown
    const now = Date.now();
    const key = `${priority}-${text}`;
    const cooldown = this.cooldowns[priority] || 3000;
    
    if (!force && this.lastSpoken[key] && (now - this.lastSpoken[key]) < cooldown) {
      return; // Still on cooldown
    }
    
    this.lastSpoken[key] = now;

    // Cancel current speech for emergencies
    if (priority === 'emergency') {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const profile = this.voiceProfiles[this.currentProfile];
    
    utterance.voice = this.voice;
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;

    // Show voice indicator
    utterance.onstart = () => {
      this.speaking = true;
      this.showIndicator(text);
    };

    utterance.onend = () => {
      this.speaking = false;
      this.hideIndicator();
    };

    utterance.onerror = () => {
      this.speaking = false;
      this.hideIndicator();
    };

    this.synth.speak(utterance);
  }

  /**
   * Emergency alert - plays siren then speaks
   */
  async emergencyAlert(message) {
    this.synth.cancel();
    
    // Play siren sound
    await this.playSiren();
    
    // Speak emergency message
    this.speak(message, 'emergency', true);
  }

  /**
   * Play siren/alarm sound using Web Audio API
   */
  playSiren() {
    return new Promise((resolve) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

        // Siren effect - oscillate between frequencies
        const startTime = audioCtx.currentTime;
        for (let i = 0; i < 6; i++) {
          oscillator.frequency.setValueAtTime(800, startTime + i * 0.2);
          oscillator.frequency.setValueAtTime(600, startTime + i * 0.2 + 0.1);
        }

        oscillator.start(startTime);
        oscillator.stop(startTime + 1.2);

        setTimeout(resolve, 1300);
      } catch (e) {
        console.log('Audio not available');
        resolve();
      }
    });
  }

  /**
   * Play warning beep
   */
  playBeep(frequency = 800, duration = 200) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration/1000);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + duration/1000);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Drowsy alarm - loud and persistent
   */
  async drowsyAlarm() {
    // Multiple loud beeps
    for (let i = 0; i < 5; i++) {
      this.playBeep(1000, 150);
      await this.delay(200);
    }
    
    this.speak('WAKE UP! PULL OVER NOW!', 'emergency', true);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showIndicator(text) {
    const indicator = document.getElementById('voice-indicator');
    const voiceText = document.getElementById('voice-text');
    if (indicator && voiceText) {
      voiceText.textContent = text;
      indicator.classList.remove('hidden');
    }
  }

  hideIndicator() {
    const indicator = document.getElementById('voice-indicator');
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }

  // ===================
  // GYM MODE PHRASES
  // ===================
  
  gymCorrection(type, detail) {
    const phrases = {
      leftLag: [
        "Push your left side!",
        "Left arm is lagging!",
        "Drive with the left!"
      ],
      rightLag: [
        "Push your right side!",
        "Right arm is lagging!", 
        "Drive with the right!"
      ],
      asymmetry: [
        "Uneven movement detected!",
        "Keep both sides balanced!",
        "Symmetry check!"
      ],
      tooFast: [
        "Slow down! Control the weight!",
        "Too fast! Mind your form!",
        "Tempo! Slow and controlled!"
      ],
      goodRep: [
        "Good rep!",
        "Nice form!",
        "Keep it up!"
      ],
      repCount: (count) => `${count}!`
    };

    if (type === 'repCount') {
      this.speak(phrases.repCount(detail), 'encouragement');
    } else {
      const options = phrases[type] || ["Check your form!"];
      const phrase = options[Math.floor(Math.random() * options.length)];
      this.speak(phrase, type === 'goodRep' ? 'encouragement' : 'correction');
    }
  }

  // ===================
  // DRIVE MODE PHRASES
  // ===================

  driveWarning(type) {
    const phrases = {
      headDrop: "Head drop detected! Stay alert!",
      eyesClosed: "Eyes closed! Wake up!",
      drowsy: "DANGER! Fatigue detected! Pull over now!",
      microSleep: "MICRO SLEEP DETECTED! PULL OVER IMMEDIATELY!",
      breakReminder: "You've been driving for 2 hours. Consider taking a break."
    };

    const phrase = phrases[type] || "Stay alert!";
    const priority = (type === 'drowsy' || type === 'microSleep') ? 'emergency' : 'warning';
    
    if (priority === 'emergency') {
      this.drowsyAlarm();
    } else {
      this.speak(phrase, priority);
    }
  }

  // ===================
  // LIFE MODE PHRASES
  // ===================

  lifeAlert(type, countdown) {
    const phrases = {
      fallDetected: "Fall detected! Are you okay?",
      countdownStart: `Calling emergency services in ${countdown} seconds. Press cancel if you are okay.`,
      countdownUpdate: (sec) => `${sec} seconds.`,
      calling911: "Calling 9 1 1 now.",
      cancelled: "Emergency cancelled. Glad you're okay.",
      noMovement: "No movement detected. Are you okay?"
    };

    if (type === 'countdownUpdate') {
      this.speak(phrases.countdownUpdate(countdown), 'emergency', true);
    } else {
      const phrase = phrases[type] || "Alert!";
      this.emergencyAlert(phrase);
    }
  }
}

// Global instance
window.voiceEngine = new VoiceEngine();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceEngine;
}