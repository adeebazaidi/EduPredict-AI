import { useState, useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import './index.css'

const API_BASE = 'http://127.0.0.1:5000'

function App() {
  const [modelMeta, setModelMeta]       = useState(null)
  const [modelError, setModelError]     = useState(false)

  const [formData, setFormData] = useState({
    attendance: 80,
    study_hours: 15,
    assignments: 75,
    midterm_score: 75,
    quiz_avg: 75
  })

  const [activeTab, setActiveTab]           = useState('single')
  const [batchFile, setBatchFile]           = useState(null)
  const [batchData, setBatchData]           = useState(null)
  const [viewState, setViewState]           = useState('placeholder')
  const [loaderInfo, setLoaderInfo]         = useState({ progress: 0, text: 'Consulting AI Model...', sub: 'Connecting to Flask backend' })
  const [predictionData, setPredictionData] = useState(null)

  const radarChartRef      = useRef(null)
  const importanceChartRef = useRef(null)
  const batchChartRef      = useRef(null)
  const radarChartInstance = useRef(null)
  const importanceInstance = useRef(null)
  const batchChartInstance = useRef(null)
  const debounceTimer      = useRef(null)

  useEffect(() => {
    fetchModelMeta()
  }, [])

  const fetchModelMeta = async () => {
    try {
      const res = await fetch(`${API_BASE}/model-info`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setModelMeta(await res.json())
    } catch {
      setModelError(true)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => {
      return { ...prev, [name]: type === 'range' ? parseFloat(value) : value }
    })
  }

  const animateLoader = (duration) =>
    new Promise(resolve => {
      const steps = [
        { progress: 0,   text: 'Consulting AI Model...',        sub: 'Establishing connection to Flask backend' },
        { progress: 25,  text: 'Extracting student features...', sub: 'Scaling and preprocessing inputs' },
        { progress: 65,  text: 'Running decision tree ensembles...', sub: 'Evaluating Random Forest Classifier' },
        { progress: 90,  text: 'Compiling personalized strategies...', sub: 'Structuring recommendations' },
        { progress: 100, text: 'Finalizing insights...',          sub: 'Generating charts' }
      ]
      let start = null
      const tick = (ts) => {
        if (!start) start = ts
        const ratio = Math.min((ts - start) / duration, 1)
        const pct   = ratio * 100
        const step  = steps.reduce((p, c) => pct >= c.progress ? c : p)
        setLoaderInfo({ progress: pct, text: step.text, sub: step.sub })
        if (ratio < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })

  const runPrediction = async (data, silent = false) => {
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        if (!silent) alert(`Error: ${err.error || 'Prediction failed'}`)
        setViewState('placeholder')
        return
      }
      setPredictionData(await res.json())
      setViewState('results')
    } catch (e) {
      console.error('Prediction error:', e)
      if (!silent) {
        alert('Cannot reach Flask backend. Make sure python app.py is running on port 5000.')
        setViewState('placeholder')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setViewState('loader')
    await animateLoader(1000)
    await runPrediction(formData)
  }

  const handleBatchSubmit = async (e) => {
    e.preventDefault()
    if (!batchFile) {
      alert("Please select a CSV file first.")
      return
    }
    setViewState('loader')
    await animateLoader(1500)
    
    const fd = new FormData()
    fd.append('file', batchFile)

    try {
      const res = await fetch(`${API_BASE}/predict-batch`, {
        method: 'POST',
        body: fd
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Error: ${err.error || 'Batch prediction failed'}`)
        setViewState('placeholder')
        return
      }
      setBatchData(await res.json())
      setViewState('batch-results')
    } catch (e) {
      console.error('Batch Prediction error:', e)
      alert('Cannot reach Flask backend.')
      setViewState('placeholder')
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Student_ID,Attendance (%),Study_Hours_per_Week,Assignments_Avg,Midterm_Score,Quizzes_Avg\nS001,80,15,75,75,75"
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "EduPredict_Batch_Template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    if (viewState === 'results' && predictionData) {
      drawRadarChart()
      if (modelMeta?.feature_importances) drawImportanceChart()
    } else if (viewState === 'batch-results' && batchData) {
      drawBatchChart()
    }
  }, [viewState, predictionData, modelMeta, formData, batchData])

  const drawBatchChart = () => {
    if (!batchChartRef.current) return
    const ctx = batchChartRef.current.getContext('2d')
    
    batchChartInstance.current?.destroy()
    batchChartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Excellent', 'Good', 'Average', 'Poor'],
        datasets: [{
          data: [
            batchData.summary.Excellent,
            batchData.summary.Good,
            batchData.summary.Average,
            batchData.summary.Poor
          ],
          backgroundColor: [
            '#065758',
            '#628d3d',
            '#c49a60',
            '#c46960'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    })
  }

  const drawRadarChart = () => {
    if (!radarChartRef.current) return
    const ctx = radarChartRef.current.getContext('2d')

    const { attendance, study_hours, assignments, midterm_score, quiz_avg } = formData
    const studentData   = [
      attendance,
      (study_hours / 30) * 100, // normalize 0-30 to 0-100
      assignments,
      midterm_score,
      quiz_avg
    ]
    const benchmarkData = [80, 50, 70, 70, 70] // Average benchmarks

    radarChartInstance.current?.destroy()
    radarChartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Attendance', 'Study Hours', 'Assignment Avg', 'Midterm Score', 'Quiz Avg'],
        datasets: [
          {
            label: 'Current Student',
            data: studentData,
            backgroundColor: 'rgba(6, 87, 88, 0.2)', // Deep Teal
            borderColor: 'rgba(6, 87, 88, 0.85)',
            borderWidth: 2,
            pointBackgroundColor: '#065758',
            pointBorderColor: '#fff'
          },
          {
            label: 'Class Average Benchmark',
            data: benchmarkData,
            backgroundColor: 'rgba(98, 141, 61, 0.05)', // Forest Green
            borderColor: 'rgba(98, 141, 61, 0.3)',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointBackgroundColor: 'rgba(98, 141, 61, 0.4)',
            pointBorderColor: '#fff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#665048', font: { family: 'Plus Jakarta Sans', size: 10 } }
          }
        },
        scales: {
          r: {
            angleLines: { color: 'rgba(102, 80, 72, 0.1)' },
            grid: { color: 'rgba(102, 80, 72, 0.1)' },
            pointLabels: { color: '#665048', font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' } },
            ticks: { display: false, maxTicksLimit: 4 },
            min: 0,
            max: 100
          }
        }
      }
    })
  }

  const drawImportanceChart = () => {
    if (!importanceChartRef.current) return
    const ctx    = importanceChartRef.current.getContext('2d')
    const sorted = Object.entries(modelMeta.feature_importances).sort((a, b) => b[1] - a[1])
    const labels = sorted.map(([k]) => k)
    const vals   = sorted.map(([, v]) => v * 100)

    const grad = ctx.createLinearGradient(0, 0, 300, 0)
    grad.addColorStop(0, 'rgba(6, 87, 88, 0.8)')
    grad.addColorStop(1, 'rgba(98, 141, 61, 0.8)')

    importanceInstance.current?.destroy()
    importanceInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Contribution Influence (%)',
          data: vals,
          backgroundColor: grad,
          borderColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (context) => ` ${context.parsed.x.toFixed(1)}%` } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(102, 80, 72, 0.05)' },
            ticks: { color: '#7f6e67', font: { family: 'Plus Jakarta Sans', size: 9 }, callback: (val) => `${val}%` },
            max: Math.ceil(Math.max(...vals) / 10) * 10 + 5
          },
          y: {
            grid: { display: false },
            ticks: { color: '#665048', font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' } }
          }
        }
      }
    })
  }

  const getPredictionCardClass = () => {
    if (!predictionData) return 'card prediction-card'
    if (['Excellent', 'Good'].includes(predictionData.prediction)) return 'card prediction-card pred-card-excellent'
    if (predictionData.prediction === 'Average') return 'card prediction-card pred-card-average'
    return 'card prediction-card pred-card-needs-improvement'
  }

  const getPredictionDesc = () => {
    if (!predictionData) return ''
    switch(predictionData.prediction) {
      case 'Excellent': return "Exceptional academic mastery. The student displays perfect discipline and consistency."
      case 'Good': return "Strong academic standing. The student is performing well above average across most metrics."
      case 'Average': return "Average progress. The student is meeting baseline expectations but has significant room for growth."
      case 'Poor': return "Poor status. Immediate, comprehensive intervention is required to salvage academic standing."
      default: return ""
    }
  }

  const getIconClassForCategory = (catStr) => {
    const cat = catStr.toLowerCase()
    if (cat.includes('study')) return 'ri-book-open-line'
    if (cat.includes('attend')) return 'ri-calendar-check-line'
    if (cat.includes('acad') || cat.includes('score') || cat.includes('exam')) return 'ri-award-line'
    if (cat.includes('coursework')) return 'ri-draft-line'
    if (cat.includes('engage') || cat.includes('particip')) return 'ri-discuss-line'
    return 'ri-sparkling-line'
  }

  return (
    <>
      <div className="mesh-gradient mesh-1"></div>
      <div className="mesh-gradient mesh-2"></div>
      <div className="mesh-gradient mesh-3"></div>

      <div className="app-container">
        <header className="app-header">
          <div className="logo-area">
            <div className="logo-icon">
              <i className="ri-brain-line"></i>
            </div>
            <div>
              <h1>EduPredict <span className="gradient-text">AI</span></h1>
              <p className="subtitle">Student Performance Prediction &amp; Analytics Dashboard</p>
            </div>
          </div>
          <div className="header-badges">
            <span className="badge badge-accent">
              <i className="ri-cpu-line"></i> Random Forest Classifier
            </span>
          </div>
        </header>

        <main className="dashboard-grid">
          <section className="card input-card">
            <div className="card-header" style={{flexDirection: 'column', alignItems: 'stretch', gap: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                <i className="ri-equalizer-line text-purple"></i>
                <h2>Student Parameters</h2>
              </div>
              <div className="tabs-container">
                <button 
                  className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('single'); setViewState(predictionData ? 'results' : 'placeholder'); }}
                >
                  <i className="ri-user-line"></i> Single Student
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'batch' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('batch'); setViewState(batchData ? 'batch-results' : 'placeholder'); }}
                >
                  <i className="ri-group-line"></i> Batch Prediction
                </button>
              </div>
            </div>

            {activeTab === 'single' ? (
            <form id="prediction-form" className="prediction-form" onSubmit={handleSubmit}>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="attendance">
                    <i className="ri-calendar-check-line"></i> Attendance (%)
                  </label>
                  <span className="value-bubble">{formData.attendance.toFixed(0)}%</span>
                </div>
                <input type="range" id="attendance" name="attendance" min="0" max="100" step="1"
                  value={formData.attendance} onChange={handleInputChange} className="slider" />
                <div className="slider-ticks"><span>0%</span><span>50%</span><span>100%</span></div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="study_hours">
                    <i className="ri-book-open-line"></i> Study Hours / Week
                  </label>
                  <span className="value-bubble">{formData.study_hours.toFixed(1)} hrs</span>
                </div>
                <input type="range" id="study_hours" name="study_hours" min="0" max="30" step="0.5"
                  value={formData.study_hours} onChange={handleInputChange} className="slider" />
                <div className="slider-ticks"><span>0 hr</span><span>15 hrs</span><span>30 hrs</span></div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="assignments">
                    <i className="ri-draft-line"></i> Assignment Average
                  </label>
                  <span className="value-bubble">{formData.assignments.toFixed(0)}</span>
                </div>
                <input type="range" id="assignments" name="assignments" min="0" max="100" step="1"
                  value={formData.assignments} onChange={handleInputChange} className="slider" />
                <div className="slider-ticks"><span>0</span><span>50</span><span>100</span></div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="midterm_score">
                    <i className="ri-award-line"></i> Midterm Score
                  </label>
                  <span className="value-bubble">{formData.midterm_score.toFixed(0)}</span>
                </div>
                <input type="range" id="midterm_score" name="midterm_score" min="0" max="100" step="1"
                  value={formData.midterm_score} onChange={handleInputChange} className="slider" />
                <div className="slider-ticks"><span>0</span><span>50</span><span>100</span></div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="quiz_avg">
                    <i className="ri-file-list-3-line"></i> Quiz Average
                  </label>
                  <span className="value-bubble">{formData.quiz_avg.toFixed(0)}</span>
                </div>
                <input type="range" id="quiz_avg" name="quiz_avg" min="0" max="100" step="1"
                  value={formData.quiz_avg} onChange={handleInputChange} className="slider" />
                <div className="slider-ticks"><span>0</span><span>50</span><span>100</span></div>
              </div>

              <button type="submit" className="btn btn-primary" id="predict-btn">
                <i className="ri-terminal-window-line"></i>
                <span>Generate Analytics</span>
                <div className="btn-glow"></div>
              </button>
            </form>
            ) : (
              <form className="prediction-form" onSubmit={handleBatchSubmit}>
                <div className="upload-container">
                  <div className="upload-box">
                    <i className="ri-upload-cloud-2-line" style={{fontSize: '3rem', color: 'var(--accent-glow)'}}></i>
                    <h4>Upload Class Data</h4>
                    <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>Upload a CSV containing student information and the required performance features.</p>
                    <input type="file" accept=".csv" onChange={e => setBatchFile(e.target.files[0])} />
                  </div>
                  {batchFile && <p className="file-name"><i className="ri-file-text-line"></i> {batchFile.name}</p>}
                </div>
                
                <button type="button" className="btn btn-outline" onClick={handleDownloadTemplate} style={{marginTop: '0.5rem'}}>
                  <i className="ri-download-line"></i> Download CSV Template
                </button>

                <button type="submit" className="btn btn-primary" style={{marginTop: '0.5rem'}}>
                  <i className="ri-terminal-window-line"></i>
                  <span>Analyze Class</span>
                  <div className="btn-glow"></div>
                </button>
              </form>
            )}
          </section>

          <section className="insights-container">
            {viewState === 'placeholder' && (
              <div className="card placeholder-card" id="placeholder-view">
                <div className="placeholder-content">
                  <div className="pulsing-radar">
                    <i className="ri-radar-line text-purple"></i>
                    <div className="pulse-ring"></div>
                  </div>
                  <h3>Awaiting Predictive Metrics</h3>
                  <p>Configure student parameters on the left and click <strong>Generate Analytics</strong> to get detailed feedback.</p>
                  <div className="feature-bullets">
                    <div className="bullet-item"><i className="ri-sparkling-2-line"></i> AI Random Forest Decision trees</div>
                    <div className="bullet-item"><i className="ri-git-branch-line"></i> Feature Contribution Weighting</div>
                    <div className="bullet-item"><i className="ri-checkbox-circle-fill"></i> Robust Student Dataset</div>
                  </div>
                </div>
              </div>
            )}

            {viewState === 'loader' && (
              <div className="card loader-card" id="loader-view">
                <div className="loader-content">
                  <div className="spinner-container">
                    <svg className="spinner" viewBox="0 0 50 50">
                      <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                    </svg>
                  </div>
                  <h3>{loaderInfo.text}</h3>
                  <p>{loaderInfo.sub}</p>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${loaderInfo.progress}%` }}></div>
                  </div>
                </div>
              </div>
            )}

            {viewState === 'results' && predictionData && (
              <div className="results-dashboard" id="results-view">
                <div className="results-row-1">
                  <div className={getPredictionCardClass()}>
                    <div className="card-header-compact">
                      <span className="label-muted">PREDICTED PERFORMANCE</span>
                      <i className="ri-pulse-line header-icon"></i>
                    </div>
                    <div className="pred-main-display">
                      <span className="pred-text">{predictionData.prediction}</span>
                      <p className="pred-desc">{getPredictionDesc()}</p>
                    </div>
                  </div>


                </div>

                <div className="results-row-2">
                  <div className="card chart-card">
                    <div className="card-header">
                      <i className="ri-radar-chart-line text-purple"></i>
                      <h3>Student Profile Metrics</h3>
                    </div>
                    <div className="chart-container">
                      <canvas ref={radarChartRef}></canvas>
                    </div>
                  </div>

                  <div className="card chart-card">
                    <div className="card-header">
                      <i className="ri-bar-chart-2-line text-blue"></i>
                      <h3>Global Factor Importances</h3>
                    </div>
                    <div className="chart-container">
                      <canvas ref={importanceChartRef}></canvas>
                    </div>
                  </div>
                </div>

                <div className="card suggestions-card">
                  <div className="card-header">
                    <i className="ri-lightbulb-line text-gold"></i>
                    <h3>Personalized Improvement Strategy</h3>
                  </div>
                  <p className="card-description">Actionable instructions compiled by analyzing parameters:</p>
                  <div className="suggestions-list">
                    {predictionData.suggestions.length === 0 ? (
                      <div className="suggestion-item suggest-low">
                        <div className="suggestion-icon"><i className="ri-checkbox-circle-fill"></i></div>
                        <div className="suggestion-content">
                          <span className="suggestion-category">All Clear</span>
                          <span className="suggestion-text">Student parameters are balanced and meeting all recommendations. Keep it up!</span>
                        </div>
                      </div>
                    ) : (
                      predictionData.suggestions.map((item, idx) => (
                        <div key={idx} className={`suggestion-item suggest-${item.priority.toLowerCase()}`}>
                          <div className="suggestion-icon">
                            <i className={getIconClassForCategory(item.category)}></i>
                          </div>
                          <div className="suggestion-content">
                            <span className="suggestion-category">{item.category} • {item.priority} priority</span>
                            <span className="suggestion-text">{item.text}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {viewState === 'batch-results' && batchData && (
              <div className="results-dashboard">
                <div className="results-row-1" style={{gridTemplateColumns: '1fr 1fr'}}>
                  <div className="card prediction-card">
                    <div className="card-header-compact">
                      <span className="label-muted">CLASS SUMMARY</span>
                      <i className="ri-group-line header-icon"></i>
                    </div>
                    <div className="class-summary-stats" style={{marginTop: '0.5rem'}}>
                      <div className="stat-row"><span>Total Students:</span> <strong>{batchData.summary.Total}</strong></div>
                      <div className="stat-row" style={{color: 'var(--excellent)'}}><span>Excellent:</span> <strong>{batchData.summary.Excellent}</strong></div>
                      <div className="stat-row" style={{color: 'var(--average)'}}><span>Good:</span> <strong>{batchData.summary.Good}</strong></div>
                      <div className="stat-row" style={{color: '#c49a60'}}><span>Average:</span> <strong>{batchData.summary.Average}</strong></div>
                      <div className="stat-row" style={{color: 'var(--needs-improvement)'}}><span>Poor:</span> <strong>{batchData.summary.Poor}</strong></div>
                      
                      <div className="stat-highlight" style={{marginTop: '1rem', padding: '0.5rem', background: 'rgba(196,105,96,0.1)', borderRadius: '8px', color: 'var(--needs-improvement)'}}>
                        <i className="ri-alert-line"></i> <strong>Students Needing Attention: {batchData.summary['Needing Attention']}</strong>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card chart-card">
                    <div className="card-header-compact">
                      <span className="label-muted">CLASS DISTRIBUTION</span>
                    </div>
                    <div className="chart-container" style={{height: '200px'}}>
                      <canvas ref={batchChartRef}></canvas>
                    </div>
                  </div>
                </div>
                
                <div className="card" style={{marginTop: '1rem', overflowX: 'auto', padding: '1.5rem'}}>
                  <div className="card-header-compact" style={{marginBottom: '1rem'}}>
                    <span className="label-muted">DETAILED RESULTS</span>
                  </div>
                  <table className="batch-results-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Predicted Performance</th>
                        <th>Top Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchData.results.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{r.Student_ID}</strong></td>
                          <td>
                            <span className={`badge ${r.Prediction === 'Excellent' || r.Prediction === 'Good' ? 'badge-success' : r.Prediction === 'Average' ? 'badge-warning' : 'badge-danger'}`} style={{display: 'inline-flex', width: 'max-content'}}>
                              {r.Prediction}
                            </span>
                          </td>
                          <td style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>{r.Recommendation.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  )
}

export default App
