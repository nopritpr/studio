#  Electron Drive: Transparent AI for EV Range Prediction

**A hybrid Electric Vehicle dashboard simulator combining deterministic physics and prompt-engineered Generative AI to deliver transparent, multi-factor range predictions and real-time driver insights.**
<img width="1034" height="825" alt="Screenshot 2025-12-29 135612" src="https://github.com/user-attachments/assets/731aca2e-f843-422c-970a-e5a1b40e9fc9" />
<img width="994" height="807" alt="Screenshot 2025-12-29 135626" src="https://github.com/user-attachments/assets/ffa7f45d-68c0-4670-a379-8eabd48ccf1b" />
<img width="1012" height="817" alt="Screenshot 2025-12-29 135638" src="https://github.com/user-attachments/assets/378daa13-a053-42f5-bf7e-48d3309e61ae" />

---

## Overview

**Electron Drive** addresses the biggest barrier in EV adoption — **range anxiety**.  
Most in-vehicle range estimators act as unreliable “guess-o-meters,” ignoring key factors such as ambient temperature, HVAC usage, drive mode, and payload.

This project demonstrates a **hybrid approach**:  
- A **60 Hz browser-based physics engine** handles traction, drag, and auxiliary power calculations.  
- A **prompt-engineered Generative AI (Gemini model via Genkit)** interprets context, forecasts impacts (like AC usage or weather), and offers actionable insights — **without custom model training**.

---

## Objectives

1. **Multi-Factor Range Prediction**  
   Compute energy consumption from first principles (speed, load, temperature, drive mode) and break down penalties visually.

2. **AI-Driven Insights**  
   Use Google Gemini LLM to create structured, explainable insights such as eco-driving scores, HVAC impact, and charging habits.

3. **Predictive Forecasting**  
   Combine deterministic and AI-powered forecasting for idle drain and 5-day weather-based range penalties.

4. **Cost & Sustainability Metrics**  
   Quantify financial savings, calculate CO₂ reduction, and align with **UN SDG 7, 11, and 13** goals.

---

## Methodology

| Component | Description |
|------------|-------------|
| **Real-Time Physics Engine** | Runs at 60 Hz using `requestAnimationFrame` to update energy and range dynamically based on drag, rolling resistance, HVAC load, and payload. |
| **Prompt-Engineered AI (Genkit)** | Executes asynchronous flow every few seconds; responses enforced via **Zod JSON schema validation** to prevent hallucinations. |
| **Firestore Database** | Stores `vehicle_state` snapshots and time-stamped `charging_logs` to support habit analytics and seamless simulation resume. |
| **Frontend** | Built in React/TypeScript with modular state management (`useVehicleState`), dynamic charts, and responsive design. |

---


## Impact

- **Economic:** Estimates up to **₹55,000 annual savings** per EV through optimized driving and energy efficiency.  
- **Environmental:** Reduces carbon emission by **≈ 2.3 t CO₂ per vehicle per year**.  
- **Behavioral:** Builds driver trust through **factor transparency** and explainable range intelligence.

---


## Installation & Setup

```bash
# Clone repository
git clone https://github.com/<your-username>/electron-drive.git
cd electron-drive

# Install dependencies
npm install

# Run local development server
npm run dev
