import time
import requests
import sys
import json

URL = "http://127.0.0.1:8000/scan"
IMAGE_PATH = r"c:\Users\abuba\OneDrive\Desktop\New folder (5)\dyslexai-mobile\Capture.PNG"

def wait_for_server():
    print("Waiting for server to start (loading models takes time)...")
    for _ in range(150):
        try:
            r = requests.get("http://127.0.0.1:8000/health")
            if r.status_code == 200:
                print("Server is up! Response:", r.json())
                return True
        except:
            pass
        time.sleep(2)
    return False

if not wait_for_server():
    print("Server did not start in time.")
    sys.exit(1)

print(f"Sending image {IMAGE_PATH} to {URL}...")
with open(IMAGE_PATH, "rb") as f:
    files = {"file": ("Capture.PNG", f, "image/png")}
    response = requests.post(URL, files=files)

print("Status:", response.status_code)
if response.status_code == 200:
    data = response.json()
    print("--- RESULTS ---")
    print("Raw Text:", data.get("raw_text"))
    print("Cleaned Text:", data.get("cleaned_text"))
    print("T5 Corrected:", data.get("t5_corrected_text"))
    print("Final Corrected:", data.get("corrected_text"))
    print("Error Regions:", json.dumps(data.get("error_regions"), indent=2))
else:
    print("Error:", response.text)
