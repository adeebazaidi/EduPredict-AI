import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report, precision_score, recall_score, f1_score
import joblib
import os

def train_and_save_model(dataset_path="data/student_performance_dataset.csv"):
    print(f"Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)

    feature_cols = [
        'Attendance (%)',
        'Study_Hours_per_Week',
        'Assignments_Avg',
        'Midterm_Score',
        'Quizzes_Avg'
    ]

    user_feature_names = [
        'Attendance (%)',
        'Study Hours / Week',
        'Assignment Average',
        'Midterm Score',
        'Quiz Average'
    ]

    X = df[feature_cols]
    y = df['Student_Performance']  # Excellent, Good, Average, Poor

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("Training Random Forest (200 trees, balanced class weights)...")
    clf = RandomForestClassifier(n_estimators=200, class_weight='balanced', random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    
    print("\n" + "="*50)
    print(" MODEL EVALUATION (ON 20% UNSEEN TEST DATA)")
    print("="*50)
    
    acc = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='macro')
    recall = recall_score(y_test, y_pred, average='macro')
    f1 = f1_score(y_test, y_pred, average='macro')
    
    print(f"Accuracy:  {acc*100:.2f}%")
    print(f"Precision: {precision*100:.2f}%")
    print(f"Recall:    {recall*100:.2f}%")
    print(f"F1-Score:  {f1*100:.2f}%\n")
    
    labels = ['Excellent', 'Good', 'Average', 'Poor']
    
    print("Confusion Matrix:")
    print(pd.DataFrame(
        confusion_matrix(y_test, y_pred, labels=labels),
        index=[f"True {l}" for l in labels],
        columns=[f"Pred {l}" for l in labels]
    ))
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, labels=labels))
    print("="*50 + "\n")

    print("Leakage Check: Final_Score and Student_Performance were NOT used in training features X.")

    model_payload = {
        'model': clf,
        'feature_cols': feature_cols,
        'user_feature_names': user_feature_names,
        'accuracy': acc
    }
    
    joblib.dump(model_payload, 'model.pkl')
    print(f"model.pkl saved to {os.path.abspath('model.pkl')}")

if __name__ == "__main__":
    train_and_save_model()