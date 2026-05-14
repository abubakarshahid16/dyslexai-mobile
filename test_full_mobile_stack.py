import requests
import os
import sys
import time

SCAN_URL = "http://localhost:8000"
EXERCISE_URL = "http://localhost:8001"

def test_module(name):
    print(f"\n--- Testing Module: {name} ---")

def run_tests():
    # 1. Health Checks
    test_module("Health")
    try:
        r1 = requests.get(f"{SCAN_URL}/health")
        print(f"Scan Backend (8000): {r1.status_code} - {r1.json()}")
        r2 = requests.get(f"{EXERCISE_URL}/")
        print(f"Exercise Backend (8001): {r2.status_code} - {r2.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return

    # 2. Auth - Signup
    test_module("Auth (Signup)")
    email = f"test_{int(time.time())}@example.com"
    signup_data = {
        "name": "Test User",
        "email": email,
        "password": "password123",
        "role": "student"
    }
    r = requests.post(f"{SCAN_URL}/auth/signup", json=signup_data)
    if r.status_code != 200:
        print(f"Signup failed: {r.status_code} - {r.text}")
        return
    print(f"Signup Success: {r.json()['user']['email']}")
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Exercises
    test_module("Exercises")
    r = requests.get(f"{EXERCISE_URL}/exercises/", headers=headers)
    if r.status_code == 200:
        exercises = r.json()
        print(f"Fetched {len(exercises)} exercises successfully.")
    else:
        print(f"Exercise fetch failed: {r.status_code} - {r.text}")

    # 4. OCR Scan
    test_module("OCR Scan")
    # Use the Capture.PNG in the root
    img_path = "../Capture.PNG" 
    if not os.path.exists(img_path):
        img_path = "Capture.PNG" # Try local if root fails
    
    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            files = {"file": ("test.png", f, "image/png")}
            r = requests.post(f"{SCAN_URL}/scan", files=files)
            if r.status_code == 200:
                print(f"OCR Success. Corrected text: {r.json().get('corrected_text', '')[:100]}...")
            else:
                print(f"OCR Failed: {r.status_code} - {r.text}")
    else:
        print("Capture.PNG not found, skipping OCR test.")

    # 5. Game
    test_module("Game")
    r = requests.get(f"{EXERCISE_URL}/api/game/today", headers=headers)
    if r.status_code == 200:
        print("Game /today reachable.")
    else:
        print(f"Game /today failed: {r.status_code} - {r.text}")

    print("\n--- All Tests Finished ---")

if __name__ == "__main__":
    run_tests()
