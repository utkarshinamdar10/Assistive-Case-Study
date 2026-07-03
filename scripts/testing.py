import serial
import time

# --- CONFIGURATION ---
PORT = 'COM16'         # Change this to your active ESP32 port (e.g., 'COM17')
BAUD_RATE = 115200
OUTPUT_FILE = 'emg_data_10s.csv'
RECORD_DURATION = 10  # Seconds

print(# Wait a brief moment for the serial line to stabilize
f"Opening port {PORT}...")
try:
    ser = serial.Serial(PORT, BAUD_RATE, timeout=1)
    time.sleep(2) 
    ser.reset_input_buffer()
except Exception as e:
    print(f"Error opening serial port: {e}")
    exit()

print(f"Recording started! Flex your muscle now... (Capturing for {RECORD_DURATION} seconds)")

start_time = time.time()
data_lines = []

# Main recording loop
while time.time() - start_time < RECORD_DURATION:
    if ser.in_waiting > 0:
        try:
            # Read a line of data from the ESP32
            line = ser.readline().decode('utf-8').strip()
            if line:
                data_lines.append(line)
        except Exception:
            # Catch occasional minor serial glitches smoothly
            continue

print("Recording finished! Saving data...")

# Write data to a CSV file
with open(OUTPUT_FILE, 'w') as file:
    # Add column headers
    file.write("Timestamp_ms,EMG_Value\n")
    for line in data_lines:
        file.write(line + "\n")

ser.close()
print(f"Successfully saved {len(data_lines)} data points to '{OUTPUT_FILE}'!")