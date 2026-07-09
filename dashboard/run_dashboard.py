import http.server
import socketserver
import webbrowser
import os
import sys
import time
import threading

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser():
    # Wait briefly for the server socket to open and bind successfully
    time.sleep(0.8)
    webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    # Change working directory to ensure correct file resolution
    os.chdir(DIRECTORY)
    
    # Start background browser launcher
    threading.Thread(target=open_browser, daemon=True).start()
    
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print("\n" + "="*55)
            print("MyoHap sEMG & Haptic Feedback Simulation Dashboard Server")
            print("="*55)
            print(f"Serving files from: {DIRECTORY}")
            print(f"Local dashboard URL: http://localhost:{PORT}")
            print("Press Ctrl+C to terminate the server session safely.")
            print("="*55 + "\n")
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Keyboard interrupt detected. Closing simulation server. Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] Failed to launch server: {e}")
        sys.exit(1)
