import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import os

class EMGSimulator:
    def __init__(self, fs=1000):
        self.fs = fs
        self.t = 0
        
    def generate_signal(self, duration, activation_level=0.0):
        """
        Generates a realistic sEMG chunk.
        activation_level: 0.0 to 1.0
        """
        n_samples = int(duration * self.fs)
        t_chunk = np.linspace(self.t, self.t + duration, n_samples, endpoint=False)
        self.t += duration
        
        # 1. Base stochastic signal (White noise filtered)
        # In a real sim, we'd use a bandpass filter. 
        # Here we'll sum several sinusoids with random phases to mimic the interference pattern.
        freqs = np.linspace(20, 450, 50)
        signal = np.zeros(n_samples)
        for f in freqs:
            phase = np.random.uniform(0, 2*np.pi)
            # Amplitude modulated by activation and a random component
            amp = np.random.normal(1.0, 0.2) * activation_level
            signal += amp * np.sin(2 * np.pi * f * t_chunk + phase)
            
        # 2. Add high-frequency noise
        noise = np.random.normal(0, 0.5, n_samples)
        
        # 3. Scale to ADC range (0-4095)
        # Assuming signal is centered around 2048
        emg_raw = 2048 + (signal + noise) * 500 
        return t_chunk, np.clip(emg_raw, 0, 4095)

class ProstheticHand:
    def __init__(self):
        self.position = 0.0  # 0: Open, 1: Closed
        self.pressure = 0.0  # Measured when touching an object
        self.is_touching = False
        self.touch_threshold = 0.8 # Object is at 80% closure
        
    def update(self, control_signal, dt):
        # control_signal: 1 for close, 0 for open
        speed = 1.0 # full close in 1 second
        
        if control_signal > 0.5:
            self.position = min(1.0, self.position + speed * dt)
        else:
            self.position = max(0.0, self.position - speed * dt)
            
        # Simulate interaction with an object
        if self.position >= self.touch_threshold:
            self.is_touching = True
            # Pressure increases as we try to close past the object
            self.pressure = (self.position - self.touch_threshold) / (1.0 - self.touch_threshold)
        else:
            self.is_touching = False
            self.pressure = 0.0

class FeedbackSystem:
    def calculate_vibro_pwm(self, pressure):
        """
        Maps pressure (0-1) to PWM (0-255)
        """
        if pressure <= 0:
            return 0
        # Provide a minimum "buzz" to signal contact
        pwm = 100 + (pressure * 155)
        return int(min(255, pwm))

def main():
    print("Starting Closed-Loop EMG Simulation...")
    fs = 1000
    duration = 10.0 # total seconds
    dt = 1.0 / fs
    
    sim = EMGSimulator(fs)
    hand = ProstheticHand()
    feedback = FeedbackSystem()
    
    # Pre-defined activation pattern (for demo)
    # 0-2s: Idle, 2-5s: Contract, 5-7s: Idle, 7-10s: Strong Contract
    t_full = np.linspace(0, duration, int(duration * fs))
    activations = np.zeros_like(t_full)
    activations[(t_full > 2) & (t_full < 5)] = 0.6
    activations[(t_full > 7) & (t_full < 10)] = 0.9
    
    # Buffers for results
    emg_history = []
    envelope_history = []
    hand_pos_history = []
    pressure_history = []
    feedback_history = []
    
    # Processing window for envelope (Moving Average)
    window_size = 50
    raw_buffer = []
    
    print("Running simulation loop...")
    for i in range(len(t_full)):
        # 1. Get EMG
        _, emg_val = sim.generate_signal(dt, activations[i])
        val = emg_val[0]
        emg_history.append(val)
        
        # 2. Process Signal (Envelope)
        rectified = abs(val - 2048)
        raw_buffer.append(rectified)
        if len(raw_buffer) > window_size:
            raw_buffer.pop(0)
        envelope = sum(raw_buffer) / len(raw_buffer)
        envelope_history.append(envelope)
        
        # 3. Control Logic
        # Threshold-based control
        control = 1.0 if envelope > 150 else 0.0
        
        # 4. Update Hand
        hand.update(control, dt)
        hand_pos_history.append(hand.position)
        pressure_history.append(hand.pressure)
        
        # 5. Generate Feedback
        pwm = feedback.calculate_vibro_pwm(hand.pressure)
        feedback_history.append(pwm)
        
    print("Simulation complete. Generating plots...")
    
    # Save to CSV
    df = pd.DataFrame({
        'Time': t_full,
        'EMG': emg_history,
        'Envelope': envelope_history,
        'HandPosition': hand_pos_history,
        'Pressure': pressure_history,
        'FeedbackPWM': feedback_history
    })
    csv_path = "EMG_Project/closed_loop_results.csv"
    df.to_csv(csv_path, index=False)
    print(f"Results saved to {csv_path}")
    
    # Plotting
    fig, axs = plt.subplots(4, 1, figsize=(12, 12), sharex=True)
    
    axs[0].plot(t_full, emg_history, color='blue', lw=0.5, alpha=0.7)
    axs[0].plot(t_full, [2048+e for e in envelope_history], color='red', lw=1.5)
    axs[0].set_title("EMG Signal & Envelope")
    axs[0].set_ylabel("ADC Value")
    
    axs[1].plot(t_full, hand_pos_history, color='green', lw=2)
    axs[1].set_title("Prosthetic Hand Position (0=Open, 1=Closed)")
    axs[1].set_ylabel("Position")
    axs[1].axhline(y=hand.touch_threshold, color='orange', linestyle='--', label='Object Contact')
    axs[1].legend()
    
    axs[2].plot(t_full, pressure_history, color='purple', lw=2)
    axs[2].set_title("Grip Pressure on Object")
    axs[2].set_ylabel("Normalized Force")
    
    axs[3].step(t_full, feedback_history, color='orange', where='post')
    axs[3].set_title("Vibrotactile Feedback Intensity (PWM)")
    axs[3].set_ylabel("PWM Value (0-255)")
    axs[3].set_xlabel("Time (seconds)")
    
    plt.tight_layout()
    plot_path = "EMG_Project/closed_loop_plot.png"
    plt.savefig(plot_path, dpi=300)
    print(f"Plot saved to {plot_path}")
    
    # plt.show() # Uncomment if running locally

if __name__ == "__main__":
    if not os.path.exists("EMG_Project"):
        os.makedirs("EMG_Project")
    main()
