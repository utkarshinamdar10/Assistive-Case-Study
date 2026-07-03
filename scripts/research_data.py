import scipy.io
import os
import glob

def inspect_files():
    mat_files = glob.glob('EMG_Project/data/**/*.mat', recursive=True)
    print(f"Found {len(mat_files)} .mat files.")
    
    for file_path in mat_files:
        print(f"\nInspecting: {file_path}")
        size = os.path.getsize(file_path)
        print(f"Size: {size} bytes")
        if size > 0:
            try:
                data = scipy.io.loadmat(file_path)
                print("Keys:", [k for k in data.keys() if not k.startswith('__')])
                for key in data.keys():
                    if not key.startswith('__'):
                        val = data[key]
                        if hasattr(val, 'shape'):
                            print(f"  - {key}: shape {val.shape}")
            except Exception as e:
                print(f"  - Error reading: {e}")
        else:
            print("  - File is empty.")

if __name__ == "__main__":
    inspect_files()
