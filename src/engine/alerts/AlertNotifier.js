import useAlertStore from './useAlertStore.js';

class AlertNotifierService {
    constructor() {
        this.unsubscribe = null;
        this.audioContext = null;
        this.oscillator = null;
    }

    notify(triggerData) {
        const prefs = useAlertStore.getState().notifPrefs;
        if (prefs.toastEnabled) window.dispatchEvent(new CustomEvent('nexus:alert-toast', { detail: triggerData }));
        if (prefs.audioEnabled) this.playAlertSound(prefs.audioVolume);
        if (prefs.browserEnabled && Notification.permission === 'granted') {
            new Notification(`${triggerData.symbol} Alert`, { body: triggerData.message });
        }
    }

    playAlertSound(volumeLevel) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const osc = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5 note
            osc.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            // Convert 0-100 linear scale to 0.0-1.0
            const maxVolume = Math.min(Math.max(volumeLevel / 100, 0), 1);
            gainNode.gain.linearRampToValueAtTime(maxVolume, this.audioContext.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

            osc.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.5);

        } catch (err) {
            console.error('Playback error:', err);
        }
    }

    requestBrowserPermission() {
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    }
}

// Export singleton instance
export const AlertNotifier = new AlertNotifierService();
