# AI Assessment Extraction & Evaluation App

An AI-powered assessment processing application that extracts questions and handwritten/student answers from PDF documents, maps answers to questions, evaluates them using AI, and presents the assessment results through a web interface.

## 🚀 Live Demo

### Frontend
https://ai-assessment-extraction-app.vercel.app

### Backend API
https://ai-assessment-extraction-app-production-3060.up.railway.app

### Health Check
https://ai-assessment-extraction-app-production-3060.up.railway.app/api/health

---

## 📌 Overview

The AI Assessment Extraction & Evaluation App automates the process of evaluating student answer sheets.

The application accepts:

- A question paper PDF
- A student's answer sheet PDF

The backend processes the documents through an AI-assisted pipeline:

```text
Question Paper PDF
        │
        ▼
Question Extraction
        │
        ▼
Question Data
        │
        │
        ├──────────────────────┐
        │                      │
        ▼                      ▼
Answer Sheet PDF        Question Mapping
        │                      │
        ▼                      │
Answer Extraction              │
        │                      │
        └──────────┬───────────┘
                   ▼
             Answer Mapping
                   │
                   ▼
             AI Evaluation
                   │
                   ▼
            Grading / Results
                   │
                   ▼
             Frontend UI
