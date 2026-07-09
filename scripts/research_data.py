import scipy.io
import os
import glob

def inspect_files():
    # Search relative to repo root or scripts folder
    search_paths = ['data/**/*.mat', '../data/**/*.mat']
    mat_files = []
    for path in search_paths:
        mat_files.extend(glob.glob(path, recursive=True))
    
    # Remove duplicates and resolve absolute paths
    mat_files = list(set([os.path.abspath(f) for f in mat_files]))
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
