import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import os

def generate_synthetic_emg(duration_sec=5, fs=1000):
    """
    Generates synthetic EMG data with noise and bursts.
    """
    t = np.linspace(0, duration_sec, duration_sec * fs)
    
    # 1. Baseline Noise (White Noise)
    noise = np.random.normal(0, 50, len(t))
    
    # 2. Simulated Contractions (Bursts)
    # We'll create 3 bursts at specific times
    bursts = np.zeros(len(t))
    burst_times = [(1.0, 1.5), (2.5, 3.2), (4.0, 4.5)]
    
    for start, end in burst_times:
        mask = (t >= start) & (t <= end)
        # EMG burst is essentially modulated high-frequency noise
        burst_envelope = np.random.normal(0, 400, np.sum(mask))
        bursts[mask] = burst_envelope
        
    # Combine and add offset (representing ADC bias or reference voltage)
    # Typical ESP32 ADC midpoint is ~2048 for a 3.3V range if biased
    emg_signal = 2048 + noise + bursts
    
    # Clip to 12-bit ADC range
    emg_signal = np.clip(emg_signal, 0, 4095)
    
    return t, emg_signal

def main(data_folder, media_folder):
    print("Simulating ESP32 EMG data acquisition...")
    fs = 1000  # 1000 Hz
    duration = 5 # seconds
    
    t, emg_data = generate_synthetic_emg(duration, fs)
    
    # Create DataFrame for CSV saving
    df = pd.DataFrame({
        'Timestamp_ms': (t * 1000).astype(int),
        'EMG_Value': emg_data.astype(int)
    })
    
    # Save Data to CSV (in data/ folder)
    csv_filename = os.path.join(data_folder, "simulated_emg_data.csv")
    df.to_csv(csv_filename, index=False)
    print(f"Simulated data saved to: {csv_filename}")
    
    # Plotting
    plt.figure(figsize=(12, 6))
    plt.plot(t, emg_data, color='blue', lw=0.5, label='Simulated Raw EMG')
    
    # Optional: Plot the envelope (Rectified + Low Pass) to show "muscle activity"
    rectified = np.abs(emg_data - 2048)
    envelope = pd.Series(rectified).rolling(window=50).mean() # Simple Moving Average
    plt.plot(t, envelope + 2048, color='red', lw=2, label='Activity Envelope')
    
    plt.title("Simulated EMG Signal (ESP32 Mockup)")
    plt.xlabel("Time (seconds)")
    plt.ylabel("ADC Value (0-4095)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # Save Plot to File (in media/ folder)
    plot_filename = os.path.join(media_folder, "emg_simulation_plot.png")
    plt.savefig(plot_filename, dpi=300)
    print(f"Simulation plot saved to: {plot_filename}")
    
    plt.show()

if __name__ == "__main__":
    # Check for correct folders relative to execution context
    data_folder = "data"
    media_folder = "media"
    
    if not os.path.exists(data_folder) and os.path.exists("../data"):
        data_folder = "../data"
        media_folder = "../media"
        
    if not os.path.exists(data_folder):
        os.makedirs(data_folder)
        
    if not os.path.exists(media_folder):
        os.makedirs(media_folder)
        
    main(data_folder, media_folder)
