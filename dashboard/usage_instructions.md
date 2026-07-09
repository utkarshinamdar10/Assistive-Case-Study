# MyoHap Simulator Dashboard - User Guide

This user guide explains how to operate the **sEMG Prosthesis & Haptic Feedback Simulation Dashboard** to run real-time muscle control simulations, tune Digital Signal Processing (DSP) parameters, import offline data, and analyze haptic feedback loops.

---

## 🎮 Mode 1: Live Real-Time Simulation

In this mode, you generate muscle contractions manually using the control dashboard sliders.

### Step 1: Simulate Muscle Activity
1. Locate the **Muscle Contraction (Activation)** slider under **1. sEMG Signal Generator**.
2. **Standard Squeeze**: Drag the slider up to $60\% - 90\%$ to simulate a muscle flex (contraction). The cyan line on the top chart represents your raw sEMG signal, and the red line represents the rectified, smoothed envelope.
3. **Quick Trigger**: Click the **Pulse Contraction (1.5s)** button to trigger a predefined, clean contraction burst that automatically relaxes after 1.5 seconds.
4. **Noise & Interference**: 
   * Adjust the **Electrode Base Noise** slider to add random noise (simulating poor skin contact or movement artifacts).
   * Adjust the **Signal Interference Frequency** to change the principal firing rate of the motor units.

### Step 2: Configure the DSP Pipeline
The DSP pipeline processes raw sEMG into a clean trigger signal.
1. **Filter Selector**: Toggle between **None** (rectifies raw input with DC offset of 2048) and **Butterworth Approx** (filters out the DC offset, centering the signal at 0V).
2. **Smoothing Window**: Drag the **Smoothing Window** slider. A larger window (e.g., $100\text{ms} - 200\text{ms}$) reduces chattering but introduces a slight delay in control response.
3. **Threshold Setting**: Adjust the **Activation Threshold** slider. The red dashed line on the top graph will move. When the envelope (red solid line) exceeds this threshold, a close command is sent to the hand.

### Step 3: Set up the Target Object
You can place a virtual physical object in the path of the closing hand.
1. **Object Position**: Set where the fingers will hit the object. For example, $80\%$ means the hand can close up to $80\%$ before touching the object.
2. **Object Stiffness/Hardness**: Sets the compression characteristics. If stiffness is high, the hand will stop abruptly upon contact and generate high force. If stiffness is low, the hand compresses the object further.

### Step 4: Map Haptic Feedback (PWM)
When the hand touches the object, it calculates a grip force, which is mapped back as vibrotactile feedback (PWM).
1. **Haptic Feedback Curve**: 
   * **Linear**: PWM scales proportionally with force.
   * **Exponential**: Delivers lower feedback at light contact and rises sharply at firm contact (simulates human skin sensation bounds).
   * **Step**: Jumps in discrete steps ($25\%$, $50\%$, $75\%$, $100\%$) to test sensory resolution.
2. **Haptic Base PWM (Min Buzz)**: Set the minimum PWM value (e.g., 100) sent to the vibrotactile motor when contact is first made to overcome initial inertia.
3. **Haptic Sensitivity**: Scale the rate at which force converts to PWM.

---

## 📂 Mode 2: Offline CSV Dataset Playback

Use this mode to stream previously recorded EMG files (e.g., from an ESP32 or MATLAB) through your DSP pipeline.

1. **Upload File**: Drag and drop any `.csv` file into the **Bottom Panel** or click inside the dashed area to select a file. The expected file structure is a CSV with headers containing:
   * A column for time (e.g., `Timestamp_ms` or `Time_sec`)
   * A column for sEMG value (e.g., `EMG_Value` or `EMG_Raw`)
2. **Review Metrics**: Upon loading, the **Processed Metrics Summary** card instantly computes:
   * **Total Data Points**: Length of the file.
   * **Mean Signal SNR**: Approximate signal-to-noise ratio in decibels.
   * **Contraction Bursts**: Number of active contraction clusters detected above your current threshold.
3. **Stream Playback**: Click **Run CSV Stream** to feed the file's data points into the live visualizer in real-time. Click **Toggle Loop** to run the file continuously.

---

## 🔌 Mode 3: Live sEMG Hardware Sensor Connection

Use this mode to connect a physical single-channel sEMG sensor (e.g., Myoware or raw muscle sensor connected to an ESP32 ADC) directly to the dashboard over USB.

### Setup Steps
1. **Flash Microcontroller**: Ensure your ESP32 or Arduino is programmed to output values over serial in the following format:
   ```text
   [timestamp_ms],[raw_adc_value]
   ```
   *(For example, the serial output should stream lines like `41240,2048` at 1000Hz. See the default template inside `firmware/emg_reader_esp32/emg_reader_esp32.ino`).*
2. **Connect Hardware**: Plug your microcontroller into your computer's USB port.
3. **Select Baud Rate**: Set the **Baud Rate** dropdown inside the **1b. Hardware Sensor Connection** dashboard panel to match your microcontroller code (default is `115200`).
4. **Initiate Connection**: Click the **Connect sEMG Sensor** button. 
5. **Grant Permission**: The web browser will prompt you to select a COM port. Choose your microcontroller's port (e.g., `COM3` or `ttyUSB0`) and click **Connect**.
6. **Live Data Streaming**:
   * The status indicator will change to **CONNECTED** (and system status will show **HARDWARE ACTIVE**).
   * The simulated signal generator sliders and CSV playbacks will be automatically disabled to prevent signals overlapping.
   * Flex your muscles to see your raw sensor data feed directly into the digital filter, drive the prosthetic hand, and trigger the red fingertip haptic feedback pulse indicators!

---

## 💾 Exporting Telemetry Data

You can save the details of your simulation runs for analysis in python/MATLAB:
1. Click the **Export Telemetry CSV** button in the playback controls.
2. This downloads a file named `myohap_telemetry_export_[timestamp].csv` containing:
   * `Time_sec`: Running timestamp.
   * `EMG_Raw`: Simulated or streamed raw ADC value.
   * `EMG_Envelope`: DSP-processed envelope.
   * `Hand_Position`: Position (0 to 1).
   * `Grip_Force`: Force (0 to 1).
   * `Feedback_PWM`: Output feedback intensity (0 to 255).
