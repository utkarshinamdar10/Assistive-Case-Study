import scipy.io
import os

file_path = os.path.join('EMG_Project', 'data', 'EMG-data (1).mat')
if os.path.exists(file_path):
    try:
        data = scipy.io.loadmat(file_path)
        print("Keys in MAT file:", list(data.keys()))
        for key in data.keys():
            if not key.startswith('__'):
                print(f"Shape of {key}: {data[key].shape}")
    except Exception as e:
        print(f"Error reading file: {e}")
else:
    print(f"File not found at {file_path}")
