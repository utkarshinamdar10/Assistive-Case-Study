# MYOHAP: Closed-Loop Myoelectric Prosthesis with Proportional Haptic Feedback

MYOHAP is a closed-loop upper-limb prosthetic system designed to bridge the "Sensory Gap" in myoelectric prosthetics. Traditional devices operate in an open-loop configuration where muscle contractions actuate movements, but the user receives no physical confirmation of contact. MYOHAP implements a high-speed, low-latency ($<20\text{ms}$) closed-loop control and vibrotactile feedback system using an **ESP32 microcontroller**, dry **sEMG sensors**, and fingertip force sensors.

---

## 🏗️ Hardware Architecture & Pin Connections

The system translates muscle electrical activity (sEMG) into high-torque servo movements. When the fingers compress an object, the grip force measured by Force Sensitive Resistors (FSRs) is translated into proportional vibration intensity (PWM) on the user's residual limb.

### Hardware Components
*   **Processing**: ESP32 Microcontroller (Dual-core Tensilica Xtensa, 240MHz, 12-bit ADC).
*   **Myoelectric Sensing**: Myoware 2.0 sEMG Sensors.
*   **Force Sensing**: Interlink Force Sensitive Resistors (FSRs).
*   **Haptic Output**: DRV2605L Haptic Driver with Linear Resonant Actuator (LRA) or ERM vibration motor.
*   **Actuation**: High-Torque Metal Gear Servos.

### Pinout Mapping Table
| ESP32 GPIO Pin | Connected Component | Signal Type | Description |
| :--- | :--- | :--- | :--- |
| **GPIO 34 (ADC1_CH6)** | Myoware 2.0 sEMG Output | Analog Input | Captures raw sEMG muscle potentials |
| **GPIO 35 (ADC1_CH7)** | Fingertip FSR Sensor | Analog Input | Measures object compression force |
| **GPIO 21 (SDA)** | DRV2605L Haptic Driver | I2C Data | Transmits haptic feedback parameters |
| **GPIO 22 (SCL)** | DRV2605L Haptic Driver | I2C Clock | Syncs I2C digital communications |
| **GPIO 13 (PWM)** | Finger Actuator Servos | PWM Output | Drives mechanical finger flexion/extension |
| **3.3V / GND** | Sensors & Driver Power | Power Rail | Regulated supply for clean analog signals |
| **5.0V / GND** | High-Torque Servos | Power Rail | Dedicated motor regulator to prevent CPU brownout |

---

## 📂 Repository Structure

The project has been organized into a modular structure optimized for GitHub:

```text
Assistive-Case-Study/
├── dashboard/                 # Interactive HTML/JS/CSS simulation workspace
│   ├── index.html             # Dashboard UI interface and SVG hand graphic
│   ├── style.css              # Dark glassmorphism styling and neon highlights
│   ├── app.js                 # Signal simulation, DSP filtering, and physics loops
│   ├── run_dashboard.py       # Python local web server launcher
│   └── usage_instructions.md  # Detailed guide to operating the dashboard
│
├── data/                      # Recorded CSV logs and raw MATLAB datasets
│   ├── EMG-data.mat           # Raw 8-channel sEMG MATLAB dataset (8 x 15,798 samples)
│   ├── trialData.mat          # MATLAB session data
│   ├── emg_data_10s.csv       # Recorded serial trial dataset (10 seconds)
│   └── simulated_emg_data.csv # Simulated sEMG output logs
│
├── firmware/                  # ESP32 microcode and Arduino sketches
│   ├── emg_reader/            # Raw 1000Hz analog sEMG acquisition firmware
│   ├── emg_reader_esp32/      # Specialized ESP32 hardware template
│   ├── emg_dsp_window_experiment/ # Hanning vs. Rectangular window DSP experiments
│   └── emg_autoscaling_feedback/  # Rest baseline calibration and auto-scaling logic
│
├── scripts/                   # Offline analytical tools and plotting utilities
│   ├── simulate_emg.py        # Stochastic sEMG signal generator script
│   ├── closed_loop_simulation.py # Closed-loop simulation modeling hand & haptics
│   ├── plot_sample_data.py    # Offline MATLAB variable analysis and graphing
│   ├── inspect_mat.py         # Helper to check internal MATLAB structure shape
│   ├── calc_hann.py           # Pre-computes normalized Hanning window coefficients
│   ├── plot_emg.py            # Real-time serial plotter interface
│   ├── testing.py             # Serial capture interface to log CSV trial data
│   └── Testing.ipynb          # Jupyter notebook for offline analysis
│
├── documentation/             # Bibliography, report, BOM, and methodology PDFs
└── media/                     # Images, schematics, and animations
```

---

## 🚀 Quick Start Guide

### 1. Running the Interactive Simulation Dashboard
You can run the web-based simulation dashboard locally without any external dependencies. This allows you to prototype digital filters and haptic curves before flashing them:
1. Open your terminal and navigate to the `dashboard/` folder:
   ```bash
   cd dashboard
   ```
2. Start the local server:
   ```bash
   python run_dashboard.py
   ```
3. Your browser will launch automatically at `http://localhost:8000`. You can:
   * Flex muscles virtually using the sliders or pulse button.
   * Toggle between RAW or **Butterworth high-pass filtering**.
   * Change smoothing windows ($10\text{ms} - 150\text{ms}$) and trigger thresholds.
   * Drag objects, adjust hardness, choose haptic curves, and connect physical serial sensors.

### 2. Flashing the ESP32 Firmware
1. Open the [Arduino IDE](https://www.arduino.cc/en/software).
2. Install the **ESP32 board package** (via Board Manager) and set your target board to `ESP32 Dev Module`.
3. Open any of the sketches in the `firmware/` directory:
   * Use `emg_dsp_window_experiment` to evaluate **Rectangular vs. Hanning window** processing.
   * Use `emg_autoscaling_feedback` to test resting-state **3-second calibration** and output gain scaling.
4. Set the serial baud rate to `115200` (or `9600` for calibration plotter) and flash.

### 3. Running Offline Python Scripts
Ensure you have the required analytical libraries installed:
```bash
pip install numpy matplotlib pandas scipy pyserial
```
*   **Generate Synthetic sEMG Data**:
    ```bash
    python scripts/simulate_emg.py
    ```
*   **Run Complete Grip-Force & Haptic PWM Simulation**:
    ```bash
    python scripts/closed_loop_simulation.py
    ```
    *This generates `closed_loop_results.csv` and saving plot results inside the `data/` folder.*
*   **Read & Plot Raw MATLAB Signal Variables**:
    ```bash
    python scripts/plot_sample_data.py
    ```

---

## 📈 Digital Signal Processing (DSP) & Windowing

The system implements a **35-sample Hanning window** to smooth the rectified sEMG signal:
1. **Rectangular Window**: Simply averages past values equally ($1/N$). While responsive, it suffers from high spectral leakage (sidelobes at $-13\text{ dB}$), letting raw muscle firing noise leak through as chitter/jitter in the hand position.
2. **Hanning Window**: Uses cosine-tapered weights that taper to 0 at the edges. This suppresses high-frequency noise leakage (sidelobes down to $-32\text{ dB}$), outputting a highly stable, smooth envelope.
3. **Latency Bound**: A window size of **35 ms** is optimal. It successfully filters raw muscle electrical noise while keeping processing delay below $20\text{ms}$, allowing the haptic response to feel instantaneous.
