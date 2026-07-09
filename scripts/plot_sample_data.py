import scipy.io
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import os

def load_emg_from_mat(file_path):
    """
    Loads EMG data from a .mat file, attempting to find the signal variable.
    """
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return None, None

    try:
        data = scipy.io.loadmat(file_path)
        # Find the first key that isn't a metadata header
        signal_key = None
        for key in data.keys():
            if not key.startswith('__'):
                signal_key = key
                break
        
        if signal_key is None:
            print("Error: No data variable found in .mat file.")
            return None, None
            
        signal = data[signal_key]
        print(f"Loaded variable '{signal_key}' with shape {signal.shape}")
        
        # Flatten if it's a 2D array with one dimension being 1
        if len(signal.shape) > 1:
            if signal.shape[0] == 1 or signal.shape[1] == 1:
                signal = signal.flatten()
            else:
                # If it's multi-channel, take the first channel for visualization
                print(f"Multi-channel data detected. Visualizing first channel.")
                signal = signal[:, 0]
                
        return signal, signal_key
    except Exception as e:
        print(f"Error loading .mat file: {e}")
        return None, None

def process_and_plot(signal, label, output_dir):
    fs = 1000  # Assuming 1000Hz, common for EMG. Adjust if known.
    t = np.arange(len(signal)) / fs
    
    # 1. Save to CSV
    df = pd.DataFrame({
        'Time_sec': t,
        'EMG_Raw': signal
    })
    csv_path = os.path.join(output_dir, f"processed_{label}.csv")
    df.to_csv(csv_path, index=False)
    print(f"Data saved to {csv_path}")
    
    # 2. Plotting
    plt.figure(figsize=(12, 6))
    plt.plot(t, signal, color='blue', lw=0.5, label='Raw EMG Signal')
    
    # Simple Envelope (Rectification + Rolling Mean)
    # We subtract the mean to remove any DC offset
    rectified = np.abs(signal - np.mean(signal))
    envelope = pd.Series(rectified).rolling(window=int(fs*0.05)).mean() # 50ms window
    
    plt.plot(t, envelope, color='red', lw=2, label='Activity Envelope')
    
    plt.title(f"EMG Sample Data Analysis: {label}")
    plt.xlabel("Time (seconds)")
    plt.ylabel("Amplitude / ADC Units")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # Save Plot
    plot_path = os.path.join(output_dir, f"plot_{label}.png")
    plt.savefig(plot_path, dpi=300)
    print(f"Plot saved to {plot_path}")
    plt.show()

if __name__ == "__main__":
    # Check both repository root and scripts directory relative path
    paths_to_try = [
        ('data/EMG-data.mat', 'data'),
        ('../data/EMG-data.mat', '../data')
    ]
    
    input_file = None
    output_folder = None
    for inp, out in paths_to_try:
        if os.path.exists(inp):
            input_file = inp
            output_folder = out
            break
            
    if input_file and output_folder:
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
            
        signal, key_name = load_emg_from_mat(input_file)
        if signal is not None:
            process_and_plot(signal, key_name, output_folder)
    else:
        print("Error: Could not find EMG-data.mat inside data/ folder.")
