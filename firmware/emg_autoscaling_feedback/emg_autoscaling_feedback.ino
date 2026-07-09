/*
 * EMG Acquisition, Processing, and Auto-Scaling for ESP32
 * Sampling Rate: 50 Hz
 */

const int emgPin = 34;       
const int sampleRate = 50;   
const int intervalMicros = 1000000 / sampleRate;

unsigned long lastSampleTime = 0;
unsigned long startTime = 0;

// Processing Parameters
const int WINDOW_SIZE = 35;  
float windowBuffer[WINDOW_SIZE];
int bufferIndex = 0;
float windowSum = 0.0;          

// Calibration variables
float dynamicBaseline = 2048.0; 
const float alpha = 0.01;    

float restingEnvelope = 0;
bool isCalibrated = false;
const unsigned long calibrationDurationMs = 3000; // 3 seconds to calibrate at rest
float calibrationSum = 0;
int calibrationSamples = 0;

void setup() {
  Serial.begin(9600);
  analogReadResolution(12);
  analogSetAttenuation(ADC_ATTEN_DB_11);
  pinMode(emgPin, INPUT);

  for (int i = 0; i < WINDOW_SIZE; i++) {
    windowBuffer[i] = 0.0;
  }
  
  startTime = millis();
}

void loop() {
  unsigned long currentMicros = micros();

  if (currentMicros - lastSampleTime >= intervalMicros) {
    lastSampleTime = currentMicros;

    int emgRaw = analogRead(emgPin);

    // 1. Dynamic Baseline Removal
    dynamicBaseline = (alpha * emgRaw) + ((1.0 - alpha) * dynamicBaseline);
    float emgCentered = dynamicBaseline - emgRaw;

    // 2. Full-Wave Rectification
    float emgRectified = abs(emgCentered);

    // 3. Rectangular Window Envelope
    windowSum -= windowBuffer[bufferIndex];
    windowBuffer[bufferIndex] = emgRectified;
    windowSum += emgRectified;

    bufferIndex++;
    if (bufferIndex >= WINDOW_SIZE) {
      bufferIndex = 0;
    }

    float emgEnvelope = windowSum / WINDOW_SIZE;

    // 4. Calibration & Auto-Scaling Logic
    if (!isCalibrated) {
      // Gather envelope data for the first 3 seconds to find the "Resting Level"
      calibrationSum += emgEnvelope;
      calibrationSamples++;
      
      if (millis() - startTime >= calibrationDurationMs) {
        restingEnvelope = calibrationSum / calibrationSamples;
        isCalibrated = true;
      }
      
      // Print status to plotter while calibrating
      Serial.print("Scaled_Envelope:"); Serial.println(0); 
    } 
    else {
      // --- REMOVE RESTING OFFSET & SCALE ---
      // Find how far away the current envelope is from the resting average
      float envelopeDeviation = abs(emgEnvelope - restingEnvelope);

      // Amplify the deviation. 
      // A multiplier of 5.0 to 8.0 will stretch your ~400 unit jump into a massive 2000+ unit leap.
      float scaledEnvelope = envelopeDeviation * 6.0; 

      // Constrain to prevent negative dips or crazy high spikes
      if (scaledEnvelope < 0) scaledEnvelope = 0;

      // 5. Serial Plotter Output
      Serial.print("Scaled_Envelope:");       Serial.print(scaledEnvelope);          // 1st = Blue
      Serial.print(",");
      Serial.print("Raw_Signal:");        Serial.print(emgRaw);               // 2nd = Orange (A clean flat baseline reference)
      Serial.print(",");
      Serial.print("Zero_Line:"); Serial.println(0); // 3rd = Green!
    }
  }
}
