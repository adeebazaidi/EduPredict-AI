# EduPredict AI

**EduPredict AI** is a machine learning-powered analytics dashboard designed to predict student performance outcomes (Excellent, Satisfactory, or Needs Improvement) based on behavioral and academic inputs using a Random Forest Classifier. It provides real-time confidence scores and actionable suggestions.

## Technology Stack
- **Backend**: Python, Flask, Scikit-Learn
- **Frontend**: React, Vite, Chart.js

## Project Structure
- `app.py`: Flask REST API server
- `train_model.py`: Script to train the ML model
- **Attendance Percentage** (0-100%)
- **Study Hours per Week** (0-30 hours)
- **Assignment Average** (0-100)
- **Midterm Score** (0-100)
- **Quiz Average** (0-100)
- `Students Performance Dataset.csv`: Dataset used for training
- `frontend/`: React/Vite web application

## Setup Instructions

To run EduPredict AI, you need to start the backend and frontend simultaneously in separate terminals.

### 1. Start the Backend (Terminal 1)
1. Open a terminal in the root directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Train the model:
   ```bash
   python train_model.py
   ```
5. Start the Flask server (runs on port 5000):
   ```bash
   python app.py
   ```

### 2. Start the Frontend (Terminal 2)
1. Open a **new** terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
