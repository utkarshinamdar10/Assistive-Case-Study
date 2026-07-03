import serial
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from collections import deque
import sys

# Configuration
PORT = 'COM3'  # Change to your port (e.g., '/dev/ttyUSB0' on Linux)
BAUD_RATE = 115200
WINDOW_SIZE = 500  # Number of points to show on the plot

# Initialize Serial
try:
    ser = serial.Serial(PORT, BAUD_RATE, timeout=0.1)
except Exception as e:
    print(f"Error opening serial port: {e}")
    print("Please check your PORT configuration.")
    sys.exit(1)

# Data storage
times = deque(maxlen=WINDOW_SIZE)
values = deque(maxlen=WINDOW_SIZE)

# Setup Plot
fig, ax = plt.subplots()
line, = ax.plot([], [], lw=1, color='red')
ax.set_ylim(0, 4096)  # ESP32 12-bit ADC range
ax.set_xlim(0, WINDOW_SIZE)
ax.set_title("Real-Time EMG Data (ESP32)")
ax.set_xlabel("Samples")
ax.set_ylabel("Raw ADC Value")
ax.grid(True)

def update(frame):
    while ser.in_waiting > 0:
        line_data = ser.readline().decode('utf-8').strip()
        if ',' in line_data:
            try:
                t_str, v_str = line_data.split(',')
                val = int(v_str)
                values.append(val)
                times.append(len(values))
            except ValueError:
                pass

    line.set_data(range(len(values)), list(values))
    
    # Dynamic x-axis if we want it to scroll
    if len(values) >= WINDOW_SIZE:
        ax.set_xlim(0, WINDOW_SIZE)
    
    return line,

ani = animation.FuncAnimation(fig, update, interval=10, blit=True, cache_frame_data=False)

plt.tight_layout()
plt.show()

ser.close()
