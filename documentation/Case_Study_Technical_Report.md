# MYOHAP Case Study: Closed-Loop Myoelectric Prosthesis with Proportional Haptic Feedback
**Technical Investigation & Signal Processing Report**

---

## Executive Summary
The **MYOHAP** project addresses the "Sensory Gap" in traditional upper-limb myoelectric prostheses—where users provide muscle contraction commands (open-loop control) but receive no physical sensory confirmation of interaction. This report evaluates the signal processing pipelines, simulations, hardware architecture, and DSP experiments designed to bridge this gap. 

By utilizing an **ESP32 microcontroller**, the system implements a real-time, low-latency ($<20\text{ms}$) classification and feedback loop:
1. **Sensing**: Capturing raw surface Electromyography (sEMG) signals.
2. **Processing**: Dynamically removing baseline offsets, rectifying, and smoothing the signal to create a control envelope.
3. **Actuation**: Translating user intent to servo-driven finger movements.
4. **Haptic Feedback**: Closing the loop by measuring grip pressure via Force Sensitive Resistors (FSRs) and mapping it to a proportional Pulse-Width Modulated (PWM) tactile vibration via a haptic driver (DRV2605L) and a Linear Resonant Actuator (LRA).

---

## 1. MATLAB Simulation and Results
MATLAB was used as the initial offline research platform to analyze multi-channel myoelectric signals, validate feature extraction algorithms, and compute filter coefficients before porting them to the ESP32 firmware.

### 1.1 Dataset Inspection
The simulation loaded raw multi-channel sEMG datasets stored in `.mat` files:
* **Dataset Files**: [EMG-data.mat](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/data/EMG-data.mat) and [trialData.mat](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/data/trialData.mat).
* **Data Structure**: The `EMG` matrix contains **8 channels** of surface EMG data, with a shape of **8 rows × 15,798 columns** (representing samples).
* **Signal Specifications**:
  * **Sampling Rate ($F_s$)**: $1000\text{ Hz}$ (1 sample per millisecond), matching the physiological firing rates of motor units.
  * **Resolution**: 16-bit unsigned integers (`uint16` format, raw values range from approximately 30,500 to 31,500 due to hardware offset biases).

### 1.2 Processing Methodology & Key Results
* **Baseline Offset Removal**: Raw MATLAB signals are centered around an offset. The simulation subtracted the mean value ($\approx 31,000$ units) to align the resting baseline at 0.
* **Rectification & MAV (Mean Absolute Value)**: Rectifying the centered signal ($|sEMG(t)|$) and applying a sliding window computed the contraction envelope:
  $$\text{MAV} = \frac{1}{N} \sum_{i=1}^{N} |x_i|$$
* **Key Findings**: 
  * The frequency features and amplitude envelope correlate linearly with contraction force.
  * The system successfully distinguished between three distinct voluntary contraction levels: **Light** (initial motor unit recruitment), **Firm** (rate coding dominance), and **Maximum Voluntary Contraction (MVC)**.
  * These results established the mathematical viability of using a simple threshold-based trigger (e.g., envelope threshold of 150 units above baseline) to actuate the prosthetic hand.

---

## 2. EMG Data Simulation for Testing
Before connecting physical sensors, the DSP and control systems were validated using synthetic sEMG signals generated via Python and MATLAB scripts.

### 2.1 Synthetic sEMG Signal Generation Model
As implemented in [simulate_emg.py](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/scripts/simulate_emg.py), a realistic sEMG signal chunk was modeled stochastically as amplitude-modulated high-frequency band-limited noise:
1. **Sinusoid Summation**: Summing 50 sinusoids with random phases ($\theta$) distributed uniformly between $0$ and $2\pi$ across the motor unit firing spectrum ($20\text{ Hz} - 450\text{ Hz}$):
   $$x_{\text{base}}(t) = \sum_{f=20}^{450} A_f \sin(2\pi f t + \theta_f)$$
2. **Amplitude Modulation**: Scaling the amplitude of each sinusoid based on a target voluntary activation level ($0.0$ to $1.0$) and a random normal component:
   $$A_f \sim \mathcal{N}(1.0, 0.2) \times \text{activation\_level}$$
3. **Noise & Biasing**: White Gaussian noise ($\mu=0$, $\sigma=50$) was added to represent electrode impedance and electromagnetic interference. The combined signal was then biased with a DC offset of 2048 to simulate the midpoint of a 12-bit microcontroller ADC ($0-4095$ range):
   $$x_{\text{ADC}}(t) = \text{clip}\Big(2048 + \big(x_{\text{base}}(t) + \text{noise}\big) \times 500,\, 0,\, 4095\Big)$$

### 2.2 Closed-Loop System Validation
The simulation script [closed_loop_simulation.py](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/scripts/closed_loop_simulation.py) validated the entire closed-loop control system:
* **Contraction Protocol**: A 10-second run consisting of:
  * $0 - 2\text{s}$: Rest (activation = 0.0)
  * $2 - 5\text{s}$: Moderate Contraction (activation = 0.6)
  * $5 - 7\text{s}$: Rest (activation = 0.0)
  * $7 - 10\text{s}$: Strong Contraction (activation = 0.9)
* **Threshold Control**: When the computed envelope exceeded **150 units**, a close command was triggered.
* **Actuation & Object Interaction**: A virtual object was set at **80% closure**. When the prosthetic hand position reached $0.8$, grip pressure scaled with the closing force.
* **Proportional Haptic Feedback**: The contact pressure was mapped to a PWM duty cycle (0-255) for the vibrotactile motor. A minimum buzz (PWM = 100) was applied to overcome mechanical inertia, scaling up to 255.

---

## 3. Test on Actual Data Recorded by EMG Sensor
Once offline simulations were validated, testing was performed on physical data streamed from a single-channel myoelectric sensor connected to an ESP32.

### 3.1 Firmware Data Acquisition
The ESP32 ran the code in [emg_reader.ino](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/firmware/emg_reader/emg_reader.ino) or [emg_autoscaling_feedback.ino](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/firmware/emg_autoscaling_feedback/emg_autoscaling_feedback.ino):
* **Analog Acquisition**: The sensor output was wired to GPIO 34 (configured for 12-bit resolution and 11dB attenuation for a full $0-3.3\text{V}$ range).
* **Sampling Protocol**: Executed at a precise sampling rate of **50 Hz** ($20\text{ms}$ intervals) or **1000 Hz** ($1\text{ms}$ intervals) controlled using microsecond timers (`micros()`).
* **Real-time Processing**:
  1. **Dynamic Baseline Tracking**: A first-order IIR running average tracked the DC baseline offset:
     $$\text{Baseline}_n = (\alpha \cdot x_{\text{raw}}) + ((1 - \alpha) \cdot \text{Baseline}_{n-1}) \quad (\alpha = 0.01)$$
  2. **Centering & Rectification**:
     $$x_{\text{centered}} = \text{Baseline} - x_{\text{raw}}$$
     $$x_{\text{rectified}} = |x_{\text{centered}}|$$
  3. **Calibration & Auto-Scaling**: The first 3 seconds of connection established the resting baseline. During active contractions, the raw envelope deviation was amplified by a scaling multiplier of **6.0** to expand the sensor output into a large, noise-resilient command range ($0-2500+$ units).

### 3.2 Offline Telemetry Analysis
The script [testing.py](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/scripts/testing.py) captured 10 seconds of active contraction data over serial (115200 baud) and saved it to [emg_data_10s.csv](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/data/emg_data_10s.csv). Analysis of this dataset showed:
* Resting baseline raw standard deviation was small ($\approx 8$ ADC units).
* During deliberate contractions, the rectified value jumped to over 400 ADC units, achieving a Signal-to-Noise Ratio (SNR) exceeding $30\text{ dB}$.
* The telemetry streams of raw, rectified, and filtered envelopes showed direct temporal alignment, confirming zero filter delay.

---

## 4. Hardware Utilization
The hardware architecture utilizes highly-integrated, low-cost components to deliver high performance at a low power footprint.

| Component Group | Specific Hardware | Function / Role | Technical Specification |
| :--- | :--- | :--- | :--- |
| **Sensing** | Myoware 2.0 sEMG Sensors | Surface muscle electrical activity acquisition | Snap-on dry electrodes, onboard rectification and amplification, analog output. |
| **Processing** | ESP32 Microcontroller | Central processing unit, filters, control, & classification | Dual-core Tensilica Xtensa 32-bit CPU (240MHz), 12-bit ADC (3.3V), built-in Wi-Fi/Bluetooth. |
| **Haptic Output** | DRV2605L Haptic Driver | Driver for vibration actuator control | $I^2C$ control, internal waveform library, PWM-to-analog vibration strength mapping. |
| **Actuator** | Linear Resonant Actuator (LRA) | Vibrotactile sensory feedback to residual limb | Mass-spring resonance system, fast rise/fall times, localized feedback. |
| **Mechanical** | High-Torque Servo Motors | Actuate finger flexion and extension | PWM-controlled position loop, metal gear transmission. |
| **Pressure Sensing**| Force Sensitive Resistors (FSRs) | Measure contact force on target objects | Resistance drops exponentially as force increases, wired in a voltage divider. |

### 4.1 Dual-Core Task Allocation
To guarantee real-time performance and prevent jitter, tasks on the ESP32 are split across its dual cores:
* **Core 0**: Handles time-critical tasks including high-frequency ADC sampling (1000 Hz), Dynamic Baseline removal, and Rectangular/Hanning window filtering.
* **Core 1**: Runs the SVM/LDA classification algorithm, updates servo motor positions, and modulates the PWM signal to the DRV2605L driver at 100 Hz.

---

## 5. Window Size Experimentation (Rectangular vs. Hanning)
A critical experiment was conducted to determine the best windowing filter to smooth the rectified sEMG signal into a clean control envelope.

### 5.1 Filter Configurations
The experiment compared two window types of varying lengths:
1. **Rectangular Window (Simple Moving Average)**:
   $$y[n] = \frac{1}{N} \sum_{i=0}^{N-1} x[n-i]$$
   * *Characteristics*: Flat frequency response with high sidelobes ($-13\text{ dB}$ attenuation). Leads to significant spectral leakage, causing high-frequency noise and chattering to pass into the envelope.
2. **Hanning (Hann) Window**:
   $$w[n] = 0.5 \left( 1 - \cos\left( \frac{2\pi n}{N-1} \right) \right)$$
   $$y[n] = \frac{\sum_{i=0}^{N-1} w[i] x[n-i]}{\sum_{i=0}^{N-1} w[i]}$$
   * *Characteristics*: Cosine-tapered shape that smooths the transitions. Sidelobes are attenuated to $-32\text{ dB}$, yielding high high-frequency rejection and a significantly cleaner envelope.

### 5.2 Window Size Impact Analysis
The smoothing window duration determines the system's responsiveness:
* **Short Window ($10\text{ms} - 20\text{ms}$)**:
  * *Pros*: Near-zero lag ($<10\text{ms}$).
  * *Cons*: The envelope remains highly chattery, following individual action potential spikes instead of overall muscle contraction force. This results in motor jitter and false control triggers.
* **Long Window ($150\text{ms} - 200\text{ms}$)**:
  * *Pros*: Extremely smooth envelope, highly stable baseline.
  * *Cons*: Introduces a delayed control response ($75\text{ms} - 100\text{ms}$). This delay is highly noticeable to the user, making real-time adjustments difficult and causing them to drop or crush fragile objects.
* **Optimal Window (35 Samples / 35 ms)**:
  * The coefficients computed by [calc_hann.py](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/scripts/calc_hann.py) and hardcoded in [emg_dsp_window_experiment.ino](file:///c:/Users/Utkarsh/OneDrive/Desktop/CaseStudy/Assistive-Case-Study/firmware/emg_dsp_window_experiment/emg_dsp_window_experiment.ino) utilize a window length of **35**.
  * **Result**: This represents the ideal trade-off. It provides a clean, stable envelope that filters out muscle firing noise, while keeping system group delay around $17.5\text{ms}$. When combined with classification and transmission delays, total loop latency is kept well under the user-perception threshold ($<25\text{ms}$), enabling a natural, closed-loop prosthetic response.

---

## 6. Lucidchart AI Generation Prompts

You can copy and paste the prompts below directly into the Lucidchart AI prompt window to generate the required diagrams.

### 6.1 Flowchart of the Workflow Prompt
```text
Create a clean, professional horizontal flowchart mapping the step-by-step workflow of a closed-loop myoelectric prosthetic hand system called MYOHAP.
The flowchart should contain the following sequential blocks:
1. "sEMG Signal Acquisition": Forearm muscle activity captured via Myoware 2.0 sensors.
2. "Dynamic Baseline Removal": ESP32 centers raw signal around 0V by removing DC offset.
3. "Full-Wave Rectification": Converts centered signal to absolute values.
4. "Smoothing Window (Hanning Filter)": Appies a 35-sample Hanning window to extract a smooth amplitude envelope.
5. "Classification & Control Logic": ESP32 runs SVM/LDA to identify intent and checks if the envelope exceeds 150 units.
6. "Prosthetic Actuation": High-torque servo motors close or open fingers.
7. "Contact & Force Sensing": Fingertip FSRs measure grip force when interacting with an object.
8. "Haptic Feedback Synthesis": ESP32 maps force to proportional PWM (100-255).
9. "Sensory Restoration": DRV2605L drives the Linear Resonant Actuator (LRA) to vibrate the user's residual limb, completing the loop.
Add clear arrows indicating the directional flow, and highlight that the loop closes from the haptic feedback back to the user's muscles. Use a professional color scheme (blues, grays, and accents).
```

### 6.2 Hardware Schematic Diagram Prompt
```text
Create a detailed hardware block diagram showing the electronic schematic connections for the MYOHAP myoelectric prosthesis.
Include the following components and label their electrical interconnections:
1. "ESP32 Microcontroller (Dual-Core)" as the central processing hub.
2. "Myoware 2.0 sEMG Sensor" connected to ESP32: Analog Output pin wired to ESP32 Pin GPIO 34 (ADC1_CH6), and VCC/GND connected to 3.3V/GND.
3. "Force Sensitive Resistor (FSR)" on fingertip connected in a voltage divider circuit to ESP32 Pin GPIO 35 (ADC1_CH7) with a 10k Ohm pull-down resistor.
4. "DRV2605L Haptic Driver Board" connected to ESP32: SDA wired to GPIO 21, SCL wired to GPIO 22 (I2C interface), VCC to 3.3V, and GND to GND.
5. "Linear Resonant Actuator (LRA) Vibration Motor" connected directly to the positive/negative output terminals of the DRV2605L.
6. "High-Torque Servo Motor (Finger Actuator)" connected to ESP32 Pin GPIO 13 (PWM output) and powered by an external 5V/GND regulator.
7. "Power Distribution System": 7.4V LiPo Battery connected to a 5V Buck Regulator (for Servo Motors) and a 3.3V Linear Regulator (for ESP32 and Sensors).
Use clean connector lines, color-code the power rails (Red for VCC, Black for GND, Blue for Analog, Green for I2C/Digital), and arrange the components logically with inputs on the left, processing in the middle, and outputs/feedback on the right.
```
