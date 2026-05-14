# DyslexAI — AI-Powered Dyslexia Support System

DyslexAI is an AI-powered assistive learning platform designed to help dyslexic learners improve handwriting, spelling, and writing skills through intelligent handwriting recognition, correction, and personalized feedback.

The system combines hybrid OCR, transformer-based text correction, adaptive learning, and gamified exercises to provide an accessible and engaging educational experience for students, teachers, and parents.

---

## ✨ Features

* 🧠 Hybrid OCR pipeline for dyslexic handwriting recognition
* ✍️ AI-powered text correction using transformer models
* 🔍 Dyslexia-specific error detection and highlighting
* 📈 Personalized learner profiles and adaptive feedback
* 🎮 Gamified exercises with points, badges, and progress tracking
* 📊 Analytics dashboard with accuracy and improvement metrics
* 🌐 Web and mobile accessibility
* ♿ Dyslexia-friendly UI and accessibility-focused design
* 🧪 Experimental dyslexia detection module

---

## 🏗️ System Architecture

```text
Handwritten Image
        │
        ▼
Image Preprocessing (OpenCV)
        │
        ▼
Hybrid OCR Pipeline
(Character-Level + Word-Level)
        │
        ▼
Text Reconstruction
        │
        ▼
AI Correction Module (Seq2Seq / T5)
        │
        ▼
Error Highlighting + Feedback
        │
        ▼
Adaptive Learning Engine
        │
        ▼
Dashboard & Gamified Exercises
```

---

## 🧠 Core Modules

### 1. Handwriting Recognition

* Character-level and word-level OCR fusion
* Handles dyslexia-specific distortions and reversals
* Image preprocessing and segmentation using OpenCV

### 2. Error Detection & Correction

* Detects spacing issues, phonetic spelling errors, and reversals
* Transformer-based correction pipeline using seq2seq models
* Context-aware corrections while preserving intended meaning

### 3. Adaptive Personalization

* Learner-specific error profiling
* Dynamic difficulty adjustment
* Personalized recommendations and exercises

### 4. Gamification

* Tracing and rewriting exercises
* Rewards, badges, levels, and progress milestones
* Engagement-focused learning workflow

### 5. Dashboard & Analytics

* Accuracy tracking
* Error trend visualization
* Learner progress monitoring for parents and teachers

---

## 🛠️ Tech Stack

### AI / Machine Learning

* Python
* TensorFlow / PyTorch
* OpenCV
* Scikit-learn
* Hugging Face Transformers

### Backend

* FastAPI / Django
* Firebase / SQL

### Frontend

* React.js
* Tailwind CSS
* Chart.js

### Deployment

* Docker
* Firebase / AWS

---

## 📂 Project Structure

```bash
DyslexAI/
│
├── backend/
│   ├── api/
│   ├── models/
│   ├── ocr/
│   ├── correction/
│   └── personalization/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   └── dashboard/
│
├── mobile/
│
├── datasets/
│
├── notebooks/
│
├── docs/
│
└── README.md
```

---

## 🚀 Installation

### Clone the Repository

```bash
git clone https://github.com/your-username/DyslexAI.git
cd DyslexAI
```

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 📊 Evaluation Metrics

The system is evaluated using:

* Character Error Rate (CER)
* Word Error Rate (WER)
* OCR Accuracy
* Correction Accuracy
* User Improvement Trends
* Engagement Metrics

---

## 🎯 Objectives

* Improve recognition accuracy for dyslexic handwriting
* Provide explainable and personalized writing feedback
* Reduce repetitive spelling and handwriting mistakes
* Encourage learning through adaptive exercises and gamification
* Create an accessible educational support system

---

## 🔮 Future Work

* Multilingual handwriting support (e.g., Urdu)
* Real-time stylus/tablet handwriting input
* Advanced dyslexia detection using eye tracking
* LMS integration for schools and institutions
* Large-scale educational deployment

---

## 👥 Team

* **Syed Abdur Rahman Grami**
* **Abubakar Shahid**
* **Muhammad Ali Zaib**

### Supervisor

* Dr. Hasan Mujtaba

### Co-Supervisor

* Ms. Saira Qamar

---

## 📜 License

This project is developed for academic and research purposes as part of a Final Year Project (FYP).

---

## ⭐ Acknowledgements

* International Dyslexia Association
* British Dyslexia Association
* Hugging Face
* OpenCV Community
* FAST NUCES Islamabad
