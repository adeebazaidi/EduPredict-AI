import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

app = Flask(__name__)
CORS(app)

# ─── Load Model ───────────────────────────────────────────────────────────────
def load_model():
    try:
        return joblib.load('model.pkl')
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

model_payload = load_model()

@app.route('/model-info', methods=['GET'])
def get_model_info():
    if not model_payload:
        return jsonify({'error': 'Model not loaded'}), 500
    
    clf = model_payload['model']
    importances = clf.feature_importances_
    names = model_payload['user_feature_names']
    
    return jsonify({
        'accuracy': model_payload['accuracy'],
        'feature_importances': dict(zip(names, importances))
    })

def get_recommendations(pred_class, attendance, study_hours, assignment_avg, midterm_score, quiz_avg):
    suggestions = []
    
    if pred_class in ['Excellent', 'Good']:
        if attendance < 90:
            suggestions.append({"category": "Attendance", "priority": "Medium", "text": f"You are on track for a {pred_class} rating, but increasing attendance above 90% ensures you won't miss advanced topics."})
        if assignment_avg < 85:
            suggestions.append({"category": "Coursework", "priority": "Low", "text": "To guarantee your top-tier standing, ensure your assignment average stays above 85%."})
    
    elif pred_class == 'Average':
        if attendance < 75:
            suggestions.append({"category": "Attendance", "priority": "High", "text": "You are passing, but missing classes is dragging you down. Aim for 80%+ attendance."})
        if midterm_score < 60:
            suggestions.append({"category": "Exam Prep", "priority": "High", "text": "An Average trajectory often stems from core concept gaps. Review midterm mistakes heavily."})
        if quiz_avg < 60:
            suggestions.append({"category": "Quizzes", "priority": "Medium", "text": "Quiz scores are low. Focus on continuous, smaller review sessions instead of cramming."})
            
    elif pred_class == 'Poor':
        if attendance < 60:
            suggestions.append({"category": "Attendance", "priority": "High", "text": f"Critical Risk ({pred_class}): Immediate attendance intervention is required."})
        if study_hours < 10:
            suggestions.append({"category": "Study Habits", "priority": "High", "text": "A massive increase in study hours is needed to catch up on missed concepts."})
        if assignment_avg < 50:
            suggestions.append({"category": "Coursework", "priority": "High", "text": "Failing daily coursework is destroying your grade. All future assignments must be completed."})
        
        if len(suggestions) == 0:
            suggestions.append({"category": "Academic Support", "priority": "High", "text": "Schedule an immediate meeting with your instructor to create a recovery plan."})
    
    if len(suggestions) == 0 and pred_class in ['Excellent', 'Good']:
        suggestions.append({"category": "All Clear", "priority": "Low", "text": "Excellent standing across all metrics. Maintain your current routine."})
        
    return suggestions

@app.route('/predict', methods=['POST'])
def predict():
    if not model_payload:
        return jsonify({'error': 'Model not loaded'}), 500

    try:
        data = request.json
        
        # ── Parse incoming JSON ───────────────────────────────────────────────
        attendance          = float(data.get('attendance', 80))
        study_hours         = float(data.get('study_hours', 15))
        assignment_avg      = float(data.get('assignments', 75))
        midterm_score       = float(data.get('midterm_score', 75))
        quiz_avg            = float(data.get('quiz_avg', 75))

        clf          = model_payload['model']
        feature_cols = model_payload['feature_cols']

        input_df = pd.DataFrame([{
            'Attendance (%)':        attendance,
            'Study_Hours_per_Week':  study_hours,
            'Assignments_Avg':       assignment_avg,
            'Midterm_Score':         midterm_score,
            'Quizzes_Avg':           quiz_avg
        }])[feature_cols]

        pred_class = clf.predict(input_df)[0]
        
        suggestions = get_recommendations(pred_class, attendance, study_hours, assignment_avg, midterm_score, quiz_avg)

        return jsonify({
            'prediction': str(pred_class),
            'suggestions': suggestions
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

import io

@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    if not model_payload:
        return jsonify({'error': 'Model not loaded'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No CSV file uploaded'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Invalid file type. Please upload a CSV file.'}), 400

    try:
        # Read CSV
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        df = pd.read_csv(stream)
        
        # Required columns check
        required_cols = ['Student_ID', 'Attendance (%)', 'Study_Hours_per_Week', 'Assignments_Avg', 'Midterm_Score', 'Quizzes_Avg']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_cols)}'}), 400
            
        clf = model_payload['model']
        feature_cols = model_payload['feature_cols']
        
        # Extract features and predict
        input_df = df[feature_cols].copy()
        
        # Fill any missing values with 0 to prevent errors
        input_df = input_df.fillna(0)
        
        predictions = clf.predict(input_df)
        
        results = []
        summary = {
            'Total': len(df),
            'Excellent': 0,
            'Good': 0,
            'Average': 0,
            'Poor': 0,
            'Needing Attention': 0
        }
        
        for i, row in df.iterrows():
            pred_class = predictions[i]
            
            attendance = float(row.get('Attendance (%)', 0))
            study_hours = float(row.get('Study_Hours_per_Week', 0))
            assignment_avg = float(row.get('Assignments_Avg', 0))
            midterm_score = float(row.get('Midterm_Score', 0))
            quiz_avg = float(row.get('Quizzes_Avg', 0))
            
            suggestions = get_recommendations(pred_class, attendance, study_hours, assignment_avg, midterm_score, quiz_avg)
            
            top_recommendation = suggestions[0] if len(suggestions) > 0 else {"text": "Maintain current routine.", "priority": "Low", "category": "All Clear"}
            
            results.append({
                'Student_ID': str(row.get('Student_ID', f'Row {i+1}')),
                'Prediction': str(pred_class),
                'Recommendation': top_recommendation
            })
            
            summary[pred_class] += 1
            if pred_class == 'Poor':
                summary['Needing Attention'] += 1
                
        return jsonify({
            'summary': summary,
            'results': results
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
