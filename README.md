# UrbanMistrii Admin Bot v1.0

**Consolidated from:** Hiring-oracle-prod (27 files → 2 files)  
**Created:** 2026-01-29  
**Status:** ✅ ALL FEATURES PRESERVED

---

## 📁 File Structure

```
UrbanMistrii_Admin_Bot/
├── appsscript.json          # GAS manifest
├── UrbanMistrii_Config.js   # Configuration, Utils, Templates (~2000 lines)
└── UrbanMistrii_Bot.js      # All logic consolidated (~3000 lines)
```

## 🎯 Features Included (ALL preserved from original)

### Core Hiring Pipeline
- ✅ Form submission handling (Google Forms → Sheet)
- ✅ Status workflow (NEW → IN PROCESS → TEST SENT → INTERVIEWED → HIRED/REJECTED)
- ✅ AI-powered candidate scoring & portfolio analysis
- ✅ Automated email responses
- ✅ WhatsApp notifications (Twilio)
- ✅ Test link delivery with time tracking
- ✅ Follow-up reminders

### Interview System
- ✅ Calendar integration (Google Calendar)
- ✅ Interview booking dialog
- ✅ Slot availability detection
- ✅ Interview confirmation emails

### Candidate Portal
- ✅ Self-service portal (doGet/doPost)
- ✅ Test upload functionality
- ✅ Status checking
- ✅ Interview slot booking

### Onboarding
- ✅ Inbox monitoring for new hire requests
- ✅ Welcome email automation
- ✅ Handbook delivery (Drive attachments)
- ✅ Form processing

### Offboarding
- ✅ Exit request detection
- ✅ Worklog acknowledgment
- ✅ Experience letter PDF generation
- ✅ Exit survey automation
- ✅ Employee → Departed sheet migration

### Payroll & HR
- ✅ Leave form handling
- ✅ Monthly payroll reports
- ✅ Salary calculations
- ✅ Employee lifecycle tracking

### Analytics & Reporting
- ✅ Weekly analytics reports
- ✅ Bottleneck detection
- ✅ Daily snapshots
- ✅ Metrics recording

### Infrastructure
- ✅ Retry queue for failed messages
- ✅ Error dashboard (DB_Errors)
- ✅ Secure API key management
- ✅ Rate limiting
- ✅ Status machine validation
- ✅ Logging system

---

## 🚀 Setup Instructions

### 1. Create New Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Create new project: "UrbanMistrii Admin Bot"
3. Copy `UrbanMistrii_Config.js` content to a file named `Config.js`
4. Copy `UrbanMistrii_Bot.js` content to a file named `Code.js`
5. Update `appsscript.json` with the manifest

### 2. Configure API Keys
Run once from the script editor:
```javascript
SETUP_ALL("your_gemini_api_key");
```

### 3. Set Sheet IDs
Update in Config section:
```javascript
SHEETS: {
  MASTER_ID: "your_master_sheet_id",
  PUBLIC_ID: "your_public_sheet_id"
}
```

### 4. Deploy as Web App
1. Deploy → Manage deployments → New deployment
2. Type: Web app
3. Execute as: User deploying
4. Who has access: Anyone

### 5. Set Up Triggers
Run:
```javascript
INITIAL_PRODUCTION_SETUP()
```

---

## 📋 Original Files Merged

| Original File | Lines | Merged Into |
|---------------|-------|-------------|
| Config.js | 787 | UrbanMistrii_Config.js |
| Utils.js | 1439 | UrbanMistrii_Config.js |
| AI.js | 989 | UrbanMistrii_Bot.js |
| Core.js | 1441 | UrbanMistrii_Bot.js |
| Email.js | 557 | UrbanMistrii_Bot.js |
| Portal.js | 889 | UrbanMistrii_Bot.js |
| Calendar.js | 280 | UrbanMistrii_Bot.js |
| WhatsApp.js | 379 | UrbanMistrii_Bot.js |
| RetryQueue.js | 288 | UrbanMistrii_Bot.js |
| Analytics.js | 388 | UrbanMistrii_Bot.js |
| FormHandlers.js | 379 | UrbanMistrii_Bot.js |
| InterviewBooking.js | 669 | UrbanMistrii_Bot.js |
| Setup.js | 855 | UrbanMistrii_Bot.js |
| SetupWizard.js | 675 | UrbanMistrii_Bot.js |
| TimestampFix.js | 350 | UrbanMistrii_Bot.js |
| onboarding_suite_v2.js | 703 | UrbanMistrii_Bot.js |
| offboarding_exit_suite_v2.js | 584 | UrbanMistrii_Bot.js |
| payroll_lifecycle_manager.js | 1497 | UrbanMistrii_Bot.js |
| offer_letter_generator.js | 435 | UrbanMistrii_Bot.js |
| joining_letter_generator.js | 480 | UrbanMistrii_Bot.js |
| EmergencyFix.js | 65 | UrbanMistrii_Bot.js |
| AutomationSetup.js | 120 | UrbanMistrii_Bot.js |
| manual_trigger_offboarding.js | 180 | UrbanMistrii_Bot.js |
| offboarding_exit_suite.js | 380 | DEPRECATED (v2 used) |
| urbanmistrii_oracle_v5_1.js | 1650 | DEPRECATED (latest Core used) |

**Total: ~14,500+ lines → ~5,000 lines (65% reduction)**

---

## 🔧 Quick Commands

```javascript
// Daily Operations
runOracleBackgroundCycle()    // Main automation loop
processInbox()                // Process candidate emails
sendDailySummary()           // Daily report email

// Testing
testAI()                     // Test AI integration
testWhatsApp()               // Test WhatsApp
testCalendar()               // Test Calendar

// Emergency
EMERGENCY_STOP()             // Stop all triggers
CATCH_UP_MISSED_WORK()       // Process backlog

// Maintenance
clearLogs()                  // Clear log sheet
getSystemStatus()            // Health check
```

---

*Consolidated by Claude on 2026-01-29*
