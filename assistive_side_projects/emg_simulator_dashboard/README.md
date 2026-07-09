# sEMG Prosthesis & Haptic Feedback Simulator Dashboard

An interactive, premium web application built inside the `assistive_side_projects` folder to simulate raw surface Electromyography (sEMG) data collection, process it in real-time through standard filtering methods, drive an interactive mechanical hand model, and map compression force back to vibrotactile feedback PWM levels.

This project is a hardware-in-the-loop (HIL) mockup designed to help prototype, visualize, and tweak feedback loop algorithms before flashing them to actual embedded microcontrollers (such as an ESP32).

---

## Features

1. **Signal Generator (Real-time)**
   * Simulates high-frequency sEMG interference patterns by summing 5 distinct sine wave frequencies modulated by muscle contraction intensity.
   * Adjustable baseline white noise to emulate low-grade electrical drift or poor electrode contact.
   * "Pulse Contraction" trigger button to run controlled contraction profiles.

2. **DSP Pipeline Visualizer**
   * **Butterworth High-Pass Filter**: A simulated 1st-order IIR high-pass digital filter ($f_c = 50\text{Hz}$) to remove DC offsets and electrode wander.
   * **Full-Wave Rectification**: Shifts alternating voltage values to positive values.
   * **Moving Average Envelope Filter**: Low-pass smooths the rectified signal over a sliding window (10ms - 150ms).
   * **Activation Threshold Comparator**: Visually editable threshold line that determines when the hand should activate.

3. **Interactive Hand SVG Model**
   * Bends index, middle, ring, pinky, and thumb joints dynamically according to the hand closure position.
   * Bending physics utilizes natural joint angles via trigonometry.
   * Draggable target object position. Adjusting the contact point determines when the hand physically collides with the object.

4. **Haptic Feedback Mapping**
   * Computes grip force based on object compression and stiffness.
   * Linear, exponential, and step haptic maps that translate contact force to motor PWM.
   * Realistic fingertip pulsation indicator whose frequency and intensity dynamically scale with haptic PWM.

5. **Offline CSV Dataset Analyzer**
   * Load any sEMG dataset (e.g. `emg_data_10s.csv` or `simulated_emg_data.csv`).
   * Stream the loaded dataset through the live DSP processor to test your threshold settings.
   * Calculates SNR metrics, counts contraction bursts, and measures peak force.

---

## File Structure

```text
assistive_side_projects/emg_simulator_dashboard/
├── index.html        # App interface structure and SVG graphics
├── style.css         # Glassmorphism dark mode styles and neon highlights
├── app.js            # Signal generator, DSP algorithms, and layout animation loops
├── run_dashboard.py  # Python launcher script (local HTTP server)
└── README.md         # Documentation (This file)
```

---

## Quick Start

To launch the dashboard, run the Python helper script which starts a local server and automatically launches the dashboard in your default browser:

```bash
python run_dashboard.py
```

*Note: The project is written in pure vanilla HTML5/JS and has zero external dependencies.*
