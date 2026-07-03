/*
 * Real-time EMG Envelope Filtering (Rectangular vs Hanning Window)
 * Ported from MATLAB to ESP32 Arduino IDE
 * Sampling Rate: 1000 Hz
 */

const int emgPin = 34;        // Analog input pin (GPIO 34)
const int sampleRate = 50;  // Hz
const int intervalMicros = 100000 / sampleRate;
unsigned long lastSampleTime = 0;

// Plotting Control (Slow down visual speed)
const int plotDecimation = 10; // Plot every 10th sample (100 Hz plotting)
int plotCounter = 0;

// 3. Filter Parameters
const int windowLength = 35;
float emgBuffer[windowLength] = {0}; // Circular buffer to store last 35 rectified samples
int bufferIndex = 0;
float rectSum = 0;                   // Tracks the running sum for the rectangular window

// 4. Pre-computed & Normalized Hanning Window Coefficients (Length = 35)
const float hannCoeffs[windowLength] = {
  0.000000f, 0.000501f, 0.001986f, 0.004405f, 0.007676f, 0.011687f, 0.016302f, 0.021363f, 0.026698f, 0.032126f,
  0.037461f, 0.042522f, 0.047136f, 0.051147f, 0.054418f, 0.056837f, 0.058323f, 0.058824f, 0.058323f, 0.056837f,
  0.054418f, 0.051147f, 0.047136f, 0.042522f, 0.037461f, 0.032126f, 0.026698f, 0.021363f, 0.016302f, 0.011687f,
  0.007676f, 0.004405f, 0.001986f, 0.000501f, 0.000000f
};

// 4b. 50Hz Low-Pass Filter (2nd Order Butterworth, Fs=1000Hz)
const float b_LP[] = {0.020083, 0.040167, 0.020083};
const float a_LP[] = {1.000000, -1.561018, 0.641352};

// History for LPF on Raw Signal
float x_RawLP[3] = {0, 0, 0};
float y_RawLP[3] = {0, 0, 0};

// History for LPF on Rectified Signal (Envelope)
float x_EnvLP[3] = {0, 0, 0};
float y_EnvLP[3] = {0, 0, 0};

// 4c. Baseline Removal (1000-sample Moving Average)
const int baselineWindow = 1000;
float baselineBuffer[baselineWindow] = {0};
int baselineIdx = 0;
double baselineSum = 0;
float baseline = 0.0;
bool isFirstSample = true;

void setup() {
  Serial.begin(115200);
  
  // Configure ESP32 ADC (0 - 3.3V range)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  pinMode(emgPin, INPUT);
}

// Add this function at the very bottom of your file, outside of loop()
float mean(int dataArray[], int sampleSize) {
  long sum = 0;
  for (int i = 0; i < sampleSize; i++) {
    sum += dataArray[i];
  }
  return (float)sum / sampleSize;
}

void loop() {
  unsigned long currentMicros = micros();

  // Precise 1000 Hz Timing Block
  if (currentMicros - lastSampleTime >= intervalMicros) {
    lastSampleTime = currentMicros;

    int rawValue = analogRead(emgPin);

    // 1. Remove Baseline Offset (1000-sample Moving Average)
    if (isFirstSample) {
      // Initialize the whole buffer with the first sample to avoid a long ramp-up
      for (int i = 0; i < baselineWindow; i++) {
        baselineBuffer[i] = (float)rawValue;
      }
      baselineSum = (double)rawValue * baselineWindow;
      isFirstSample = false;
    }

    // Subtract the oldest value and add the new value to the sum
    baselineSum -= baselineBuffer[baselineIdx];
    baselineBuffer[baselineIdx] = (float)rawValue;
    baselineSum += rawValue;

    // Increment circular buffer index
    baselineIdx = (baselineIdx + 1) % baselineWindow;

    // Calculate the mean (baseline)
    baseline = (float)(baselineSum / baselineWindow);

    // Final Centered Signal
    float emgCentered = (float)rawValue - baseline;

    // 2. Apply 50Hz Low-Pass Filter to Raw Signal
    x_RawLP[0] = emgCentered;
    float rawFiltered = b_LP[0]*x_RawLP[0] + b_LP[1]*x_RawLP[1] + b_LP[2]*x_RawLP[2] 
                      - a_LP[1]*y_RawLP[1] - a_LP[2]*y_RawLP[2];
    x_RawLP[2] = x_RawLP[1]; x_RawLP[1] = x_RawLP[0];
    y_RawLP[2] = y_RawLP[1]; y_RawLP[1] = rawFiltered;

    // 3. Rectify (using the filtered raw signal)
    float emgRectified = abs(rawFiltered);

    // 4. Apply 50Hz Low-Pass Filter to Rectified Signal (Envelope)
    x_EnvLP[0] = emgRectified;
    float emgLPF_Env = b_LP[0]*x_EnvLP[0] + b_LP[1]*x_EnvLP[1] + b_LP[2]*x_EnvLP[2] 
                     - a_LP[1]*y_EnvLP[1] - a_LP[2]*y_EnvLP[2];
    x_EnvLP[2] = x_EnvLP[1]; x_EnvLP[1] = x_EnvLP[0];
    y_EnvLP[2] = y_EnvLP[1]; y_EnvLP[1] = emgLPF_Env;

    // 5. Apply Hanning Window Filter (Legacy)
    rectSum -= emgBuffer[bufferIndex];       
    emgBuffer[bufferIndex] = emgRectified;   
    rectSum += emgRectified;                 
    float emgHann_Env = 0;
    for (int i = 0; i < windowLength; i++) {
      int idx = (bufferIndex + i) % windowLength;
      emgHann_Env += emgBuffer[idx] * hannCoeffs[i];
    }
    bufferIndex = (bufferIndex + 1) % windowLength;

    // 6. Plotting (Decimated to slow down Serial Plotter)
    plotCounter++;
    if (plotCounter >= plotDecimation) {
      plotCounter = 0;
      Serial.print("Raw_Unfiltered:");
      Serial.print(emgCentered);
      Serial.print(",");
      Serial.print("Raw_Filtered_50Hz:");
      Serial.print(rawFiltered);
      Serial.print(",");
      Serial.print("Envelope_50Hz:");
      Serial.println(emgLPF_Env);
    }
  }
}
