import scipy.io
import os

# Check both repository root and scripts directory relative path
paths_to_try = [
    os.path.join('data', 'EMG-data.mat'),
    os.path.join('..', 'data', 'EMG-data.mat')
]

file_path = None
for path in paths_to_try:
    if os.path.exists(path):
        file_path = path
        break

if file_path:
    try:
        data = scipy.io.loadmat(file_path)
        print(f"Successfully loaded: {file_path}")
        print("Keys in MAT file:", list(data.keys()))
        for key in data.keys():
            if not key.startswith('__'):
                print(f"Shape of {key}: {data[key].shape}")
    except Exception as e:
        print(f"Error reading file: {e}")
else:
    print("Error: EMG-data.mat not found in data/ or ../data/ directories.")
