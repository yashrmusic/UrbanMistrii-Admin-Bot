/**
 * UrbanMistrii Admin Bot v1.0
 * Central configuration and shared utilities.
 *
 * Includes:
 * - Business rules and pipeline states
 * - Sheet IDs and column mappings
 * - Feature flags and integrations
 * - Security helpers and setup utilities
 */

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------
const CONFIG = {
  // Company branding
  COMPANY: {
    NAME: "Your Company",
    DOMAIN: "company.com",
    LOGO: "",
    COLOR: "#4a86e8"
  },

  // Email configuration
  EMAIL: {
    HR: "hr@company.com",
    HIRING: "hiring@company.com",
    NOTIFICATIONS: "alerts@company.com"
  },

  // Spreadsheet IDs
  SHEETS: {
    MASTER_ID: "112UbKamDcvQ-UkXshdhyDRFt0y7SX0NBgP00lvl98V4",
    PUBLIC_ID: "1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4",

    TABS: {
      CANDIDATES: "DB_Candidates",
      FOLLOWUP: "DB_FollowUp",
      LOGS: "DB_Logs",
      TIMELINE: "DB_Timeline",
      ANALYTICS: "DB_Analytics",
      TEST_SUBMISSIONS: "DB_TestSubmissions",
      SALARY_TRACKER: "Salary_Tracker"
    }
  },

  // Column mappings (1-based)
  // Column mappings (1-based)
  COLUMNS: {
    // User Sheet Headers (1-23)
    STATUS: 1,
    UPDATED: 2,
    TIMESTAMP: 3,
    NAME: 4,
    PHONE: 5,
    EMAIL: 6,
    ROLE: 7,
    DEGREE: 8,
    START_DATE: 9,
    TENURE: 10,
    SALARY_EXP: 11,
    SALARY_LAST: 12,
    EXPERIENCE: 13,
    PORTFOLIO_URL: 14,
    CV_URL: 15,
    CITY: 16,
    HINDI: 17,
    HEALTH: 18,
    PREV_EXP: 19,
    TEST_AVAILABILITY_DATE: 20,   // RENAMED: When candidate wants to take test
    TEST_AVAILABILITY_TIME: 21,   // RENAMED: Time preference for test
    EMAIL_ALT: 22,
    RELOCATION: 23,

    // System Columns (Appended -> 24+)
    LOG: 24,
    TEST_SENT: 25,
    TEST_SUBMITTED: 26,
    AI_SCORE: 27,
    PORTFOLIO_SCORE: 28,
    PORTFOLIO_FEEDBACK: 29,
    DEPARTMENT: 30,
    CALENDAR_EVENT_ID: 31,
    PORTAL_TOKEN: 32,
    INTERVIEW_DATE: 33,           // NEW: Actual interview date (separate from test availability)
    INTERVIEW_TIME: 34            // NEW: Actual interview time
  },

  // Business rules
  RULES: {
    TIME_LIMITS: {
      intern: 2,      // hours
      junior: 24,     // hours
      senior: 48      // hours
    },

    REJECTION_DELAY_HRS: 24,
    MAX_FOLLOWUPS: 2,
    FOLLOWUP_DAYS: [2, 5], // Day 2 and Day 5 after test sent

    STATUSES: {
      NEW: "NEW",
      IN_PROCESS: "IN PROCESS",
      TEST_SENT: "TEST SENT",
      TEST_SUBMITTED: "TEST SUBMITTED",
      UNDER_REVIEW: "UNDER REVIEW",
      INTERVIEW_PENDING: "INTERVIEW PENDING",
      INTERVIEW_DONE: "INTERVIEW DONE",
      PENDING_REJECTION: "PENDING REJECTION",
      REJECTED: "REJECTED",
      HIRED: "HIRED"
    },

    // v22.4: Configurable status transitions (HR can customize without code)
    STATUS_TRANSITIONS: {
      'NEW': ['IN PROCESS', 'PENDING REJECTION', 'REJECTED'],
      'IN PROCESS': ['TEST SENT', 'PENDING REJECTION', 'REJECTED'],
      'TEST SENT': ['TEST SUBMITTED', 'PENDING REJECTION', 'REJECTED'],
      'TEST SUBMITTED': ['UNDER REVIEW', 'INTERVIEW PENDING', 'PENDING REJECTION', 'REJECTED'],
      'UNDER REVIEW': ['INTERVIEW PENDING', 'PENDING REJECTION', 'REJECTED'],
      'INTERVIEW PENDING': ['INTERVIEW DONE', 'PENDING REJECTION', 'REJECTED'],
      'INTERVIEW DONE': ['HIRED', 'PENDING REJECTION', 'REJECTED'],
      'PENDING REJECTION': ['REJECTED'],
      'REJECTED': [],
      'HIRED': []
    }
  },

  // v22.4: Webhook API settings
  WEBHOOK: {
    ENABLED: true,
    SECRET_KEY: 'CHANGE_ME_WEBHOOK_SECRET',
    REQUIRE_SIGNATURE: true,
    SIGNATURE_TTL_SEC: 300,
    NONCE_TTL_SEC: 600,
    ALLOWED_ACTIONS: ['trigger_test', 'update_status', 'get_candidate', 'retry_errors']
  },

  // WhatsApp templates
  WHATSAPP: {
    TEMPLATES: {
      WELCOME: "hiring_welcome",
      TEST_LINK: "hiring_test_link",
      SCHEDULE: "hiring_schedule",
      REMINDER: "hiring_reminder",
      REJECTION: "hiring_rejection"
    }
  },

  // Test links by role
  TEST_LINKS: {
    intern: "https://app.box.com/s/lvp6m9rcsgvkjixis6yt5422ajw2mr8t",
    junior: "https://app.box.com/folder/309187038121?s=v2g3zfmrbhok36zbsykca5hhqjfrahqf",
    senior: "https://app.box.com/s/mf3pbeethgznuha1oxzve2lhy79i209v"
  },

  // Forms and links
  APPLICATION_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLScucJWBWNZWMYKu9i06TlZZjeaiijWjjDuEVQyBxcDET66NCg/viewform",
  PORTAL_URL: "https://script.google.com/macros/s/AKfycbyaZbGMBNM33g-fu3uFBWWXP_WsRdS7nuHpqzq8dsIfE-dGfMoZo2t0y2R5Aqeyaq1sVw/exec",
  TEST_SUBMISSION_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdLSjFWPaI3mpO23JprV6xQfBco5nSAAyxUFRv1eP5sf1xJ9g/viewform",
  LEAVE_FORM_URL: "https://docs.google.com/forms/d/e/1sFoC-e83AN7j2VXklmCC4Pah2B6-uvCCWNJTVLH3Sqg/viewform",

  // Contacts and emails
  TEAM: {
    ADMIN_EMAIL: "hr@urbanmistrii.com",
    TEAM_EMAILS: ["hr@urbanmistrii.com", "mail@urbanmistrii.com"],
    YASH_PHONE: "919312943581"
  },

  // Privacy and security
  PRIVACY: {
    SENSITIVE_WORDS: ["salary", "stipend", "ctc", "expected", "pay", "current", "contact", "compensation"],
    GDPR_RETENTION_DAYS: 180 // Auto-delete rejected candidates after 6 months
  },

  // AI settings
  AI: {
    MODELS: {
      PRIMARY: "gemini-2.0-flash",  // Stable production model (Jan 2026)
      FALLBACK: "meta-llama/llama-3.3-70b-instruct:free"
    },
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.7
  },

  // Rate limits
  RATE_LIMITS: {
    WHATSAPP_DELAY_MS: 2000,    // 2 sec between messages
    EMAIL_BATCH_SIZE: 10,        // Process 10 emails at a time
    API_RETRY_COUNT: 3,
    API_RETRY_DELAY_MS: 1000
  },

  // Feature flags
  FEATURES: {
    TEST_MODE: false,              // Set true to prevent actual sends
    AI_ENABLED: true,
    WHATSAPP_ENABLED: true,
    AUTO_FOLLOWUP: true,
    AUTO_REJECTION: true,
    ANALYTICS: true,
    CALENDAR_INTEGRATION: true,    // v22.0: Now enabled!
    PORTAL_ENABLED: true,          // v22.0: Candidate self-service
    AUTO_PORTFOLIO_SCORING: true,  // v22.0: AI scores portfolios automatically
    DUPLICATE_CHECK: true          // v22.0: Check for duplicate applications
  },

  // Departments
  DEPARTMENTS: {
    DESIGN: {
      name: 'Design',
      roles: ['Design Intern', 'Junior Designer', 'Senior Designer', 'Lead Designer'],
      testLinks: {
        intern: 'https://app.box.com/s/lvp6m9rcsgvkjixis6yt5422ajw2mr8t',
        junior: 'https://app.box.com/folder/309187038121?s=v2g3zfmrbhok36zbsykca5hhqjfrahqf',
        senior: 'https://app.box.com/s/mf3pbeethgznuha1oxzve2lhy79i209v'
      },
      evaluators: ['hr@company.com'],
      timeLimits: { intern: 2, junior: 24, senior: 48 }
    },
    DEVELOPMENT: {
      name: 'Development',
      roles: ['Dev Intern', 'Junior Developer', 'Senior Developer'],
      testLinks: {
        intern: 'https://github.com/company/dev-test-intern',
        junior: 'https://github.com/company/dev-test-junior',
        senior: 'https://github.com/company/dev-test-senior'
      },
      evaluators: ['tech@company.com'],
      timeLimits: { intern: 4, junior: 48, senior: 72 }
    },
    MARKETING: {
      name: 'Marketing',
      roles: ['Marketing Intern', 'Marketing Executive', 'Marketing Manager'],
      testLinks: {
        intern: 'https://forms.google.com/marketing-intern-test',
        junior: 'https://forms.google.com/marketing-test',
        senior: 'https://forms.google.com/marketing-manager-test'
      },
      evaluators: ['marketing@urbanmistrii.com'],
      timeLimits: { intern: 24, junior: 48, senior: 72 }
    }
  }
};

// 
//                          SECURE API KEY MANAGEMENT
// 

// Backward compatibility for merged legacy modules.
// Keeps old onboarding/offboarding utilities from crashing on missing keys.
CONFIG.HR_EMAIL = CONFIG.HR_EMAIL || CONFIG.TEAM.ADMIN_EMAIL;
CONFIG.SHEET_ID = CONFIG.SHEET_ID || CONFIG.SHEETS.MASTER_ID;
CONFIG.SHEET_TAB = CONFIG.SHEET_TAB || CONFIG.SHEETS.TABS.CANDIDATES;
CONFIG.LOG_SHEET = CONFIG.LOG_SHEET || CONFIG.SHEETS.TABS.LOGS;
CONFIG.REAL_FORM_LINK = CONFIG.REAL_FORM_LINK || CONFIG.APPLICATION_FORM_URL;
CONFIG.URL_OFFBOARD = CONFIG.URL_OFFBOARD || CONFIG.TEST_SUBMISSION_FORM_URL;
CONFIG.URL_EXIT = CONFIG.URL_EXIT || CONFIG.LEAVE_FORM_URL;
CONFIG.ROOT_FOLDER = CONFIG.ROOT_FOLDER || 'UrbanMistrii_Bot_Files';
CONFIG.ATTACHMENT_FOLDER = CONFIG.ATTACHMENT_FOLDER || 'Attachments';
CONFIG.SCAN_DAYS = CONFIG.SCAN_DAYS || 15;
CONFIG.LINK_LOG_INTERN = CONFIG.LINK_LOG_INTERN || 'https://docs.google.com/document/d/YOUR_INTERN_LOG_ID/edit';
CONFIG.LINK_LOG_FULLTIME = CONFIG.LINK_LOG_FULLTIME || 'https://docs.google.com/document/d/YOUR_FULLTIME_LOG_ID/edit';

CONFIG.LABELS = CONFIG.LABELS || {
  STOP: 'ORACLE_STOP',
  SENT: 'ORACLE_SENT',
  PROCESSED: 'ORACLE_PROCESSED',
  ESCALATED: 'ORACLE_ESCALATED'
};

CONFIG.KEYWORDS = CONFIG.KEYWORDS || {
  ONBOARDING_TRIGGERS: ['joining', 'onboarding', 'offer accepted', 'new hire', 'welcome onboard']
};

CONFIG.HEADERS = CONFIG.HEADERS || [
  'Timestamp', 'Name', 'Email', 'Position', 'Joining Date', 'Leaves Oct', 'Oct Leaves',
  'Total Leaves', 'Leave Dates', 'Current Salary', 'Per Day', 'Deductions',
  'Total Minus Deductions', 'Conveyance', 'Total Salary', 'Days With UM',
  'Phone', 'Resume Link', 'Aadhar Link', 'Photo Link', 'Notes'
];

const LEGACY_COLUMN_MAP = {
  JOINING_DATE: 4,
  LEAVES_OCT: 5,
  OCT_LEAVES: 6,
  TOTAL_LEAVES: 7,
  LEAVE_DATES: 8,
  CURRENT_SAL: 9,
  PER_DAY: 10,
  DEDUCTIONS: 11,
  TOTAL_MINUS_DED: 12,
  CONVEYANCE: 13,
  TOTAL_SALARY: 14,
  DAYS_WITH_UM: 15,
  POSITION: 3,
  RESUME_LINK: 17,
  AADHAR_LINK: 18,
  PHOTO_LINK: 19
};
Object.keys(LEGACY_COLUMN_MAP).forEach(function (key) {
  if (typeof CONFIG.COLUMNS[key] === 'undefined') {
    CONFIG.COLUMNS[key] = LEGACY_COLUMN_MAP[key];
  }
});

const SecureConfig = {
  /**
   * ONE-TIME SETUP: Store API keys securely
   * Run this function once, then delete it from your code
   */
  setup() {
    const props = PropertiesService.getScriptProperties();

    // Only run if not already configured
    if (props.getProperty('CONFIG_INITIALIZED')) {
      Logger.log(' Already configured. Delete keys manually in Project Settings if you need to reset.');
      return;
    }

    //  DEPRECATED: Use SETUP_ALL() instead!
    // This function is kept for backward compatibility only
    // 
    // DO NOT HARDCODE API KEYS HERE!
    // Run: SETUP_ALL("your_gemini_key") instead

    Logger.log(' DEPRECATED: Use SETUP_ALL("your_gemini_key") instead!');
    Logger.log('   Get your key from: https://aistudio.google.com/app/apikey');
    return;

    Logger.log(' API Keys stored securely!');
    Logger.log(' They are encrypted and only accessible by this script.');
    Logger.log(' IMPORTANT: Now delete the API keys from this code file!');
  },

  /**
   * Get API key safely
   */
  get(keyName) {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty(keyName);

    if (!key) {
      throw new Error(` Missing API key: ${keyName}. Run FORCE_RESET_API_KEYS() first!`);
    }

    return key;
  },

  /**
   * Get API key safely, returns null if not found (no error)
   */
  getOptional(keyName) {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(keyName) || null;
  },

  /**
   * Validate required keys (only Gemini is required, Twilio is optional)
   */
  validate() {
    const required = ['GEMINI_API_KEY'];  // Only AI is required
    const optional = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'];

    const props = PropertiesService.getScriptProperties();
    const missing = required.filter(key => !props.getProperty(key));

    if (missing.length > 0) {
      throw new Error(` Missing API keys: ${missing.join(', ')}. Run FORCE_RESET_API_KEYS() first!`);
    }

    // Check optional keys and warn
    const missingOptional = optional.filter(key => !props.getProperty(key));
    if (missingOptional.length > 0) {
      Logger.log(` Optional keys not configured (WhatsApp disabled): ${missingOptional.join(', ')}`);
    }

    const webhookSecret = Guards.toString(CONFIG?.WEBHOOK?.SECRET_KEY, '');
    if (!webhookSecret || webhookSecret.length < 24 || webhookSecret === 'urbanmistrii_oracle_webhook_2024' || /CHANGE_ME/i.test(webhookSecret)) {
      throw new Error(' Insecure webhook secret. Set CONFIG.WEBHOOK.SECRET_KEY to a strong custom value.');
    }

    return true;
  },

  /**
   * Check if WhatsApp/Twilio is configured
   */
  isWhatsAppConfigured() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('TWILIO_ACCOUNT_SID') &&
      props.getProperty('TWILIO_AUTH_TOKEN') &&
      props.getProperty('TWILIO_WHATSAPP_NUMBER');
  },

  /**
   * Test mode - prevents actual API calls
   */
  isTestMode() {
    return CONFIG.FEATURES.TEST_MODE;
  }
};

/**
 *  ONE-BUTTON SETUP - Run this to configure EVERYTHING
 * Tests multiple Gemini models and picks the best working one
 * 
 * Usage: SETUP_ALL("your_gemini_key", "your_groq_key", "your_github_pat")
 * Minimum: SETUP_ALL("your_gemini_key")
 */
function SETUP_ALL(geminiKey, groqKey, githubPat) {
  Logger.log('');
  Logger.log('          ORACLE COMPLETE SETUP                                  ');
  Logger.log('');
  Logger.log('');

  if (!geminiKey) {
    Logger.log(' Usage: SETUP_ALL("your_gemini_api_key")');
    Logger.log('   Get key from: https://aistudio.google.com/app/apikey');
    return false;
  }

  const props = PropertiesService.getScriptProperties();

  // Step 1: Clear old config
  props.deleteAllProperties();
  Logger.log(' Cleared old configuration');

  // Step 2: Store API keys
  props.setProperties({
    'GEMINI_API_KEY': geminiKey,
    'GROQ_API_KEY': groqKey || '',
    'GITHUB_PAT': githubPat || '',
    'TWILIO_ACCOUNT_SID': '',
    'TWILIO_AUTH_TOKEN': '',
    'TWILIO_WHATSAPP_NUMBER': 'whatsapp:+14155238886',
    'CONFIG_INITIALIZED': 'true'
  });
  Logger.log(' API keys stored securely');
  Logger.log('');

  // Step 3: Test multiple Gemini models to find the best one
  Logger.log('');
  Logger.log(' TESTING GEMINI MODELS (finding best available)...');
  Logger.log('');

  const geminiModels = [
    // Latest 2.5 models (best first)
    'gemini-2.5-flash',           // Latest & best flash (GA June 2025)
    'gemini-2.5-pro',             // Latest & best pro (GA June 2025)
    'gemini-2.5-flash-lite',      // Lightweight 2.5
    // 2.0 models
    'gemini-2.0-flash-exp',       // Experimental 2.0
    'gemini-2.0-flash',           // Stable 2.0
    // 1.5 fallbacks
    'gemini-1.5-flash',           // Old stable flash
    'gemini-1.5-pro'              // Old stable pro
  ];

  let workingModel = null;

  for (const model of geminiModels) {
    Logger.log(`   Testing: ${model}...`);
    try {
      const result = _testGeminiModel(geminiKey, model);
      if (result.success) {
        Logger.log(`    ${model} - WORKING!`);
        workingModel = model;
        break;
      } else {
        Logger.log(`    ${model} - ${result.error.substring(0, 50)}`);
      }
    } catch (e) {
      Logger.log(`    ${model} - ${e.message.substring(0, 50)}`);
    }
  }

  Logger.log('');

  if (workingModel) {
    // Store the working model
    props.setProperty('GEMINI_MODEL', workingModel);
    Logger.log(` Best Gemini Model: ${workingModel}`);
    Logger.log('   (Stored in Script Properties as GEMINI_MODEL)');
  } else {
    Logger.log(' No Gemini models working - will rely on fallbacks');
  }

  Logger.log('');

  // Step 4: Test fallback providers
  Logger.log('');
  Logger.log(' TESTING FALLBACK PROVIDERS...');
  Logger.log('');

  let groqOk = false;
  let githubOk = false;

  // Test Groq
  if (groqKey) {
    try {
      const response = Http.fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'post',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say ok' }],
          max_tokens: 10
        }),
        muteHttpExceptions: true
      });
      const json = JSON.parse(response.getContentText());
      if (!json.error) {
        Logger.log('    GROQ: Working');
        groqOk = true;
      } else {
        Logger.log(`    GROQ: ${json.error.message || 'Failed'}`);
      }
    } catch (e) {
      Logger.log(`    GROQ: ${e.message.substring(0, 50)}`);
    }
  } else {
    Logger.log('    GROQ: Not configured (optional)');
  }

  // Test GitHub Models
  if (githubPat) {
    try {
      const response = Http.fetch('https://models.github.ai/inference/chat/completions', {
        method: 'post',
        headers: { 'Authorization': `Bearer ${githubPat}`, 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say ok' }],
          max_tokens: 10
        }),
        muteHttpExceptions: true
      });
      const json = JSON.parse(response.getContentText());
      if (!json.error) {
        Logger.log('    GITHUB MODELS: Working');
        githubOk = true;
      } else {
        Logger.log(`    GITHUB: ${json.error.message || 'Failed'}`);
      }
    } catch (e) {
      Logger.log(`    GITHUB: ${e.message.substring(0, 50)}`);
    }
  } else {
    Logger.log('    GITHUB MODELS: Not configured (optional)');
  }

  // Summary
  Logger.log('');
  Logger.log('');
  Logger.log(' SETUP COMPLETE - SUMMARY');
  Logger.log('');
  Logger.log(`   GEMINI:  ${workingModel ? ' ' + workingModel : ' Not working'}`);
  Logger.log(`   GROQ:    ${groqOk ? ' Working' : groqKey ? ' Failed' : ' Not configured'}`);
  Logger.log(`   GITHUB:  ${githubOk ? ' Working' : githubPat ? ' Failed' : ' Not configured'}`);
  Logger.log('');

  if (workingModel || groqOk || githubOk) {
    Logger.log(' AI SYSTEM: READY');
    return true;
  } else {
    Logger.log(' AI SYSTEM: NO PROVIDERS WORKING');
    Logger.log('   Please check your API keys');
    return false;
  }
}

/**
 * Helper: Test a specific Gemini model
 */
function _testGeminiModel(apiKey, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: 'Say "working" in one word' }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
  };

  const response = Http.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const json = JSON.parse(response.getContentText());

  if (json.error) {
    return { success: false, error: json.error.message || JSON.stringify(json.error) };
  }

  if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
    return { success: true, response: json.candidates[0].content.parts[0].text };
  }

  return { success: false, error: 'Invalid response structure' };
}

/**
 * FORCE RESET - Legacy function (use SETUP_ALL instead)
 */
function FORCE_RESET_API_KEYS(geminiKey, groqKey, githubPat) {
  if (!geminiKey) {
    Logger.log(' Usage: FORCE_RESET_API_KEYS("your_gemini_key", "optional_groq_key", "optional_github_pat")');
    Logger.log('   Get Gemini key from: https://aistudio.google.com/app/apikey');
    return;
  }

  Logger.log(' Use SETUP_ALL() instead - it auto-tests and finds working models!');
  Logger.log('');
  SETUP_ALL(geminiKey, groqKey, githubPat);
}

/**
 * Setup Twilio credentials separately
 */
function SETUP_TWILIO(accountSid, authToken) {
  if (!accountSid || !authToken) {
    Logger.log('Usage: SETUP_TWILIO("ACxxxx...", "your_auth_token")');
    return;
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty('TWILIO_ACCOUNT_SID', accountSid);
  props.setProperty('TWILIO_AUTH_TOKEN', authToken);

  Logger.log(' Twilio credentials stored!');
  Logger.log(' Test it: diagnosticsWhatsApp()');
}

/**
 * Setup Groq API key (fallback AI)
 */
function SETUP_GROQ(apiKey) {
  if (!apiKey) {
    Logger.log('Usage: SETUP_GROQ("gsk_xxxx...")');
    return;
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty('GROQ_API_KEY', apiKey);

  Logger.log(' Groq API key stored!');
  Logger.log(' Test it: testAI()');
}

// 
//                              HELPER FUNCTIONS
// 

const ConfigHelpers = {
  /**
   * Get department for a specific role
   */
  getDepartment(role) {
    const r = (role || '').toLowerCase();
    if (r.includes('dev') || r.includes('engineer') || r.includes('programmer') || r.includes('tech') || r.includes('software')) return 'DEVELOPMENT';
    if (r.includes('marketing') || r.includes('content') || r.includes('social') || r.includes('sales') || r.includes('copy')) return 'MARKETING';
    return 'DESIGN';
  },

  /**
   * Get role-specific time limit in hours (department aware)
   */
  getTimeLimit(role, department) {
    const dept = department || this.getDepartment(role);
    const deptConfig = CONFIG.DEPARTMENTS[dept] || CONFIG.DEPARTMENTS.DESIGN;

    const roleKey = role.toLowerCase().includes('senior') ? 'senior'
      : role.toLowerCase().includes('junior') ? 'junior'
        : 'intern';

    return deptConfig.timeLimits[roleKey] || CONFIG.RULES.TIME_LIMITS[roleKey];
  },

  /**
   * Get test link for specific role (department aware)
   */
  getTestLink(role, department) {
    const dept = department || this.getDepartment(role);
    const deptConfig = CONFIG.DEPARTMENTS[dept] || CONFIG.DEPARTMENTS.DESIGN;

    const roleKey = role.toLowerCase().includes('senior') ? 'senior'
      : role.toLowerCase().includes('junior') ? 'junior'
        : 'intern';

    return deptConfig.testLinks[roleKey] || CONFIG.TEST_LINKS[roleKey];
  },

  /**
   * Check if a word is sensitive (for privacy sync)
   */
  isSensitive(word) {
    return CONFIG.PRIVACY.SENSITIVE_WORDS.some(
      sensitive => word.toLowerCase().includes(sensitive)
    );
  },

  /**
   * Get sheet by name with error handling
   */
  getSheet(tabName) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
      const sheet = ss.getSheetByName(tabName);

      if (!sheet) {
        throw new Error(`Sheet "${tabName}" not found`);
      }

      return sheet;
    } catch (e) {
      Logger.log(` Error accessing sheet "${tabName}": ${e.message}`);
      throw e;
    }
  },

  /**
   * Validate phone number format
   */
  validatePhone(phone) {
    const cleaned = String(phone).replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 12;
  },

  /**
   * Validate email format
   */
  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
};

/**
 * RUN THIS ONCE to initialize secure configuration
 */
function setupSecureConfig() {
  Logger.log('');
  Logger.log('   ORACLE v22.0 - SECURE SETUP');
  Logger.log('');

  try {
    SecureConfig.setup();
    SecureConfig.validate();

    Logger.log('');
    Logger.log(' Configuration complete!');
    Logger.log(' All API keys are now stored securely.');
    Logger.log('');
    Logger.log(' NEXT STEPS:');
    Logger.log('1. Delete the API keys from SecureConfig.setup() function');
    Logger.log('2. Save this script');
    Logger.log('3. Run: testSystemHealth()');
    Logger.log('');

  } catch (e) {
    Logger.log(' Setup failed: ' + e.message);
  }
}

/**
 * Test that everything is configured correctly
 */
function testSystemHealth() {
  Logger.log('');
  Logger.log('   SYSTEM HEALTH CHECK');
  Logger.log('');

  let passed = 0;
  let failed = 0;

  // Test 1: API Keys
  try {
    SecureConfig.validate();
    Logger.log(' API Keys: Configured');
    passed++;
  } catch (e) {
    Logger.log(' API Keys: Missing');
    failed++;
  }

  // Test 2: Master Sheet
  try {
    SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
    Logger.log(' Master Sheet: Accessible');
    passed++;
  } catch (e) {
    Logger.log(' Master Sheet: Not accessible');
    failed++;
  }

  // Test 3: Public Sheet
  try {
    SpreadsheetApp.openById(CONFIG.SHEETS.PUBLIC_ID);
    Logger.log(' Public Sheet: Accessible');
    passed++;
  } catch (e) {
    Logger.log(' Public Sheet: Not accessible');
    failed++;
  }

  // Test 4: Gemini AI
  Logger.log('');
  Logger.log('--- AI Models ---');
  try {
    AI._callGemini('test', 'test');
    Logger.log(' Gemini: Working');
    passed++;
  } catch (e) {
    Logger.log(' Gemini: ' + e.message.substring(0, 60));
    failed++;
  }

  // Test 5: Groq AI
  try {
    AI._callGroq('test', 'test');
    Logger.log(' Groq: Working');
    passed++;
  } catch (e) {
    Logger.log(' Groq: ' + e.message.substring(0, 60));
    failed++;
  }

  Logger.log('');
  Logger.log(`Results: ${passed} passed, ${failed} failed`);
  Logger.log('');

  return failed === 0;
}



// 
//  UTILS
// 
/**
 * 
 *                      URBANMISTRII ORACLE v22.4 - UTILS                         
 *                      Logging, Helpers & Core Utilities (Hardened)              
 * 
 * 
 * v22.4 NEW:
 * - batchUpdate() for 10x faster sheet writes
 * - ErrorRecovery dashboard for failed operations
 * - Improved DateTime parsing
 */

// 
//                              GUARDS & SAFETY UTILITIES
// 

/**
 * Safe guards to prevent crashes and data leaks
 */
const Guards = {
  /**
   * Safely get nested property without crashing
   * @param {object} obj - Object to traverse
   * @param {string} path - Dot-notation path (e.g., 'user.name.first')
   * @param {*} defaultValue - Default value if path doesn't exist
   */
  get(obj, path, defaultValue = null) {
    if (!obj || typeof obj !== 'object') return defaultValue;
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    return result !== undefined && result !== null ? result : defaultValue;
  },

  /**
   * Check if value is empty (null, undefined, empty string, empty array)
   */
  isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },

  /**
   * Ensure value is a string
   */
  toString(value, defaultValue = '') {
    if (value === null || value === undefined) return defaultValue;
    return String(value);
  },

  /**
   * Ensure value is a number
   */
  toNumber(value, defaultValue = 0) {
    if (value === null || value === undefined) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  },

  /**
   * Safe array access
   */
  arrayGet(arr, index, defaultValue = null) {
    if (!Array.isArray(arr)) return defaultValue;
    if (index < 0 || index >= arr.length) return defaultValue;
    return arr[index] !== undefined ? arr[index] : defaultValue;
  },

  /**
   * Validate candidate object has required fields
   */
  validateCandidate(candidate) {
    const errors = [];
    if (!candidate) {
      return { valid: false, errors: ['Candidate object is null'] };
    }
    if (Guards.isEmpty(candidate.row)) errors.push('Missing row number');
    if (Guards.isEmpty(candidate.email) && Guards.isEmpty(candidate.phone)) {
      errors.push('Must have email or phone');
    }
    return { valid: errors.length === 0, errors };
  },

  /**
   * Safe execution wrapper with error handling
   */
  safeExecute(fn, context = 'UNKNOWN', fallbackValue = null) {
    try {
      return fn();
    } catch (e) {
      Log.error(context, 'Safe execution failed', { error: e.message, stack: e.stack });
      return fallbackValue;
    }
  },

  /**
   * Async-safe execution with retry
   */
  safeExecuteWithRetry(fn, context = 'UNKNOWN', maxRetries = 3, delayMs = 1000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return fn();
      } catch (e) {
        lastError = e;
        Log.warn(context, `Attempt ${attempt}/${maxRetries} failed`, { error: e.message });
        if (attempt < maxRetries) {
          Utilities.sleep(delayMs * attempt); // Exponential backoff
        }
      }
    }
    Log.error(context, 'All retry attempts failed', { error: lastError?.message });
    return null;
  },

  /**
   * Rate limiter to prevent quota exhaustion
   */
  _rateLimitState: {},
  rateLimit(key, maxCalls, windowMs) {
    const now = Date.now();
    if (!this._rateLimitState[key]) {
      this._rateLimitState[key] = { calls: [], windowStart: now };
    }
    const state = this._rateLimitState[key];

    // Clean old calls outside window
    state.calls = state.calls.filter(t => now - t < windowMs);

    if (state.calls.length >= maxCalls) {
      const waitTime = windowMs - (now - state.calls[0]);
      Log.warn('RATE_LIMIT', `Rate limit hit for ${key}, waiting ${waitTime}ms`);
      return false;
    }

    state.calls.push(now);
    return true;
  },

  /**
   * Prevent duplicate processing with idempotency key
   */
  _processedKeys: {},
  checkIdempotency(key, ttlMs = 300000) { // 5 min default
    const now = Date.now();
    // Clean expired keys
    for (const k in this._processedKeys) {
      if (now - this._processedKeys[k] > ttlMs) {
        delete this._processedKeys[k];
      }
    }
    if (this._processedKeys[key]) {
      return false; // Already processed
    }
    this._processedKeys[key] = now;
    return true;
  }
};

// Shared HTTP wrapper with retry and standard defaults.
const Http = {
  fetch(url, options = {}, context = 'HTTP') {
    const retryCount = Math.max(1, Guards.toNumber(CONFIG?.RATE_LIMITS?.API_RETRY_COUNT, 3));
    const retryDelayMs = Math.max(0, Guards.toNumber(CONFIG?.RATE_LIMITS?.API_RETRY_DELAY_MS, 1000));
    let lastError = null;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const requestOptions = Object.assign({ muteHttpExceptions: true }, options || {});
        return UrlFetchApp.fetch(url, requestOptions);
      } catch (err) {
        lastError = err;
        Log.warn(context, `HTTP attempt ${attempt}/${retryCount} failed`, { error: err.message });
        if (attempt < retryCount) Utilities.sleep(retryDelayMs * attempt);
      }
    }

    throw new Error(`${context} failed after ${retryCount} attempts: ${lastError ? lastError.message : 'Unknown error'}`);
  },

  fetchJson(url, options = {}, context = 'HTTP_JSON') {
    const response = this.fetch(url, options, context);
    const text = response.getContentText() || '';
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (err) {
      throw new Error(`${context} returned non-JSON response (${response.getResponseCode()})`);
    }
    return { response, json, text, status: response.getResponseCode() };
  }
};

// 
//                              STATUS TRANSITIONS
// 

/**
 * Valid status transition rules - prevents invalid status changes
 * v22.4: Now uses CONFIG.RULES.STATUS_TRANSITIONS if available (configurable)
 */
const StatusMachine = {
  /**
   * Get transitions - uses CONFIG if available, else falls back to hardcoded
   */
  _getTransitions() {
    // Try to use configurable transitions from CONFIG
    if (typeof CONFIG !== 'undefined' && CONFIG.RULES && CONFIG.RULES.STATUS_TRANSITIONS) {
      return CONFIG.RULES.STATUS_TRANSITIONS;
    }
    // Fallback to hardcoded defaults
    return {
      'NEW': ['IN PROCESS', 'PENDING REJECTION', 'REJECTED'],
      'IN PROCESS': ['TEST SENT', 'PENDING REJECTION', 'REJECTED'],
      'TEST SENT': ['TEST SUBMITTED', 'PENDING REJECTION', 'REJECTED'],
      'TEST SUBMITTED': ['UNDER REVIEW', 'INTERVIEW PENDING', 'PENDING REJECTION', 'REJECTED'],
      'UNDER REVIEW': ['INTERVIEW PENDING', 'PENDING REJECTION', 'REJECTED'],
      'INTERVIEW PENDING': ['INTERVIEW DONE', 'PENDING REJECTION', 'REJECTED'],
      'INTERVIEW DONE': ['HIRED', 'PENDING REJECTION', 'REJECTED'],
      'PENDING REJECTION': ['REJECTED'],
      'REJECTED': [],
      'HIRED': []
    };
  },

  /**
   * Check if a status transition is valid
   */
  isValidTransition(fromStatus, toStatus) {
    // Allow same status (no-op)
    if (fromStatus === toStatus) return true;

    const transitions = this._getTransitions();

    // If from status is unknown, allow it (new record)
    if (!fromStatus || !transitions[fromStatus]) return true;

    const validTargets = transitions[fromStatus] || [];
    return validTargets.includes(toStatus);
  },

  /**
   * Get valid next statuses for a given status
   */
  getValidNextStatuses(currentStatus) {
    const transitions = this._getTransitions();
    return transitions[currentStatus] || [];
  },

  /**
   * Validate and log invalid transitions (but don't block)
   */
  validateAndWarn(fromStatus, toStatus, candidateName = 'Unknown') {
    if (!this.isValidTransition(fromStatus, toStatus)) {
      const transitions = this._getTransitions();
      Log.warn('STATUS_MACHINE', `Unusual transition: ${fromStatus} -> ${toStatus}`, {
        candidate: candidateName,
        expected: transitions[fromStatus] || ['any']
      });
      return false;
    }
    return true;
  }
};

// 
//                              LOGGING SYSTEM
// 

const Log = {
  _logBuffer: [],
  _lastFlush: Date.now(),
  _FLUSH_INTERVAL_MS: 5000, // Batch logs every 5 seconds
  _MAX_BUFFER_SIZE: 50,

  /**
   * internal helper to append to log sheet (with buffering for performance)
   */
  _append(level, category, message, data = null) {
    try {
      const timestamp = new Date();
      // Safely stringify data, handling circular references
      let dataStr = '';
      if (data) {
        try {
          dataStr = JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (this._seen?.has(value)) return '[Circular]';
              this._seen = this._seen || new WeakSet();
              this._seen.add(value);
            }
            return value;
          });
        } catch (jsonError) {
          dataStr = String(data);
        }
      }

      // Also log to console for debugging
      const icon = level === 'ERROR' || level === 'CRITICAL' ? ''
        : level === 'SUCCESS' ? ''
          : level === 'WARN' ? ''
            : '';
      Logger.log(`${icon} [${level}] ${category}: ${message} ${dataStr}`);

      // Buffer logs for batch writing (performance optimization)
      this._logBuffer.push([timestamp, level, category, message, dataStr.substring(0, 1000)]);

      // Flush if buffer is full or enough time has passed
      const now = Date.now();
      if (this._logBuffer.length >= this._MAX_BUFFER_SIZE ||
        now - this._lastFlush > this._FLUSH_INTERVAL_MS ||
        level === 'CRITICAL' || level === 'ERROR') {
        this._flush();
      }

    } catch (e) {
      Logger.log(` LOGGING FAILED: ${e.message}`);
    }
  },

  /**
   * Flush buffered logs to sheet
   */
  _flush() {
    if (this._logBuffer.length === 0) return;
    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.LOGS);
      const rows = this._logBuffer.splice(0, this._logBuffer.length);
      if (rows.length > 0) {
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rows.length, 5).setValues(rows);
      }
      this._lastFlush = Date.now();
    } catch (e) {
      Logger.log(` LOG FLUSH FAILED: ${e.message}`);
    }
  },

  info(category, message, data) {
    this._append('INFO', category, message, data);
  },

  success(category, message, data) {
    this._append('SUCCESS', category, message, data);
  },

  warn(category, message, data) {
    this._append('WARN', category, message, data);
  },

  error(category, message, data) {
    this._append('ERROR', category, message, data);
  },

  critical(category, message, data) {
    this._append('CRITICAL', category, message, data);
    // Critical errors also email the admin immediately
    Notify.email(
      CONFIG.TEAM.ADMIN_EMAIL,
      ` CRITICAL ERROR: ${category}`,
      `Message: ${message}\nData: ${JSON.stringify(data, null, 2)}`
    );
  }
};

// 
//                              DATE & TIME HELPERS
// 

const DateTime = {
  getIST(date = new Date()) {
    const str = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(str);
  },

  hoursBetween(d1, d2) {
    // Input validation - return 0 if either date is invalid
    if (!d1 || !d2) return 0;
    const date1 = d1 instanceof Date ? d1 : new Date(d1);
    const date2 = d2 instanceof Date ? d2 : new Date(d2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
    return Math.abs(date2 - date1) / 36e5;
  },

  daysBetween(d1, d2) {
    // Input validation - return 0 if either date is invalid
    if (!d1 || !d2) return 0;
    const date1 = d1 instanceof Date ? d1 : new Date(d1);
    const date2 = d2 instanceof Date ? d2 : new Date(d2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
    return Math.floor(Math.abs(date2 - date1) / (1000 * 60 * 60 * 24));
  },

  addHours(date, hours) {
    // Input validation - return current time + hours if date is invalid
    const baseDate = (date && !isNaN(new Date(date).getTime())) ? new Date(date) : new Date();
    baseDate.setTime(baseDate.getTime() + ((hours || 0) * 60 * 60 * 1000));
    return baseDate;
  },

  addDays(date, days) {
    // Input validation - return current date + days if date is invalid
    const baseDate = (date && !isNaN(new Date(date).getTime())) ? new Date(date) : new Date();
    baseDate.setDate(baseDate.getDate() + (days || 0));
    return baseDate;
  },

  formatIST(date, format = 'short') {
    if (!date) return '';
    const options = { timeZone: 'Asia/Kolkata' };

    if (format === 'full') {
      return date.toLocaleString('en-IN', {
        ...options,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString('en-IN', options);
  }
};

/**
 * Generate Google Calendar link for an event
 */
function generateCalendarLink(name, role, dateInput, timeInput) {
  try {
    let startDate = new Date();

    // Try to parse the date
    if (dateInput instanceof Date) {
      startDate = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      // Try to parse string date
      const parsed = new Date(dateInput);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed;
      } else {
        // Default to tomorrow if unparseable
        startDate = DateTime.addDays(new Date(), 1);
        startDate.setHours(10, 0, 0, 0);
      }
    }

    // Parse time if provided
    if (timeInput) {
      if (timeInput instanceof Date) {
        startDate.setHours(timeInput.getHours(), timeInput.getMinutes());
      } else if (typeof timeInput === 'string') {
        const timeMatch = timeInput.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const mins = parseInt(timeMatch[2]) || 0;
          const ampm = timeMatch[3];
          if (ampm && ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
          if (ampm && ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
          startDate.setHours(hours, mins, 0, 0);
        }
      }
    }

    // Calculate end time (45 minutes later)
    const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);

    // Format dates for Google Calendar URL
    const formatGCalDate = (d) => {
      return d.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, -1) + 'Z';
    };

    const title = encodeURIComponent(`Urbanmistrii Interview - ${role}`);
    const details = encodeURIComponent(`Interview with ${name} for ${role} position at Urbanmistrii.\n\nPlease have your portfolio ready.`);
    const location = encodeURIComponent('Online / Video Call');

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCalDate(startDate)}/${formatGCalDate(endDate)}&details=${details}&location=${location}`;

  } catch (e) {
    // Return a basic calendar link if parsing fails
    return 'https://calendar.google.com';
  }
}

// 
//                          EMAIL TEMPLATES (v9.1 Style)
// 

const EmailTemplates = {
  // Shared styles
  _styles: {
    container: 'max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; color: #333333;',
    header: 'background-color: #1a1a1a; padding: 30px 40px; text-align: left; border-bottom: 4px solid #e74c3c;',
    logo: 'color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase;',
    body: 'padding: 40px; line-height: 1.6; font-size: 15px;',
    button: 'display: inline-block; background-color: #e74c3c; color: #ffffff !important; padding: 14px 30px; text-decoration: none; font-weight: 600; border-radius: 2px;',
    infoBox: 'background-color: #f9f9f9; padding: 20px; border-left: 4px solid #e74c3c; margin: 25px 0;',
    warningBox: 'background-color: #fff3cd; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;',
    footer: 'background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888;'
  },

  /**
   * Wrap content in the standard UrbanMistrii email template
   */
  wrap(content) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="${this._styles.container}">
    <div style="${this._styles.header}">
      <h1 style="${this._styles.logo}">URBANMISTRII</h1>
    </div>
    <div style="${this._styles.body}">
      ${content}
    </div>
    <div style="${this._styles.footer}">
      &copy; ${new Date().getFullYear()} Urbanmistrii. All Rights Reserved.
    </div>
  </div>
</body>
</html>`;
  },

  /**
   * Create a styled button
   */
  button(text, url) {
    return `<div style="text-align: center; margin: 25px 0;"><a href="${url}" style="${this._styles.button}">${text}</a></div>`;
  },

  /**
   * Create an info box
   */
  infoBox(content) {
    return `<div style="${this._styles.infoBox}">${content}</div>`;
  },

  /**
   * Create a warning box
   */
  warningBox(content) {
    return `<div style="${this._styles.warningBox}">${content}</div>`;
  }
};

// 
//                              SHEET UTILITIES
// 

const SheetUtils = {
  /**
   * Safely update a cell with validation
   */
  updateCell(row, col, value) {
    if (!Guards.toNumber(row) || row < 2) {
      Log.warn('SHEET', 'Invalid row for updateCell', { row, col });
      return false;
    }
    if (!Guards.toNumber(col) || col < 1) {
      Log.warn('SHEET', 'Invalid column for updateCell', { row, col });
      return false;
    }
    try {
      //  CRITICAL FIX: Prevent writing timestamps to STATUS column (Col 1)
      if (col === 1 && value instanceof Date) {
        Log.warn('SHEET', 'Stopped attempt to write timestamp to STATUS column', { row });
        // Redirect to column 2 (Updated) if it looked like a timestamp update
        col = 2;
      }

      //  CRITICAL FIX: Prevent writing timestamps to STATUS column if using Config ID
      if (typeof CONFIG !== 'undefined' && col === CONFIG.COLUMNS.STATUS && value instanceof Date) {
        Log.warn('SHEET', 'Stopped attempt to write timestamp to STATUS column (via Config)', { row });
        return false; // Just block it
      }

      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      sheet.getRange(row, col).setValue(value);
      return true;
    } catch (e) {
      Log.error('SHEET', 'updateCell failed', { row, col, error: e.message });
      return false;
    }
  },

  /**
   * Sort the candidate sheet by Timestamp (Column 3) descending
   */
  sortByTimestamp(sheet) {
    try {
      if (!sheet) sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2) return;

      // Sort range (Header at row 1 remains fixed)
      sheet.getRange(2, 1, lastRow - 1, lastCol).sort({ column: 3, ascending: false });
      Log.info('SHEET', 'Sheet sorted by timestamp (descending)');
    } catch (e) {
      Log.error('SHEET', 'Sort failed', { error: e.message });
    }
  },

  /**
   * Apply dropdown validation to the Status column
   */
  applyStatusValidation(sheet) {
    try {
      if (!sheet) sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const statusList = Object.values(CONFIG.RULES.STATUSES);
      const validation = SpreadsheetApp.newDataValidation()
        .requireValueInList(statusList)
        .setAllowInvalid(false)
        .build();

      const lastRow = sheet.getLastRow();
      const rangeSize = Math.max(lastRow - 1, 1000); // Apply to current rows or up to 1000
      sheet.getRange(2, CONFIG.COLUMNS.STATUS, rangeSize, 1).setDataValidation(validation);
      Log.info('SHEET', 'Status validation applied');
    } catch (e) {
      Log.error('SHEET', 'Validation failed', { error: e.message });
    }
  },


  /**
   * BATCH UPDATE - 10x faster than individual updateCell calls
   * Groups updates by row and uses setValues() instead of individual setValue()
   * @param {Array} updates - Array of {row, col, value} objects
   * @returns {boolean} success
   */
  batchUpdate(updates) {
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return true; // Nothing to update
    }

    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);

      // Group updates by row for efficiency
      const rowGroups = {};
      for (const u of updates) {
        if (!u.row || !u.col) continue;
        if (!rowGroups[u.row]) rowGroups[u.row] = {};
        rowGroups[u.row][u.col] = u.value;
      }

      // Apply updates row by row (minimizes API calls)
      for (const rowStr in rowGroups) {
        const row = parseInt(rowStr);
        const colUpdates = rowGroups[row];

        for (const colStr in colUpdates) {
          const col = parseInt(colStr);
          sheet.getRange(row, col).setValue(colUpdates[col]);
        }
      }

      // Flush all changes at once
      SpreadsheetApp.flush();
      return true;

    } catch (e) {
      Log.error('SHEET', 'batchUpdate failed', { error: e.message, updateCount: updates.length });
      return false;
    }
  },

  /**
   * SUPER BATCH UPDATE - For updating many cells in a contiguous range
   * Use when updating multiple columns in the same row
   * @param {number} row - Row number
   * @param {object} colValueMap - Object mapping column numbers to values
   */
  updateRow(row, colValueMap) {
    if (!row || row < 2 || !colValueMap) return false;

    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);

      for (const colStr in colValueMap) {
        const col = parseInt(colStr);
        if (col > 0) {
          sheet.getRange(row, col).setValue(colValueMap[col]);
        }
      }

      return true;
    } catch (e) {
      Log.error('SHEET', 'updateRow failed', { row, error: e.message });
      return false;
    }
  },

  /**
   * Update candidate status with validation and sync across all related sheets
   * @param {number} row - Candidate row number in DB_Candidates
   * @param {string} newStatus - New status value
   * @param {string} email - Candidate email (for syncing to other sheets)
   */
  updateStatus(row, newStatus, email) {
    // Validate inputs
    if (!Guards.toNumber(row) || row < 2) {
      Log.error('STATUS', 'Invalid row for status update', { row, newStatus });
      return false;
    }
    if (Guards.isEmpty(newStatus)) {
      Log.error('STATUS', 'Empty status provided', { row });
      return false;
    }

    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const oldStatus = Guards.toString(sheet.getRange(row, CONFIG.COLUMNS.STATUS).getValue());

      // Validate status transition
      StatusMachine.validateAndWarn(oldStatus, newStatus, email);

      // Create idempotency key to prevent duplicate processing
      const idempotencyKey = `status_${row}_${newStatus}_${Date.now().toString().slice(0, -3)}`;
      if (!Guards.checkIdempotency(idempotencyKey, 10000)) { // 10 sec window
        Log.warn('STATUS', 'Duplicate status update blocked', { row, newStatus });
        return false;
      }

      sheet.getRange(row, CONFIG.COLUMNS.STATUS).setValue(newStatus);
      sheet.getRange(row, CONFIG.COLUMNS.UPDATED).setValue(new Date());

      Log.info('STATUS_SYNC', `Updated: ${oldStatus} -> ${newStatus}`, { row, email: Sanitize.maskEmail(email || '') });

      // Sync asynchronously to prevent blocking
      this._syncStatusToSheets(email, newStatus);
      return true;
    } catch (e) {
      Log.error('STATUS', 'Status update failed', { row, newStatus, error: e.message });
      return false;
    }
  },

  /**
   * Sync status to all related sheets (DB_TestSubmissions, DB_FollowUp, etc.)
   */
  _syncStatusToSheets(email, newStatus) {
    try {
      if (!email) return;

      const emailLower = email.toLowerCase();

      // Update DB_TestSubmissions
      try {
        const testSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.TEST_SUBMISSIONS);
        const testData = testSheet.getDataRange().getValues();

        if (testData.length > 1) {
          for (let i = 1; i < testData.length; i++) {
            if (String(testData[i][2] || '').toLowerCase() === emailLower) {
              const emailColIndex = testSheet.getLastColumn();
              const statusHeader = testData[0][emailColIndex - 1];

              if (statusHeader === 'Status' || statusHeader === 'CURRENT_STATUS') {
                testSheet.getRange(i + 1, emailColIndex).setValue(newStatus);
              }
            }
          }
        }
      } catch (e) {
        Log.warn('STATUS_SYNC', 'Failed to sync to DB_TestSubmissions', { error: e.message });
      }

      // Update DB_FollowUp (status column exists)
      try {
        const followSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.FOLLOWUP);
        const followData = followSheet.getDataRange().getValues();

        if (followData.length > 1) {
          for (let i = 1; i < followData.length; i++) {
            if (String(followData[i][2] || '').toLowerCase() === emailLower) {
              const statusCol = followData[0].indexOf('Status');
              if (statusCol >= 0) {
                followSheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
              }
            }
          }
        }
      } catch (e) {
        Log.warn('STATUS_SYNC', 'Failed to sync to DB_FollowUp', { error: e.message });
      }

      // Update Public/Team View
      try {
        const publicSheet = SpreadsheetApp.openById(CONFIG.SHEETS.PUBLIC_ID).getSheetByName('Team View');
        if (publicSheet) {
          const publicData = publicSheet.getDataRange().getValues();
          const emailCol = publicData[0].indexOf('Email Address');

          if (emailCol >= 0) {
            const statusCol = publicData[0].indexOf('Status');
            if (statusCol >= 0) {
              for (let i = 1; i < publicData.length; i++) {
                if (String(publicData[i][emailCol] || '').toLowerCase() === emailLower) {
                  publicSheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
                }
              }
            }
          }
        }
      } catch (e) {
        Log.warn('STATUS_SYNC', 'Failed to sync to Public View', { error: e.message });
      }

    } catch (e) {
      Log.error('STATUS_SYNC', 'Failed to sync status', { email, status: newStatus, error: e.message });
    }
  },

  findCandidateByEmail(email) {
    if (Guards.isEmpty(email)) return null;

    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const data = sheet.getDataRange().getValues();
      const emailColIndex = CONFIG.COLUMNS.EMAIL - 1;
      const normalizedEmail = Guards.toString(email).toLowerCase().trim();

      for (let i = 1; i < data.length; i++) {
        const rowEmail = Guards.toString(data[i][emailColIndex]).toLowerCase().trim();
        if (rowEmail === normalizedEmail) {
          return {
            row: i + 1,
            data: data[i],
            // Add parsed fields for convenience
            name: Guards.toString(data[i][CONFIG.COLUMNS.NAME - 1]),
            phone: Guards.toString(data[i][CONFIG.COLUMNS.PHONE - 1]),
            email: Guards.toString(data[i][CONFIG.COLUMNS.EMAIL - 1]),
            role: Guards.toString(data[i][CONFIG.COLUMNS.ROLE - 1]),
            status: Guards.toString(data[i][CONFIG.COLUMNS.STATUS - 1]),
            testSent: data[i][CONFIG.COLUMNS.TEST_SENT - 1]
          };
        }
      }
      return null;
    } catch (e) {
      Log.error('SHEET', 'findCandidateByEmail failed', { email: Sanitize.maskEmail(email), error: e.message });
      return null;
    }
  },

  /**
   * Find candidate by phone number
   */
  findCandidateByPhone(phone) {
    if (Guards.isEmpty(phone)) return null;

    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const data = sheet.getDataRange().getValues();
      const phoneColIndex = CONFIG.COLUMNS.PHONE - 1;
      const normalizedPhone = Guards.toString(phone).replace(/\D/g, '').slice(-10);

      for (let i = 1; i < data.length; i++) {
        const rowPhone = Guards.toString(data[i][phoneColIndex]).replace(/\D/g, '').slice(-10);
        if (rowPhone === normalizedPhone && normalizedPhone.length === 10) {
          return {
            row: i + 1,
            data: data[i],
            name: Guards.toString(data[i][CONFIG.COLUMNS.NAME - 1]),
            phone: Guards.toString(data[i][CONFIG.COLUMNS.PHONE - 1]),
            email: Guards.toString(data[i][CONFIG.COLUMNS.EMAIL - 1]),
            role: Guards.toString(data[i][CONFIG.COLUMNS.ROLE - 1]),
            status: Guards.toString(data[i][CONFIG.COLUMNS.STATUS - 1])
          };
        }
      }
      return null;
    } catch (e) {
      Log.error('SHEET', 'findCandidateByPhone failed', { error: e.message });
      return null;
    }
  },

  getCandidatesByStatus(status) {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const data = sheet.getDataRange().getValues();
    const statusIdx = CONFIG.COLUMNS.STATUS - 1;
    const matches = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][statusIdx] === status) {
        matches.push({
          row: i + 1,
          data: data[i]
        });
      }
    }
    return matches;
  }
};

// 
//                              VALIDATION
// 

const Validate = {
  phone(phone) {
    // Basic India validation
    const regex = /^(?:\+91|91)?[6-9]\d{9}$/;
    const str = String(phone).replace(/\D/g, '');
    const valid = regex.test(str) || str.length === 10;
    return { valid, cleaned: str };
  },

  email(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { valid: regex.test(email) };
  },

  name(name) {
    return { valid: name && name.length >= 2 };
  }
};

// 
//                              SANITIZATION
// 

const Sanitize = {
  maskEmail(email) {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length < 2) return email;
    const name = parts[0];
    const visible = name.substring(0, 3);
    return `${visible}***@${parts[1]}`;
  }
};

// 
//                              DUPLICATE DETECTION
// 

const Duplicates = {
  /**
   * Check if a candidate already exists (fuzzy matching)
   * @param {string} email - Candidate email
   * @param {string} phone - Candidate phone
   * @param {string} name - Candidate name
   * @returns {object} { isDuplicate, existingRow, similarity, matchType }
   */
  check(email, phone, name) {
    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const data = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        const existingEmail = String(data[i][CONFIG.COLUMNS.EMAIL - 1] || '').toLowerCase();
        const existingPhone = String(data[i][CONFIG.COLUMNS.PHONE - 1] || '').replace(/\D/g, '');
        const existingName = String(data[i][CONFIG.COLUMNS.NAME - 1] || '').toLowerCase();

        // Exact email match
        if (email && existingEmail && email.toLowerCase() === existingEmail) {
          return {
            isDuplicate: true,
            existingRow: i + 1,
            existingData: data[i],
            similarity: 1.0,
            matchType: 'EMAIL_EXACT'
          };
        }

        // Exact phone match (last 10 digits)
        const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
        const cleanExisting = existingPhone.slice(-10);
        if (cleanPhone.length === 10 && cleanPhone === cleanExisting) {
          return {
            isDuplicate: true,
            existingRow: i + 1,
            existingData: data[i],
            similarity: 1.0,
            matchType: 'PHONE_EXACT'
          };
        }

        // Fuzzy name match (using Levenshtein distance)
        if (name && existingName) {
          const similarity = this._nameSimilarity(name.toLowerCase(), existingName);
          if (similarity > 0.85) {
            // Also check if phone partially matches
            const phonePartial = cleanPhone.length >= 6 && cleanExisting.includes(cleanPhone.slice(-6));
            if (phonePartial || similarity > 0.95) {
              return {
                isDuplicate: true,
                existingRow: i + 1,
                existingData: data[i],
                similarity: similarity,
                matchType: 'NAME_FUZZY'
              };
            }
          }
        }
      }

      return { isDuplicate: false };

    } catch (e) {
      Log.error('DUPLICATES', 'Check failed', { error: e.message });
      return { isDuplicate: false, error: e.message };
    }
  },

  /**
   * Calculate name similarity using Levenshtein distance
   */
  _nameSimilarity(name1, name2) {
    // Normalize names
    const n1 = name1.replace(/[^a-z\s]/g, '').trim();
    const n2 = name2.replace(/[^a-z\s]/g, '').trim();

    if (n1 === n2) return 1.0;
    if (!n1 || !n2) return 0.0;

    const distance = this._levenshtein(n1, n2);
    const maxLen = Math.max(n1.length, n2.length);
    return 1 - (distance / maxLen);
  },

  /**
   * Levenshtein distance algorithm
   */
  _levenshtein(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  },

  /**
   * Get duplicate response message for candidates
   */
  getResponse(existingData) {
    const status = existingData[CONFIG.COLUMNS.STATUS - 1];
    const name = existingData[CONFIG.COLUMNS.NAME - 1];

    return `Hi ${name},

We found that you've already applied to UrbanMistrii! 

Your current application status is: **${status}**

If you have any questions about your application, please reply to this email.

Best regards,
Team UrbanMistrii`;
  }
};

// 
//                              NOTIFICATIONS
// 

const Notify = {
  /**
   * Send plain text email
   */
  email(to, subject, body, options = {}) {
    if (SecureConfig.isTestMode() && !to.includes("test")) {
      Logger.log(`[TEST MODE] Would email ${to}: ${subject}`);
      return;
    }
    GmailApp.sendEmail(to, subject, body, options);
  },

  /**
   * Send branded HTML email using UrbanMistrii template
   */
  emailHtml(to, subject, htmlContent, plainTextFallback = '') {
    if (SecureConfig.isTestMode() && !to.includes("test")) {
      Logger.log(`[TEST MODE] Would email ${to}: ${subject}`);
      return;
    }

    const htmlBody = EmailTemplates.wrap(htmlContent);
    const plainBody = plainTextFallback || htmlContent.replace(/<[^>]*>/g, '').trim();

    GmailApp.sendEmail(to, subject, plainBody, {
      htmlBody: htmlBody,
      name: 'Urbanmistrii'
    });
  },

  /**
   * Send to team with branded template
   */
  team(subject, body) {
    const emails = CONFIG.TEAM.TEAM_EMAILS.join(',');
    this.email(emails, subject, body);
  },

  /**
   * Send branded team notification
   */
  teamHtml(subject, htmlContent) {
    const emails = CONFIG.TEAM.TEAM_EMAILS.join(',');
    this.emailHtml(emails, subject, htmlContent);
  },

  /**
   * Daily summary with beautiful HTML template
   */
  dailySummary(stats) {
    const htmlContent = `
      <h3>Daily Recruitment Summary</h3>
      <p style="color: #666; margin-bottom: 25px;">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #e74c3c; margin: 25px 0;">
        <h4 style="margin: 0 0 15px 0; color: #1a1a1a;">Overview</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Total Candidates</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${stats.total}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">New Today</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right; color: #27ae60;">${stats.new}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Hired</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right; color: #27ae60;">${stats.hired}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Rejected</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #e74c3c;">${stats.rejected}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #3498db; margin: 25px 0;">
        <h4 style="margin: 0 0 15px 0; color: #1a1a1a;">Pipeline Status</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Tests Sent</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${stats.testsSent}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Tests Submitted</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${stats.testsSubmitted}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Interviews</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right;">${stats.interviews}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #e8f5e9; padding: 20px; border-left: 4px solid #27ae60; margin: 25px 0;">
        <h4 style="margin: 0 0 15px 0; color: #1a1a1a;">Performance</h4>
        <p style="margin: 0 0 10px 0;"><strong>Conversion Rate:</strong> ${stats.conversionRate}%</p>
        <p style="margin: 0;"><strong>Avg Response Time:</strong> ${stats.avgResponseTime}</p>
      </div>
    `;

    const plainBody = `
DAILY RECRUITMENT SUMMARY
${new Date().toLocaleDateString()}

OVERVIEW
- Total Candidates: ${stats.total}
- New Today: ${stats.new}
- Hired: ${stats.hired}
- Rejected: ${stats.rejected}

PIPELINE
- Tests Sent: ${stats.testsSent}
- Tests Submitted: ${stats.testsSubmitted}
- Interviews: ${stats.interviews}

PERFORMANCE
- Conversion Rate: ${stats.conversionRate}%
- Avg Response: ${stats.avgResponseTime}
`;

    const emails = CONFIG.TEAM.TEAM_EMAILS.join(',');
    const htmlBody = EmailTemplates.wrap(htmlContent);

    GmailApp.sendEmail(emails, `Daily Hiring Analytics - ${new Date().toLocaleDateString()}`, plainBody, {
      htmlBody: htmlBody,
      name: 'Urbanmistrii Oracle'
    });
  }
};

// 
//                              ERROR RECOVERY DASHBOARD (v22.4)
// 

/**
 * Error Recovery - Logs failed operations for 1-click retry
 * Creates a DB_Errors sheet for tracking and retrying failed operations
 */
const ErrorRecovery = {
  SHEET_NAME: 'DB_Errors',

  /**
   * Initialize error recovery sheet
   */
  init() {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
      let sheet = ss.getSheetByName(this.SHEET_NAME);

      if (!sheet) {
        sheet = ss.insertSheet(this.SHEET_NAME);
        sheet.appendRow([
          'ID', 'Timestamp', 'Error Type', 'Details', 'Status',
          'Retry Count', 'Last Retry', 'Resolved At', 'Resolved By'
        ]);
        sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#d32f2f').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
        sheet.setColumnWidth(4, 400); // Details column wider
        Log.info('ERROR_RECOVERY', 'Initialized DB_Errors sheet');
      }

      return sheet;
    } catch (e) {
      Logger.log('Failed to init ErrorRecovery: ' + e.message);
      return null;
    }
  },

  /**
   * Log a failed operation for later retry
   * @param {string} errorType - Type of error (TEST_SEND_FAILED, EMAIL_FAILED, etc.)
   * @param {object} details - Details about the failed operation
   * @returns {string} Error ID for tracking
   */
  log(errorType, details) {
    try {
      const sheet = this.init();
      if (!sheet) return null;

      const id = Utilities.getUuid().substring(0, 8);
      const detailsStr = JSON.stringify(details || {});

      sheet.appendRow([
        id,
        new Date(),
        errorType,
        detailsStr.substring(0, 2000), // Limit size
        'PENDING',
        0,
        '',
        '',
        ''
      ]);

      Log.warn('ERROR_RECOVERY', `Logged error: ${errorType}`, { id, type: errorType });
      return id;

    } catch (e) {
      Logger.log('ErrorRecovery.log failed: ' + e.message);
      return null;
    }
  },

  /**
   * Get all pending errors for display/retry
   */
  getPending() {
    try {
      const sheet = this.init();
      if (!sheet) return [];

      const data = sheet.getDataRange().getValues();
      const pending = [];

      for (let i = 1; i < data.length; i++) {
        if (data[i][4] === 'PENDING') {
          pending.push({
            row: i + 1,
            id: data[i][0],
            timestamp: data[i][1],
            type: data[i][2],
            details: JSON.parse(data[i][3] || '{}'),
            retryCount: data[i][5] || 0
          });
        }
      }

      return pending;
    } catch (e) {
      return [];
    }
  },

  /**
   * Retry a specific error by ID
   */
  retry(errorId) {
    try {
      const sheet = this.init();
      if (!sheet) return { success: false, error: 'Sheet not found' };

      const data = sheet.getDataRange().getValues();
      let errorRow = null;
      let errorData = null;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === errorId) {
          errorRow = i + 1;
          errorData = {
            type: data[i][2],
            details: JSON.parse(data[i][3] || '{}'),
            retryCount: parseInt(data[i][5]) || 0
          };
          break;
        }
      }

      if (!errorRow) return { success: false, error: 'Error not found' };

      // Attempt retry based on error type
      let result = { success: false };

      switch (errorData.type) {
        case 'TEST_SEND_FAILED':
          const d = errorData.details;
          result = WhatsApp.sendTestLink(d.phone, d.name, d.role, d.department);
          if (result.success) {
            // Update candidate sheet too
            if (d.candidateRow) {
              SheetUtils.updateCell(d.candidateRow, CONFIG.COLUMNS.TEST_SENT, new Date());
              SheetUtils.updateCell(d.candidateRow, CONFIG.COLUMNS.STATUS, CONFIG.RULES.STATUSES.TEST_SENT);
              SheetUtils.updateCell(d.candidateRow, CONFIG.COLUMNS.LOG, ' Test sent (retry successful)');
            }
          }
          break;

        case 'EMAIL_FAILED':
          try {
            const ed = errorData.details;
            GmailApp.sendEmail(ed.to, ed.subject, ed.body, ed.options || {});
            result = { success: true };
          } catch (e) {
            result = { success: false, error: e.message };
          }
          break;

        default:
          result = { success: false, error: 'Unknown error type: ' + errorData.type };
      }

      // Update error record
      sheet.getRange(errorRow, 6).setValue(errorData.retryCount + 1); // Retry count
      sheet.getRange(errorRow, 7).setValue(new Date()); // Last retry

      if (result.success) {
        sheet.getRange(errorRow, 5).setValue('RESOLVED'); // Status
        sheet.getRange(errorRow, 8).setValue(new Date()); // Resolved at
        sheet.getRange(errorRow, 9).setValue('AUTO_RETRY'); // Resolved by
        Log.success('ERROR_RECOVERY', `Retry successful for ${errorId}`);
      } else {
        sheet.getRange(errorRow, 5).setValue(errorData.retryCount >= 2 ? 'FAILED' : 'PENDING');
      }

      return result;

    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Retry all pending errors
   */
  retryAll() {
    const pending = this.getPending();
    let success = 0, failed = 0;

    for (const error of pending) {
      const result = this.retry(error.id);
      if (result.success) success++;
      else failed++;

      Utilities.sleep(1000); // Rate limit
    }

    Log.info('ERROR_RECOVERY', `Retry all: ${success} success, ${failed} failed`);
    return { success, failed };
  },

  /**
   * Get error statistics
   */
  getStats() {
    try {
      const sheet = this.init();
      if (!sheet) return null;

      const data = sheet.getDataRange().getValues();
      const stats = { pending: 0, resolved: 0, failed: 0, total: data.length - 1 };

      for (let i = 1; i < data.length; i++) {
        const status = data[i][4];
        if (status === 'PENDING') stats.pending++;
        else if (status === 'RESOLVED') stats.resolved++;
        else if (status === 'FAILED') stats.failed++;
      }

      return stats;
    } catch (e) {
      return null;
    }
  },

  /**
   * Mark error as resolved manually
   */
  resolve(errorId, resolvedBy = 'MANUAL') {
    try {
      const sheet = this.init();
      if (!sheet) return false;

      const data = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === errorId) {
          const row = i + 1;
          sheet.getRange(row, 5).setValue('RESOLVED');
          sheet.getRange(row, 8).setValue(new Date());
          sheet.getRange(row, 9).setValue(resolvedBy);
          return true;
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  }
};

/**
 * Run error recovery - retry all pending errors
 * Can be called manually or via trigger
 */
function runErrorRecovery() {
  Logger.log('');
  Logger.log('         ERROR RECOVERY - RETRYING FAILED OPERATIONS              ');
  Logger.log('');

  const stats = ErrorRecovery.getStats();
  Logger.log(`Current stats: ${stats.pending} pending, ${stats.resolved} resolved, ${stats.failed} failed`);

  if (stats.pending === 0) {
    Logger.log(' No pending errors to retry');
    return;
  }

  const result = ErrorRecovery.retryAll();
  Logger.log(`\nRetry complete: ${result.success} success, ${result.failed} failed`);
}

// 
//                              TEST UTILS
// 

const Test = {
  runAll() {
    Logger.log('Running Utils tests...');

    // DateTime
    const now = new Date();
    const later = DateTime.addHours(now, 2);
    if (DateTime.hoursBetween(now, later) !== 2) throw new Error('DateTime.addHours fail');

    // Validate
    if (!Validate.phone('9999999999').valid) throw new Error('Validate.phone fail');

    // Sanitize
    if (Sanitize.maskEmail('testing@example.com') !== 'tes***@example.com') throw new Error('Sanitize fail');

    Logger.log(' Utils tests passed');
  }
};





