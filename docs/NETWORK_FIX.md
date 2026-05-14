# Fix "Network request failed" (app can't reach backends)

Follow these in order. **Dashboard tip:** Open the app and go to the Dashboard — the "Backend status" card shows whether Scan (8000) and Exercises (8001) are reachable. Pull to refresh to re-check.

---

## 1. How are you running the app?

- **Android emulator** (phone icon on your PC) → use **Section A**
- **Physical phone** (real device with Expo Go) → use **Section B**

---

## 2. Section A – Android emulator

The app must call **10.0.2.2** (that’s the emulator’s way to reach your PC).

**Step 1 – .env**

In `DyslexAI-Mobile/.env` you should have:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
EXPO_PUBLIC_EXERCISE_API_URL=http://10.0.2.2:8001
```

(Already set to this.)

**Step 2 – Restart Expo**

Changing `.env` only applies after a full restart:

1. In the terminal where Expo is running, press **Ctrl+C**.
2. Run again: `npx expo start`
3. Open the app on the **Android emulator** again (press **a** or choose Android).

**Step 3 – Backend must be running**

- In one PowerShell: **Scan backend** on port 8000  
  `cd scan-backend` → `.\venv\Scripts\activate` → `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- In another: **Exercise backend** on port 8001 (optional for signup; needed for Practice)  
  `cd dyslexia-backend` → `.\venv\Scripts\activate` → `uvicorn app.main:app --host 0.0.0.0 --port 8001`

**Step 4 – Test from your PC**

In a **new** PowerShell (from the project root):

```powershell
.\check-backends.ps1
```

Or: `curl http://localhost:8000/health` and `curl http://localhost:8001/`. You should see OK responses. If that fails, the backends aren’t running or aren’t bound to `0.0.0.0`.

**Step 5 – Windows Firewall (if still failing)**

The emulator talks to your PC over the network. Allow inbound TCP on ports **8000** and **8001**:

1. Win key → type **Windows Defender Firewall** → **Advanced settings**
2. **Inbound Rules** → **New Rule**
3. **Port** → **TCP** → **Specific local ports:** `8000,8001` → **Allow** → name e.g. **DyslexAI**

Then try the app again.

---

## 3. Section B – Physical phone

The app must use your **PC’s IP address** (phone and PC on Have ythe same Wi‑Fi).

**Step 1 – Get your PC IP**

In PowerShell run:

```powershell
ipconfig
```

Find **IPv4 Address** under your Wi‑Fi adapter (e.g. `192.168.1.12`).

**Step 2 – .env**

In `DyslexAI-Mobile/.env` set your **PC’s IP** (from `ipconfig`, e.g. 192.168.1.12 or 172.18.0.1):

```
EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:8000
EXPO_PUBLIC_EXERCISE_API_URL=http://YOUR_PC_IP:8001
```

Example: `http://192.168.1.12:8000` and `http://192.168.1.12:8001`.

**Step 3 – Restart Expo**

Ctrl+C in the Expo terminal, then `npx expo start` again. Reload the app on the phone.

**Step 4 – Firewall**

Same as Section A Step 5: allow inbound TCP on **8000** and **8001** for your Wi‑Fi (Private) profile.

**Step 5 – Same Wi‑Fi**

Phone and PC must be on the same Wi‑Fi network.

---

## 4. Use the app without network (temporary)

On the **Sign in** screen there is a link:

**“Skip sign in (use app offline / fix network later)”**

Tap it to enter the app as Guest. You can use scans (if backend is fixed later), library, and most of the UI. When the network is fixed, sign up or sign in for real and you’ll stay logged in.
