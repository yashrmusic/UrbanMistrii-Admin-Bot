# UrbanMistrii Admin Bot

A production-ready Google Apps Script automation suite for hiring, candidate experience, onboarding, offboarding, and HR operations.

## Why This Script Is Valuable

- End-to-end hiring automation from form intake to final decision
- Candidate self-service portal with status and interview workflows
- AI-assisted scoring and communication flows
- WhatsApp + email orchestration for high response rates
- Built-in reporting, retry handling, and operational safeguards

## Business Outcomes

- Faster hiring response cycles
- Lower manual HR workload
- Better candidate communication consistency
- Stronger operational visibility through analytics

## Architecture Snapshot

- `Config.js`: central configuration, guardrails, utilities, secure key setup
- `Bot.js`: all workflow engines (hiring, portal, onboarding, offboarding, payroll, letters)
- `appsscript.json`: Apps Script manifest

## Core Modules Included

- Hiring pipeline automation
- Candidate portal (`doGet` / `doPost`)
- Interview scheduling and calendar integration
- Onboarding email and document flows
- Offboarding and experience-letter workflows
- Payroll and lifecycle reporting
- Webhook API actions
- Error recovery + retry queue

## Setup (Production)

1. Open this project in Google Apps Script.
2. Confirm IDs/URLs in `CONFIG` (sheet IDs, portal URL, form URLs).
3. Run:

```javascript
SETUP_ALL("your_gemini_api_key")
```

4. Run:

```javascript
INITIAL_PRODUCTION_SETUP()
```

5. Validate:

```javascript
TEST_COMPLETE_WORKFLOW()
```

## Operator Commands

```javascript
runOracleBackgroundCycle()     // Main automation cycle
processInbox()                 // Candidate email processing
sendDailySummary_()            // Daily analytics summary
GET_SYSTEM_STATUS()            // Health/status snapshot
EMERGENCY_STOP()               // Stop all automation triggers
```

## Positioning for Clients

This script is suitable for design studios, agencies, and SMB teams that need enterprise-style hiring and HR automation without building custom infrastructure. It combines AI assistance, workflow automation, and operational controls in one deployable Apps Script package.

---

If you are presenting this to clients, pair this README with a short demo showing:
- New candidate intake
- Automated response + status progression
- Portal interaction
- Daily summary report
