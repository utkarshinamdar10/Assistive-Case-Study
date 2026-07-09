const int emgPin = 34;       // Analog input pin
const int sampleRate = 1000; // Hz
const int intervalMicros = 1000000 / sampleRate;

unsigned long lastSampleTime = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetAttenuation(ADC_ATTEN_DB_11);
  pinMode(emgPin, INPUT);
}

void loop() {
  unsigned long currentMicros = micros();

  if (currentMicros - lastSampleTime >= intervalMicros) {
    lastSampleTime = currentMicros;

    int emgValue = analogRead(emgPin);

    // Print raw data separated by a comma (Timestamp,Value)
    Serial.print(millis());
    Serial.print(",");
    Serial.println(emgValue);
  }
}
