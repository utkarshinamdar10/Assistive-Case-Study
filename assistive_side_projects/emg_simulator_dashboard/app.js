// ==========================================
// MyoHap sEMG & Haptic Dashboard - Core Logic
// ==========================================

// Global Application State
const state = {
    // DSP & Simulation Configuration
    fs: 1000,                  // 1000 Hz sample rate
    dt: 0.001,                 // 1ms time step
    t: 0,                      // running sample index
    running: true,
    
    // Live buffers for charting (rolling window of 500 samples)
    bufferSize: 400,
    emgBuffer: [],
    envelopeBuffer: [],
    posBuffer: [],
    forceBuffer: [],
    pwmBuffer: [],
    timeBuffer: [],
    
    // Control variables
    handPosition: 0.0,         // 0.0 (open) to 1.0 (closed)
    gripForce: 0.0,            // 0.0 to 1.0
    hapticPWM: 0,              // 0 to 255
    controlActive: false,
    
    // Temporary pulse state (for button pulse contraction)
    pulseEndTime: 0,
    
    // CSV file streaming state
    csvData: null,
    csvIndex: 0,
    isStreamingCSV: false,
    loopCSV: false,
    csvPlaybackSpeed: 1.0,     // multiplier
    
    // FPS tracking
    lastFrameTime: performance.now(),
    fps: 60,

    // Web Serial sEMG hardware integration
    isStreamingSerial: false,
    serialPort: null,
    serialReader: null,
    serialKeepReading: true
};

// DSP Filters (Simulating embedded microcontroller code)
class HighPassFilter {
    // 1st order HPF to remove DC offset / baseline wander (fc = 50Hz @ 1000Hz)
    constructor(cutoffHz = 50, fs = 1000) {
        const rc = 1.0 / (2.0 * Math.PI * cutoffHz);
        const dt = 1.0 / fs;
        this.alpha = rc / (rc + dt);
        this.prevX = 2048;
        this.prevY = 0;
    }
    
    filter(x) {
        const y = this.alpha * (this.prevY + x - this.prevX);
        this.prevX = x;
        this.prevY = y;
        return y;
    }
}

class MovingAverage {
    // Rolling moving average window for rectified envelope
    constructor(size = 50) {
        this.size = size;
        this.buffer = [];
        this.sum = 0;
    }
    
    updateSize(newSize) {
        this.size = newSize;
        while (this.buffer.length > this.size) {
            this.sum -= this.buffer.shift();
        }
    }
    
    process(val) {
        this.buffer.push(val);
        this.sum += val;
        
        if (this.buffer.length > this.size) {
            this.sum -= this.buffer.shift();
        }
        
        return this.sum / this.buffer.length;
    }
}

// Instantiate filters
let hpf = new HighPassFilter(50, state.fs);
let envFilter = new MovingAverage(50);

// Initialize rolling chart buffers with default baseline
function initBuffers() {
    for (let i = 0; i < state.bufferSize; i++) {
        state.emgBuffer.push(2048);
        state.envelopeBuffer.push(0);
        state.posBuffer.push(0);
        state.forceBuffer.push(0);
        state.pwmBuffer.push(0);
        state.timeBuffer.push(i * state.dt);
    }
}

// DOM Elements cache
const DOM = {
    // Sliders & Controls
    contractionSlider: document.getElementById('contraction-intensity'),
    contractionVal: document.getElementById('contraction-val'),
    triggerContractionBtn: document.getElementById('trigger-contraction-btn'),
    noiseSlider: document.getElementById('base-noise'),
    noiseVal: document.getElementById('noise-val'),
    freqSlider: document.getElementById('signal-frequency'),
    freqVal: document.getElementById('freq-val'),
    
    filterSelect: document.getElementById('filter-type'),
    windowSlider: document.getElementById('dsp-window'),
    windowVal: document.getElementById('window-val'),
    thresholdSlider: document.getElementById('control-threshold'),
    thresholdVal: document.getElementById('threshold-val'),
    
    speedSlider: document.getElementById('hand-speed'),
    speedVal: document.getElementById('speed-val'),
    hapticMapSelect: document.getElementById('haptic-map'),
    minPwmSlider: document.getElementById('min-pwm'),
    minPwmVal: document.getElementById('min-pwm-val'),
    hapticSensSlider: document.getElementById('haptic-sensitivity'),
    hapticSensVal: document.getElementById('haptic-sens-val'),
    
    objPosSlider: document.getElementById('object-position'),
    objPosVal: document.getElementById('obj-pos-val'),
    objHardSlider: document.getElementById('object-hardness'),
    objHardVal: document.getElementById('obj-hard-val'),
    
    // Readouts
    readoutRms: document.getElementById('readout-rms'),
    readoutPos: document.getElementById('readout-pos'),
    readoutForce: document.getElementById('readout-force'),
    readoutPwm: document.getElementById('readout-pwm'),
    
    fpsCounter: document.getElementById('fps-counter'),
    systemStatusText: document.getElementById('system-status-text'),
    hapticAlertBanner: document.getElementById('haptic-alert-banner'),
    
    // CSV Handling
    dragDropZone: document.getElementById('drag-drop-zone'),
    csvFileInput: document.getElementById('csv-file-input'),
    loadedFileName: document.getElementById('loaded-file-name'),
    clearCsvBtn: document.getElementById('clear-csv-btn'),
    csvPlayBtn: document.getElementById('csv-play-btn'),
    csvLoopBtn: document.getElementById('csv-loop-btn'),
    exportTelemetryBtn: document.getElementById('export-telemetry-btn'),
    
    // Metrics summary
    sumPoints: document.getElementById('sum-points'),
    sumSnr: document.getElementById('sum-snr'),
    sumBursts: document.getElementById('sum-bursts'),
    sumForce: document.getElementById('sum-force'),
    
    // SVG Hand elements
    visualObject: document.getElementById('visual-object'),
    visualObjectLabel: document.getElementById('visual-object-label'),
    hapticSensorDot: document.getElementById('haptic-sensor-dot'),
    hapticPulses: document.getElementById('haptic-pulses'),
    pulse1: document.getElementById('pulse-1'),
    pulse2: document.getElementById('pulse-2'),
    pulse3: document.getElementById('pulse-3'),
    
    // Canvases
    canvasEMG: document.getElementById('chart-emg'),
    canvasPos: document.getElementById('chart-position'),
    canvasForce: document.getElementById('chart-force'),
    canvasHaptic: document.getElementById('chart-haptic'),
    
    // Web Serial Elements
    serialBaudSelect: document.getElementById('serial-baud'),
    serialConnectBtn: document.getElementById('serial-connect-btn'),
    serialPortText: document.getElementById('serial-port-text')
};

// UI Value Binding & Updates
function updateUIReadouts() {
    DOM.contractionVal.textContent = DOM.contractionSlider.value + '%';
    DOM.noiseVal.textContent = DOM.noiseSlider.value + ' ADC';
    DOM.freqVal.textContent = DOM.freqSlider.value + ' Hz';
    DOM.windowVal.textContent = DOM.windowSlider.value + ' ms';
    DOM.thresholdVal.textContent = DOM.thresholdSlider.value + ' ADC';
    DOM.speedVal.textContent = (DOM.speedSlider.value / 10).toFixed(1) + 'x';
    DOM.minPwmVal.textContent = DOM.minPwmSlider.value;
    DOM.hapticSensVal.textContent = (DOM.hapticSensSlider.value / 10).toFixed(1);
    DOM.objPosVal.textContent = DOM.objPosSlider.value + '%';
    DOM.objHardVal.textContent = (DOM.objHardSlider.value / 10).toFixed(1);
    
    // Sync envelope window size size with state
    envFilter.updateSize(parseInt(DOM.windowSlider.value));
}

// Attach control UI listeners
function attachUIListeners() {
    const inputs = [
        DOM.contractionSlider, DOM.noiseSlider, DOM.freqSlider,
        DOM.windowSlider, DOM.thresholdSlider, DOM.speedSlider,
        DOM.minPwmSlider, DOM.hapticSensSlider, DOM.objPosSlider, DOM.objHardSlider
    ];
    inputs.forEach(input => input.addEventListener('input', updateUIReadouts));

    DOM.triggerContractionBtn.addEventListener('click', () => {
        state.pulseEndTime = performance.now() + 1500; // pulse for 1.5 seconds
        DOM.contractionSlider.value = 85; // high contraction force
        updateUIReadouts();
    });

    // File Drag and Drop listeners
    DOM.dragDropZone.addEventListener('click', () => DOM.csvFileInput.click());
    
    DOM.dragDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.dragDropZone.classList.add('drag-over');
    });
    
    DOM.dragDropZone.addEventListener('dragleave', () => {
        DOM.dragDropZone.classList.remove('drag-over');
    });
    
    DOM.dragDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.dragDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    DOM.csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    DOM.clearCsvBtn.addEventListener('click', clearCSV);
    DOM.csvPlayBtn.addEventListener('click', toggleCSVPlayback);
    DOM.csvLoopBtn.addEventListener('click', toggleCSVLoop);
    DOM.exportTelemetryBtn.addEventListener('click', exportTelemetry);
    
    // Web Serial listener
    DOM.serialConnectBtn.addEventListener('click', toggleSerialConnection);
    
    // Setup resize canvas handler
    window.addEventListener('resize', resizeCharts);
}

// ----------------------------------------------------
// Signal Simulation & Physics Core loop (1ms steps)
// ----------------------------------------------------
function getEMGValue(timeMs) {
    if (state.isStreamingCSV && state.csvData) {
        // Stream from loaded CSV
        if (state.csvIndex >= state.csvData.length) {
            if (state.loopCSV) {
                state.csvIndex = 0;
            } else {
                clearCSV();
                return 2048;
            }
        }
        const val = state.csvData[state.csvIndex].emg;
        state.csvIndex++;
        return val;
    }

    // Otherwise, generate synthetic real-time signal
    // Check if a pulse contraction button trigger is active
    if (state.pulseEndTime > 0) {
        if (performance.now() > state.pulseEndTime) {
            state.pulseEndTime = 0;
            DOM.contractionSlider.value = 0;
            updateUIReadouts();
        }
    }

    const activation = parseFloat(DOM.contractionSlider.value) / 100.0;
    const baseNoise = parseFloat(DOM.noiseSlider.value);
    const baseFreq = parseFloat(DOM.freqSlider.value);
    
    // Sum sinusoids for realistic high-frequency EMG wave pattern
    let signalSum = 0;
    const freqs = [baseFreq, baseFreq * 0.73, baseFreq * 1.27, baseFreq * 1.81, baseFreq * 2.39];
    
    freqs.forEach((f, idx) => {
        const phase = (timeMs * 0.001 * f * 2.0 * Math.PI) + (idx * 1.34);
        // Add random micro-squeezes representing motor unit recruitment variations
        const motorRecruitmentVariation = 1.0 + 0.25 * Math.sin(timeMs * 0.008);
        const amp = motorRecruitmentVariation * activation * 160.0;
        signalSum += amp * Math.sin(phase);
    });

    // Baseline stochastic white noise
    const whiteNoise = (Math.random() - 0.5) * baseNoise * 4.5;
    
    // Combine centered around 12-bit ADC mid point (2048)
    let raw = 2048 + signalSum + whiteNoise;
    return Math.max(0, Math.min(4095, raw));
}

// Step the physics and processing pipeline by 1ms
function stepSimulator() {
    state.t++;
    const currentMs = state.t;

    // 1. Fetch raw EMG data
    const rawVal = getEMGValue(currentMs);

    // 2. DSP filtering pipeline
    let processedVal = rawVal;
    const filterOption = DOM.filterSelect.value;
    
    if (filterOption === 'butterworth') {
        // High-pass filter to remove DC midpoint bias (centered on 0)
        processedVal = hpf.filter(rawVal);
    } else {
        // Just remove fixed 2048 DC offset
        processedVal = rawVal - 2048;
    }

    // 3. Rectification & Envelope Extraction (Moving Average)
    const rectified = Math.abs(processedVal);
    const envelope = envFilter.process(rectified);

    // 4. Threshold Control Decision
    const thresholdVal = parseFloat(DOM.thresholdSlider.value);
    state.controlActive = (envelope > thresholdVal);

    // 5. Hand Position Closing/Opening Physics
    const handSpeed = parseFloat(DOM.speedSlider.value) / 10.0; // scaled
    const objectPos = parseFloat(DOM.objPosSlider.value) / 100.0;
    const objectHardness = parseFloat(DOM.objHardSlider.value) / 10.0;

    if (state.controlActive) {
        // Grip closure action
        if (state.handPosition < objectPos) {
            state.handPosition = Math.min(objectPos, state.handPosition + handSpeed * state.dt);
        } else {
            // Compress obstruction slightly based on its hardness
            const maxCompressionFactor = 0.12 / objectHardness;
            state.handPosition = Math.min(objectPos + maxCompressionFactor, state.handPosition + (handSpeed * 0.15) * state.dt);
        }
    } else {
        // Grip releasing
        state.handPosition = Math.max(0.0, state.handPosition - handSpeed * state.dt);
    }

    // 6. Grip Force / Pressure calculation
    if (state.handPosition > objectPos) {
        state.gripForce = (state.handPosition - objectPos) * objectHardness * 8.0;
        state.gripForce = Math.min(1.0, state.gripForce);
    } else {
        state.gripForce = 0.0;
    }

    // 7. Haptic feedback mapping
    const minPwm = parseInt(DOM.minPwmSlider.value);
    const hapticSens = parseFloat(DOM.hapticSensSlider.value) / 10.0;
    const mapType = DOM.hapticMapSelect.value;

    if (state.gripForce > 0) {
        if (mapType === 'linear') {
            state.hapticPWM = minPwm + (255 - minPwm) * state.gripForce;
        } else if (mapType === 'exponential') {
            state.hapticPWM = minPwm + (255 - minPwm) * Math.pow(state.gripForce, 1.5 / hapticSens);
        } else if (mapType === 'step') {
            // Discrete intensity steps for sensory feedback resolution testing
            if (state.gripForce < 0.25) state.hapticPWM = minPwm + 20;
            else if (state.gripForce < 0.5) state.hapticPWM = minPwm + 60;
            else if (state.gripForce < 0.75) state.hapticPWM = minPwm + 100;
            else state.hapticPWM = 255;
        }
        state.hapticPWM = Math.min(255, Math.max(minPwm, Math.floor(state.hapticPWM)));
    } else {
        state.hapticPWM = 0;
    }

    // Push calculations to rolling telemetry buffers
    state.emgBuffer.push(rawVal);
    state.envelopeBuffer.push(envelope);
    state.posBuffer.push(state.handPosition);
    state.forceBuffer.push(state.gripForce);
    state.pwmBuffer.push(state.hapticPWM);
    state.timeBuffer.push(currentMs * state.dt);

    // Limit buffer length
    if (state.emgBuffer.length > state.bufferSize) {
        state.emgBuffer.shift();
        state.envelopeBuffer.shift();
        state.posBuffer.shift();
        state.forceBuffer.shift();
        state.pwmBuffer.shift();
        state.timeBuffer.shift();
    }
}

// ----------------------------------------------------
// Hand joint mechanics & SVG Curving calculations
// ----------------------------------------------------
function updateFingerJoints(groupId, x0, y0, L1, L2, position, baseAngleDeg) {
    const baseAngleRad = baseAngleDeg * Math.PI / 180;
    
    // Curvature factors: index 1 and index 2 bend based on closure pos
    const bendAngle1 = position * 82 * Math.PI / 180;
    const bendAngle2 = position * 95 * Math.PI / 180;
    
    const angle1 = baseAngleRad + bendAngle1;
    const angle2 = angle1 + bendAngle2;

    // Joint 1 endpoint
    const x1 = x0 + L1 * Math.cos(angle1);
    const y1 = y0 + L1 * Math.sin(angle1);

    // Joint 2 (Fingertip) endpoint
    const x2 = x1 + L2 * Math.cos(angle2);
    const y2 = y1 + L2 * Math.sin(angle2);

    const group = document.getElementById(groupId);
    if (group) {
        const lines = group.getElementsByTagName('line');
        if (lines.length >= 2) {
            lines[0].setAttribute('x1', x0.toFixed(1));
            lines[0].setAttribute('y1', y0.toFixed(1));
            lines[0].setAttribute('x2', x1.toFixed(1));
            lines[0].setAttribute('y2', y1.toFixed(1));

            lines[1].setAttribute('x1', x1.toFixed(1));
            lines[1].setAttribute('y1', y1.toFixed(1));
            lines[1].setAttribute('x2', x2.toFixed(1));
            lines[1].setAttribute('y2', y2.toFixed(1));
        }
    }
    return { tipX: x2, tipY: y2 };
}

function updateProstheticHandSVG() {
    const pos = state.handPosition;

    // Update index tip to center haptic animations
    const indexTip = updateFingerJoints('svg-index', 70, 100, 30, 24, pos, -90);
    updateFingerJoints('svg-middle', 90, 97, 34, 26, pos, -90);
    updateFingerJoints('svg-ring', 110, 97, 31, 24, pos, -90);
    updateFingerJoints('svg-pinky', 130, 100, 24, 18, pos, -90);

    // Thumb moves in an opposable orientation
    const thumbRad = -145 * Math.PI / 180;
    const thumbBend = pos * 52 * Math.PI / 180;
    const thumbAngle1 = thumbRad + thumbBend;
    const thumbAngle2 = thumbAngle1 + thumbBend * 0.8;
    
    const tx1 = 50 + 20 * Math.cos(thumbAngle1);
    const ty1 = 140 + 20 * Math.sin(thumbAngle1);
    const tx2 = tx1 + 16 * Math.cos(thumbAngle2);
    const ty2 = ty1 + 16 * Math.sin(thumbAngle2);

    const thumbLines = DOM.svgThumb.getElementsByTagName('line');
    if (thumbLines.length >= 2) {
        thumbLines[0].setAttribute('x1', '50');
        thumbLines[0].setAttribute('y1', '140');
        thumbLines[0].setAttribute('x2', tx1.toFixed(1));
        thumbLines[0].setAttribute('y2', ty1.toFixed(1));

        thumbLines[1].setAttribute('x1', tx1.toFixed(1));
        thumbLines[1].setAttribute('y1', ty1.toFixed(1));
        thumbLines[1].setAttribute('x2', tx2.toFixed(1));
        thumbLines[1].setAttribute('y2', ty2.toFixed(1));
    }

    // Set interactive visual obstacle object vertical height
    const objPos = parseFloat(DOM.objPosSlider.value) / 100.0;
    // Object matches hand closing position visually. Map 0-1 to y position: 140 (completely open finger tip height) down to 40
    const objY = 40 + (1.0 - objPos) * 60;
    DOM.visualObject.setAttribute('y', objY.toFixed(1));
    DOM.visualObjectLabel.setAttribute('y', (objY + 16).toFixed(1));

    // Update haptic pulses at index fingertip
    if (state.hapticPWM > 0) {
        DOM.hapticSensorDot.setAttribute('cx', indexTip.tipX.toFixed(1));
        DOM.hapticSensorDot.setAttribute('cy', indexTip.tipY.toFixed(1));
        DOM.hapticSensorDot.setAttribute('opacity', '1');
        
        DOM.hapticAlertBanner.textContent = `CONTACT FORCE: ${(state.gripForce * 15.0).toFixed(1)} N | feedback PWM: ${state.hapticPWM}`;
        DOM.hapticAlertBanner.classList.add('alert-active');

        // Animate three pulsating rings centered at index fingertip
        const pulseCycle = (performance.now() * 0.004 * (state.hapticPWM / 255.0)) % 1;
        
        const r1 = 5 + pulseCycle * 15;
        const r2 = 5 + ((pulseCycle + 0.33) % 1) * 15;
        const r3 = 5 + ((pulseCycle + 0.66) % 1) * 15;
        
        DOM.pulse1.setAttribute('cx', indexTip.tipX.toFixed(1));
        DOM.pulse1.setAttribute('cy', indexTip.tipY.toFixed(1));
        DOM.pulse1.setAttribute('r', r1.toFixed(1));
        DOM.pulse1.setAttribute('opacity', (1.0 - (r1 - 5) / 15).toFixed(2));

        DOM.pulse2.setAttribute('cx', indexTip.tipX.toFixed(1));
        DOM.pulse2.setAttribute('cy', indexTip.tipY.toFixed(1));
        DOM.pulse2.setAttribute('r', r2.toFixed(1));
        DOM.pulse2.setAttribute('opacity', (1.0 - (r2 - 5) / 15).toFixed(2));

        DOM.pulse3.setAttribute('cx', indexTip.tipX.toFixed(1));
        DOM.pulse3.setAttribute('cy', indexTip.tipY.toFixed(1));
        DOM.pulse3.setAttribute('r', r3.toFixed(1));
        DOM.pulse3.setAttribute('opacity', (1.0 - (r3 - 5) / 15).toFixed(2));

        DOM.hapticSensorDot.classList.add('glowing');
    } else {
        DOM.hapticSensorDot.setAttribute('opacity', '0');
        DOM.pulse1.setAttribute('opacity', '0');
        DOM.pulse2.setAttribute('opacity', '0');
        DOM.pulse3.setAttribute('opacity', '0');
        DOM.hapticAlertBanner.textContent = "NO CONTACT";
        DOM.hapticAlertBanner.classList.remove('alert-active');
        DOM.hapticSensorDot.classList.remove('glowing');
    }
}

// ----------------------------------------------------
// Canvas Telemetry Waveforms Painter (Double Buffered)
// ----------------------------------------------------
function drawWaveform(canvas, dataList, color, label, drawThreshold = false, thresholdVal = 0, rectifiedEnvData = null) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear and draw grid
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    const gridCols = 8;
    for (let i = 1; i < gridCols; i++) {
        const gx = (width / gridCols) * i;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
    }
    
    // Horizontal grid lines
    const gridRows = 4;
    for (let i = 1; i < gridRows; i++) {
        const gy = (height / gridRows) * i;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
    }

    if (dataList.length < 2) return;

    // Determine scale bounds based on typical sensor bounds
    let yMin = 0;
    let yMax = 4095;
    
    if (canvas === DOM.canvasPos || canvas === DOM.canvasForce) {
        yMax = 1.0;
    } else if (canvas === DOM.canvasHaptic) {
        yMax = 255;
    } else if (canvas === DOM.canvasEMG) {
        // Auto scale to buffer bounds, minimum span of 400
        const currentMin = Math.min(...dataList);
        const currentMax = Math.max(...dataList);
        yMin = Math.max(0, currentMin - 200);
        yMax = Math.min(4095, currentMax + 200);
        if (yMax - yMin < 500) {
            yMin = 2048 - 250;
            yMax = 2048 + 250;
        }
    }

    // Function to map values to canvas pixels
    const mapY = (val) => height - ((val - yMin) / (yMax - yMin)) * height;

    // Draw raw trace
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = canvas === DOM.canvasEMG ? 1 : 2.5;
    
    for (let i = 0; i < dataList.length; i++) {
        const cx = (width / (dataList.length - 1)) * i;
        const cy = mapY(dataList[i]);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Draw transparent background shading for premium depth
    if (canvas !== DOM.canvasEMG) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = color.replace(')', ', 0.08)').replace('rgb', 'rgba').replace('#10b981', 'rgba(16, 185, 129, 0.08)').replace('#f59e0b', 'rgba(245, 158, 11, 0.08)').replace('#ef4444', 'rgba(239, 68, 68, 0.08)');
        ctx.fill();
    }

    // Draw rectified envelope on top for Raw EMG chart
    if (rectifiedEnvData && canvas === DOM.canvasEMG) {
        ctx.beginPath();
        ctx.strokeStyle = varColor('--accent-envelope');
        ctx.lineWidth = 2.5;
        for (let i = 0; i < rectifiedEnvData.length; i++) {
            const cx = (width / (rectifiedEnvData.length - 1)) * i;
            // Shift envelope trace relative to raw baseline
            const cy = mapY(2048 + rectifiedEnvData[i]);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }

    // Draw activation threshold line
    if (drawThreshold) {
        const thresholdY = mapY(2048 + thresholdVal);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, thresholdY);
        ctx.lineTo(width, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.font = '9px Space Grotesk';
        ctx.fillText(`THR: ${thresholdVal}`, 6, thresholdY - 4);
    }

    // Overlay numerical values dynamically inside visualizer bounds
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Space Grotesk';
    ctx.fillText(`${label}: ${dataList[dataList.length - 1].toFixed(canvas === DOM.canvasHaptic ? 0 : 2)}`, width - 110, 16);
}

// Read CSS neon variables easily
function varColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function renderCharts() {
    // 1. Raw sEMG + Envelope
    const thVal = parseFloat(DOM.thresholdSlider.value);
    drawWaveform(DOM.canvasEMG, state.emgBuffer, varColor('--accent-emg'), 'Raw EMG', true, thVal, state.envelopeBuffer);

    // 2. Hand Position
    drawWaveform(DOM.canvasPos, state.posBuffer, '#10b981', 'Position');

    // 3. Grip Pressure Force
    drawWaveform(DOM.canvasForce, state.forceBuffer, '#f59e0b', 'Grip Force');

    // 4. Vibrotactile Feedback PWM intensity
    drawWaveform(DOM.canvasHaptic, state.pwmBuffer, '#ef4444', 'Feedback');
}

function resizeCharts() {
    const parentWidth = DOM.canvasEMG.parentElement.clientWidth - 26; // accommodate padding
    DOM.canvasEMG.width = parentWidth;
    DOM.canvasPos.width = parentWidth;
    DOM.canvasForce.width = parentWidth;
    DOM.canvasHaptic.width = parentWidth;
}

// ----------------------------------------------------
// File Reader (sEMG CSV Datasets Import/Parser)
// ----------------------------------------------------
function handleFileSelect(file) {
    if (!file) return;
    
    DOM.loadedFileName.textContent = `Loading: ${file.name}...`;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSVText(text, file.name);
    };
    reader.readAsText(file);
}

function parseCSVText(csvText, filename) {
    try {
        const lines = csvText.split('\n');
        if (lines.length < 2) throw new Error("Empty CSV file layout.");

        // Detect column indices based on header names
        const header = lines[0].toLowerCase().split(',');
        let timeColIdx = -1;
        let emgColIdx = -1;

        for (let i = 0; i < header.length; i++) {
            const col = header[i].trim();
            if (col.includes('time') || col.includes('ms') || col.includes('sec')) {
                timeColIdx = i;
            }
            if (col.includes('emg') || col.includes('val')) {
                emgColIdx = i;
            }
        }

        // Fallback to column 0 (time) and column 1 (emg) if headers not found
        if (timeColIdx === -1) timeColIdx = 0;
        if (emgColIdx === -1) emgColIdx = 1;

        const dataPoints = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cols = line.split(',');
            if (cols.length > Math.max(timeColIdx, emgColIdx)) {
                const rawTime = parseFloat(cols[timeColIdx]);
                const rawEmg = parseFloat(cols[emgColIdx]);

                if (!isNaN(rawEmg)) {
                    dataPoints.push({
                        time: isNaN(rawTime) ? (i * state.dt) : rawTime,
                        emg: rawEmg
                    });
                }
            }
        }

        if (dataPoints.length === 0) throw new Error("No numeric sEMG rows parsed.");

        // Set CSV state
        state.csvData = dataPoints;
        state.csvIndex = 0;
        state.isStreamingCSV = false;
        
        DOM.loadedFileName.textContent = filename;
        DOM.clearCsvBtn.disabled = false;
        DOM.csvPlayBtn.disabled = false;
        DOM.csvLoopBtn.disabled = false;
        DOM.csvPlayBtn.textContent = "Run CSV Stream";
        DOM.csvPlayBtn.className = "btn btn-primary";
        
        // Disable real-time slider input to prioritize file playback
        DOM.contractionSlider.disabled = true;
        DOM.triggerContractionBtn.disabled = true;

        calculateOfflineMetrics(dataPoints);

    } catch (err) {
        alert("Failed to parse CSV file: " + err.message);
        clearCSV();
    }
}

function clearCSV() {
    state.csvData = null;
    state.csvIndex = 0;
    state.isStreamingCSV = false;
    
    DOM.loadedFileName.textContent = "No CSV file loaded";
    DOM.clearCsvBtn.disabled = true;
    DOM.csvPlayBtn.disabled = true;
    DOM.csvLoopBtn.disabled = true;
    DOM.csvPlayBtn.textContent = "Run CSV Stream";
    DOM.csvPlayBtn.className = "btn btn-primary";
    
    DOM.contractionSlider.disabled = false;
    DOM.triggerContractionBtn.disabled = false;
    
    // Reset summary metrics labels
    DOM.sumPoints.textContent = "-";
    DOM.sumSnr.textContent = "- dB";
    DOM.sumBursts.textContent = "-";
    DOM.sumForce.textContent = "-";
}

function toggleCSVPlayback() {
    if (!state.csvData) return;
    
    state.isStreamingCSV = !state.isStreamingCSV;
    if (state.isStreamingCSV) {
        DOM.csvPlayBtn.textContent = "Pause Stream";
        DOM.csvPlayBtn.className = "btn btn-danger";
        DOM.systemStatusText.textContent = "STREAMING FILE";
        DOM.systemStatusText.className = "status-active";
    } else {
        DOM.csvPlayBtn.textContent = "Resume Stream";
        DOM.csvPlayBtn.className = "btn btn-primary";
        DOM.systemStatusText.textContent = "PAUSED";
        DOM.systemStatusText.className = "";
    }
}

function toggleCSVLoop() {
    state.loopCSV = !state.loopCSV;
    if (state.loopCSV) {
        DOM.csvLoopBtn.className = "btn btn-primary";
    } else {
        DOM.csvLoopBtn.className = "btn btn-secondary";
    }
}

// DSP Offline Analytics Calculation
function calculateOfflineMetrics(dataPoints) {
    const n = dataPoints.length;
    DOM.sumPoints.textContent = n.toLocaleString();

    // 1. Calculate Signal to Noise Ratio (SNR) approximation
    // We segment the loaded data: Signal = variance of high contraction, Noise = variance of resting
    let mean = 0;
    dataPoints.forEach(p => mean += p.emg);
    mean /= n;

    let variance = 0;
    dataPoints.forEach(p => variance += Math.pow(p.emg - mean, 2));
    variance /= n;
    
    // Sort amplitudes to find resting baseline noise vs contracting signal
    const absDeviations = dataPoints.map(p => Math.abs(p.emg - mean)).sort((a, b) => a - b);
    const noiseBaselineDev = absDeviations[Math.floor(n * 0.15)]; // lowest 15% deviations represent rest
    const peakSignalDev = absDeviations[Math.floor(n * 0.95)];   // upper 95% deviations represent contraction strength

    let snrDb = 0;
    if (noiseBaselineDev > 0) {
        snrDb = 20 * Math.log10(peakSignalDev / noiseBaselineDev);
    }
    DOM.sumSnr.textContent = snrDb.toFixed(1) + " dB";

    // 2. Count Contraction bursts (using simple threshold envelope counts)
    let burstCount = 0;
    let inBurst = false;
    let maxGripForce = 0;
    
    // Run temporary offline envelope logic
    const tempEnvFilter = new MovingAverage(50);
    const thVal = parseFloat(DOM.thresholdSlider.value);
    
    dataPoints.forEach(p => {
        const rectified = Math.abs(p.emg - 2048);
        const env = tempEnvFilter.process(rectified);
        
        if (env > thVal) {
            if (!inBurst) {
                burstCount++;
                inBurst = true;
            }
        } else {
            inBurst = false;
        }
    });

    DOM.sumBursts.textContent = burstCount;
    DOM.sumForce.textContent = "15.0 N (Auto-Max)";
}

// ----------------------------------------------------
// Web Serial Port sEMG hardware integration
// ----------------------------------------------------
async function connectSerial() {
    if (!('serial' in navigator)) {
        alert("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
        return;
    }
    
    DOM.serialPortText.textContent = "CONNECTING...";
    DOM.serialPortText.style.color = "#f59e0b";
    
    try {
        state.serialPort = await navigator.serial.requestPort();
        const baudRate = parseInt(DOM.serialBaudSelect.value) || 115200;
        await state.serialPort.open({ baudRate });
        
        state.isStreamingSerial = true;
        state.serialKeepReading = true;
        
        DOM.serialPortText.textContent = "CONNECTED";
        DOM.serialPortText.style.color = "var(--accent-hand)";
        DOM.serialConnectBtn.textContent = "Disconnect Sensor";
        DOM.serialConnectBtn.className = "btn btn-danger";
        DOM.systemStatusText.textContent = "HARDWARE ACTIVE";
        DOM.systemStatusText.className = "status-active";
        
        // Disable simulation/CSV components to avoid conflicts
        DOM.contractionSlider.disabled = true;
        DOM.triggerContractionBtn.disabled = true;
        DOM.csvPlayBtn.disabled = true;
        DOM.csvFileInput.disabled = true;
        
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = state.serialPort.readable.pipeTo(textDecoder.writable);
        state.serialReader = textDecoder.readable.getReader();
        
        let buffer = "";
        while (state.serialKeepReading) {
            const { value, done } = await state.serialReader.read();
            if (done) break;
            if (value) {
                buffer += value;
                let lines = buffer.split('\n');
                buffer = lines.pop(); // keep last partial line
                
                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    let parts = line.split(',');
                    let rawVal = NaN;
                    if (parts.length >= 2) {
                        rawVal = parseFloat(parts[1]);
                    } else {
                        rawVal = parseFloat(line);
                    }
                    
                    if (!isNaN(rawVal)) {
                        processHardwareDataPoint(rawVal);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Web Serial connection error:", err);
        alert("Web Serial error: " + err.message);
        disconnectSerial();
    }
}

async function disconnectSerial() {
    state.serialKeepReading = false;
    state.isStreamingSerial = false;
    
    if (state.serialReader) {
        try {
            await state.serialReader.cancel();
            state.serialReader.releaseLock();
        } catch (e) {}
        state.serialReader = null;
    }
    
    if (state.serialPort) {
        try {
            await state.serialPort.close();
        } catch (e) {}
        state.serialPort = null;
    }
    
    DOM.serialPortText.textContent = "DISCONNECTED";
    DOM.serialPortText.style.color = "var(--text-muted)";
    DOM.serialConnectBtn.textContent = "Connect sEMG Sensor";
    DOM.serialConnectBtn.className = "btn btn-success";
    DOM.systemStatusText.textContent = "SIMULATING";
    DOM.systemStatusText.className = "status-active";
    
    DOM.contractionSlider.disabled = false;
    DOM.triggerContractionBtn.disabled = false;
    DOM.csvFileInput.disabled = false;
    if (state.csvData) DOM.csvPlayBtn.disabled = false;
}

async function toggleSerialConnection() {
    if (state.isStreamingSerial) {
        await disconnectSerial();
    } else {
        await connectSerial();
    }
}

function processHardwareDataPoint(rawVal) {
    state.t++;
    const currentMs = state.t;

    // 1. DSP filtering pipeline
    let processedVal = rawVal;
    const filterOption = DOM.filterSelect.value;
    if (filterOption === 'butterworth') {
        processedVal = hpf.filter(rawVal);
    } else {
        processedVal = rawVal - 2048;
    }

    // 2. Rectification & Envelope Extraction
    const rectified = Math.abs(processedVal);
    const envelope = envFilter.process(rectified);

    // 3. Threshold Control Decision
    const thresholdVal = parseFloat(DOM.thresholdSlider.value);
    state.controlActive = (envelope > thresholdVal);

    // 4. Hand Position Closing/Opening Physics (using dt=0.001 for 1ms intervals)
    const handSpeed = parseFloat(DOM.speedSlider.value) / 10.0;
    const objectPos = parseFloat(DOM.objPosSlider.value) / 100.0;
    const objectHardness = parseFloat(DOM.objHardSlider.value) / 10.0;

    if (state.controlActive) {
        if (state.handPosition < objectPos) {
            state.handPosition = Math.min(objectPos, state.handPosition + handSpeed * state.dt);
        } else {
            const maxCompressionFactor = 0.12 / objectHardness;
            state.handPosition = Math.min(objectPos + maxCompressionFactor, state.handPosition + (handSpeed * 0.15) * state.dt);
        }
    } else {
        state.handPosition = Math.max(0.0, state.handPosition - handSpeed * state.dt);
    }

    // 5. Grip Force / Pressure calculation
    if (state.handPosition > objectPos) {
        state.gripForce = (state.handPosition - objectPos) * objectHardness * 8.0;
        state.gripForce = Math.min(1.0, state.gripForce);
    } else {
        state.gripForce = 0.0;
    }

    // 6. Haptic feedback mapping
    const minPwm = parseInt(DOM.minPwmSlider.value);
    const hapticSens = parseFloat(DOM.hapticSensSlider.value) / 10.0;
    const mapType = DOM.hapticMapSelect.value;

    if (state.gripForce > 0) {
        if (mapType === 'linear') {
            state.hapticPWM = minPwm + (255 - minPwm) * state.gripForce;
        } else if (mapType === 'exponential') {
            state.hapticPWM = minPwm + (255 - minPwm) * Math.pow(state.gripForce, 1.5 / hapticSens);
        } else if (mapType === 'step') {
            if (state.gripForce < 0.25) state.hapticPWM = minPwm + 20;
            else if (state.gripForce < 0.5) state.hapticPWM = minPwm + 60;
            else if (state.gripForce < 0.75) state.hapticPWM = minPwm + 100;
            else state.hapticPWM = 255;
        }
        state.hapticPWM = Math.min(255, Math.max(minPwm, Math.floor(state.hapticPWM)));
    } else {
        state.hapticPWM = 0;
    }

    // Push calculations to rolling telemetry buffers
    state.emgBuffer.push(rawVal);
    state.envelopeBuffer.push(envelope);
    state.posBuffer.push(state.handPosition);
    state.forceBuffer.push(state.gripForce);
    state.pwmBuffer.push(state.hapticPWM);
    state.timeBuffer.push(currentMs * state.dt);

    if (state.emgBuffer.length > state.bufferSize) {
        state.emgBuffer.shift();
        state.envelopeBuffer.shift();
        state.posBuffer.shift();
        state.forceBuffer.shift();
        state.pwmBuffer.shift();
        state.timeBuffer.shift();
    }
}

// ----------------------------------------------------
// Telemetry Data Export Utility
// ----------------------------------------------------
function exportTelemetry() {
    try {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Time_sec,EMG_Raw,EMG_Envelope,Hand_Position,Grip_Force,Feedback_PWM\n";
        
        const count = state.emgBuffer.length;
        for (let i = 0; i < count; i++) {
            const time = state.timeBuffer[i].toFixed(3);
            const raw = state.emgBuffer[i].toFixed(0);
            const env = state.envelopeBuffer[i].toFixed(1);
            const pos = state.posBuffer[i].toFixed(3);
            const force = state.forceBuffer[i].toFixed(3);
            const pwm = state.pwmBuffer[i].toFixed(0);
            
            csvContent += `${time},${raw},${env},${pos},${force},${pwm}\n`;
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `myohap_telemetry_export_${Math.floor(Date.now()/1000)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Failed to export telemetry data: " + e.message);
    }
}

// ----------------------------------------------------
// Main animation loops
// ----------------------------------------------------
function mainLoop() {
    const now = performance.now();
    const frameElapsed = now - state.lastFrameTime;
    state.lastFrameTime = now;
    state.fps = Math.round(1000 / frameElapsed);
    DOM.fpsCounter.textContent = state.fps;

    if (state.running) {
        if (!state.isStreamingSerial) {
            // Sync number of DSP steps with the actual frame rendering duration 
            // to ensure file playback keeps pace with real time (1ms per step)
            const stepsToCompute = state.isStreamingCSV ? Math.floor(frameElapsed) : 16;
            
            for (let step = 0; step < Math.min(100, stepsToCompute); step++) {
                stepSimulator();
            }
        }
        
        // Readout numbers rendering
        DOM.readoutRms.textContent = state.envelopeBuffer[state.envelopeBuffer.length - 1].toFixed(1) + " ADC";
        DOM.readoutPos.textContent = state.handPosition.toFixed(2) + (state.handPosition > 0 ? " (Closing)" : " (Open)");
        DOM.readoutForce.textContent = (state.gripForce * 15.0).toFixed(1) + " N";
        DOM.readoutPwm.textContent = state.hapticPWM + " PWM";

        // Draw visualizers
        renderCharts();
        updateProstheticHandSVG();
    }

    requestAnimationFrame(mainLoop);
}

// ----------------------------------------------------
// Page load entrypoint
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    // Cache SVG element handles specifically (avoiding querySelector overhead)
    DOM.svgThumb = document.getElementById('svg-thumb');
    DOM.svgIndex = document.getElementById('svg-index');
    DOM.svgMiddle = document.getElementById('svg-middle');
    DOM.svgRing = document.getElementById('svg-ring');
    DOM.svgPinky = document.getElementById('svg-pinky');

    initBuffers();
    resizeCharts();
    attachUIListeners();
    updateUIReadouts();
    
    // Kick off animation frames
    requestAnimationFrame(mainLoop);
});
