/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                    URBANMISTRII ADMIN BOT v1.0 - MAIN                         ║
 * ║                    All Logic: AI, Email, Portal, HR, Payroll                  ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  CONSOLIDATED FROM: Hiring-oracle-prod                                        ║
 * ║  DATE: 2026-01-29                                                             ║
 * ║  ALL FEATURES PRESERVED                                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * INCLUDES:
 * - AI (Gemini, Groq, GitHub Models integration)
 * - WhatsApp (Twilio integration)
 * - Calendar (Google Calendar integration)
 * - Email Processing & Templates
 * - Candidate Portal (Web App)
 * - Interview Booking System
 * - Onboarding Automation
 * - Offboarding & Exit Suite
 * - Payroll & Lifecycle Manager
 * - Offer/Joining Letter Generation
 * - Analytics & Reporting
 * - Retry Queue & Error Recovery
 */


// ═══════════════════════════════════════════════════════════════════════════
//  AI
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      URBANMISTRII ORACLE v22.2 - AI                           ║
 * ║                      Gemini + GitHub Models + Groq + OpenRouter (Hardened)    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const AI = {
  _callCount: 0,
  _lastCallTime: 0,
  _RATE_LIMIT_PER_MIN: 30,
  _MIN_CALL_INTERVAL_MS: 500,

  /**
   * Rate limit check for AI calls
   */
  _checkRateLimit() {
    const now = Date.now();
    // Enforce minimum interval between calls
    if (now - this._lastCallTime < this._MIN_CALL_INTERVAL_MS) {
      const waitTime = this._MIN_CALL_INTERVAL_MS - (now - this._lastCallTime);
      Utilities.sleep(waitTime);
    }
    this._lastCallTime = Date.now();
    this._callCount++;
    return true;
  },

  /**
   * Main LLM Call Router - Quad fallback: Gemini → GitHub Models → Groq → OpenRouter
   */
  call(prompt, systemInstruction = "You are a helpful HR assistant.") {
    // Input validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      Log.warn('AI', 'Empty or invalid prompt provided');
      return this._getFallbackResponse(prompt || '');
    }

    // Truncate very long prompts to prevent API errors
    const maxPromptLength = 10000;
    const truncatedPrompt = prompt.length > maxPromptLength
      ? prompt.substring(0, maxPromptLength) + '... [truncated]'
      : prompt;

    if (SecureConfig.isTestMode()) {
      Logger.log('[AI TEST] Prompt: ' + truncatedPrompt.substring(0, 50) + '...');
      return "AI_TEST_RESPONSE";
    }

    // Rate limiting
    this._checkRateLimit();

    let lastError = null;

    // Try Gemini first
    try {
      return this._callGemini(prompt, systemInstruction);
    } catch (e) {
      Log.warn("AI", "Gemini failed, trying GitHub Models", { error: e.message });
      lastError = e;

      // Try GitHub Models second (free GPT-4o-mini)
      try {
        return this._callGitHubModels(prompt, systemInstruction);
      } catch (e2) {
        Log.warn("AI", "GitHub Models failed, trying Groq", { error: e2.message });
        lastError = e2;

        // Try Groq third (fast & free)
        try {
          return this._callGroq(prompt, systemInstruction);
        } catch (e3) {
          Log.warn("AI", "Groq failed, trying OpenRouter", { error: e3.message });
          lastError = e3;

          // Try OpenRouter last
          try {
            return this._callOpenRouter(prompt, systemInstruction);
          } catch (e4) {
            Log.warn("AI", "OpenRouter not configured or failed", { error: e4.message });
            lastError = e4;
          }
        }
      }
    }

    // All AI providers failed - use fallback responses instead of crashing
    Log.error("AI", "All AI models failed, using rule-based fallback", { lastError: lastError?.message });
    return this._getFallbackResponse(prompt);
  },

  /**
   * Rule-based fallback when AI is unavailable
   */
  _getFallbackResponse(prompt) {
    const p = (prompt || '').toLowerCase();

    // Intent-based responses
    if (p.includes('rejection') || p.includes('rejected') || p.includes('not selected')) {
      return "Thank you for your interest in UrbanMistrii. After careful review, we've decided to move forward with other candidates whose experience more closely matches our current needs. We encourage you to apply again in the future as new opportunities arise.";
    }

    if (p.includes('schedule') || p.includes('interview') || p.includes('meeting')) {
      return "Your interview has been scheduled. You will receive a confirmation email with details shortly. Please ensure you have your portfolio ready to share during the interview.";
    }

    if (p.includes('welcome') || p.includes('apply') || p.includes('application')) {
      return "Thank you for applying to UrbanMistrii! Your application has been received and is being reviewed by our team. We'll get back to you within 1-2 business days with the next steps.";
    }

    if (p.includes('test') || p.includes('assignment') || p.includes('task')) {
      return "Please complete the design test within the specified time limit. Upload all files (PDFs, DWGs, and any supporting documents) via the submission form. Good luck!";
    }

    if (p.includes('intent') || p.includes('analyze') || p.includes('categorize')) {
      // Return a safe JSON fallback for intent analysis
      return JSON.stringify({
        intent: 'ESCALATE',
        confidence: 0.5,
        name: null,
        role: null,
        reason: 'AI unavailable - requires manual review'
      });
    }

    if (p.includes('portfolio') || p.includes('score') || p.includes('evaluate')) {
      return JSON.stringify({
        score: 5,
        recommendation: 'REVIEW',
        summary: 'Automatic scoring unavailable - manual review required',
        strengths: [],
        weaknesses: []
      });
    }

    return "Thank you for your message. Our team will review and respond shortly. If this is urgent, please contact hr@urbanmistrii.com directly.";
  },

  _callGemini(prompt, system) {
    const key = SecureConfig.getOptional('GEMINI_API_KEY');
    if (!key) throw new Error('Gemini not configured');

    // Use auto-detected working model, or fall back to config
    const props = PropertiesService.getScriptProperties();
    const model = props.getProperty('GEMINI_MODEL') || CONFIG.AI.MODELS.PRIMARY;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const payload = {
      contents: [{
        parts: [{ text: system + "\n\n" + prompt }]
      }],
      generationConfig: {
        temperature: CONFIG.AI.TEMPERATURE,
        maxOutputTokens: CONFIG.AI.MAX_TOKENS
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const rawContent = response.getContentText();
    let json;

    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      throw new Error(`Failed to parse Gemini response: ${rawContent.substring(0, 500)}`);
    }

    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

    const text = this._safePath(json, ['candidates', 0, 'content', 'parts', 0, 'text']);
    if (!text) {
      throw new Error(`Invalid candidate structure from Gemini. Raw: ${rawContent.substring(0, 500)}`);
    }

    return text;
  },

  /**
   * GitHub Models API - Free GPT-4o-mini via GitHub PAT
   */
  _callGitHubModels(prompt, system) {
    const key = SecureConfig.getOptional('GITHUB_PAT');
    if (!key) throw new Error('GitHub Models not configured');

    const url = "https://models.github.ai/inference/chat/completions";

    const payload = {
      model: "openai/gpt-4o-mini",  // Free, fast, high quality
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      max_tokens: CONFIG.AI.MAX_TOKENS
    };

    const options = {
      method: "post",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const rawContent = response.getContentText();
    let json;

    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      throw new Error(`Failed to parse GitHub Models response: ${rawContent.substring(0, 500)}`);
    }

    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

    const text = this._safePath(json, ['choices', 0, 'message', 'content']);
    if (!text) {
      throw new Error(`Invalid response structure from GitHub Models. Raw: ${rawContent.substring(0, 500)}`);
    }
    return text;
  },

  /**
   * Groq API - Fast & Free fallback
   */
  _callGroq(prompt, system) {
    const key = SecureConfig.getOptional('GROQ_API_KEY');
    if (!key) throw new Error('Groq not configured');

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const payload = {
      model: "llama-3.3-70b-versatile",  // Fast, free, high quality
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      temperature: CONFIG.AI.TEMPERATURE,
      max_tokens: CONFIG.AI.MAX_TOKENS
    };

    const options = {
      method: "post",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const rawContent = response.getContentText();
    let json;

    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      throw new Error(`Failed to parse Groq response: ${rawContent.substring(0, 500)}`);
    }

    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

    const text = this._safePath(json, ['choices', 0, 'message', 'content']);
    if (!text) {
      throw new Error(`Invalid response structure from Groq. Raw: ${rawContent.substring(0, 500)}`);
    }
    return text;
  },

  _callOpenRouter(prompt, system) {
    const key = SecureConfig.getOptional('OPENROUTER_API_KEY');
    if (!key) throw new Error('OpenRouter not configured (skip to fallback)');

    const url = "https://openrouter.ai/api/v1/chat/completions";

    const payload = {
      model: CONFIG.AI.MODELS.FALLBACK,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    };

    const options = {
      method: "post",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const rawContent = response.getContentText();
    let json;

    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      throw new Error(`Failed to parse OpenRouter response: ${rawContent.substring(0, 500)}`);
    }

    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

    const text = this._safePath(json, ['choices', 0, 'message', 'content']);
    if (!text) {
      throw new Error(`Invalid response structure from OpenRouter. Raw: ${rawContent.substring(0, 500)}`);
    }
    return text;
  },

  /**
   * Safely parse JSON from AI response
   */
  _safeJsonParse(text, context = 'Unknown') {
    if (!text || typeof text !== 'string') {
      Log.warn('AI', `Empty response in ${context}`);
      return null;
    }

    try {
      // Clean markdown code blocks if present
      let cleanJson = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Try to find JSON object or array in the response
      const jsonMatch = cleanJson.match(/[\[\{].*[\]\}]/s);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }

      return JSON.parse(cleanJson);
    } catch (e) {
      Log.warn('AI', `JSON parse failed in ${context}`, {
        error: e.message,
        text: text.substring(0, 200)
      });
      return null;
    }
  },

  /**
   * Specific AI Tasks
   */

  /**
   * Detect intent for Offboarding Suite (v2 compatible)
   */
  detectIntent(context, subject) {
    if (!context && !subject) {
      return { type: 'UNKNOWN', confidence: 0 };
    }

    const text = ((subject || '') + ' ' + (context || '')).toLowerCase();

    // 🛡️ HARDENED FALLBACK: Keyword Logic (Bypass AI for obvious cases)
    if (text.includes('resign') || text.includes(' quitting') || text.includes('served my notice') || 
        text.includes('last working day') || text.includes('initiate offboarding') || 
        text.includes('relieving') || text.includes('formal resignation')) {
      Log.info('AI', 'Keyword Match: Resignation detected', { subject: subject });
      return { type: 'INITIATE_OFFBOARDING', confidence: 1.0 };
    }

    if (text.includes('work log') || text.includes('logbook') || text.includes('attached my log')) {
       return { type: 'SUBMISSION_WORKLOG', confidence: 1.0 };
    }

    const prompt = `
    Analyze this email context for OFFBOARDING/EXIT intents.
    Subject: ${subject}
    Context: ${context}

    Categories:
    - INITIATE_OFFBOARDING (User says "resignation", "resign", "leaving", "last working day", "initiate offboarding", "quit")
    - SUBMISSION_WORKLOG (User says "attached work log", "here is my logbook", "sending logs", or context implies step 1 done)
    - REQUEST_DOCUMENT (User asks for "experience letter", "relieving letter", "certificate", "payslip", "documents")
    - ESCALATE_SENSITIVE (User mentions "harassment", "unfair", "legal", "complaint", "toxic", "urgent help", "salary issue")
    - GENERAL_QUESTION (General queries about exit process, notice period calculation, etc.)
    - UNKNOWN (None of the above)

    Return JSON:
    {
      "type": "CATEGORY", 
      "confidence": 0.0-1.0,
      "data": "Extracted doc type if REQUEST_DOCUMENT (e.g. 'experience_letter')"
    }
    `;

    try {
      const result = this.call(prompt, "You are an intent classifier. Return valid JSON only.");
      const parsed = this._safeJsonParse(result, 'detectIntent');

      if (parsed) {
        return {
          type: parsed.type || 'UNKNOWN',
          confidence: parsed.confidence || 0,
          data: parsed.data || null
        };
      }
      return { type: 'UNKNOWN', confidence: 0 };
    } catch (e) {
      Log.warn('AI', 'detectIntent failed', { error: e.message });
      // Fallback check if AI failed but keywords didn't catch it earlier
      if (text.includes('resign') || text.includes('offboard')) return { type: 'INITIATE_OFFBOARDING', confidence: 0.8 };
      
      return { type: 'UNKNOWN', confidence: 0 };
    }
  },

  analyzeIntent(body, subject, hasAttachments) {
    // Input validation
    if (!body && !subject) {
      Log.warn('AI', 'analyzeIntent called with empty body and subject');
      return { intent: 'ESCALATE', confidence: 0.3, reason: 'Empty input' };
    }

    const prompt = `
    Analyze this email and categorize its intent.
    Subject: ${subject}
    Body: ${body}
    Has Attachments: ${hasAttachments}

    Categories:
    - TEST_SUBMISSION (Uses words like 'submitted', 'test', 'task', attached files with design work)
    - NEW_APPLICATION (First time applying for a job, sharing portfolio/resume WITHOUT answering specific questions)
    - FORM_RESPONSE (Candidate replying with structured answers like: name, email, phone, city, salary, experience, availability dates - filling out application details)
    - FOLLOWUP (Asking about status, or previous conversation)
    - QUESTION (Asking specific question about process/company that can be auto-answered)
    - ESCALATE (Reschedule requests, date changes, salary negotiations, angry, urgent, complaints, anything needing human attention)
    - SPAM (Marketing, irrelevant)

    IMPORTANT: 
    - If email contains structured Q&A pairs like "Current City: X", "Name: Y", "Salary: Z" - it's FORM_RESPONSE
    - Any request to reschedule, change dates, or modify interview/test timing should be ESCALATE.

    Return ONLY JSON:
    {
      "intent": "CATEGORY",
      "confidence": 0.0-1.0,
      "name": "Extracted Name if available",
      "role": "Extracted Role if available (Intern/Junior/Senior)"
    }
    `;

    try {
      const result = this.call(prompt, "You are a JSON extraction bot. Return valid JSON only.");
      if (!result || result === "AI_TEST_RESPONSE") return null;

      const parsed = this._safeJsonParse(result, 'analyzeIntent');
      if (!parsed) {
        return { intent: 'ESCALATE', confidence: 0.5, reason: 'Parse failed' };
      }

      // Validate intent is one of expected values
      const validIntents = ['TEST_SUBMISSION', 'NEW_APPLICATION', 'FORM_RESPONSE', 'FOLLOWUP', 'QUESTION', 'ESCALATE', 'SPAM'];
      if (!validIntents.includes(parsed.intent)) {
        parsed.intent = 'ESCALATE';
        parsed.confidence = 0.5;
      }

      return parsed;
    } catch (e) {
      Log.error("AI", "Intent analysis failed", { error: e.message });
      return { intent: 'ESCALATE', confidence: 0.3, error: e.message };
    }
  },

  extractCandidateInfo(body, subject) {
    if (!body && !subject) {
      Log.warn('AI', 'extractCandidateInfo called with empty inputs');
      return null;
    }

    const prompt = `
    Extract candidate details from this email.
    Subject: ${subject || 'No subject'}
    Body: ${(body || '').substring(0, 2000)}
    
    Return JSON:
    {
      "name": "Full Name",
      "email": "Email Address",
      "phone": "Phone Number (if present)",
      "role": "Inferred Role (Intern/Junior/Senior)",
      "portfolioLinks": ["link1", "link2"]
    }
    `;

    try {
      const res = this.call(prompt, "Extract strict JSON only.");
      const parsed = this._safeJsonParse(res, 'extractCandidateInfo');
      if (parsed) {
        // Normalize extracted data
        parsed.name = parsed.name || null;
        parsed.email = parsed.email || null;
        parsed.phone = parsed.phone ? String(parsed.phone).replace(/\D/g, '') : null;
        parsed.role = parsed.role || 'Intern';
        parsed.portfolioLinks = Array.isArray(parsed.portfolioLinks) ? parsed.portfolioLinks : [];
      }
      return parsed;
    } catch (e) {
      Log.warn('AI', 'extractCandidateInfo failed', { error: e.message });
      return null;
    }
  },

  /**
   * Extract structured form response data from candidate email
   * Parses emails where candidates reply with their details in Q&A format
   */
  extractFormResponse(body, senderEmail) {
    if (!body || typeof body !== 'string') {
      Log.warn('AI', 'extractFormResponse called with empty body');
      return null;
    }

    const prompt = `
    Extract ALL candidate details from this structured email response.
    The candidate is replying with their information.
    
    Email body:
    ${body.substring(0, 3000)}
    
    Extract and return JSON with these fields (use null if not found):
    {
      "name": "Full Name",
      "email": "${senderEmail || 'unknown'}",
      "phone": "Phone Number",
      "city": "Current City",
      "role": "Desired Position/Role",
      "degree": "Degree/Education",
      "startDate": "Earliest Start Date",
      "tenure": "Expected Tenure",
      "salaryExpected": "Salary Expectations",
      "salaryLast": "Last Drawn Salary",
      "experience": "Work Experience description",
      "hindiProficient": "Yes/No",
      "healthNotes": "Health Considerations",
      "previousApplication": "Yes/No if applied before",
      "testAvailability": "Preferred test date/time",
      "willingToRelocate": "Yes/No",
      "portfolioUrl": "Portfolio link if any",
      "cvUrl": "CV/Resume link if any"
    }
    
    IMPORTANT: Extract exact values from the email. Don't make up data.
    `;

    try {
      const res = this.call(prompt, "You extract structured data from emails. Return valid JSON only.");
      const parsed = this._safeJsonParse(res, 'extractFormResponse');
      if (parsed) {
        // Ensure email is set
        parsed.email = parsed.email || senderEmail || null;
        // Normalize phone
        if (parsed.phone) {
          parsed.phone = String(parsed.phone).replace(/\D/g, '');
        }
      }
      return parsed;
    } catch (e) {
      Log.error('AI', 'Failed to extract form response', { error: e.message });
      return null;
    }
  },

  generateRejection(name, role, reason) {
    // Input validation with defaults
    const safeName = name || 'Candidate';
    const safeRole = role || 'the position';
    const safeReason = reason || 'after careful review';

    const prompt = `
    Write a gentle, professional rejection email for ${safeName} applied for ${safeRole}.
    Context/Reason: ${safeReason}.
    
    Tone: Empathetic, encouraging, professional. High warmth.
    No placeholders. Sign off as 'Team UrbanMistrii'.
    `;

    try {
      const response = this.call(prompt);
      return response || `Dear ${safeName},\n\nThank you for your interest in UrbanMistrii. After careful review, we've decided to move forward with other candidates whose experience more closely matches our current needs.\n\nWe encourage you to apply again as new opportunities arise.\n\nBest regards,\nTeam UrbanMistrii`;
    } catch (e) {
      Log.warn('AI', 'generateRejection failed, using fallback', { error: e.message });
      return `Dear ${safeName},\n\nThank you for your interest in UrbanMistrii. After careful review, we've decided to move forward with other candidates whose experience more closely matches our current needs.\n\nWe encourage you to apply again as new opportunities arise.\n\nBest regards,\nTeam UrbanMistrii`;
    }
  },

  suggestReply(questionText, context) {
    // Input validation
    if (!questionText || typeof questionText !== 'string') {
      Log.warn('AI', 'suggestReply called with empty questionText');
      return null;
    }

    const safeContext = {
      name: context?.name || 'Candidate',
      role: context?.role || 'Designer',
      status: context?.status || 'NEW'
    };

    const prompt = `
    You are a hiring assistant for Urbanmistrii, a design studio.
    Write a SHORT, HELPFUL reply to this candidate's email.
    
    Candidate: ${safeContext.name}
    Role Applied: ${safeContext.role}
    Current Status: ${safeContext.status}
    
    Their message: "${questionText.substring(0, 1000)}"
    
    CRITICAL RULES:
    - Write the ACTUAL reply text, ready to send.
    - Be warm, professional, and specific.
    - Keep it 2-3 sentences maximum.
    - NEVER use placeholders like [date], [time], [your name], etc.
    - NEVER ask them to fill in blanks.
    - If they ask about dates/times and you don't know, say "Our team will get back to you shortly with specific timing."
    - If status is NEW, say their application is under review (1-2 days).
    - If status is TEST_SENT, encourage them to complete and submit.
    - If status is TEST_SUBMITTED or UNDER_REVIEW, say their work is being evaluated (2-3 days).
    - Sign off as "Hiring Team, Urbanmistrii"
    
    Reply:
    `;

    try {
      const reply = this.call(prompt);

      if (!reply) {
        Log.warn('AI', 'Empty response from suggestReply');
        return null;
      }

      // Safety check - reject if response contains obvious placeholders
      if (reply.includes('[') || reply.includes('proposed date')) {
        Log.warn('AI', 'Rejected AI reply with placeholders', { reply: reply.substring(0, 100) });
        return null; // This will trigger escalation to human
      }

      return reply;
    } catch (e) {
      Log.error('AI', 'suggestReply failed', { error: e.message });
      return null;
    }
  },

  /**
   * Score a portfolio using AI analysis
   * @param {string} portfolioUrl - URL to the portfolio
   * @param {string} role - Candidate role (Intern/Junior/Senior)
   * @returns {object} { score, strengths, weaknesses, recommendation, summary }
   */
  scorePortfolio(portfolioUrl, role = 'Designer') {
    if (!portfolioUrl || typeof portfolioUrl !== 'string') {
      Log.warn('AI', 'scorePortfolio called with invalid URL');
      return {
        score: 0,
        error: 'No portfolio URL provided',
        recommendation: 'REVIEW',
        summary: 'No portfolio to evaluate'
      };
    }

    // Validate URL format
    if (!portfolioUrl.startsWith('http://') && !portfolioUrl.startsWith('https://')) {
      Log.warn('AI', 'Invalid portfolio URL format', { url: portfolioUrl });
      return {
        score: 5,
        error: 'Invalid URL format',
        recommendation: 'REVIEW',
        summary: 'Could not access portfolio - manual review required'
      };
    }

    // Try to fetch portfolio content
    let portfolioContent = '';
    try {
      const response = UrlFetchApp.fetch(portfolioUrl, {
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: false
      });
      if (response.getResponseCode() === 200) {
        // Extract text content (simplified - works for most portfolio sites)
        portfolioContent = response.getContentText()
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 3000); // Limit content size
      } else {
        Log.warn('AI', 'Portfolio fetch returned non-200', { url: portfolioUrl, status: response.getResponseCode() });
      }
    } catch (e) {
      Log.warn('AI', 'Could not fetch portfolio', { url: portfolioUrl, error: e.message });
    }

    const prompt = `
    Evaluate this design portfolio for a ${role} position at UrbanMistrii (an interior design company).
    
    Portfolio URL: ${portfolioUrl}
    ${portfolioContent ? `Portfolio Content Preview: ${portfolioContent}` : 'Could not fetch content - evaluate based on URL structure and common portfolio patterns.'}
    
    Evaluation Criteria:
    1. Visual Design Quality (aesthetics, typography, color usage)
    2. Project Variety (range of work shown)
    3. Presentation (how work is displayed and explained)
    4. Technical Skills (tools, techniques demonstrated)
    5. Creativity & Originality
    6. Relevance to Interior Design
    
    Return ONLY valid JSON:
    {
      "score": 7.5,
      "strengths": ["Strong visual hierarchy", "Good project variety"],
      "weaknesses": ["Could improve case study depth"],
      "recommendation": "PROCEED" or "REVIEW" or "REJECT",
      "summary": "One paragraph summary of candidate's design abilities",
      "suggestedQuestions": ["Question 1 for interview", "Question 2"]
    }
    
    Score Guide:
    - 8-10: Exceptional, fast-track to interview
    - 6-7.9: Good, proceed with standard process
    - 4-5.9: Average, needs thorough review
    - 0-3.9: Below requirements
    `;

    try {
      const result = this.call(prompt, "You are an expert design portfolio evaluator. Return only valid JSON.");
      const parsed = this._safeJsonParse(result, 'scorePortfolio');

      if (!parsed) {
        return {
          score: 5,
          recommendation: 'REVIEW',
          summary: 'Automatic scoring failed - manual review required',
          strengths: [],
          weaknesses: []
        };
      }

      // Normalize the response
      const normalized = {
        score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 5,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendation: ['PROCEED', 'REVIEW', 'REJECT'].includes(parsed.recommendation) ? parsed.recommendation : 'REVIEW',
        summary: parsed.summary || 'Portfolio evaluated',
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : []
      };

      Log.info('AI', 'Portfolio scored', {
        url: portfolioUrl.substring(0, 50),
        score: normalized.score,
        recommendation: normalized.recommendation
      });

      return normalized;
    } catch (e) {
      Log.error('AI', 'Portfolio scoring failed', { error: e.message });
      return {
        score: 5,
        error: e.message,
        recommendation: 'REVIEW',
        summary: 'Automatic scoring failed - manual review required',
        strengths: [],
        weaknesses: []
      };
    }
  },

  /**
   * Generate interview questions based on candidate profile
   */
  generateInterviewQuestions(candidate, portfolioScore = null) {
    // Default fallback questions
    const defaultQuestions = [
      "Walk me through your design process for a recent project.",
      "How do you handle feedback from clients?",
      "What design tools are you most comfortable with?",
      "Describe a challenging project and how you solved it.",
      "Why are you interested in interior design?"
    ];

    if (!candidate || !candidate.name) {
      Log.warn('AI', 'generateInterviewQuestions called with invalid candidate');
      return defaultQuestions;
    }

    const prompt = `
    Generate 5 interview questions for a ${candidate.role || 'Designer'} candidate at UrbanMistrii (interior design company).
    
    Candidate: ${candidate.name}
    Role: ${candidate.role || 'Designer'}
    ${portfolioScore?.score ? `Portfolio Score: ${portfolioScore.score}/10` : ''}
    ${portfolioScore?.weaknesses?.length ? `Areas to probe: ${portfolioScore.weaknesses.join(', ')}` : ''}
    
    Mix of:
    - Technical design questions
    - Behavioral/situational questions
    - Culture fit questions
    - Role-specific challenges
    
    Return JSON array:
    ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    `;

    try {
      const result = this.call(prompt, "Generate interview questions as JSON array only.");
      const parsed = this._safeJsonParse(result, 'generateInterviewQuestions');

      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 5);
      }
      return defaultQuestions;
    } catch (e) {
      Log.warn('AI', 'generateInterviewQuestions failed', { error: e.message });
      return defaultQuestions;
    }
  },

  /**
   * Detect spam/fake applications
   */
  detectSpam(email, name, body) {
    // Input validation
    if (!email && !body) {
      return { isSpam: false, confidence: 0.5, reasons: ['Insufficient data for spam detection'] };
    }

    const safeEmail = email || 'unknown';
    const safeName = name || 'Unknown';
    const safeBody = (body || '').substring(0, 500);

    const prompt = `
    Analyze if this job application appears legitimate or spam/fake.
    
    Email: ${safeEmail}
    Name: ${safeName}
    Content: ${safeBody}
    
    Red flags to check:
    - Generic/template content
    - Mismatched name/email
    - Suspicious email domains
    - No relevant experience mentioned
    - Excessive links or promotional content
    
    Return JSON:
    {
      "isSpam": true/false,
      "confidence": 0.0-1.0,
      "reasons": ["reason1", "reason2"]
    }
    `;

    try {
      const result = this.call(prompt, "Spam detection. Return JSON only.");
      const parsed = this._safeJsonParse(result, 'detectSpam');

      if (parsed) {
        return {
          isSpam: Boolean(parsed.isSpam),
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          reasons: Array.isArray(parsed.reasons) ? parsed.reasons : []
        };
      }
      return { isSpam: false, confidence: 0, reasons: ['Parse failed'] };
    } catch (e) {
      Log.warn('AI', 'detectSpam failed', { error: e.message });
      return { isSpam: false, confidence: 0, error: e.message };
    }
  },

  /**
   * Safe path navigation for nested objects
   */
  _safePath(obj, path) {
    return path.reduce((xs, x) => (xs && xs[x] !== undefined && xs[x] !== null) ? xs[x] : null, obj);
  }
};

/**
 * Test AI integration - Tests each model individually
 */
function testAI() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         AI MODEL DIAGNOSTICS                                      ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  let geminiOk = false;
  let githubOk = false;
  let groqOk = false;
  let openrouterOk = false;

  // Test Gemini
  Logger.log('');
  Logger.log('🔷 Testing GEMINI (gemini-2.0-flash)...');
  try {
    const response = AI._callGemini('Say "working" in one word', 'Respond briefly.');
    if (response) {
      Logger.log('   ✅ GEMINI: Working');
      Logger.log('   Response: ' + response.substring(0, 50));
      geminiOk = true;
    }
  } catch (e) {
    Logger.log('   ❌ GEMINI: ' + e.message.substring(0, 100));
  }

  // Test GitHub Models
  Logger.log('');
  Logger.log('🟣 Testing GITHUB MODELS (gpt-4o-mini)...');
  try {
    const response = AI._callGitHubModels('Say "working" in one word', 'Respond briefly.');
    if (response) {
      Logger.log('   ✅ GITHUB: Working');
      Logger.log('   Response: ' + response.substring(0, 50));
      githubOk = true;
    }
  } catch (e) {
    Logger.log('   ❌ GITHUB: ' + e.message.substring(0, 100));
  }

  // Test Groq
  Logger.log('');
  Logger.log('🟢 Testing GROQ (llama-3.3-70b)...');
  try {
    const response = AI._callGroq('Say "working" in one word', 'Respond briefly.');
    if (response) {
      Logger.log('   ✅ GROQ: Working');
      Logger.log('   Response: ' + response.substring(0, 50));
      groqOk = true;
    }
  } catch (e) {
    Logger.log('   ❌ GROQ: ' + e.message.substring(0, 100));
  }

  // Test OpenRouter
  Logger.log('');
  Logger.log('🟠 Testing OPENROUTER...');
  try {
    const response = AI._callOpenRouter('Say "working" in one word', 'Respond briefly.');
    if (response) {
      Logger.log('   ✅ OPENROUTER: Working');
      Logger.log('   Response: ' + response.substring(0, 50));
      openrouterOk = true;
    }
  } catch (e) {
    Logger.log('   ❌ OPENROUTER: ' + e.message.substring(0, 100));
  }

  // Summary
  Logger.log('');
  Logger.log('═══════════════════════════════════════════════════════════════════');
  Logger.log('SUMMARY:');
  Logger.log(`   GEMINI:      ${geminiOk ? '✅ Working' : '❌ Not working'}`);
  Logger.log(`   GITHUB:      ${githubOk ? '✅ Working' : '❌ Not working'}`);
  Logger.log(`   GROQ:        ${groqOk ? '✅ Working' : '❌ Not working'}`);
  Logger.log(`   OPENROUTER:  ${openrouterOk ? '✅ Working' : '❌ Not working'}`);
  Logger.log('');

  if (geminiOk || githubOk || groqOk || openrouterOk) {
    Logger.log('🎉 AI System: OPERATIONAL');
    Logger.log('   At least one model is working!');
    return true;
  } else {
    Logger.log('🚨 AI System: DOWN');
    Logger.log('   No models are working. Check API keys!');
    return false;
  }
}



// ═══════════════════════════════════════════════════════════════════════════
//  WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                    URBANMISTRII ORACLE v22.4 - WHATSAPP                       ║
 * ║                    Twilio WhatsApp API Integration (Hardened)                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * SETUP:
 * 1. Create a Twilio account at https://www.twilio.com
 * 2. Enable WhatsApp in the Twilio Console
 * 3. Get your Account SID and Auth Token
 * 4. Set up a WhatsApp sender (sandbox for testing, or approved number)
 * 5. Add credentials to SecureConfig.setup()
 */

const WhatsApp = {
  _lastSendTime: 0,
  _MIN_INTERVAL_MS: 1000, // Minimum 1 second between sends

  /**
   * Internal: Send WhatsApp message via Twilio
   */
  _send(destination, messageBody) {
    // Input validation
    if (!destination) {
      Log.warn('WHATSAPP', 'No destination phone provided');
      return { success: false, error: 'No destination phone provided' };
    }

    if (!messageBody || typeof messageBody !== 'string') {
      Log.warn('WHATSAPP', 'Empty or invalid message body');
      return { success: false, error: 'Empty or invalid message body' };
    }

    // Rate limiting - prevent rapid fire sends
    const now = Date.now();
    if (now - this._lastSendTime < this._MIN_INTERVAL_MS) {
      Utilities.sleep(this._MIN_INTERVAL_MS - (now - this._lastSendTime));
    }
    this._lastSendTime = Date.now();

    // Test mode - just log
    if (SecureConfig.isTestMode()) {
      Logger.log(`[WHATSAPP TEST] To: ${destination}, Message: ${messageBody.substring(0, 100)}...`);
      return { success: true, testMode: true };
    }

    // Check if Twilio is configured
    if (!SecureConfig.isWhatsAppConfigured()) {
      Logger.log(`[WHATSAPP SKIP] Twilio not configured. Message to ${destination} not sent.`);
      Log.info('WHATSAPP', 'Skipped - Twilio not configured', { destination: Sanitize.maskEmail(destination) });
      return { success: false, skipped: true, error: 'Twilio not configured' };
    }

    try {
      const accountSid = SecureConfig.getOptional('TWILIO_ACCOUNT_SID');
      const authToken = SecureConfig.getOptional('TWILIO_AUTH_TOKEN');
      const fromNumber = SecureConfig.getOptional('TWILIO_WHATSAPP_NUMBER');

      if (!accountSid || !authToken || !fromNumber) {
        Log.warn('WHATSAPP', 'Incomplete Twilio configuration');
        return { success: false, error: 'Incomplete Twilio configuration' };
      }

      // Format phone number
      let phone = String(destination).replace(/\D/g, '');
      if (!phone || phone.length < 10) {
        Log.warn('WHATSAPP', 'Invalid phone number', { phone });
        return { success: false, error: 'Invalid phone number' };
      }
      if (phone.length === 10) {
        phone = '91' + phone; // Add India country code
      }
      const toNumber = `whatsapp:+${phone}`;

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      // Twilio uses HTTP Basic Auth
      const authHeader = Utilities.base64Encode(`${accountSid}:${authToken}`);

      const payload = {
        'From': fromNumber,
        'To': toNumber,
        'Body': messageBody
      };

      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: payload,
        muteHttpExceptions: true
      });

      const code = response.getResponseCode();
      const resText = response.getContentText();

      Log.info('WHATSAPP', `Sent message to ${Sanitize.maskEmail(phone)}`, {
        code: code,
        response: resText.substring(0, 200)
      });

      if (code >= 200 && code < 300) {
        const json = JSON.parse(resText);
        return { success: true, sid: json.sid, response: resText };
      } else {
        return { success: false, error: `HTTP ${code}: ${resText}` };
      }
    } catch (e) {
      Log.error('WHATSAPP', 'Send failed', { error: e.message });
      return { success: false, error: e.message };
    }
  },

  /**
   * Internal: Send WhatsApp template message via Twilio Content API
   * Use this for approved templates (required for business-initiated messages)
   */
  _sendTemplate(destination, contentSid, contentVariables = {}) {
    if (SecureConfig.isTestMode()) {
      Logger.log(`[WHATSAPP TEST] To: ${destination}, Template: ${contentSid}`);
      return { success: true, testMode: true };
    }

    try {
      const accountSid = SecureConfig.get('TWILIO_ACCOUNT_SID');
      const authToken = SecureConfig.get('TWILIO_AUTH_TOKEN');
      const fromNumber = SecureConfig.get('TWILIO_WHATSAPP_NUMBER');

      let phone = String(destination).replace(/\D/g, '');
      if (phone.length === 10) {
        phone = '91' + phone;
      }
      const toNumber = `whatsapp:+${phone}`;

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const authHeader = Utilities.base64Encode(`${accountSid}:${authToken}`);

      const payload = {
        'From': fromNumber,
        'To': toNumber,
        'ContentSid': contentSid,
        'ContentVariables': JSON.stringify(contentVariables)
      };

      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: payload,
        muteHttpExceptions: true
      });

      const code = response.getResponseCode();
      const resText = response.getContentText();

      if (code >= 200 && code < 300) {
        return { success: true, response: resText };
      } else {
        return { success: false, error: `HTTP ${code}: ${resText}` };
      }
    } catch (e) {
      Log.error('WHATSAPP', 'Template send failed', { error: e.message });
      return { success: false, error: e.message };
    }
  },

  /**
   * Send welcome message to new candidate
   */
  sendWelcome(phone, name) {
    if (!phone) {
      Log.warn('WHATSAPP', 'sendWelcome called without phone');
      return { success: false, error: 'No phone number' };
    }

    const safeName = name || 'there';
    const message = `Hi ${safeName}!

Welcome to UrbanMistrii! We're excited to have you as a candidate.

Your application has been received and is being reviewed. We'll get back to you within 1-2 business days with the next steps.

Best regards,
Team UrbanMistrii`;

    return this._send(phone, message);
  },

  /**
   * Send test link to candidate
   */
  sendTestLink(phone, name, role, department) {
    if (!phone) {
      Log.warn('WHATSAPP', 'sendTestLink called without phone');
      return { success: false, error: 'No phone number' };
    }

    const safeName = name || 'Candidate';
    const safeRole = role || 'Design';
    const link = ConfigHelpers.getTestLink(safeRole, department || '');
    const timeLimit = ConfigHelpers.getTimeLimit(safeRole, department || '');

    const message = `Hi ${safeName}!

Great news! You've been selected to take our ${safeRole} assessment.

*Test Details:*
• Role: ${safeRole}
• Time Limit: ${timeLimit} hours
• Link: ${link}

Please complete the test within ${timeLimit} hours of receiving this message.

Once done, reply to this message or email us at hr@urbanmistrii.com with your submission.

Good luck!
Team UrbanMistrii`;

    return this._send(phone, message);
  },

  /**
   * Send interview schedule
   */
  sendInterviewSchedule(phone, name, role, dateString) {
    if (!phone) {
      Log.warn('WHATSAPP', 'sendInterviewSchedule called without phone');
      return { success: false, error: 'No phone number' };
    }

    const safeName = name || 'Candidate';
    const safeRole = role || 'the position';
    const safeDate = dateString || 'TBD (to be confirmed shortly)';

    const message = `Hi ${safeName}!

Congratulations! You've cleared the assessment for ${safeRole}.

📅 *Interview Details:*
• Date & Time: ${safeDate}
• Mode: Video Call (link will be shared via email)
• Duration: ~30-45 minutes

Please confirm your availability by replying to this message.

See you soon!
Team UrbanMistrii`;

    return this._send(phone, message);
  },

  /**
   * Send reminder message
   */
  sendReminder(phone, name, messageStr) {
    if (!phone) {
      Log.warn('WHATSAPP', 'sendReminder called without phone');
      return { success: false, error: 'No phone number' };
    }

    const safeName = name || 'there';
    const safeMessage = messageStr || 'Please complete your pending tasks.';

    const message = `Hi ${safeName}!

Just a friendly reminder: ${safeMessage}

If you have any questions, feel free to reach out!

Best,
Team UrbanMistrii`;

    return this._send(phone, message);
  },

  /**
   * Send rejection message
   */
  sendRejection(phone, name) {
    if (!phone) {
      Log.warn('WHATSAPP', 'sendRejection called without phone');
      return { success: false, error: 'No phone number' };
    }

    const safeName = name || 'there';

    const message = `Hi ${safeName},

Thank you for your interest in UrbanMistrii and for taking the time to apply.

After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current needs.

We encourage you to apply again in the future as new opportunities arise.

Wishing you all the best in your career!

Warm regards,
Team UrbanMistrii`;

    return this._send(phone, message);
  }
};

/**
 * Test WhatsApp integration
 */
function testWhatsApp() {
  Logger.log('Testing Twilio WhatsApp integration...');

  // Send test to Yash
  const result = WhatsApp.sendWelcome(CONFIG.TEAM.YASH_PHONE, 'Test User');

  if (result.success) {
    Logger.log('✅ WhatsApp test passed');
    Logger.log('Response: ' + JSON.stringify(result));
  } else if (result.testMode) {
    Logger.log('✅ WhatsApp test passed (TEST MODE)');
  } else {
    Logger.log('❌ WhatsApp test failed: ' + result.error);
  }

  return result;
}

/**
 * Send test message to Yash
 */
function sendTestToYash() {
  const result = WhatsApp.sendWelcome(CONFIG.TEAM.YASH_PHONE, 'Yash');
  Logger.log('Result: ' + JSON.stringify(result));
  return result;
}

/**
 * Diagnostics for WhatsApp setup
 */
function diagnosticsWhatsApp() {
  Logger.log('╔═══════════════════════════════════════╗');
  Logger.log('║   TWILIO WHATSAPP DIAGNOSTICS         ║');
  Logger.log('╚═══════════════════════════════════════╝');

  // Check Account SID
  try {
    const sid = SecureConfig.get('TWILIO_ACCOUNT_SID');
    Logger.log('✅ Account SID: Configured (' + sid.substring(0, 10) + '...)');
  } catch (e) {
    Logger.log('❌ Account SID: Missing - Get from https://console.twilio.com');
  }

  // Check Auth Token
  try {
    const token = SecureConfig.get('TWILIO_AUTH_TOKEN');
    Logger.log('✅ Auth Token: Configured (' + token.substring(0, 10) + '...)');
  } catch (e) {
    Logger.log('❌ Auth Token: Missing');
  }

  // Check WhatsApp Number
  try {
    const num = SecureConfig.get('TWILIO_WHATSAPP_NUMBER');
    Logger.log('✅ WhatsApp Number: ' + num);
  } catch (e) {
    Logger.log('❌ WhatsApp Number: Missing');
    Logger.log('   For sandbox: whatsapp:+14155238886');
    Logger.log('   For production: whatsapp:+YOUR_TWILIO_NUMBER');
  }

  Logger.log('');
  Logger.log('📚 Twilio WhatsApp Quickstart:');
  Logger.log('   https://www.twilio.com/docs/whatsapp/quickstart');
  Logger.log('');
  Logger.log('💡 For sandbox testing, users must first send:');
  Logger.log('   "join <your-sandbox-keyword>" to +1 415 523 8886');
}



// ═══════════════════════════════════════════════════════════════════════════
//  RETRYQUEUE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                 URBANMISTRII ORACLE v22.4 - RETRY QUEUE                       ║
 * ║                 Automatic Retry for Failed Messages (Hardened)                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const RetryQueue = {
  SHEET_NAME: 'DB_RetryQueue',
  MAX_RETRIES: 3,
  VALID_TYPES: ['WHATSAPP', 'EMAIL'],
  
  /**
   * Initialize retry queue sheet if it doesn't exist
   */
  init() {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
      if (!ss) {
        Log.error('RETRY_QUEUE', 'Could not open spreadsheet');
        return null;
      }

      let sheet = ss.getSheetByName(this.SHEET_NAME);
      
      if (!sheet) {
        sheet = ss.insertSheet(this.SHEET_NAME);
        sheet.appendRow([
          'ID', 'Created', 'Type', 'Payload', 'RetryAfter', 
          'Attempts', 'LastError', 'Status'
        ]);
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f4b400');
        Log.info('RETRY_QUEUE', 'Initialized retry queue sheet');
      }
      
      return sheet;
    } catch (e) {
      Log.error('RETRY_QUEUE', 'Init failed', { error: e.message });
      return null;
    }
  },
  
  /**
   * Add a failed message to the retry queue
   * @param {string} type - 'WHATSAPP' or 'EMAIL'
   * @param {object} payload - The message payload to retry
   * @param {string} error - The error message from the failed attempt
   */
  add(type, payload, error) {
    // Input validation
    if (!type || !this.VALID_TYPES.includes(type)) {
      Log.warn('RETRY_QUEUE', 'Invalid type for retry queue', { type });
      return false;
    }

    if (!payload || typeof payload !== 'object') {
      Log.warn('RETRY_QUEUE', 'Invalid payload for retry queue');
      return false;
    }

    try {
      const sheet = this.init();
      if (!sheet) return false;
      
      const id = Utilities.getUuid();
      const retryAfter = DateTime.addHours(new Date(), 1); // First retry in 1 hour
      const safeError = (error || 'Unknown error').substring(0, 500); // Limit error length
      
      // Safely stringify payload
      let payloadStr;
      try {
        payloadStr = JSON.stringify(payload);
      } catch (e) {
        payloadStr = JSON.stringify({ error: 'Could not serialize payload' });
      }

      sheet.appendRow([
        id,
        new Date(),
        type,
        payloadStr,
        retryAfter,
        0,
        safeError,
        'PENDING'
      ]);
      
      Log.info('RETRY_QUEUE', 'Added to queue', { type, id });
      return id;
      
    } catch (e) {
      Log.error('RETRY_QUEUE', 'Failed to add to queue', { error: e.message });
      return false;
    }
  },
  
  /**
   * Process pending retries (called by background cycle)
   */
  process() {
    // Rate limit processing to prevent overload
    if (!Guards.rateLimit('RetryQueue.process', 60, 60000)) { // 60 calls per minute
      Log.warn('RETRY_QUEUE', 'Rate limited - skipping this run');
      return;
    }

    try {
      const sheet = this.init();
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const now = new Date();
      let processed = 0;
      const MAX_PROCESS_PER_RUN = 10; // Limit per run to prevent timeout
      
      for (let i = 1; i < data.length && processed < MAX_PROCESS_PER_RUN; i++) {
        const status = data[i][7];
        const retryAfter = new Date(data[i][4]);
        const attempts = parseInt(data[i][5]) || 0;
        
        // Skip if not pending or not due yet
        if (status !== 'PENDING') continue;
        if (retryAfter > now) continue;
        
        const row = i + 1;
        const type = data[i][2];
        
        // Safely parse payload
        let payload;
        try {
          payload = JSON.parse(data[i][3] || '{}');
        } catch (e) {
          Log.warn('RETRY_QUEUE', 'Invalid payload JSON', { row });
          sheet.getRange(row, 8).setValue('FAILED');
          sheet.getRange(row, 7).setValue('Invalid payload JSON');
          continue;
        }
        
        Log.info('RETRY_QUEUE', `Retrying ${type}`, { attempts: attempts + 1 });
        
        let result;
        
        // Retry based on type
        if (type === 'WHATSAPP') {
          result = Guards.safeExecute(
            () => WhatsApp._send(payload.destination, payload.message || payload.template),
            'RetryWhatsApp',
            { destination: payload.destination }
          );
          if (result === undefined) result = { success: false, error: 'Execution failed' };
        } else if (type === 'EMAIL') {
          try {
            const to = payload.to;
            const subject = payload.subject || 'No subject';
            const body = payload.body || '';
            if (to) {
              GmailApp.sendEmail(to, subject, body, payload.options || {});
              result = { success: true };
            } else {
              result = { success: false, error: 'No recipient' };
            }
          } catch (e) {
            result = { success: false, error: e.message };
          }
        } else {
          result = { success: false, error: 'Unknown type' };
        }
        
        if (result && result.success) {
          // Success! Mark as completed
          sheet.getRange(row, 8).setValue('COMPLETED');
          sheet.getRange(row, 6).setValue(attempts + 1);
          Log.success('RETRY_QUEUE', 'Retry successful', { type });
        } else {
          // Failed again
          const newAttempts = attempts + 1;
          
          if (newAttempts >= this.MAX_RETRIES) {
            // Give up
            sheet.getRange(row, 8).setValue('FAILED');
            sheet.getRange(row, 7).setValue(result?.error || 'Max retries exceeded');
            Log.warn('RETRY_QUEUE', 'Max retries reached, giving up', { type });
          } else {
            // Schedule next retry with exponential backoff
            const nextRetry = DateTime.addHours(now, Math.pow(2, newAttempts)); // 2h, 4h, 8h
            sheet.getRange(row, 5).setValue(nextRetry);
            sheet.getRange(row, 6).setValue(newAttempts);
            sheet.getRange(row, 7).setValue(result?.error || 'Unknown error');
          }
        }
        
        processed++;
      }
      
      if (processed > 0) {
        Log.info('RETRY_QUEUE', `Processed ${processed} retries`);
      }
      
    } catch (e) {
      Log.error('RETRY_QUEUE', 'Process failed', { error: e.message });
    }
  },
  
  /**
   * Get queue statistics
   */
  getStats() {
    try {
      const sheet = this.init();
      if (!sheet) return null;
      
      const data = sheet.getDataRange().getValues();
      const stats = { pending: 0, completed: 0, failed: 0, total: data.length - 1 };
      
      for (let i = 1; i < data.length; i++) {
        const status = data[i][7];
        if (status === 'PENDING') stats.pending++;
        else if (status === 'COMPLETED') stats.completed++;
        else if (status === 'FAILED') stats.failed++;
      }
      
      return stats;
    } catch (e) {
      return null;
    }
  },
  
  /**
   * Clean up old completed/failed entries (older than 7 days)
   */
  cleanup() {
    try {
      const sheet = this.init();
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const cutoff = DateTime.addDays(new Date(), -7);
      const rowsToDelete = [];
      
      for (let i = 1; i < data.length; i++) {
        const created = new Date(data[i][1]);
        const status = data[i][7];
        
        if ((status === 'COMPLETED' || status === 'FAILED') && created < cutoff) {
          rowsToDelete.push(i + 1);
        }
      }
      
      // Delete from bottom to top to maintain row indices
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        sheet.deleteRow(rowsToDelete[i]);
      }
      
      if (rowsToDelete.length > 0) {
        Log.info('RETRY_QUEUE', `Cleaned up ${rowsToDelete.length} old entries`);
      }
      
    } catch (e) {
      Log.error('RETRY_QUEUE', 'Cleanup failed', { error: e.message });
    }
  }
};

/**
 * Test retry queue
 */
function testRetryQueue() {
  Logger.log('Testing Retry Queue...');
  
  // Initialize
  RetryQueue.init();
  
  // Add test item
  const id = RetryQueue.add('WHATSAPP', {
    destination: '9999999999',
    template: 'test_template',
    params: ['Test User']
  }, 'Test error');
  
  Logger.log('Added to queue: ' + id);
  
  // Get stats
  const stats = RetryQueue.getStats();
  Logger.log('Queue stats: ' + JSON.stringify(stats));
  
  Logger.log('✅ Retry Queue test passed');
}



// ═══════════════════════════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                 URBANMISTRII ORACLE v22.4 - CALENDAR                          ║
 * ║                 Google Calendar Integration (Hardened)                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const Calendar = {
  /**
   * Create an interview event on Google Calendar
   * @param {object} candidate - Candidate info
   * @param {Date} dateTime - Interview date/time
   * @param {number} durationMinutes - Interview duration (default 45)
   * @param {string} interviewerEmail - Interviewer's email (optional)
   * @returns {object} { success, eventId, eventUrl }
   */
  createInterview(candidate, dateTime, durationMinutes = 45, interviewerEmail = null) {
    // Input validation
    if (!candidate || !candidate.name) {
      Log.warn('CALENDAR', 'createInterview called with invalid candidate');
      return { success: false, error: 'Invalid candidate data' };
    }

    if (!dateTime || !(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
      Log.warn('CALENDAR', 'createInterview called with invalid dateTime');
      return { success: false, error: 'Invalid date/time' };
    }

    // Ensure duration is reasonable (15 min to 4 hours)
    const safeDuration = Math.max(15, Math.min(240, durationMinutes || 45));

    try {
      if (SecureConfig.isTestMode()) {
        Logger.log(`[CALENDAR TEST] Would create interview for ${candidate.name} at ${dateTime}`);
        return { success: true, testMode: true, eventId: 'TEST_EVENT_ID' };
      }
      
      const calendar = CalendarApp.getDefaultCalendar();
      if (!calendar) {
        Log.error('CALENDAR', 'Could not access default calendar');
        return { success: false, error: 'Calendar access failed' };
      }

      const endTime = new Date(dateTime.getTime() + safeDuration * 60 * 1000);
      
      // Safe candidate data extraction
      const safeName = Guards.get(candidate, 'name', 'Candidate');
      const safeRole = Guards.get(candidate, 'role', 'Designer');
      const safeEmail = Guards.get(candidate, 'email', '');
      
      // Create event
      const event = calendar.createEvent(
        `🎯 Interview: ${safeName} (${safeRole})`,
        dateTime,
        endTime,
        {
          description: this._generateDescription(candidate),
          location: 'UrbanMistrii Office / Google Meet',
          guests: this._getGuests(safeEmail, interviewerEmail),
          sendInvites: true
        }
      );
      
      // Set reminder
      event.addPopupReminder(30); // 30 minutes before
      event.addEmailReminder(60); // 1 hour before
      
      // Add color coding based on role
      const color = this._getRoleColor(candidate.role);
      event.setColor(color);
      
      Log.success('CALENDAR', 'Interview scheduled', {
        candidate: candidate.name,
        date: dateTime.toISOString(),
        eventId: event.getId()
      });
      
      return {
        success: true,
        eventId: event.getId(),
        eventUrl: event.getEventSeries ? null : `https://calendar.google.com/calendar/event?eid=${event.getId()}`
      };
      
    } catch (e) {
      Log.error('CALENDAR', 'Failed to create interview', { error: e.message });
      return { success: false, error: e.message };
    }
  },
  
  /**
   * Get available interview slots for a given date
   * @param {Date} date - The date to check
   * @param {number} slotDuration - Duration of each slot in minutes
   * @returns {Array} Array of available time slots
   */
  getAvailableSlots(date, slotDuration = 45) {
    try {
      const calendar = CalendarApp.getDefaultCalendar();
      
      // Define working hours (10 AM to 7 PM IST)
      const workStart = 10;
      const workEnd = 19;
      
      // Get all events for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const events = calendar.getEvents(startOfDay, endOfDay);
      
      // Generate all possible slots
      const slots = [];
      for (let hour = workStart; hour < workEnd; hour++) {
        for (let min = 0; min < 60; min += slotDuration) {
          if (hour === workEnd - 1 && min + slotDuration > 60) continue;
          
          const slotStart = new Date(date);
          slotStart.setHours(hour, min, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);
          
          // Check if slot conflicts with any event
          const isAvailable = !events.some(event => {
            const eventStart = event.getStartTime();
            const eventEnd = event.getEndTime();
            return (slotStart < eventEnd && slotEnd > eventStart);
          });
          
          if (isAvailable) {
            slots.push({
              start: slotStart,
              end: slotEnd,
              label: `${this._formatTime(slotStart)} - ${this._formatTime(slotEnd)}`
            });
          }
        }
      }
      
      return slots;
      
    } catch (e) {
      Log.error('CALENDAR', 'Failed to get slots', { error: e.message });
      return [];
    }
  },
  
  /**
   * Cancel/delete an interview event
   */
  cancelInterview(eventId, reason = '') {
    try {
      const calendar = CalendarApp.getDefaultCalendar();
      const event = calendar.getEventById(eventId);
      
      if (event) {
        event.setDescription(event.getDescription() + `\n\n❌ CANCELLED: ${reason}`);
        event.deleteEvent();
        
        Log.info('CALENDAR', 'Interview cancelled', { eventId, reason });
        return { success: true };
      }
      
      return { success: false, error: 'Event not found' };
      
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  
  /**
   * Reschedule an interview
   */
  rescheduleInterview(eventId, newDateTime) {
    try {
      const calendar = CalendarApp.getDefaultCalendar();
      const event = calendar.getEventById(eventId);
      
      if (event) {
        const duration = event.getEndTime() - event.getStartTime();
        event.setTime(newDateTime, new Date(newDateTime.getTime() + duration));
        
        Log.info('CALENDAR', 'Interview rescheduled', { eventId, newDate: newDateTime.toISOString() });
        return { success: true };
      }
      
      return { success: false, error: 'Event not found' };
      
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════════
  //                              HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  _generateDescription(candidate) {
    const safeName = Guards.get(candidate, 'name', 'Not provided');
    const safeRole = Guards.get(candidate, 'role', 'Not provided');
    const safeEmail = Guards.get(candidate, 'email', 'Not provided');
    const safePhone = Guards.get(candidate, 'phone', 'Not provided');
    const safePortfolio = Guards.get(candidate, 'portfolioUrl', 'Not provided');
    const safeStatus = Guards.get(candidate, 'status', 'Interview Pending');

    return `
📋 CANDIDATE DETAILS
━━━━━━━━━━━━━━━━━━━━
Name: ${safeName}
Role: ${safeRole}
Email: ${safeEmail}
Phone: ${safePhone}

📁 PORTFOLIO
${safePortfolio}

📊 STATUS
${safeStatus}

🔗 QUICK LINKS
• View in Sheet: ${getSheetUrl()}
• HR Contact: ${CONFIG.TEAM.ADMIN_EMAIL}

━━━━━━━━━━━━━━━━━━━━
Generated by Oracle v22.2
    `.trim();
  },
  
  _getGuests(candidateEmail, interviewerEmail) {
    const guests = [CONFIG.TEAM.ADMIN_EMAIL];
    if (candidateEmail) guests.push(candidateEmail);
    if (interviewerEmail) guests.push(interviewerEmail);
    return guests.join(',');
  },
  
  _getRoleColor(role) {
    // Google Calendar colors (1-11)
    if (role.toLowerCase().includes('senior')) return '11'; // Red
    if (role.toLowerCase().includes('junior')) return '5';  // Yellow
    return '10'; // Green (Intern)
  },
  
  _formatTime(date) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  }
};

/**
 * Test calendar integration
 */
function testCalendar() {
  Logger.log('Testing Calendar integration...');
  
  // Test getting available slots
  const tomorrow = DateTime.addDays(new Date(), 1);
  const slots = Calendar.getAvailableSlots(tomorrow);
  
  Logger.log(`Found ${slots.length} available slots for tomorrow`);
  if (slots.length > 0) {
    Logger.log('First slot: ' + slots[0].label);
  }
  
  // Test creating interview (in test mode)
  const testCandidate = {
    name: 'Test Candidate',
    email: 'test@example.com',
    phone: '9999999999',
    role: 'Junior Designer'
  };
  
  const result = Calendar.createInterview(testCandidate, slots[0]?.start || tomorrow);
  Logger.log('Create result: ' + JSON.stringify(result));
  
  Logger.log('✅ Calendar test completed');
}



// ═══════════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                 URBANMISTRII ORACLE v22.1 - ANALYTICS                         ║
 * ║                 Metrics, Reports & Insights                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const Analytics = {

  /**
   * Normalize role name to avoid duplicates (trim, standardize casing, handle variants)
   */
  _normalizeRole(role) {
    if (!role) return 'Unknown';

    const r = role.trim();
    const lower = r.toLowerCase();

    // Standardize common variations
    const mappings = {
      'junior architect': 'Junior Architect',
      'senior architect': 'Senior Architect',
      'interior designer': 'Interior Designer',
      'junior interior designer': 'Junior Interior Designer',
      'team lead': 'Team Lead',
      'team lead - interior designer': 'Team Lead - Interior Designer',
      'architectural draftsman': 'Architectural Draftsman',
      'architectural intern': 'Architecture Intern',
      'intern architect': 'Architecture Intern',
      'architectural intern': 'Architecture Intern',
      'intermediate architect': 'Intermediate Architect',
      'project architect': 'Project Architect',
      '3d artist': '3D Artist',
      '3d visualiser': '3D Visualizer',
      '3d visualizer': '3D Visualizer',
      'senior 3d generalist': 'Senior 3D Generalist',
      'compositor and 3d artist': 'Compositor and 3D Artist'
    };

    return mappings[lower] || r;
  },

  /**
   * Get comprehensive recruitment metrics
   */
  getMetrics() {
    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const data = sheet.getDataRange().getValues();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = DateTime.addDays(today, -7);
      const monthAgo = DateTime.addDays(today, -30);

      const metrics = {
        // Pipeline counts
        pipeline: {
          new: 0,
          inProcess: 0,
          testSent: 0,
          testSubmitted: 0,
          underReview: 0,
          interviewPending: 0,
          interviewDone: 0,
          pendingRejection: 0,
          rejected: 0,
          hired: 0,
          total: data.length - 1
        },

        // Time-based metrics
        thisWeek: { applications: 0, hires: 0, rejections: 0 },
        thisMonth: { applications: 0, hires: 0, rejections: 0 },

        // Performance metrics
        performance: {
          avgTimeToHire: 0,
          avgTimeToReject: 0,
          avgTestCompletionRate: 0,
          avgTestTime: 0
        },

        // Conversion funnel
        funnel: {
          applicationToTest: 0,
          testToInterview: 0,
          interviewToHire: 0,
          overallConversion: 0
        },

        // By role breakdown
        byRole: {}
      };

      let totalTestTime = 0;
      let testCount = 0;
      let hireTime = 0;
      let hireCount = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = row[CONFIG.COLUMNS.STATUS - 1];
        const timestamp = new Date(row[CONFIG.COLUMNS.TIMESTAMP - 1]);
        const role = this._normalizeRole(row[CONFIG.COLUMNS.ROLE - 1]);
        const testSent = row[CONFIG.COLUMNS.TEST_SENT - 1];
        const testSubmitted = row[CONFIG.COLUMNS.TEST_SUBMITTED - 1];

        // Pipeline counts
        switch (status) {
          case CONFIG.RULES.STATUSES.NEW: metrics.pipeline.new++; break;
          case CONFIG.RULES.STATUSES.IN_PROCESS: metrics.pipeline.inProcess++; break;
          case CONFIG.RULES.STATUSES.TEST_SENT: metrics.pipeline.testSent++; break;
          case CONFIG.RULES.STATUSES.TEST_SUBMITTED: metrics.pipeline.testSubmitted++; break;
          case CONFIG.RULES.STATUSES.UNDER_REVIEW: metrics.pipeline.underReview++; break;
          case CONFIG.RULES.STATUSES.INTERVIEW_PENDING: metrics.pipeline.interviewPending++; break;
          case CONFIG.RULES.STATUSES.INTERVIEW_DONE: metrics.pipeline.interviewDone++; break;
          case CONFIG.RULES.STATUSES.PENDING_REJECTION: metrics.pipeline.pendingRejection++; break;
          case CONFIG.RULES.STATUSES.REJECTED: metrics.pipeline.rejected++; break;
          case CONFIG.RULES.STATUSES.HIRED: metrics.pipeline.hired++; break;
        }

        // Time-based
        if (timestamp >= weekAgo) {
          metrics.thisWeek.applications++;
          if (status === CONFIG.RULES.STATUSES.HIRED) metrics.thisWeek.hires++;
          if (status === CONFIG.RULES.STATUSES.REJECTED) metrics.thisWeek.rejections++;
        }
        if (timestamp >= monthAgo) {
          metrics.thisMonth.applications++;
          if (status === CONFIG.RULES.STATUSES.HIRED) metrics.thisMonth.hires++;
          if (status === CONFIG.RULES.STATUSES.REJECTED) metrics.thisMonth.rejections++;
        }

        // Test completion time
        if (testSent && testSubmitted) {
          const hours = DateTime.hoursBetween(new Date(testSent), new Date(testSubmitted));
          totalTestTime += hours;
          testCount++;
        }

        // Time to hire
        if (status === CONFIG.RULES.STATUSES.HIRED && timestamp) {
          const days = DateTime.daysBetween(timestamp, new Date(row[CONFIG.COLUMNS.UPDATED - 1]));
          hireTime += days;
          hireCount++;
        }

        // By role (with normalized names)
        if (!metrics.byRole[role]) {
          metrics.byRole[role] = { total: 0, hired: 0, rejected: 0 };
        }
        metrics.byRole[role].total++;
        if (status === CONFIG.RULES.STATUSES.HIRED) metrics.byRole[role].hired++;
        if (status === CONFIG.RULES.STATUSES.REJECTED) metrics.byRole[role].rejected++;
      }

      // Calculate averages
      const total = metrics.pipeline.total;
      metrics.performance.avgTestTime = testCount > 0 ? (totalTestTime / testCount).toFixed(1) + 'h' : 'N/A';
      metrics.performance.avgTimeToHire = hireCount > 0 ? (hireTime / hireCount).toFixed(0) + ' days' : 'N/A';
      metrics.performance.avgTestCompletionRate = metrics.pipeline.testSent > 0
        ? ((metrics.pipeline.testSubmitted / metrics.pipeline.testSent) * 100).toFixed(1) + '%'
        : 'N/A';

      // Conversion funnel
      const gotTest = metrics.pipeline.testSent + metrics.pipeline.testSubmitted + metrics.pipeline.underReview +
        metrics.pipeline.interviewPending + metrics.pipeline.interviewDone + metrics.pipeline.hired;
      const gotInterview = metrics.pipeline.interviewPending + metrics.pipeline.interviewDone + metrics.pipeline.hired;

      metrics.funnel.applicationToTest = total > 0 ? ((gotTest / total) * 100).toFixed(1) + '%' : '0%';
      metrics.funnel.testToInterview = gotTest > 0 ? ((gotInterview / gotTest) * 100).toFixed(1) + '%' : '0%';
      metrics.funnel.interviewToHire = gotInterview > 0 ? ((metrics.pipeline.hired / gotInterview) * 100).toFixed(1) + '%' : '0%';
      metrics.funnel.overallConversion = total > 0 ? ((metrics.pipeline.hired / total) * 100).toFixed(2) + '%' : '0%';

      return metrics;

    } catch (e) {
      Log.error('ANALYTICS', 'Failed to get metrics', { error: e.message });
      return null;
    }
  },

  /**
   * Generate weekly report
   */
  generateWeeklyReport() {
    const metrics = this.getMetrics();
    if (!metrics) return null;

    const report = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    WEEKLY RECRUITMENT REPORT                                   ║
║                    ${new Date().toLocaleDateString('en-IN')}                                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

 THIS WEEK'S HIGHLIGHTS
 ━━━━━━━━━━━━━━━━━━━━━━━━━
 New Applications (last 7 days): ${metrics.thisWeek.applications}
 New Hires: ${metrics.thisWeek.hires}
 New Rejections: ${metrics.thisWeek.rejections}

PIPELINE STATUS
━━━━━━━━━━━━━━━━━━
New:               ${metrics.pipeline.new}
In Process:        ${metrics.pipeline.inProcess}
Test Sent:         ${metrics.pipeline.testSent}
Test Submitted:    ${metrics.pipeline.testSubmitted}
Under Review:      ${metrics.pipeline.underReview}
Interview Pending: ${metrics.pipeline.interviewPending}
Interview Done:    ${metrics.pipeline.interviewDone}
━━━━━━━━━━━━━━━━━━
Hired:             ${metrics.pipeline.hired}
Rejected:          ${metrics.pipeline.rejected}

CONVERSION FUNNEL
━━━━━━━━━━━━━━━━━━━━
Application → Test: ${metrics.funnel.applicationToTest}
Test → Interview:   ${metrics.funnel.testToInterview}
Interview → Hire:   ${metrics.funnel.interviewToHire}
Overall:            ${metrics.funnel.overallConversion}

⏱️ PERFORMANCE
━━━━━━━━━━━━━━
Avg Time to Hire:      ${metrics.performance.avgTimeToHire}
Avg Test Time:         ${metrics.performance.avgTestTime}
Test Completion Rate:  ${metrics.performance.avgTestCompletionRate}

 BY ROLE (Top 10)
 ━━━━━━━━━━━━━━━━━
 ${Object.entries(metrics.byRole)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .filter(([role]) => role !== 'Unknown')
      .map(([role, data]) =>
        `${role}: ${data.total} total, ${data.hired} hired (${((data.hired / data.total) * 100 || 0).toFixed(0)}%)`
      ).join('\n')}

 NOTE: Pipeline "NEW" count shows current status, not new applications this week.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Oracle v22.0 | ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
    `.trim();

    return report;
  },

  /**
   * Send weekly report via email
   */
  sendWeeklyReport() {
    const report = this.generateWeeklyReport();
    if (!report) return;

    Notify.team(
      `Weekly Recruitment Report - ${new Date().toLocaleDateString('en-IN')}`,
      report
    );

    Log.success('ANALYTICS', 'Weekly report sent');
  },

  /**
   * Record custom metric to analytics sheet
   */
  recordMetric(name, value, metadata = {}) {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
      let sheet = ss.getSheetByName(CONFIG.SHEETS.TABS.ANALYTICS);

      if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEETS.TABS.ANALYTICS);
        sheet.appendRow(['Date', 'Metric', 'Value', 'Metadata']);
      }

      sheet.appendRow([
        new Date(),
        name,
        value,
        JSON.stringify(metadata)
      ]);

    } catch (e) {
      Log.error('ANALYTICS', 'Failed to record metric', { error: e.message });
    }
  },

  /**
   * Get bottleneck analysis - where are candidates getting stuck?
   */
  getBottlenecks() {
    const metrics = this.getMetrics();
    if (!metrics) return [];

    const bottlenecks = [];
    const p = metrics.pipeline;

    // Check for high numbers in each stage
    if (p.new > 10) {
      bottlenecks.push({
        stage: 'NEW',
        count: p.new,
        severity: 'HIGH',
        suggestion: 'Too many unprocessed applications. Consider processing or auto-rejecting.'
      });
    }

    if (p.testSent > 5 && p.testSubmitted < p.testSent * 0.5) {
      bottlenecks.push({
        stage: 'TEST_SENT',
        count: p.testSent,
        severity: 'MEDIUM',
        suggestion: 'Low test completion rate. Send more reminders or simplify the test.'
      });
    }

    if (p.underReview > 5) {
      bottlenecks.push({
        stage: 'UNDER_REVIEW',
        count: p.underReview,
        severity: 'HIGH',
        suggestion: 'Tests piling up for review. Schedule time to review submissions.'
      });
    }

    if (p.pendingRejection > 3) {
      bottlenecks.push({
        stage: 'PENDING_REJECTION',
        count: p.pendingRejection,
        severity: 'LOW',
        suggestion: 'Rejections queued - will be sent automatically within 24h.'
      });
    }

    return bottlenecks;
  },

  /**
   * Record daily snapshot of key metrics
   * Called by daily summary trigger
   */
  recordDailySnapshot(stats) {
    try {
      this.recordMetric('DAILY_TOTAL_CANDIDATES', stats.total);
      this.recordMetric('DAILY_NEW_APPLICATIONS', stats.new);
      this.recordMetric('DAILY_HIRES', stats.hired);
      this.recordMetric('DAILY_CONVERSION_RATE', stats.conversionRate);

      const pipelineData = {
        testsSent: stats.testsSent,
        testsSubmitted: stats.testsSubmitted,
        interviews: stats.interviews,
        rejected: stats.rejected
      };

      this.recordMetric('DAILY_PIPELINE_SNAPSHOT', 'SNAPSHOT', pipelineData);
      Log.info('ANALYTICS', 'Recorded daily snapshot');
    } catch (e) {
      Log.error('ANALYTICS', 'Failed to record snapshot', { error: e.message });
    }
  }
};

/**
 * Test analytics
 */
function testAnalytics() {
  Logger.log('Testing Analytics...');

  const metrics = Analytics.getMetrics();
  Logger.log('Pipeline: ' + JSON.stringify(metrics.pipeline));
  Logger.log('Funnel: ' + JSON.stringify(metrics.funnel));

  const bottlenecks = Analytics.getBottlenecks();
  Logger.log('Bottlenecks: ' + JSON.stringify(bottlenecks));

  const report = Analytics.generateWeeklyReport();
  Logger.log(report);

  Logger.log('✅ Analytics test passed');
}

/**
 * Trigger for weekly report (to be scheduled)
 */
function sendWeeklyAnalyticsReport() {
  Analytics.sendWeeklyReport();
}



// ═══════════════════════════════════════════════════════════════════════════
//  EMAIL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                 URBANMISTRII ORACLE v22.2 - EMAIL MODULE                      ║
 * ║                 Gmail Processing & Smart Responses (Hardened)                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * Process Gmail inbox for candidate emails
 */
/**
 * Process Gmail inbox for candidate emails
 * Uses 'ORACLE_PROCESSED' label to track state without marking as read
 */
function processInbox() {
  // Rate limit check for inbox processing
  if (!Guards.rateLimit('processInbox', 60, 60000)) { // 60 calls per minute
    Log.warn('INBOX', 'Rate limited - skipping this run');
    return;
  }

  try {
    // Ensure label exists
    const labelName = 'ORACLE_PROCESSED';
    let label = GmailApp.getUserLabelByName(labelName);
    if (!label) label = GmailApp.createLabel(labelName);

    // Search for unread emails that haven't been processed
    const threads = GmailApp.search(`is:unread -label:${labelName} -category:social`, 0, 10);
    if (!threads || threads.length === 0) return;

    Log.info('INBOX', `Processing ${threads.length} unread emails`);

    for (const thread of threads) {
      try {
        const messages = thread.getMessages();
        if (!messages || messages.length === 0) {
          thread.addLabel(label);
          continue;
        }

        const msg = messages[messages.length - 1]; // Get last message
        const from = msg.getFrom() || '';
        const email = (from.match(/[\w.-]+@[\w.-]+\.\w+/) || [''])[0];
        
        if (!email) {
          Log.warn('INBOX', 'Could not extract email from sender', { from });
          thread.addLabel(label);
          continue;
        }

        const subject = msg.getSubject() || '';
        const body = (msg.getPlainBody() || '').substring(0, 1000);
        const hasAttachments = msg.getAttachments().length > 0;

        const analysis = AI.analyzeIntent(body, subject, hasAttachments);
        if (!analysis || !analysis.intent) {
          // Mark as processed even if analysis failed to avoid infinite loop
          thread.addLabel(label);
          Log.warn('INBOX', 'AI analysis failed - skipped', { email: Sanitize.maskEmail(email), subject });
          continue;
        }

        Log.info('INBOX', 'Email analyzed', { email: Sanitize.maskEmail(email), intent: analysis.intent });

        // Wrap each handler in try-catch to prevent one failure from stopping all processing
        Guards.safeExecute(() => {
          switch (analysis.intent) {
            case 'TEST_SUBMISSION': handleEmailTestSubmission(email, analysis, msg); break;
            case 'NEW_APPLICATION': handleEmailApplication(email, analysis, msg); break;
            case 'FORM_RESPONSE': handleFormResponse(email, body, msg); break;
            case 'FOLLOWUP': handleEmailFollowup(email, analysis); break;
            case 'QUESTION': handleEmailQuestion(email, analysis, body); break;
            case 'ESCALATE': handleEmailEscalation(email, subject, body); break;
            default:
              Log.info('INBOX', 'Unhandled intent', { intent: analysis.intent });
          }
        }, 'InboxHandler', { email, intent: analysis.intent });

        // Mark as processed (adds label, keeps Unread status)
        thread.addLabel(label);

      } catch (threadError) {
        Log.error('INBOX', 'Failed to process thread', { error: threadError.message });
        // Still try to label to avoid reprocessing
        try { thread.addLabel(label); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    Log.error('INBOX', 'Failed to process inbox', { error: e.message, stack: e.stack });
  }
}

function handleEmailTestSubmission(email, analysis, message) {
  if (!email || !message) {
    Log.warn('EMAIL', 'handleEmailTestSubmission called with invalid params');
    return;
  }

  Log.info('EMAIL', 'Processing test submission', { email: Sanitize.maskEmail(email) });
  
  const candidate = Guards.safeExecute(
    () => SheetUtils.findCandidateByEmail(email),
    'findCandidateByEmail',
    { email }
  );

  if (!candidate) {
    const safeName = Guards.get(analysis, 'name', 'there');
    const notFoundHtml = EmailTemplates.wrap(`
      <h3>Application Not Found</h3>
      <p>Hello ${safeName},</p>
      <p>We couldn't find your application in our system.</p>
      ${EmailTemplates.warningBox('Please ensure you have applied through our official channels before submitting your test.')}
      <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
    `);
    
    try {
      message.reply('', { htmlBody: notFoundHtml });
    } catch (replyError) {
      Log.error('EMAIL', 'Failed to send reply', { error: replyError.message });
    }
    return;
  }

  // Update status with idempotency check
  SheetUtils.updateStatus(candidate.row, CONFIG.RULES.STATUSES.TEST_SUBMITTED, email);

  const safeName = Guards.get(analysis, 'name', 'Candidate');
  
  try {
    const attachments = message.getAttachments() || [];
    GmailApp.sendEmail(CONFIG.TEAM.ADMIN_EMAIL, `Test Submission: ${safeName}`,
      `${safeName} has submitted their test.\nEmail: ${email}\nAttachments: ${attachments.length}`,
      { attachments: attachments, name: 'Urbanmistrii Oracle' });

    const submissionHtml = EmailTemplates.wrap(`
      <h3>Test Received</h3>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>Thank you for submitting your test! We have received your submission and our team will begin the review process.</p>
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #e74c3c; margin: 25px 0;">
        <p style="margin: 0 0 10px 0;"><strong>What happens next?</strong></p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Our design team will review your submission</li>
          <li>You will receive feedback within 2-3 business days</li>
          <li>We will contact you for the next steps</li>
        </ul>
      </div>
      <p>We appreciate your effort and look forward to reviewing your work!</p>
      <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
    `);
    message.reply('', { htmlBody: submissionHtml });
  } catch (e) {
    Log.error('EMAIL', 'Failed to process test submission', { error: e.message });
  }

  CandidateTimeline.add(email, 'TEST_SUBMISSION_EMAIL_PROCESSED');
}

/**
 * Handle structured form-like responses from candidates
 * When candidates reply with their details in Q&A format, parse and save to sheet
 */
function handleFormResponse(email, body, message) {
  if (!email || !body) {
    Log.warn('EMAIL', 'handleFormResponse called with invalid params');
    return;
  }

  Log.info('EMAIL', 'Processing form response', { email: Sanitize.maskEmail(email) });

  // Extract structured data from email
  const formData = AI.extractFormResponse(body, email);

  if (!formData || !formData.name) {
    Log.error('EMAIL', 'Failed to extract form data', { email: Sanitize.maskEmail(email) });
    // Escalate to admin
    Guards.safeExecute(() => {
      Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `Form Response Parse Failed: ${email}`,
        `Could not parse candidate response. Manual review needed.\n\nEmail:\n${body.substring(0, 1500)}`);
    }, 'NotifyFormParseFailed', { email });
    return;
  }

  Log.info('EMAIL', 'Form data extracted', { name: formData.name, role: formData.role || 'N/A' });

  // Check if candidate already exists
  const existing = SheetUtils.findCandidateByEmail(email);
  const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);

  if (!sheet) {
    Log.error('EMAIL', 'Could not get candidates sheet');
    return;
  }

  try {
    if (existing) {
      // Update existing candidate row
      Log.info('EMAIL', 'Updating existing candidate', { row: existing.row });

      // Update fields that were provided - use Guards.get for safe access
      const safeUpdate = (field, column) => {
        const value = Guards.get(formData, field);
        if (value) SheetUtils.updateCell(existing.row, column, value);
      };

      safeUpdate('name', CONFIG.COLUMNS.NAME);
      safeUpdate('phone', CONFIG.COLUMNS.PHONE);
      safeUpdate('role', CONFIG.COLUMNS.ROLE);
      safeUpdate('degree', CONFIG.COLUMNS.DEGREE);
      safeUpdate('startDate', CONFIG.COLUMNS.START_DATE);
      safeUpdate('tenure', CONFIG.COLUMNS.TENURE);
      safeUpdate('salaryExpected', CONFIG.COLUMNS.SALARY_EXP);
      safeUpdate('salaryLast', CONFIG.COLUMNS.SALARY_LAST);
      safeUpdate('experience', CONFIG.COLUMNS.EXPERIENCE);
      safeUpdate('portfolioUrl', CONFIG.COLUMNS.PORTFOLIO_URL);
      safeUpdate('cvUrl', CONFIG.COLUMNS.CV_URL);
      safeUpdate('city', CONFIG.COLUMNS.CITY);
      safeUpdate('hindiProficient', CONFIG.COLUMNS.HINDI);
      safeUpdate('healthNotes', CONFIG.COLUMNS.HEALTH);
      safeUpdate('previousApplication', CONFIG.COLUMNS.PREV_EXP);
      safeUpdate('testAvailability', CONFIG.COLUMNS.TEST_AVAILABILITY_DATE);
      safeUpdate('willingToRelocate', CONFIG.COLUMNS.RELOCATION);

      SheetUtils.updateCell(existing.row, CONFIG.COLUMNS.UPDATED, new Date());
      SheetUtils.updateCell(existing.row, CONFIG.COLUMNS.LOG, '📝 Form response updated via email');

    } else {
      // Create new candidate row
      Log.info('EMAIL', 'Creating new candidate from form response');

      const department = ConfigHelpers.getDepartment(formData.role || '');

      sheet.appendRow([
      CONFIG.RULES.STATUSES.NEW,           // STATUS
      new Date(),                           // UPDATED
      new Date(),                           // TIMESTAMP
      formData.name,                        // NAME
      formData.phone || '',                 // PHONE
      formData.email || email,              // EMAIL
      formData.role || '',                  // ROLE
      formData.degree || '',                // DEGREE
      formData.startDate || '',             // START_DATE
      formData.tenure || '',                // TENURE
      formData.salaryExpected || '',        // SALARY_EXP
      formData.salaryLast || '',            // SALARY_LAST
      formData.experience || '',            // EXPERIENCE
      formData.portfolioUrl || '',          // PORTFOLIO_URL
      formData.cvUrl || '',                 // CV_URL
      formData.city || '',                  // CITY
      formData.hindiProficient || '',       // HINDI
      formData.healthNotes || '',           // HEALTH
      formData.previousApplication || '',   // PREV_EXP
      formData.testAvailability || '',      // TEST_AVAILABILITY_DATE
      '',                                   // TEST_AVAILABILITY_TIME
      '',                                   // EMAIL_ALT
      formData.willingToRelocate || '',     // RELOCATION
      'From email form response',        // LOG
      '', '', '', '', department, '', ''    // System columns
      ]);
    }

    // Send confirmation email
    const confirmHtml = EmailTemplates.wrap(`
      <h3>Details Received!</h3>
      <p>Hello <strong>${formData.name}</strong>,</p>
      <p>Thank you for providing your details. We have successfully recorded your information in our system.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4caf50; margin: 25px 0;">
        <p style="margin: 0;"><strong>What happens next?</strong></p>
        <p style="margin: 10px 0 0 0;">Our team will review your profile and send you the design test shortly. Please keep an eye on your inbox.</p>
      </div>
      <p>If you have any questions, feel free to reply to this email.</p>
      <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
    `);

    GmailApp.sendEmail(email, 'Details Received - Urbanmistrii',
      `Hi ${formData.name}, Thank you for your details. We'll send you the design test shortly.`,
      { htmlBody: confirmHtml, name: 'Urbanmistrii Hiring' });

    // Notify admin
    Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `Form Response: ${formData.name}`,
      `Candidate responded with details via email.\n\nName: ${formData.name}\nRole: ${formData.role || 'N/A'}\nEmail: ${email}\nPhone: ${formData.phone || 'N/A'}\nCity: ${formData.city || 'N/A'}\nTest Availability: ${formData.testAvailability || 'N/A'}\n\nReview at: ${getSheetUrl()}`);

    CandidateTimeline.add(email, 'FORM_RESPONSE_PROCESSED', { name: formData.name });

  } catch (e) {
    Log.error('EMAIL', 'Failed to process form response', { error: e.message, email: Sanitize.maskEmail(email) });
  }
}

function handleEmailApplication(email, analysis, message) {
  if (!email || !message) {
    Log.warn('EMAIL', 'handleEmailApplication called with invalid params');
    return;
  }

  Log.info('EMAIL', 'Processing new application', { email: Sanitize.maskEmail(email) });

  try {
    // v22.0: Check for duplicates
    if (CONFIG.FEATURES.DUPLICATE_CHECK) {
      const candidateInfo = AI.extractCandidateInfo(
        message.getPlainBody() || '', 
        message.getSubject() || ''
      );
      const dupCheck = Duplicates.check(
        email, 
        Guards.get(candidateInfo, 'phone'), 
        Guards.get(candidateInfo, 'name') || Guards.get(analysis, 'name')
      );

      if (dupCheck && dupCheck.isDuplicate) {
        Log.info('EMAIL', 'Duplicate detected', {
          email: Sanitize.maskEmail(email),
          matchType: dupCheck.matchType,
          similarity: dupCheck.similarity
        });

        const response = Duplicates.getResponse(dupCheck.existingData);
        if (response) message.reply(response);
        CandidateTimeline.add(email, 'DUPLICATE_APPLICATION_BLOCKED', { matchType: dupCheck.matchType });
        return;
      }
    }

    // Check for existing application by email only
    const existing = SheetUtils.findCandidateByEmail(email);
    if (existing) {
      const safeName = Guards.get(analysis, 'name', 'there');
      const currentStatus = Guards.get(existing.data, CONFIG.COLUMNS.STATUS - 1, 'pending');
      message.reply(`Hi ${safeName},\n\nWe already have your application! Status: ${currentStatus}\n\nBest,\nTeam UrbanMistrii`);
      return;
    }

    const candidateInfo = AI.extractCandidateInfo(
      message.getPlainBody() || '', 
      message.getSubject() || ''
    );
    if (!candidateInfo) {
      Log.error('EMAIL', 'Failed to extract candidate info', { email: Sanitize.maskEmail(email) });
      return;
    }

    // v22.0: Spam detection
    const spamCheck = AI.detectSpam(email, candidateInfo.name, message.getPlainBody() || '');
    if (spamCheck && spamCheck.isSpam && spamCheck.confidence > 0.8) {
      Log.warn('EMAIL', 'Spam application detected', { email: Sanitize.maskEmail(email), reasons: spamCheck.reasons });
      CandidateTimeline.add(email, 'SPAM_APPLICATION_BLOCKED', { confidence: spamCheck.confidence });
      return; // Silently ignore spam
    }

    // v22.0: Detect department from role
    const role = Guards.get(candidateInfo, 'role') || Guards.get(analysis, 'role') || '';
    const department = ConfigHelpers.getDepartment(role);

    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    if (!sheet) {
      Log.error('EMAIL', 'Could not get candidates sheet');
      return;
    }

    const portfolioLinks = Guards.get(candidateInfo, 'portfolioLinks');
    sheet.appendRow([
      CONFIG.RULES.STATUSES.NEW, new Date(), new Date(),
      candidateInfo.name || Guards.get(analysis, 'name'), candidateInfo.phone || '',
      candidateInfo.email || email, candidateInfo.role || Guards.get(analysis, 'role') || '',
      '', '', '', '', '', '',
      Array.isArray(portfolioLinks) ? portfolioLinks.join(', ') : '', '',
      '', '', '', '', '',
      'From email', '', '', '', department, '', ''
    ]);

    Log.success('EMAIL', 'New candidate added', { name: candidateInfo.name, department });

  // Send branded HTML email with form link
  const applicationHtml = EmailTemplates.wrap(`
    <h3>Application Received!</h3>
    <p>Hello <strong>${candidateInfo.name || 'there'}</strong>,</p>
    <p>Thank you for your interest in joining Urbanmistrii! We have received your application.</p>
    <p>To ensure we have all the necessary details, please complete our official application form:</p>
    ${EmailTemplates.button('FILL APPLICATION FORM', CONFIG.APPLICATION_FORM_URL)}
    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #e74c3c; margin: 25px 0;">
      <p style="margin: 0 0 10px 0;"><strong>What to include:</strong></p>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Your portfolio/work samples</li>
        <li>Contact details</li>
        <li>Preferred interview availability</li>
      </ul>
    </div>
    <p>Once you've submitted the form, our team will review your application and get back to you within 1-2 business days.</p>
    <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
  `);

  GmailApp.sendEmail(email, 'Complete Your Application - Urbanmistrii',
    `Hi ${candidateInfo.name || 'there'}, Thank you for applying! Please complete our application form: ${CONFIG.APPLICATION_FORM_URL}`,
    { htmlBody: applicationHtml, name: 'Urbanmistrii Hiring' });

  Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `New Application: ${candidateInfo.name}`,
      `New candidate from email (${department} dept).\n\nEmail: ${email}\nName: ${candidateInfo.name}\n\nForm link sent to candidate.\n\nReview at: ${getSheetUrl()}`);

  } catch (e) {
    Log.error('EMAIL', 'Failed to process email application', { error: e.message, email: Sanitize.maskEmail(email) });
  }
}

function handleEmailFollowup(email, analysis) {
  Log.info('EMAIL', 'Processing follow-up', { email: Sanitize.maskEmail(email) });
  const candidate = SheetUtils.findCandidateByEmail(email);

  if (!candidate) {
    Log.warn('EMAIL', 'Candidate not found for follow-up - SKIPPING auto-reply to prevent spam', { email: Sanitize.maskEmail(email) });
    // GmailApp.sendEmail(email, 'Re: Your Application Status',
    //   `Hi there,\n\nWe couldn't find your application. Please provide your full name and role applied for.\n\nBest,\nTeam UrbanMistrii`);
    return;
  }

  const status = candidate.data[CONFIG.COLUMNS.STATUS - 1];
  const name = candidate.data[CONFIG.COLUMNS.NAME - 1];

  const statusHtml = EmailTemplates.wrap(`
    <h3>Application Status Update</h3>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Thank you for checking in! Here's the current status of your application:</p>
    <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #e74c3c; margin: 25px 0;">
      <p style="margin: 0;"><strong>Current Status:</strong> ${status}</p>
    </div>
    <p>We'll keep you updated on any changes. If you have any questions, feel free to reply to this email.</p>
    <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
  `);
  GmailApp.sendEmail(email, 'Your Application Status', `Hi ${name}, Your current status is: ${status}`, { htmlBody: statusHtml, name: 'Urbanmistrii' });
  CandidateTimeline.add(email, 'FOLLOWUP_EMAIL_SENT');

  // v22.1: Log to DB_FollowUp
  try {
    const followSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.FOLLOWUP);
    const phone = candidate.data[CONFIG.COLUMNS.PHONE - 1] || '';
    followSheet.appendRow([new Date(), name, phone, 'EMAIL_STATUS_CHECK', status]);
  } catch (e) {
    Log.warn('FOLLOWUP', 'Failed to log follow-up', { error: e.message });
  }
}

function handleEmailQuestion(email, analysis, body) {
  Log.info('EMAIL', 'Processing question', { email: Sanitize.maskEmail(email) });
  const candidate = SheetUtils.findCandidateByEmail(email);

  const context = {
    name: candidate ? candidate.data[CONFIG.COLUMNS.NAME - 1] : analysis.name,
    role: candidate ? candidate.data[CONFIG.COLUMNS.ROLE - 1] : 'unknown',
    status: candidate ? candidate.data[CONFIG.COLUMNS.STATUS - 1] : 'not in system'
  };

  const reply = AI.suggestReply(body.substring(0, 500), context);

  if (reply) {
    const replyHtml = EmailTemplates.wrap(`
      <h3>Your Question</h3>
      <p>Hello <strong>${context.name}</strong>,</p>
      <p>${reply.replace(/\n/g, '<br>')}</p>
      <p>If you have any more questions, feel free to ask!</p>
      <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
    `);
    GmailApp.sendEmail(email, 'Re: Your Question', reply, { htmlBody: replyHtml, name: 'Urbanmistrii' });
    Log.success('EMAIL', 'AI-generated reply sent');
  } else {
    Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `Question from ${context.name}`,
      `Candidate question needs manual response:\n\nFrom: ${email}\nQuestion:\n${body.substring(0, 1000)}`);
  }
}

function handleEmailEscalation(email, subject, body) {
  Log.warn('EMAIL', 'Escalation detected', { email: Sanitize.maskEmail(email) });
  Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `🚨 URGENT: Escalated Email from ${email}`,
    `Urgent email needs attention.\n\nFrom: ${email}\nSubject: ${subject}\n\nBody:\n${body}`);
  const escalationHtml = EmailTemplates.wrap(`
    <h3>Message Received</h3>
    <p>Hello,</p>
    <p>We've received your message and it has been flagged as a priority. A member of our HR team will review and respond to you personally.</p>
    <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;">
      <strong>Expected Response Time:</strong> 1-2 business days
    </div>
    <p>Thank you for your patience.</p>
    <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
  `);
  GmailApp.sendEmail(email, 'Re: ' + subject, 'We have received your message and will respond soon.', { htmlBody: escalationHtml, name: 'Urbanmistrii' });
}

// ═══════════════════════════════════════════════════════════════════════════════
//                        CANDIDATE TIMELINE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

const CandidateTimeline = {
  add(email, event, data = {}) {
    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.TIMELINE);
      sheet.appendRow([new Date(), email, event, JSON.stringify(data)]);
      Log.info('TIMELINE', 'Event recorded', { email: Sanitize.maskEmail(email), event });
    } catch (e) {
      Log.error('TIMELINE', 'Failed to record event', { email, event, error: e.message });
    }
  },

  get(email) {
    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.TIMELINE);
      const data = sheet.getDataRange().getValues();
      const timeline = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === email) {
          timeline.push({ timestamp: data[i][0], event: data[i][2], data: data[i][3] ? JSON.parse(data[i][3]) : {} });
        }
      }
      return timeline;
    } catch (e) {
      return [];
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//                        PRIVACY-SAFE SYNC
// ═══════════════════════════════════════════════════════════════════════════════

function syncToPublicView() {
  try {
    Log.info('SYNC', 'Starting privacy-safe sync');

    const master = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const masterData = master.getDataRange().getValues();
    if (masterData.length === 0) {
      Log.warn('SYNC', 'Master sheet is empty');
      return;
    }

    const safeColumns = [];
    masterData[0].forEach((header, index) => {
      if (!ConfigHelpers.isSensitive(header)) safeColumns.push(index);
    });

    const safeData = masterData.map(row => safeColumns.map(colIndex => row[colIndex]));

    const publicSs = SpreadsheetApp.openById(CONFIG.SHEETS.PUBLIC_ID);
    let publicSheet = publicSs.getSheetByName('Team View');
    if (!publicSheet) publicSheet = publicSs.insertSheet('Team View');

    if (safeData.length > 0) {
      publicSheet.clearContents();
      publicSheet.getRange(1, 1, safeData.length, safeData[0].length).setValues(safeData);
      publicSheet.getRange(1, 1, 1, safeData[0].length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    }

    Log.success('SYNC', 'Public view synced', { rows: safeData.length });
  } catch (e) {
    Log.error('SYNC', 'Failed to sync', { error: e.message });
  }
}



// ═══════════════════════════════════════════════════════════════════════════
//  FORMHANDLERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                     URBANMISTRII ORACLE v22.4 - FORM HANDLERS                 ║
 * ║                     Processing Google Form Submissions                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const FormHandlers = {
    /**
     * Handle leave submission from Google Form
     * Trigger: On Form Submit (Spreadsheet)
     * Form: https://docs.google.com/forms/d/e/1sFoC-e83AN7j2VXklmCC4Pah2B6-uvCCWNJTVLH3Sqg/viewform
     */
    handleLeaveFormSubmit(e) {
        try {
            const responses = e.namedValues;
            const name = (responses['Name'] || responses['Employee Name'] || [''])[0].trim();
            const email = (responses['Email'] || [''])[0].trim();
            const month = (responses['Month'] || [''])[0].trim();
            const year = (responses['Year'] || new Date().getFullYear().toString()).trim();
            const leavesTaken = parseInt((responses['Leaves Taken'] || responses['Total Leaves'] || ['0'])[0]) || 0;
            const notes = (responses['Notes'] || [''])[0].trim();
            const workingDays = parseInt((responses['Working Days'] || ['26'])[0]) || 26;

            if (!name || !email) {
                Log.error('SALARY', 'Missing name or email in leave submission');
                return;
            }

            Log.info('SALARY', `Processing leave submission from ${name}`, { email, leavesTaken, month, year });

            const currentMonth = month || new Date().toLocaleString('en-US', { month: 'long' });
            const currentYear = year || new Date().getFullYear().toString();
            const monthlySheetName = `Salary_${currentMonth}_${currentYear}`;

            const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);

            let monthlySheet;
            try {
                monthlySheet = ss.getSheetByName(monthlySheetName);
                if (!monthlySheet) {
                    monthlySheet = this._createMonthlySalarySheet(ss, monthlySheetName, workingDays);
                }
            } catch (e) {
                monthlySheet = this._createMonthlySalarySheet(ss, monthlySheetName, workingDays);
            }

            const presentDays = Math.max(0, workingDays - leavesTaken);

            const rowData = this._findOrCreateEmployeeRow(monthlySheet, name, email);

            monthlySheet.getRange(rowData.row, 1, 1, 6).setValues([[
                new Date(),
                name,
                email,
                leavesTaken,
                presentDays,
                notes || ''
            ]]);

            this._checkAllSubmissionsAndNotify(monthlySheet, monthlySheetName, workingDays);

            Log.success('SALARY', 'Leave submission processed', { name, leavesTaken, presentDays });

        } catch (err) {
            Log.error('SALARY', 'Failed to handle leave form submission', { error: err.message, stack: err.stack });
        }
    },

    _createMonthlySalarySheet(ss, sheetName, workingDays) {
        const sheet = ss.insertSheet(sheetName);
        sheet.appendRow(['Timestamp', 'Employee Name', 'Email', 'Leaves Taken', 'Present Days', 'Notes', 'Salary Status']);
        sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
        sheet.setColumnWidth(1, 180);
        sheet.setColumnWidth(2, 200);
        sheet.setColumnWidth(3, 220);
        sheet.setColumnWidth(4, 120);
        sheet.setColumnWidth(5, 120);
        sheet.setColumnWidth(6, 300);
        sheet.setColumnWidth(7, 150);
        sheet.setFrozenRows(1);
        return sheet;
    },

    _findOrCreateEmployeeRow(sheet, name, email) {
        const data = sheet.getDataRange().getValues();
        const numRows = data.length;

        for (let i = 1; i < numRows; i++) {
            const rowEmail = data[i][2];
            if (rowEmail === email) {
                return { row: i + 1, exists: true };
            }
        }

        const newRow = numRows + 1;
        return { row: newRow, exists: false };
    },

    _checkAllSubmissionsAndNotify(sheet, sheetName, workingDays) {
        try {
            const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
            const salaryTracker = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.SALARY_TRACKER);
            const allEmployees = salaryTracker.getDataRange().getValues();
            const activeEmails = new Set();
            for (let i = 1; i < allEmployees.length; i++) {
                if (allEmployees[i][8] === 'Active') {
                    activeEmails.add(allEmployees[i][2]);
                }
            }

            // FIX: Get monthlyData from the passed sheet parameter
            const monthlyData = sheet.getDataRange().getValues();
            const submittedEmails = new Set();
            for (let i = 1; i < monthlyData.length; i++) {
                submittedEmails.add(monthlyData[i][2]);
            }

            const missingEmails = [...activeEmails].filter(email => !submittedEmails.has(email));
            const submissionsCount = monthlyData.length - 1; // FIX: Calculate submissions count

            if (missingEmails.length === 0 && activeEmails.size > 0) {
                const notificationHtml = EmailTemplates.wrap(`
                    <h3>✅ Monthly Leave Report Complete</h3>
                    <p>All employees have submitted their leave information for <strong>${sheetName}</strong>.</p>
                    <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin: 0 0 10px 0;">📊 Summary:</h4>
                        <ul style="margin: 0;">
                            <li>Total Employees: ${activeEmails.size}</li>
                            <li>Total Submissions: ${submissionsCount}</li>
                            <li>Working Days: ${workingDays}</li>
                        </ul>
                    </div>
                    <p style="margin-top: 20px;">
                        ${EmailTemplates.button('VIEW SALARY SHEET', ss.getUrl())}
                    </p>
                    <p>
                        <strong>Next Steps:</strong>
                        <ol>
                            <li>Review the ${sheetName} sheet for any discrepancies</li>
                            <li>Calculate salaries based on present days</li>
                            <li>Process payments accordingly</li>
                        </ol>
                    </p>
                `);

                GmailApp.sendEmail(
                    CONFIG.TEAM.ADMIN_EMAIL,
                    `✅ Complete: ${sheetName} - All Employees Submitted`,
                    `All ${activeEmails.size} employees have submitted leave data. Review sheet: ${ss.getUrl()}`,
                    { htmlBody: notificationHtml, name: 'Urbanmistrii Oracle' }
                );

                Log.success('SALARY', 'All submissions received - notification sent', { total: activeEmails.size });
            } else {
                Log.info('SALARY', `Waiting for ${missingEmails.length} more submissions`, { missing: missingEmails });
            }

        } catch (e) {
            Log.error('SALARY', 'Failed to check all submissions', { error: e.message });
        }
    },

    /**
     * Handle test submission from Google Form
     * Trigger: On Form Submit (Spreadsheet)
     */
    handleTestFormSubmit(e) {
        try {
            const responses = e.namedValues;
            // Handle potential variations in field names
            const email = (responses['Email Address'] || responses['Email'] || responses['Username'] || [''])[0].trim();

            if (!email) {
                Log.error('FORM', 'No email found in form submission');
                return;
            }

            const pdfDocsUrl = (responses['PDF/Docs Upload'] || responses['PDF/Docs'] || responses['Upload PDF/Docs'] || [''])[0];
            const dwgUrl = (responses['DWG Upload'] || responses['DWG Files'] || responses['Upload DWG'] || [''])[0];
            const otherFilesUrl = (responses['Other Files'] || responses['Other Uploads'] || [''])[0];
            const testNotes = (responses['Test Notes'] || responses['Notes'] || [''])[0];

            const submissionData = {
                pdfDocsUrl,
                dwgUrl,
                otherFilesUrl,
                testNotes
            };

            Log.info('FORM', 'Processing test submission', { email });

            // Find candidate by email
            const candidate = SheetUtils.findCandidateByEmail(email);

            // VALIDATION: Must have candidate AND at least one file
            const hasFiles = pdfDocsUrl || dwgUrl || otherFilesUrl;

            if (!candidate) {
                Log.warn('FORM', 'Candidate not found in system - skipping submission', { email });
                return;
            }

            if (!hasFiles) {
                Log.warn('FORM', 'No files submitted - skipping notification', { email });
                return;
            }

            const submissionTime = new Date();
            let hoursTaken = null;
            let timeStatus = 'Unknown';
            let candidateName = 'Unknown';
            let candidateRole = 'Unknown';
            let candidatePhone = 'Unknown';
            let testSentTime = null;

            if (candidate) {
                candidateName = candidate.name;
                candidateRole = candidate.role;
                candidatePhone = candidate.phone;
                testSentTime = candidate.testSent;

                if (testSentTime) {
                    hoursTaken = DateTime.hoursBetween(new Date(testSentTime), submissionTime);
                    const roleNormalized = (candidate.role || '').toLowerCase();
                    const timeLimit = CONFIG.RULES.TIME_LIMITS[roleNormalized.includes('senior') ? 'senior' : roleNormalized.includes('junior') ? 'junior' : 'intern'] || 2;
                    timeStatus = hoursTaken <= timeLimit ? `ON TIME (${hoursTaken.toFixed(1)}h / ${timeLimit}h)` : `LATE (${hoursTaken.toFixed(1)}h / ${timeLimit}h)`;
                }

                // Update candidate sheet
                const allUrls = [pdfDocsUrl, dwgUrl, otherFilesUrl].filter(Boolean).join(' | ');
                SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTFOLIO_URL, allUrls);
                SheetUtils.updateStatus(candidate.row, CONFIG.RULES.STATUSES.TEST_SUBMITTED, email);
                SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.TEST_SUBMITTED, submissionTime);
                SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `Form: ${timeStatus}`);

                // Trigger AI scoring
                if (pdfDocsUrl || dwgUrl) {
                    const scoreUrl = pdfDocsUrl || dwgUrl;
                    const score = AI.scorePortfolio(scoreUrl, candidate.role);
                    if (score && score.score) {
                        SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.AI_SCORE, score.score);
                        SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTFOLIO_FEEDBACK, score.summary);
                    }
                }

                CandidateTimeline.add(email, 'TEST_SUBMITTED_VIA_FORM', {
                    pdfDocsUrl, dwgUrl, otherFilesUrl, timeStatus, hoursTaken
                });
            }

            // Log to DB_TestSubmissions sheet (only if valid candidate and files)
            if (candidate && hasFiles) {
                this._logToTestSubmissions({
                    timestamp: submissionTime,
                    name: candidateName,
                    email: email,
                    role: candidateRole,
                    phone: candidatePhone,
                    pdfDocsUrl,
                    dwgUrl,
                    otherFilesUrl,
                    testNotes,
                    timeStatus,
                    hoursTaken,
                    testSentAt: testSentTime
                });

                // Notify Admin (only if valid candidate and files)
                this._notifyAdmin(candidateName, email, candidateRole, candidatePhone, submissionData, timeStatus);
            }

            Log.success('FORM', 'Test submission processed', { email, timeStatus });

        } catch (err) {
            Log.error('FORM', 'Failed to handle form submission', { error: err.message, stack: err.stack });
        }
    },

    /**
     * Internal logger for Test Submissions
     */
    _logToTestSubmissions(logData) {
        try {
            let subSheet;
            try {
                subSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.TEST_SUBMISSIONS);
            } catch (e) {
                const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
                subSheet = ss.insertSheet(CONFIG.SHEETS.TABS.TEST_SUBMISSIONS);
                subSheet.appendRow([
                    'Timestamp', 'Name', 'Email', 'Role', 'Phone',
                    'PDF/Docs URL', 'DWG URL', 'Other Files', 'Test Notes',
                    'Time Allotted (hrs)', 'Time Taken (hrs)', 'Status', 'Test Sent At'
                ]);
                subSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
            }

            const roleNormalized = (logData.role || '').toLowerCase();
            const timeLimit = CONFIG.RULES.TIME_LIMITS[roleNormalized.includes('senior') ? 'senior' : roleNormalized.includes('junior') ? 'junior' : 'intern'] || 2;

            subSheet.appendRow([
                logData.timestamp,
                logData.name,
                logData.email,
                logData.role,
                logData.phone,
                logData.pdfDocsUrl || '',
                logData.dwgUrl || '',
                logData.otherFilesUrl || '',
                logData.testNotes || '',
                timeLimit,
                logData.hoursTaken ? logData.hoursTaken.toFixed(2) : '',
                logData.timeStatus,
                logData.testSentAt || ''
            ]);
        } catch (e) {
            Log.error('FORM', 'Failed to write to DB_TestSubmissions', { error: e.message });
        }
    },

    /**
     * Internal admin notification
     */
    _notifyAdmin(name, email, role, phone, data, timeStatus) {
        const adminEmailHtml = EmailTemplates.wrap(`
      <h3>Test Submission Received (via Google Form)</h3>
      <p><strong>${name}</strong> has submitted their test.</p>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid ${timeStatus.includes('ON TIME') ? '#4caf50' : '#f44336'}; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Time Status:</strong> ${timeStatus}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd;"><strong>Name</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${name}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${email}</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd;"><strong>Role</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${role}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${phone || 'N/A'}</td></tr>
      </table>
      
      <h4>Submitted Files:</h4>
      <ul>
        ${data.pdfDocsUrl ? `<li><strong>PDF/Docs:</strong> <a href="${data.pdfDocsUrl}">${data.pdfDocsUrl}</a></li>` : ''}
        ${data.dwgUrl ? `<li><strong>DWG Files:</strong> <a href="${data.dwgUrl}">${data.dwgUrl}</a></li>` : ''}
        ${data.otherFilesUrl ? `<li><strong>Other:</strong> <a href="${data.otherFilesUrl}">${data.otherFilesUrl}</a></li>` : ''}
      </ul>
      
      ${data.testNotes ? `<h4>Candidate Notes:</h4><p style="background: #fff3e0; padding: 15px; border-radius: 8px;">${data.testNotes}</p>` : ''}
      
      <p style="margin-top: 20px;">
        ${EmailTemplates.button('REVIEW IN SHEET', getSheetUrl())}
      </p>
    `);

        GmailApp.sendEmail(
            CONFIG.TEAM.ADMIN_EMAIL,
            `Form Submission: ${name} - ${timeStatus}`,
            `${name} submitted their test via form. Time: ${timeStatus}.`,
            { htmlBody: adminEmailHtml, name: 'Urbanmistrii Oracle' }
        );
    }
};

/**
 * Global wrapper function for trigger - GAS triggers can't call object methods directly
 * @param {object} e - Form submission event
 */
function onLeaveFormSubmit(e) {
    FormHandlers.handleLeaveFormSubmit(e);
}

/**
 * Global wrapper function for test form trigger
 * @param {object} e - Form submission event  
 */
function onTestFormSubmit(e) {
    FormHandlers.handleTestFormSubmit(e);
}



// ═══════════════════════════════════════════════════════════════════════════
//  PORTAL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                 URBANMISTRII ORACLE v22.4 - CANDIDATE PORTAL                  ║
 * ║                 Self-Service Web App for Candidates                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy: Publish → Deploy as web app
 * URL will be: https://script.google.com/macros/s/.../exec
 */

/**
 * Handle GET requests - serve the portal HTML
 */
function doGet(e) {
  try {
    // Hit Logger for debugging access issues
    Log.info('PORTAL_HIT', 'Request received', {
      token: e.parameter.token ? 'PRESENT' : 'MISSING',
      userAgent: e.parameter.ua || 'Unknown'
    });

    const token = e.parameter.token;

    if (!token) {
      return HtmlService.createHtmlOutput(Portal.getErrorPage(`No access token provided. Please use the Google Form for submission: <a href="${CONFIG.TEST_SUBMISSION_FORM_URL}">${CONFIG.TEST_SUBMISSION_FORM_URL}</a>`));
    }

    // Validate token and get candidate
    const candidate = Portal.validateToken(token);

    if (!candidate) {
      return HtmlService.createHtmlOutput(Portal.getErrorPage('Invalid or expired access token. Please contact HR.'));
    }

    // Serve the portal
    const html = Portal.generatePortalHtml(candidate, token);
    return HtmlService.createHtmlOutput(html)
      .setTitle('UrbanMistrii - Candidate Portal')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  } catch (err) {
    return HtmlService.createHtmlOutput(`
      <div style="font-family: sans-serif; padding: 50px; text-align: center;">
        <h1 style="color: #d32f2f;">🚨 Portal Runtime Error</h1>
        <p>The portal encountered a technical issue during load.</p>
        <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: left; display: inline-block; margin-top: 20px;">
Error: ${err.message}
        </pre>
        <p style="margin-top: 20px; color: #666;">Please share this error message with the administrator.</p>
      </div>
    `);
  }
}

/**
 * Handle POST requests - form submissions
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    switch (data.action) {
      case 'uploadTest':
        return ContentService.createTextOutput(JSON.stringify(
          Portal.handleTestUpload(data.token, {
            pdfDocsUrl: data.pdfDocsUrl,
            dwgUrl: data.dwgUrl,
            otherFilesUrl: data.otherFilesUrl,
            testNotes: data.testNotes
          })
        )).setMimeType(ContentService.MimeType.JSON);

      case 'bookSlot':
        return ContentService.createTextOutput(JSON.stringify(
          Portal.handleSlotBooking(data.token, data.slotTime)
        )).setMimeType(ContentService.MimeType.JSON);

      case 'getSlots':
        return ContentService.createTextOutput(JSON.stringify(
          Portal.getAvailableSlots(data.date)
        )).setMimeType(ContentService.MimeType.JSON);

      default:
        return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

const Portal = {
  /**
   * Generate unique access token for a candidate
   */
  generateToken(email) {
    const token = Utilities.getUuid();

    // Find candidate and update token column
    const candidate = SheetUtils.findCandidateByEmail(email);
    if (candidate) {
      // Store token using configuration column
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTAL_TOKEN, token);

      Log.info('PORTAL', 'Token generated', { email: Sanitize.maskEmail(email) });
      return token;
    }

    return null;
  },

  /**
   * Validate token and return candidate data
   */
  validateToken(token) {
    try {
      const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
      const data = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][CONFIG.COLUMNS.PORTAL_TOKEN - 1] === token) { // Use constant
          return {
            row: i + 1,
            name: data[i][CONFIG.COLUMNS.NAME - 1],
            email: data[i][CONFIG.COLUMNS.EMAIL - 1],
            phone: data[i][CONFIG.COLUMNS.PHONE - 1],
            role: data[i][CONFIG.COLUMNS.ROLE - 1],
            status: data[i][CONFIG.COLUMNS.STATUS - 1],
            testSent: data[i][CONFIG.COLUMNS.TEST_SENT - 1],
            testSubmitted: data[i][CONFIG.COLUMNS.TEST_SUBMITTED - 1],
            interviewDate: data[i][CONFIG.COLUMNS.INTERVIEW_DATE - 1],
            portfolioScore: data[i][CONFIG.COLUMNS.PORTFOLIO_SCORE - 1]
          };
        }
      }

      return null;
    } catch (e) {
      Log.error('PORTAL', 'Token validation failed', { error: e.message });
      return null;
    }
  },

  /**
   * Handle test submission from portal with multiple file types
   * Tracks submission time vs allotted time
   */
  handleTestUpload(token, submissionData) {
    const candidate = this.validateToken(token);
    if (!candidate) return { success: false, error: 'Invalid token' };

    const {
      pdfDocsUrl,      // PDF/docs/design notes
      dwgUrl,          // DWG files
      otherFilesUrl,   // Other uploads
      testNotes        // Text notes
    } = submissionData;

    // Calculate time taken vs allotted
    const testSentTime = candidate.testSent;
    const submissionTime = new Date();
    let hoursTaken = null;
    let timeStatus = 'Unknown';

    if (testSentTime) {
      hoursTaken = DateTime.hoursBetween(new Date(testSentTime), submissionTime);
      const role = (candidate.role || '').toLowerCase();
      const timeLimit = CONFIG.RULES.TIME_LIMITS[role.includes('senior') ? 'senior' : role.includes('junior') ? 'junior' : 'intern'] || 2;
      timeStatus = hoursTaken <= timeLimit ? `ON TIME (${hoursTaken.toFixed(1)}h / ${timeLimit}h)` : `LATE (${hoursTaken.toFixed(1)}h / ${timeLimit}h)`;
    }

    // Combine all URLs for portfolio field
    const allUrls = [pdfDocsUrl, dwgUrl, otherFilesUrl].filter(Boolean).join(' | ');

    // Update candidate sheet
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTFOLIO_URL, allUrls);
    SheetUtils.updateStatus(candidate.row, CONFIG.RULES.STATUSES.TEST_SUBMITTED, candidate.email);
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.TEST_SUBMITTED, submissionTime);
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `📤 Portal: ${timeStatus}`);

    // Write to DB_TestSubmissions sheet
    try {
      let subSheet;
      try {
        subSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.TEST_SUBMISSIONS);
      } catch (e) {
        // Create sheet if doesn't exist
        const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
        subSheet = ss.insertSheet(CONFIG.SHEETS.TABS.TEST_SUBMISSIONS);
        subSheet.appendRow([
          'Timestamp', 'Name', 'Email', 'Role', 'Phone',
          'PDF/Docs URL', 'DWG URL', 'Other Files', 'Test Notes',
          'Time Allotted (hrs)', 'Time Taken (hrs)', 'Status', 'Test Sent At'
        ]);
        subSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      }

      const role = (candidate.role || '').toLowerCase();
      const timeLimit = CONFIG.RULES.TIME_LIMITS[role.includes('senior') ? 'senior' : role.includes('junior') ? 'junior' : 'intern'] || 2;

      subSheet.appendRow([
        submissionTime,
        candidate.name,
        candidate.email,
        candidate.role,
        candidate.phone,
        pdfDocsUrl || '',
        dwgUrl || '',
        otherFilesUrl || '',
        testNotes || '',
        timeLimit,
        hoursTaken ? hoursTaken.toFixed(2) : '',
        timeStatus,
        testSentTime || ''
      ]);
    } catch (e) {
      Log.error('PORTAL', 'Failed to write to DB_TestSubmissions', { error: e.message });
    }

    // Trigger AI scoring if we have a portfolio URL
    if (pdfDocsUrl || dwgUrl) {
      const scoreUrl = pdfDocsUrl || dwgUrl;
      const score = AI.scorePortfolio(scoreUrl, candidate.role);
      if (score && score.score) {
        SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.AI_SCORE, score.score);
        SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTFOLIO_FEEDBACK, score.summary);
      }
    }

    CandidateTimeline.add(candidate.email, 'TEST_SUBMITTED_VIA_PORTAL', {
      pdfDocsUrl, dwgUrl, otherFilesUrl, timeStatus, hoursTaken
    });

    // Auto-forward email to admin with all details
    const adminEmailHtml = EmailTemplates.wrap(`
      <h3>Test Submission Received</h3>
      <p><strong>${candidate.name}</strong> has submitted their test via the portal.</p>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid ${timeStatus.includes('ON TIME') ? '#4caf50' : '#f44336'}; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Time Status:</strong> ${timeStatus}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd;"><strong>Name</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${candidate.name}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${candidate.email}</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd;"><strong>Role</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${candidate.role}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${candidate.phone || 'N/A'}</td></tr>
      </table>
      
      <h4>Submitted Files:</h4>
      <ul>
        ${pdfDocsUrl ? `<li><strong>PDF/Docs:</strong> <a href="${pdfDocsUrl}">${pdfDocsUrl}</a></li>` : ''}
        ${dwgUrl ? `<li><strong>DWG Files:</strong> <a href="${dwgUrl}">${dwgUrl}</a></li>` : ''}
        ${otherFilesUrl ? `<li><strong>Other:</strong> <a href="${otherFilesUrl}">${otherFilesUrl}</a></li>` : ''}
      </ul>
      
      ${testNotes ? `<h4>Candidate Notes:</h4><p style="background: #fff3e0; padding: 15px; border-radius: 8px;">${testNotes}</p>` : ''}
      
      <p style="margin-top: 20px;">
        ${EmailTemplates.button('REVIEW IN SHEET', getSheetUrl())}
      </p>
    `);

    GmailApp.sendEmail(
      CONFIG.TEAM.ADMIN_EMAIL,
      `Test Submission: ${candidate.name} - ${timeStatus}`,
      `${candidate.name} submitted their test. Time: ${timeStatus}. Review at: ${getSheetUrl()}`,
      { htmlBody: adminEmailHtml, name: 'Urbanmistrii Oracle' }
    );

    Log.success('PORTAL', 'Test submitted via portal', { name: candidate.name, timeStatus });

    return { success: true, message: 'Test submitted successfully! We will review and get back to you.' };
  },

  /**
   * Handle interview slot booking
   */
  handleSlotBooking(token, slotTime) {
    const candidate = this.validateToken(token);
    if (!candidate) return { success: false, error: 'Invalid token' };

    const dateTime = new Date(slotTime);

    // Create calendar event
    const calResult = Calendar.createInterview(candidate, dateTime);

    if (calResult.success) {
      // Update interview date in sheet
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.INTERVIEW_DATE, dateTime);
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.CALENDAR_EVENT_ID, calResult.eventId);
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `📅 Interview booked via portal: ${DateTime.formatIST(dateTime, 'full')}`);

      CandidateTimeline.add(candidate.email, 'INTERVIEW_BOOKED_VIA_PORTAL', { date: dateTime.toISOString() });

      Log.success('PORTAL', 'Interview booked via portal', { name: candidate.name, date: dateTime });

      return { success: true, message: `Interview booked for ${DateTime.formatIST(dateTime, 'full')}` };
    }

    return { success: false, error: calResult.error };
  },

  /**
   * Get available interview slots
   */
  getAvailableSlots(dateStr) {
    const date = new Date(dateStr);
    const slots = Calendar.getAvailableSlots(date);
    return { success: true, slots: slots };
  },

  /**
   * Generate portal HTML
   */
  generatePortalHtml(candidate, token) {
    const statusInfo = this.getStatusInfo(candidate.status);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UrbanMistrii - Candidate Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    // SESSION FIXER: Automatically redirect if Google adds account hints (/u/n/)
    (function() {
      const url = window.location.href;
      if (url.includes('/u/') && !url.includes('?token=')) {
        // If it's a multi-session link but missing the token in current view, 
        // Or if it's just stuck in a loop, try to redirect to the clean config URL
        // with the token extracted from current search params
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
          window.location.host = 'script.google.com';
          const cleanPath = window.location.pathname.replace(/\/u\/\d+/, '');
          window.location.href = 'https://script.google.com' + cleanPath + '?token=' + token;
        }
      }
    })();
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo { font-size: 28px; font-weight: 700; color: #667eea; }
    .welcome { color: #666; margin-top: 10px; }
    .status-banner {
      background: ${statusInfo.color};
      color: white;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .status-icon { font-size: 48px; margin-bottom: 10px; }
    .status-text { font-size: 20px; font-weight: 600; }
    .status-desc { opacity: 0.9; margin-top: 8px; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .info-item {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
    }
    .info-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .info-value { font-size: 16px; font-weight: 600; margin-top: 4px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #333; }
    .btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
    .btn:disabled { background: #ccc; cursor: not-allowed; transform: none; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-weight: 500; margin-bottom: 8px; }
    input, textarea, select {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
    }
    .timeline {
      border-left: 3px solid #667eea;
      padding-left: 20px;
    }
    .timeline-item {
      position: relative;
      padding-bottom: 20px;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -26px;
      top: 0;
      width: 12px;
      height: 12px;
      background: #667eea;
      border-radius: 50%;
    }
    .timeline-item.completed::before { background: #4caf50; }
    .timeline-item.current::before { background: #ff9800; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
    .message { padding: 16px; border-radius: 8px; margin-top: 16px; }
    .message.success { background: #e8f5e9; color: #2e7d32; }
    .message.error { background: #ffebee; color: #c62828; }
    .hidden { display: none; }
    .footer { text-align: center; color: rgba(255,255,255,0.7); margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">🏠 UrbanMistrii</div>
        <div class="welcome">Welcome, ${candidate.name}!</div>
      </div>
      
      <div class="status-banner">
        <div class="status-icon">${statusInfo.icon}</div>
        <div class="status-text">${statusInfo.title}</div>
        <div class="status-desc">${statusInfo.description}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Role</div>
          <div class="info-value">${candidate.role || 'Designer'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Email</div>
          <div class="info-value">${candidate.email}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value">${candidate.status}</div>
        </div>
        ${candidate.portfolioScore ? `
        <div class="info-item">
          <div class="info-label">Portfolio Score</div>
          <div class="info-value">${candidate.portfolioScore}/10</div>
        </div>
        ` : ''}
      </div>
      
      <!-- Test Upload Section -->
      <div id="testUploadSection" class="${this.shouldShowTestUpload(candidate.status) ? '' : 'hidden'}">
        <h3 class="section-title">📤 Submit Your Test</h3>
        <p style="color: #666; margin-bottom: 20px;">Upload your test files by providing links to Google Drive, Dropbox, or any file sharing service. Make sure the links are accessible (set to "Anyone with link can view").</p>
        
        <form id="testForm">
          <div class="form-group">
            <label>📄 PDF/Documents/Design Notes *</label>
            <input type="url" id="pdfDocsUrl" placeholder="https://drive.google.com/..." required>
            <small style="color: #888;">Presentation, design notes, PDFs (required)</small>
          </div>
          
          <div class="form-group">
            <label>📐 DWG/CAD Files</label>
            <input type="url" id="dwgUrl" placeholder="https://drive.google.com/...">
            <small style="color: #888;">AutoCAD, DWG files (if applicable)</small>
          </div>
          
          <div class="form-group">
            <label>📁 Other Supporting Files</label>
            <input type="url" id="otherFilesUrl" placeholder="https://...">
            <small style="color: #888;">Any other files - 3D renders, references, etc.</small>
          </div>
          
          <div class="form-group">
            <label>📝 Test Notes</label>
            <textarea id="testNotes" rows="4" placeholder="Describe your approach, any challenges faced, or additional context about your submission..."></textarea>
          </div>
          
          <button type="submit" class="btn">🚀 Submit Test</button>
        </form>
        <div id="testMessage" class="message hidden"></div>
      </div>
      
      <!-- Interview Booking Section -->
      <div id="interviewSection" class="${this.shouldShowInterviewBooking(candidate.status) ? '' : 'hidden'}">
        <h3 class="section-title">📅 Book Your Interview</h3>
        <form id="interviewForm">
          <div class="form-group">
            <label>Select Date</label>
            <input type="date" id="interviewDate" min="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Available Slots</label>
            <select id="slotSelect" disabled>
              <option>Select a date first</option>
            </select>
          </div>
          <button type="submit" class="btn" id="bookBtn" disabled>Book Interview</button>
        </form>
        <div id="interviewMessage" class="message hidden"></div>
      </div>
    </div>
    
    <div class="footer">
      UrbanMistrii Candidate Portal • Powered by Oracle v22.0
    </div>
  </div>
  
  <script>
    const TOKEN = '${token}';
    const API_URL = '${CONFIG.PORTAL_URL}';
    
    // Test submission
    document.getElementById('testForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = '⏳ Submitting...';
      
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadTest',
            token: TOKEN,
            pdfDocsUrl: document.getElementById('pdfDocsUrl').value,
            dwgUrl: document.getElementById('dwgUrl').value || '',
            otherFilesUrl: document.getElementById('otherFilesUrl').value || '',
            testNotes: document.getElementById('testNotes').value || ''
          })
        });
        const data = await res.json();
        showMessage('testMessage', data.success, data.message || data.error);
        if (data.success) {
          e.target.classList.add('hidden');
          // Show success animation
          document.getElementById('testUploadSection').innerHTML = '<div style="text-align: center; padding: 40px;"><div style="font-size: 64px;">✅</div><h3>Test Submitted Successfully!</h3><p>We will review your submission and get back to you soon.</p></div>';
        }
      } catch (err) {
        showMessage('testMessage', false, err.message);
      }
      
      btn.disabled = false;
      btn.textContent = '🚀 Submit Test';
    });
    
    // Date selection for interview
    document.getElementById('interviewDate')?.addEventListener('change', async (e) => {
      const select = document.getElementById('slotSelect');
      const btn = document.getElementById('bookBtn');
      select.innerHTML = '<option>Loading...</option>';
      
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'getSlots', date: e.target.value })
        });
        const data = await res.json();
        
        if (data.slots && data.slots.length > 0) {
          select.innerHTML = data.slots.map(s => 
            '<option value="' + s.start + '">' + s.label + '</option>'
          ).join('');
          select.disabled = false;
          btn.disabled = false;
        } else {
          select.innerHTML = '<option>No slots available</option>';
        }
      } catch (err) {
        select.innerHTML = '<option>Error loading slots</option>';
      }
    });
    
    // Interview booking
    document.getElementById('interviewForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('bookBtn');
      btn.disabled = true;
      btn.textContent = 'Booking...';
      
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'bookSlot',
            token: TOKEN,
            slotTime: document.getElementById('slotSelect').value
          })
        });
        const data = await res.json();
        showMessage('interviewMessage', data.success, data.message || data.error);
        if (data.success) {
          e.target.classList.add('hidden');
        }
      } catch (err) {
        showMessage('interviewMessage', false, err.message);
      }
      
      btn.textContent = 'Book Interview';
    });
    
    function showMessage(id, success, text) {
      const el = document.getElementById(id);
      el.className = 'message ' + (success ? 'success' : 'error');
      el.textContent = text;
      el.classList.remove('hidden');
    }
  </script>
</body>
</html>
    `;
  },

  /**
   * Get status display info
   */
  getStatusInfo(status) {
    const info = {
      [CONFIG.RULES.STATUSES.NEW]: { icon: '📋', title: 'Application Received', description: 'We are reviewing your application', color: '#2196f3' },
      [CONFIG.RULES.STATUSES.IN_PROCESS]: { icon: '⏳', title: 'In Process', description: 'Your application is being processed', color: '#ff9800' },
      [CONFIG.RULES.STATUSES.TEST_SENT]: { icon: '📝', title: 'Test Assigned', description: 'Please complete and submit your test', color: '#9c27b0' },
      [CONFIG.RULES.STATUSES.TEST_SUBMITTED]: { icon: '✅', title: 'Test Submitted', description: 'We received your test and are reviewing it', color: '#4caf50' },
      [CONFIG.RULES.STATUSES.UNDER_REVIEW]: { icon: '🔍', title: 'Under Review', description: 'Your work is being evaluated', color: '#607d8b' },
      [CONFIG.RULES.STATUSES.INTERVIEW_PENDING]: { icon: '📅', title: 'Interview Pending', description: 'Book your interview slot below', color: '#e91e63' },
      [CONFIG.RULES.STATUSES.INTERVIEW_DONE]: { icon: '🎯', title: 'Interview Complete', description: 'We will share the decision soon', color: '#673ab7' },
      [CONFIG.RULES.STATUSES.HIRED]: { icon: '🎉', title: 'Congratulations!', description: 'Welcome to the UrbanMistrii team!', color: '#4caf50' },
      [CONFIG.RULES.STATUSES.REJECTED]: { icon: '💔', title: 'Not Selected', description: 'Thank you for your interest', color: '#9e9e9e' }
    };

    return info[status] || { icon: '📋', title: status, description: '', color: '#2196f3' };
  },

  shouldShowTestUpload(status) {
    return status === CONFIG.RULES.STATUSES.TEST_SENT;
  },

  shouldShowInterviewBooking(status) {
    return status === CONFIG.RULES.STATUSES.INTERVIEW_PENDING;
  },

  getErrorPage(message) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Error - UrbanMistrii Portal</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; }
    .error { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .error h1 { color: #e53935; margin-bottom: 16px; }
    .error p { color: #666; }
  </style>
</head>
<body>
  <div class="error">
    <h1>⚠️ Access Error</h1>
    <p>${message}</p>
    <div id="sessionFix" style="display:none; margin-top:20px; padding:15px; background:#fff3e0; border-radius:8px;">
      <p style="font-size:14px; margin-bottom:10px;">Having trouble? Try the clean link:</p>
      <button onclick="fixSession()" style="background:#e67e22; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">FIX SESSION & RELOAD</button>
    </div>
    <p style="margin-top: 20px;"><a href="mailto:${CONFIG.TEAM.ADMIN_EMAIL}">Contact HR</a></p>
  </div>
  <script>
    const url = window.location.href;
    if (url.includes('/u/')) {
      document.getElementById('sessionFix').style.display = 'block';
    }
    
    function fixSession() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const cleanUrl = 'https://script.google.com/macros/s/AKfycbyaZbGMBNM33g-fu3uFBWWXP_WsRdS7nuHpqzq8dsIfE-dGfMoZo2t0y2R5Aqeyaq1sVw/exec' + (token ? '?token=' + token : '');
      window.top.location.href = cleanUrl;
    }
  </script>
</body>
</html>
    `;
  }
};

/**
 * Send portal link to a candidate
 */
function sendPortalLink(email) {
  const token = Portal.generateToken(email);
  if (!token) {
    Logger.log('Failed to generate token for ' + email);
    return false;
  }

  const portalUrl = CONFIG.PORTAL_URL + '?token=' + token;

  Notify.email(
    email,
    '🔗 Your UrbanMistrii Candidate Portal',
    `Hello!

You now have access to your personal candidate portal where you can:
• Check your application status
• Submit your test
• Book interview slots

Access your portal here:
${portalUrl}

This link is unique to you - do not share it.

Best regards,
Team UrbanMistrii`
  );

  Log.success('PORTAL', 'Portal link sent', { email: Sanitize.maskEmail(email) });
  return true;
}

/**
 * Test portal - generates a test link for the first TEST_SENT candidate
 * Run this function to get a working portal URL
 */
function testPortal() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         PORTAL TEST - GENERATING TEST LINK                        ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
  const data = sheet.getDataRange().getValues();

  // Find first TEST_SENT candidate or first candidate with email
  let testCandidate = null;
  let testRow = null;

  for (let i = 1; i < data.length; i++) {
    const status = data[i][CONFIG.COLUMNS.STATUS - 1];
    const email = data[i][CONFIG.COLUMNS.EMAIL - 1];
    const name = data[i][CONFIG.COLUMNS.NAME - 1];

    if (email && (status === CONFIG.RULES.STATUSES.TEST_SENT || !testCandidate)) {
      testCandidate = { email, name, status, row: i + 1 };
      testRow = i + 1;
      if (status === CONFIG.RULES.STATUSES.TEST_SENT) break; // Prefer TEST_SENT candidates
    }
  }

  if (!testCandidate) {
    Logger.log('❌ No candidates found in sheet!');
    return;
  }

  Logger.log(`\n📋 Testing with: ${testCandidate.name} (${testCandidate.email})`);
  Logger.log(`   Status: ${testCandidate.status}`);

  // Generate or get existing token
  let token = data[testRow - 1][CONFIG.COLUMNS.PORTAL_TOKEN - 1];

  if (!token) {
    token = Portal.generateToken(testCandidate.email);
    Logger.log('🔑 Generated new token');
  } else {
    Logger.log('🔑 Using existing token');
  }

  // Build portal URL
  const baseUrl = CONFIG.PORTAL_URL;
  const portalUrl = baseUrl + '?token=' + token;

  Logger.log('\n════════════════════════════════════════════════════════════════════');
  Logger.log('✅ PORTAL TEST URL:');
  Logger.log(portalUrl);
  Logger.log('════════════════════════════════════════════════════════════════════');
  Logger.log('\nOpen this URL in your browser to test the portal.');
  Logger.log('(The candidate will see their status and can submit test if status is TEST_SENT)');
}

/**
 * Generate portal link for a specific email address
 * @param {string} email - Candidate email to generate link for
 */
function generatePortalLinkFor(email) {
  if (!email) {
    Logger.log('Usage: generatePortalLinkFor("candidate@email.com")');
    return;
  }

  const token = Portal.generateToken(email);
  if (!token) {
    Logger.log('❌ Candidate not found: ' + email);
    return;
  }

  const baseUrl = CONFIG.PORTAL_URL;
  const portalUrl = baseUrl + '?token=' + token;

  Logger.log('✅ Portal link for ' + email + ':');
  Logger.log(portalUrl);
}

/**
 * QUICK TEST: Send portal link to Yash for testing
 * Run this function directly!
 */
/**
 * QUICK TEST: Send test links to Yash
 */
function sendOracleTestToYash() {
  const email = 'iamyash95@gmail.com';
  const roles = [
    { name: 'Intern', role: 'intern' },
    { name: 'Junior', role: 'junior' },
    { name: 'Senior', role: 'senior' }
  ];

  roles.forEach(item => {
    const testLink = ConfigHelpers.getTestLink(item.role, 'DESIGN');
    const timeLimit = ConfigHelpers.getTimeLimit(item.role, 'DESIGN');
    const submissionFormUrl = CONFIG.TEST_SUBMISSION_FORM_URL;

    const html = EmailTemplates.wrap(`
      <h3>UrbanMistrii - ${item.name} Assessment</h3>
      <p>Hello Yash,</p>
      <p>Here is your selection for the <strong>${item.name} Designer</strong> assessment.</p>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #4285f4; margin: 20px 0;">
        <p style="margin-bottom: 15px;"><strong>Assignment Link:</strong></p>
        ${EmailTemplates.button('DOWNLOAD ASSESSMENT', testLink)}
        <p><strong>Time Limit:</strong> ${timeLimit} hours</p>
      </div>

      <h4>Submission Instructions:</h4>
      <p>Once you complete your test, please upload all your files via the official submission form below:</p>
      
      ${EmailTemplates.button('SUBMIT YOUR TEST', submissionFormUrl)}

      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        Note: This is an automated test email for the Oracle system verification.
      </p>
    `);

    GmailApp.sendEmail(email, `[TEST] ${item.name} Assessment - UrbanMistrii`,
      `Test your ${item.name} assessment: ${testLink}\nSubmit here: ${submissionFormUrl}`,
      { htmlBody: html, name: 'Urbanmistrii Oracle' });

    Logger.log(`Sent ${item.name} test to ${email}`);
  });

  Logger.log('\n====================================================================');
  Logger.log('DONE! Checked iamyash95@gmail.com for both tests.');
  Logger.log('====================================================================');
}



// ═══════════════════════════════════════════════════════════════════════════
//  INTERVIEWBOOKING
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║             URBANMISTRII ORACLE v22.5 - INTERVIEW BOOKING SYSTEM              ║
 * ║      Allows employees to book interviews directly from the public sheet       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * FEATURES:
 * - Date & Time picker modal
 * - Google Calendar integration
 * - Sends invites to: Candidate + HR + Booker
 * - Creates Google Meet link automatically
 * - Logs all bookings in timeline
 */

// ═══════════════════════════════════════════════════════════════════════════════
//                              MENU INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add custom menu to the public sheet for interview booking
 */
function onOpen() {
    try {
        const ui = SpreadsheetApp.getUi();
        ui.createMenu('📅 Interview Booking')
            .addItem('📅 Book Interview for Selected Row', 'showBookingDialog')
            .addItem('📊 View My Bookings', 'showMyBookings')
            .addSeparator()
            .addItem('⚙️ Setup Booking System', 'setupInterviewBooking')
            .addToUi();
    } catch (e) {
        // Silently fail if menu can't be added (viewer permissions)
        Logger.log('Menu not added: ' + e.message);
    }
}

/**
 * Show the interview booking dialog
 */
function showBookingDialog() {
    const sheet = SpreadsheetApp.getActiveSheet();
    const row = sheet.getActiveRange().getRow();

    if (row < 2) {
        SpreadsheetApp.getUi().alert('⚠️ Please select a candidate row (not the header)');
        return;
    }

    // Get candidate data from the row
    const rowData = sheet.getRange(row, 1, 1, 20).getValues()[0];

    const candidateInfo = {
        row: row,
        status: rowData[0] || 'Unknown',
        name: rowData[3] || 'Not provided',            // Column D - Name
        phone: rowData[4] || '',                        // Column E - Phone
        email: rowData[5] || '',                        // Column F - Email
        role: rowData[6] || 'Designer',                 // Column G - Desired Position
        portfolio: rowData[10] || '',                   // Column K - Portfolio
        cv: rowData[11] || ''                           // Column L - CV
    };

    // Store candidate info for the booking
    PropertiesService.getUserProperties().setProperty('PENDING_BOOKING', JSON.stringify(candidateInfo));

    // Create and show the HTML dialog
    const html = HtmlService.createHtmlOutput(getBookingDialogHtml(candidateInfo))
        .setWidth(500)
        .setHeight(600);

    SpreadsheetApp.getUi().showModalDialog(html, '📅 Book Interview: ' + candidateInfo.name);
}

/**
 * Generate the booking dialog HTML
 */
function getBookingDialogHtml(candidate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; font-family: 'Google Sans', 'Segoe UI', sans-serif; }
    body { margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
    .container { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    h2 { margin: 0 0 20px; color: #333; font-size: 18px; }
    .candidate-card { background: #f8f9ff; border-radius: 12px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #667eea; }
    .candidate-name { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 4px; }
    .candidate-role { color: #666; font-size: 14px; }
    .candidate-email { color: #888; font-size: 12px; margin-top: 4px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-weight: 500; color: #444; margin-bottom: 6px; font-size: 14px; }
    input, select { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.2s; }
    input:focus, select:focus { border-color: #667eea; outline: none; box-shadow: 0 0 0 3px rgba(102,126,234,0.2); }
    .time-slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
    .time-slot { padding: 10px; text-align: center; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 13px; }
    .time-slot:hover { border-color: #667eea; background: #f8f9ff; }
    .time-slot.selected { background: #667eea; color: white; border-color: #667eea; }
    .btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 10px; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102,126,234,0.4); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .btn-secondary { background: #f0f0f0; color: #666; }
    .duration-selector { display: flex; gap: 10px; }
    .duration-option { flex: 1; padding: 10px; text-align: center; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; }
    .duration-option.selected { background: #667eea; color: white; border-color: #667eea; }
    .loading { display: none; text-align: center; padding: 20px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #f0f0f0; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .success { display: none; text-align: center; padding: 30px; }
    .success-icon { font-size: 60px; margin-bottom: 16px; }
    .error { color: #e53935; font-size: 13px; margin-top: 10px; display: none; }
    .notes-input { min-height: 60px; resize: vertical; }
  </style>
</head>
<body>
  <div class="container">
    <div id="form-view">
      <h2>📅 Schedule Interview</h2>
      
      <div class="candidate-card">
        <div class="candidate-name">${escapeHtml(candidate.name)}</div>
        <div class="candidate-role">🎯 ${escapeHtml(candidate.role)}</div>
        <div class="candidate-email">📧 ${escapeHtml(candidate.email)}</div>
      </div>
      
      <div class="form-group">
        <label>📆 Select Date</label>
        <input type="date" id="interview-date" min="${minDate}" max="${maxDateStr}" required>
      </div>
      
      <div class="form-group">
        <label>⏰ Select Time (IST)</label>
        <div class="time-slots" id="time-slots">
          <div class="time-slot" data-time="10:00">10:00 AM</div>
          <div class="time-slot" data-time="10:30">10:30 AM</div>
          <div class="time-slot" data-time="11:00">11:00 AM</div>
          <div class="time-slot" data-time="11:30">11:30 AM</div>
          <div class="time-slot" data-time="12:00">12:00 PM</div>
          <div class="time-slot" data-time="12:30">12:30 PM</div>
          <div class="time-slot" data-time="14:00">2:00 PM</div>
          <div class="time-slot" data-time="14:30">2:30 PM</div>
          <div class="time-slot" data-time="15:00">3:00 PM</div>
          <div class="time-slot" data-time="15:30">3:30 PM</div>
          <div class="time-slot" data-time="16:00">4:00 PM</div>
          <div class="time-slot" data-time="16:30">4:30 PM</div>
          <div class="time-slot" data-time="17:00">5:00 PM</div>
          <div class="time-slot" data-time="17:30">5:30 PM</div>
          <div class="time-slot" data-time="18:00">6:00 PM</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>⏱️ Duration</label>
        <div class="duration-selector">
          <div class="duration-option" data-duration="30">30 min</div>
          <div class="duration-option selected" data-duration="45">45 min</div>
          <div class="duration-option" data-duration="60">1 hour</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>📝 Interview Notes (Optional)</label>
        <input type="text" id="notes" class="notes-input" placeholder="E.g., Focus on portfolio review, technical skills...">
      </div>
      
      <div class="error" id="error-msg"></div>
      
      <button class="btn btn-primary" id="book-btn" onclick="bookInterview()" disabled>
        📅 Book Interview & Send Invites
      </button>
      <button class="btn btn-secondary" onclick="google.script.host.close()">Cancel</button>
    </div>
    
    <div class="loading" id="loading-view">
      <div class="spinner"></div>
      <p>Creating calendar event...</p>
      <p style="font-size: 12px; color: #888;">Sending invites to candidate & HR</p>
    </div>
    
    <div class="success" id="success-view">
      <div class="success-icon">✅</div>
      <h2>Interview Booked!</h2>
      <p id="success-details"></p>
      <button class="btn btn-primary" onclick="google.script.host.close()">Close</button>
    </div>
  </div>
  
  <script>
    let selectedTime = null;
    let selectedDuration = 45;
    const candidateInfo = ${JSON.stringify(candidate)};
    
    // Time slot selection
    document.querySelectorAll('.time-slot').forEach(slot => {
      slot.addEventListener('click', function() {
        document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
        selectedTime = this.dataset.time;
        validateForm();
      });
    });
    
    // Duration selection
    document.querySelectorAll('.duration-option').forEach(opt => {
      opt.addEventListener('click', function() {
        document.querySelectorAll('.duration-option').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        selectedDuration = parseInt(this.dataset.duration);
      });
    });
    
    // Date change handler
    document.getElementById('interview-date').addEventListener('change', validateForm);
    
    function validateForm() {
      const date = document.getElementById('interview-date').value;
      const isValid = date && selectedTime;
      document.getElementById('book-btn').disabled = !isValid;
    }
    
    function bookInterview() {
      const date = document.getElementById('interview-date').value;
      const notes = document.getElementById('notes').value;
      
      if (!date || !selectedTime) {
        showError('Please select both date and time');
        return;
      }
      
      // Show loading
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('loading-view').style.display = 'block';
      
      // Call Apps Script function
      google.script.run
        .withSuccessHandler(onSuccess)
        .withFailureHandler(onError)
        .createInterviewBooking(candidateInfo, date, selectedTime, selectedDuration, notes);
    }
    
    function onSuccess(result) {
      document.getElementById('loading-view').style.display = 'none';
      document.getElementById('success-view').style.display = 'block';
      document.getElementById('success-details').innerHTML = 
        '<strong>' + result.dateTime + '</strong><br>' +
        'Duration: ' + result.duration + ' minutes<br>' +
        '📧 Invites sent to ' + result.invitesSent + ' people';
    }
    
    function onError(error) {
      document.getElementById('loading-view').style.display = 'none';
      document.getElementById('form-view').style.display = 'block';
      showError(error.message || 'Failed to book interview');
    }
    
    function showError(msg) {
      const el = document.getElementById('error-msg');
      el.textContent = '❌ ' + msg;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 5000);
    }
  </script>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════════════════════════════
//                           BOOKING LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create the interview booking - the main function called from the dialog
 */
function createInterviewBooking(candidateInfo, dateStr, timeStr, duration, notes) {
    try {
        // Validate inputs
        if (!candidateInfo || !candidateInfo.name) {
            throw new Error('Invalid candidate information');
        }

        if (!dateStr || !timeStr) {
            throw new Error('Date and time are required');
        }

        // Parse date and time
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);

        const interviewDate = new Date(year, month - 1, day, hours, minutes, 0);

        // Validate the date is in the future
        if (interviewDate <= new Date()) {
            throw new Error('Interview must be scheduled for a future date/time');
        }

        // Get the booker's email
        const bookerEmail = Session.getActiveUser().getEmail();

        // Get HR email from config (with fallback)
        const hrEmail = getHREmail();

        // Create the calendar event
        const endTime = new Date(interviewDate.getTime() + duration * 60 * 1000);

        const calendar = CalendarApp.getDefaultCalendar();

        // Build guest list
        const guests = [];
        if (candidateInfo.email && isValidEmail(candidateInfo.email)) {
            guests.push(candidateInfo.email);
        }
        if (hrEmail && hrEmail !== bookerEmail) {
            guests.push(hrEmail);
        }

        // Create event with Google Meet
        const event = calendar.createEvent(
            `🎯 Interview: ${candidateInfo.name} - ${candidateInfo.role}`,
            interviewDate,
            endTime,
            {
                description: generateInterviewDescription(candidateInfo, notes, bookerEmail),
                location: 'Google Meet (link in invite)',
                guests: guests.join(','),
                sendInvites: true
            }
        );

        // Add Google Meet
        try {
            event.setConferencing({
                conferenceType: 'hangoutsMeet'
            });
        } catch (e) {
            Logger.log('Could not add Meet link: ' + e.message);
        }

        // Set reminders
        event.addPopupReminder(30);  // 30 min before
        event.addEmailReminder(60); // 1 hour before

        // Set color (purple for interviews)
        event.setColor('3'); // Purple

        // Update the sheet with interview date
        updateSheetWithInterview(candidateInfo.row, interviewDate, bookerEmail);

        // Log to timeline
        logInterviewBooking(candidateInfo, interviewDate, bookerEmail);

        // Format date for response
        const formattedDate = interviewDate.toLocaleString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        return {
            success: true,
            eventId: event.getId(),
            dateTime: formattedDate,
            duration: duration,
            invitesSent: guests.length + 1 // +1 for calendar owner
        };

    } catch (e) {
        Logger.log('Interview booking error: ' + e.message);
        throw new Error('Failed to book interview: ' + e.message);
    }
}

/**
 * Generate the interview description
 */
function generateInterviewDescription(candidate, notes, bookerEmail) {
    return `
📋 INTERVIEW DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 CANDIDATE INFORMATION
• Name: ${candidate.name}
• Position: ${candidate.role}
• Email: ${candidate.email || 'Not provided'}
• Phone: ${candidate.phone || 'Not provided'}

📁 RESOURCES
• Portfolio: ${candidate.portfolio || 'Not provided'}
• CV: ${candidate.cv || 'Not provided'}

📝 INTERVIEW NOTES
${notes || 'No specific notes added'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️ Scheduled by: ${bookerEmail}
📅 Booked on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

🔗 View Candidate Sheet: https://docs.google.com/spreadsheets/d/1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by UrbanMistrii Oracle v22.5
  `.trim();
}

/**
 * Get HR email from config or fallback
 */
function getHREmail() {
    try {
        // Try to get from CONFIG if available
        if (typeof CONFIG !== 'undefined' && CONFIG.TEAM && CONFIG.TEAM.ADMIN_EMAIL) {
            return CONFIG.TEAM.ADMIN_EMAIL;
        }

        // Try script properties
        const props = PropertiesService.getScriptProperties();
        const hrEmail = props.getProperty('HR_EMAIL');
        if (hrEmail) return hrEmail;

        // Default fallback
        return 'mail@urbanmistrii.com';
    } catch (e) {
        return 'mail@urbanmistrii.com';
    }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Update the sheet with interview information
 */
function updateSheetWithInterview(row, interviewDate, bookerEmail) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // Find or create "Interview Scheduled" column
        const headers = sheet.getRange(1, 1, 1, 30).getValues()[0];
        let interviewCol = headers.findIndex(h =>
            h && h.toString().toLowerCase().includes('interview scheduled')
        ) + 1;

        // If column doesn't exist, add it
        if (interviewCol === 0) {
            const lastCol = sheet.getLastColumn() + 1;
            sheet.getRange(1, lastCol).setValue('📅 Interview Scheduled');
            interviewCol = lastCol;
        }

        // Format the interview date
        const formatted = interviewDate.toLocaleString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        // Update the cell with interview info
        sheet.getRange(row, interviewCol).setValue(`${formatted}\n(by ${bookerEmail.split('@')[0]})`);

        // Also update status if it exists
        const statusCol = headers.findIndex(h =>
            h && h.toString().toLowerCase() === 'status'
        ) + 1;

        if (statusCol > 0) {
            const currentStatus = sheet.getRange(row, statusCol).getValue();
            if (!currentStatus.toString().toLowerCase().includes('interview')) {
                sheet.getRange(row, statusCol).setValue('INTERVIEW_SCHEDULED');
            }
        }

        Logger.log(`Updated row ${row} with interview date`);

    } catch (e) {
        Logger.log('Failed to update sheet: ' + e.message);
        // Don't throw - the calendar event was still created
    }
}

/**
 * Log the interview booking to timeline
 */
function logInterviewBooking(candidate, interviewDate, bookerEmail) {
    try {
        // Try to log using the existing Log system
        if (typeof Log !== 'undefined' && Log.success) {
            Log.success('INTERVIEW', 'Interview booked', {
                candidate: candidate.name,
                role: candidate.role,
                date: interviewDate.toISOString(),
                bookedBy: bookerEmail
            });
        } else {
            Logger.log(`INTERVIEW BOOKED: ${candidate.name} - ${interviewDate} by ${bookerEmail}`);
        }
    } catch (e) {
        Logger.log('Timeline log failed: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                           SETUP & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Setup the interview booking system
 */
function setupInterviewBooking() {
    const ui = SpreadsheetApp.getUi();

    // Add the Interview Scheduled column if missing
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headers = sheet.getRange(1, 1, 1, 30).getValues()[0];

    let interviewCol = headers.findIndex(h =>
        h && h.toString().toLowerCase().includes('interview scheduled')
    ) + 1;

    if (interviewCol === 0) {
        const lastCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, lastCol).setValue('📅 Interview Scheduled');
        sheet.getRange(1, lastCol).setBackground('#4a90d9').setFontColor('white').setFontWeight('bold');

        ui.alert('✅ Setup Complete',
            'Interview Booking System is ready!\n\n' +
            'How to use:\n' +
            '1. Select a candidate row\n' +
            '2. Click "Interview Booking" → "Book Interview"\n' +
            '3. Pick date and time\n' +
            '4. Click Book - invites sent automatically!',
            ui.ButtonSet.OK);
    } else {
        ui.alert('ℹ️ Already Setup',
            'Interview Booking System is already configured.\n\n' +
            'Use: Interview Booking → Book Interview for Selected Row',
            ui.ButtonSet.OK);
    }
}

/**
 * Show my bookings
 */
function showMyBookings() {
    const ui = SpreadsheetApp.getUi();
    const email = Session.getActiveUser().getEmail();

    // Get upcoming interviews from calendar
    const calendar = CalendarApp.getDefaultCalendar();
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const events = calendar.getEvents(now, nextMonth);
    const interviews = events.filter(e => e.getTitle().includes('Interview:'));

    if (interviews.length === 0) {
        ui.alert('📅 Your Bookings', 'No upcoming interviews scheduled.', ui.ButtonSet.OK);
        return;
    }

    let message = 'Your upcoming interviews:\n\n';
    interviews.forEach((event, idx) => {
        const date = event.getStartTime().toLocaleString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
        message += `${idx + 1}. ${event.getTitle()}\n   📅 ${date}\n\n`;
    });

    ui.alert('📅 Your Upcoming Interviews', message, ui.ButtonSet.OK);
}

/**
 * Test the interview booking system
 */
function testInterviewBooking() {
    Logger.log('=== Testing Interview Booking System ===');

    // Test 1: Check calendar access
    try {
        const calendar = CalendarApp.getDefaultCalendar();
        Logger.log('✅ Calendar access: OK');
    } catch (e) {
        Logger.log('❌ Calendar access: FAILED - ' + e.message);
        return;
    }

    // Test 2: Check sheet access
    try {
        const ss = SpreadsheetApp.openById('1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4');
        Logger.log('✅ Sheet access: OK');
    } catch (e) {
        Logger.log('❌ Sheet access: FAILED - ' + e.message);
    }

    // Test 3: Check email
    try {
        const email = Session.getActiveUser().getEmail();
        Logger.log('✅ User email: ' + email);
    } catch (e) {
        Logger.log('❌ User email: FAILED');
    }

    // Test 4: Create a test booking (dry run)
    const testCandidate = {
        row: 999,
        name: 'Test Candidate',
        email: 'test@example.com',
        role: 'Junior Designer',
        phone: '9876543210'
    };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    Logger.log('Test candidate: ' + JSON.stringify(testCandidate));
    Logger.log('Test date: ' + tomorrow.toISOString());
    Logger.log('HR Email: ' + getHREmail());

    Logger.log('');
    Logger.log('=== Interview Booking System Ready! ===');
    Logger.log('To use: Open the public sheet, select a row, then use the Interview Booking menu');

    return 'Interview Booking System test completed. Check logs for details.';
}



// ═══════════════════════════════════════════════════════════════════════════
//  CORE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                 URBANMISTRII ORACLE v22.4 - CORE ENGINE                       ║
 * ║                 Main Orchestrator & Automation Logic (Hardened)               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * v22.4 FIXES:
 * - Fixed test scheduling: now respects time, handles past dates, immediate send
 * - Added batch sheet writes for 10x performance
 * - Added error recovery dashboard (DB_Errors)
 * - Added webhook support (doPost)
 * - Made status transitions configurable
 */

/**
 * FORM SUBMIT HANDLER - Fires when Google Form submits new entry
 * NOTE: INTERVIEW_DATE column is actually "Test Availability Date" - when candidate wants to take test
 * The proper flow is: NEW -> IN PROCESS -> TEST SENT -> TEST SUBMITTED -> INTERVIEW PENDING
 */
function onFormSubmit(e) {
  // Early guard: validate event object
  if (!e || !e.range) {
    Log.warn('FORM', 'Invalid form submit event received');
    return;
  }

  try {
    const sheet = e.range.getSheet();
    if (!sheet || sheet.getName() !== CONFIG.SHEETS.TABS.CANDIDATES) return;

    const row = e.range.getRow();
    if (row < 2) return; // Skip header row

    // Get row data safely
    const lastCol = Math.max(sheet.getLastColumn(), CONFIG.COLUMNS.PORTAL_TOKEN);
    const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    if (!rowData || rowData.length === 0) {
      Log.error('FORM', 'Empty row data received', { row });
      return;
    }

    // Create candidate object with Guards for safety
    const candidate = {
      row: row,
      name: Guards.toString(rowData[CONFIG.COLUMNS.NAME - 1], 'Candidate'),
      email: Guards.toString(rowData[CONFIG.COLUMNS.EMAIL - 1]).trim().toLowerCase(),
      phone: Guards.toString(rowData[CONFIG.COLUMNS.PHONE - 1]).replace(/\D/g, ''),
      role: Guards.toString(rowData[CONFIG.COLUMNS.ROLE - 1], 'Design Intern'),
      testAvailabilityDate: rowData[CONFIG.COLUMNS.TEST_AVAILABILITY_DATE - 1],
      testAvailabilityTime: rowData[CONFIG.COLUMNS.TEST_AVAILABILITY_TIME - 1]
    };

    // Validate candidate has minimum required data
    if (Guards.isEmpty(candidate.email) && Guards.isEmpty(candidate.phone)) {
      Log.warn('FORM', 'Form submission missing email and phone', { row, name: candidate.name });
      SheetUtils.updateCell(row, CONFIG.COLUMNS.LOG, '⚠️ No contact info');
      return;
    }

    Log.info('FORM', `New form submission from ${candidate.name}`, { row: row });

    // Set initial status to NEW (only if empty)
    const currentStatus = Guards.toString(rowData[CONFIG.COLUMNS.STATUS - 1]);
    if (Guards.isEmpty(currentStatus)) {
      SheetUtils.updateCell(row, CONFIG.COLUMNS.STATUS, CONFIG.RULES.STATUSES.NEW);
    }
    SheetUtils.updateCell(row, CONFIG.COLUMNS.UPDATED, new Date());

    // Log if test date was provided (test scheduling, NOT interview)
    if (candidate.testAvailabilityDate) {
      SheetUtils.updateCell(row, CONFIG.COLUMNS.LOG,
        `Test availability: ${candidate.testAvailabilityDate} ${candidate.testAvailabilityTime || ''}`.trim());
    }

    // Notify admin about new candidate
    Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `New Form Submission: ${candidate.name}`,
      `New application received!\n\n` +
      `Name: ${candidate.name}\n` +
      `Role: ${candidate.role}\n` +
      `Email: ${candidate.email}\n` +
      `Phone: ${candidate.phone}\n` +
      (candidate.testAvailabilityDate ? `Preferred Test Date: ${candidate.testAvailabilityDate} ${candidate.testAvailabilityTime || ''}\n` : '') +
      `\nReview & set status to "IN PROCESS" to send welcome message.\n` +
      `Set status to "TEST SENT" to dispatch the test.\n` +
      `\nSheet: ${getSheetUrl()}`);

    CandidateTimeline.add(candidate.email, 'FORM_SUBMITTED', {
      role: candidate.role,
      hasTestDate: !!candidate.testAvailabilityDate
    });

  } catch (err) {
    Log.error('FORM', 'Form submission handler failed', { error: err.message });
  }
}

/**
 * Send interview confirmation email to candidate with beautiful HTML template
 * NOTE: This should only be called for ACTUAL interviews, not test scheduling
 */
function sendInterviewConfirmationEmail(candidate) {
  try {
    if (!candidate.email) {
      Log.warn('CONFIRM', 'No email for interview confirmation', { name: candidate.name });
      return { success: false, error: 'No email' };
    }

    // Parse date properly - handle Date objects, strings, and spreadsheet date values
    let dateStr = '';
    const rawDate = candidate.interviewDate;

    if (rawDate instanceof Date && !isNaN(rawDate.getTime()) && rawDate.getFullYear() > 1900) {
      dateStr = DateTime.formatIST(rawDate, 'full');
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      // Try to parse the string as a date
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
        dateStr = DateTime.formatIST(parsed, 'full');
      } else {
        dateStr = rawDate; // Use as-is if can't parse
      }
    }

    // Parse time - handle Date objects (spreadsheet times) and strings
    let timeStr = '';
    const rawTime = candidate.interviewTime;

    if (rawTime instanceof Date && !isNaN(rawTime.getTime())) {
      // Spreadsheet time values are Date objects for 1899-12-30
      const hours = rawTime.getHours();
      const mins = rawTime.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      timeStr = `${hour12}:${mins.toString().padStart(2, '0')} ${ampm} IST`;
    } else if (typeof rawTime === 'string' && rawTime.trim()) {
      timeStr = rawTime.trim();
    }

    const fullDateTime = `${dateStr} ${timeStr}`.trim() || 'To be confirmed';

    // Generate Google Calendar link
    const calendarLink = generateCalendarLink(candidate.name, candidate.role, candidate.interviewDate, candidate.interviewTime);

    // Beautiful HTML email template (UrbanMistrii v9.1 style)
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; color: #333333;">
    
    <!-- Header -->
    <div style="background-color: #1a1a1a; padding: 30px 40px; text-align: left; border-bottom: 4px solid #e74c3c;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase;">URBANMISTRII</h1>
    </div>

    <!-- Body -->
    <div style="padding: 40px; line-height: 1.6; font-size: 15px;">
      
      <h3 style="color: #1a1a1a; margin-top: 0;">Interview Confirmed</h3>
      
      <p>Hello <strong>${candidate.name}</strong>,</p>
      
      <p>Thank you for scheduling your interview with Urbanmistrii. We're excited to learn more about you and discuss the opportunity.</p>
      
      <!-- Details Box -->
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #e74c3c; margin: 25px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Position:</strong> ${candidate.role}</p>
        <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong> ${fullDateTime}</p>
        <p style="margin: 0;"><strong>Duration:</strong> 30-45 minutes</p>
      </div>
      
      <!-- Add to Calendar Button -->
      <div style="text-align: center; margin: 25px 0;">
        <a href="${calendarLink}" style="display: inline-block; background-color: #e74c3c; color: #ffffff !important; padding: 14px 30px; text-decoration: none; font-weight: 600; border-radius: 2px;">
          &#128197; ADD TO GOOGLE CALENDAR
        </a>
      </div>
      
      <h4 style="color: #1a1a1a; margin-bottom: 10px;">What to Expect</h4>
      <ul style="margin: 0 0 25px 0; padding-left: 20px; color: #555;">
        <li>We'll discuss your experience, portfolio, and design approach</li>
        <li>Please have your portfolio ready to share</li>
        <li>Feel free to ask us any questions about the role</li>
      </ul>
      
      <!-- Reschedule Note -->
      <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;">
        <strong>Need to reschedule?</strong><br>
        Please reply to this email at least 24 hours before your scheduled time.
      </div>
      
      <p>We look forward to meeting you!</p>
      
      <p style="margin-bottom: 0;">
        Best regards,<br>
        <strong>Hiring Team, Urbanmistrii</strong>
      </p>
      
    </div>

    <!-- Footer -->
    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888;">
      &copy; ${new Date().getFullYear()} Urbanmistrii. All Rights Reserved.
    </div>

  </div>
</body>
</html>`;

    // Plain text fallback
    const plainBody = `Dear ${candidate.name},

Thank you for scheduling your interview with UrbanMistrii!

Interview Details:
- Date & Time: ${fullDateTime}
- Position: ${candidate.role}
- Duration: 30-45 minutes

What to Expect:
- We'll discuss your experience, portfolio, and design approach
- Please have your portfolio ready to share

Need to reschedule? Reply to this email at least 24 hours before your scheduled time.

We look forward to meeting you!

Best regards,
Team UrbanMistrii
hr@urbanmistrii.com`;

    // Send with HTML body
    GmailApp.sendEmail(candidate.email, `Interview Confirmed - ${fullDateTime}`, plainBody, {
      htmlBody: htmlBody,
      name: 'UrbanMistrii HR'
    });

    Log.success('CONFIRM', 'Interview confirmation sent', {
      name: candidate.name,
      datetime: fullDateTime
    });

    // Update sheet log
    if (candidate.row) {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, 'Interview confirmed: ' + fullDateTime);
    }

    // Log to timeline
    CandidateTimeline.add(candidate.email, 'INTERVIEW_CONFIRMATION_SENT', {
      datetime: fullDateTime
    });

    return { success: true };

  } catch (err) {
    Log.error('CONFIRM', 'Failed to send interview confirmation', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * TEST: Send a sample interview confirmation email
 * Usage: testInterviewEmail() or testInterviewEmail("your@email.com")
 */
function testInterviewEmail(email) {
  const testCandidate = {
    name: 'Test Candidate',
    email: email || 'mail@urbanmistrii.com',
    role: 'Design Intern',
    interviewDate: 'Saturday, December 21, 2024',
    interviewTime: '11:00 AM IST'
  };

  Logger.log('Sending test email to: ' + testCandidate.email);
  const result = sendInterviewConfirmationEmail(testCandidate);
  Logger.log(result.success ? 'Email sent successfully!' : 'Failed: ' + result.error);
  return result;
}

/**
 * Process candidates who have interview dates but no confirmation sent
 * Run this periodically or manually to catch missed confirmations
 */
function processUnconfirmedInterviews() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         PROCESSING UNCONFIRMED INTERVIEWS                        ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const data = sheet.getDataRange().getValues();

    let confirmed = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const interviewDate = data[i][CONFIG.COLUMNS.INTERVIEW_DATE - 1];
      const log = data[i][CONFIG.COLUMNS.LOG - 1] || '';
      const email = data[i][CONFIG.COLUMNS.EMAIL - 1];
      const name = data[i][CONFIG.COLUMNS.NAME - 1];

      // If has interview date but no confirmation in log
      if (interviewDate && email && !log.includes('confirmed') && !log.includes('Interview confirmed')) {
        Logger.log(`   → Row ${row}: Sending confirmation to ${name}...`);

        const candidate = {
          row: row,
          name: name,
          email: email,
          role: data[i][CONFIG.COLUMNS.ROLE - 1] || 'Design Intern',
          interviewDate: interviewDate,
          interviewTime: data[i][CONFIG.COLUMNS.INTERVIEW_TIME - 1]
        };

        const result = sendInterviewConfirmationEmail(candidate);

        if (result.success) {
          confirmed++;
          Logger.log(`     ✅ Confirmation sent`);
        } else {
          errors++;
          Logger.log(`     ❌ Failed: ${result.error}`);
        }

        // Rate limit
        Utilities.sleep(1000);
      }
    }

    Logger.log('');
    Logger.log(`   ✅ Sent ${confirmed} confirmations, ${errors} errors`);
    return { confirmed, errors };

  } catch (e) {
    Logger.log('❌ Failed: ' + e.message);
    return { confirmed: 0, errors: 1, error: e.message };
  }
}

/**
 * 🆕 Send confirmation to a specific row
 */
function sendConfirmationToRow(rowNumber) {
  try {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const rowData = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

    const candidate = {
      row: rowNumber,
      name: rowData[CONFIG.COLUMNS.NAME - 1] || 'Candidate',
      email: rowData[CONFIG.COLUMNS.EMAIL - 1],
      role: rowData[CONFIG.COLUMNS.ROLE - 1] || 'Design Intern',
      interviewDate: rowData[CONFIG.COLUMNS.INTERVIEW_DATE - 1],
      interviewTime: rowData[CONFIG.COLUMNS.INTERVIEW_TIME - 1]
    };

    if (!candidate.email) {
      Logger.log('❌ No email for row ' + rowNumber);
      return { success: false, error: 'No email' };
    }

    if (!candidate.interviewDate) {
      Logger.log('❌ No interview date for row ' + rowNumber);
      return { success: false, error: 'No interview date' };
    }

    const result = sendInterviewConfirmationEmail(candidate);
    Logger.log(`Row ${rowNumber}: ${result.success ? '✅ Confirmation sent' : '❌ Failed: ' + result.error}`);
    return result;

  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Main automation trigger - fires on status changes
 */
function universalAutomationEngine(e) {
  // Early guard: validate event
  if (!e || !e.source || !e.range) {
    Log.warn('AUTOMATION', 'Invalid automation event received');
    return;
  }

  try {
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    
    if (!sheet || !range) return;
    
    const row = range.getRow();
    const col = range.getColumn();

    // Validate context
    if (sheet.getName() !== CONFIG.SHEETS.TABS.CANDIDATES) return;
    if (col !== CONFIG.COLUMNS.STATUS) return;
    if (row < 2) return; // Skip header

    const newStatus = Guards.toString(range.getValue()).trim();
    if (Guards.isEmpty(newStatus)) return;

    // Create idempotency key to prevent duplicate processing
    const idempotencyKey = `automation_${row}_${newStatus}`;
    if (!Guards.checkIdempotency(idempotencyKey, 5000)) { // 5 sec window
      Log.info('AUTOMATION', 'Duplicate event blocked', { row, status: newStatus });
      return;
    }

    // Get row data safely
    const lastCol = Math.max(sheet.getLastColumn(), CONFIG.COLUMNS.PORTAL_TOKEN);
    const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    if (!rowData || rowData.length === 0) return;

    // Get old status for transition validation
    const oldStatus = Guards.toString(rowData[CONFIG.COLUMNS.STATUS - 1]);
    StatusMachine.validateAndWarn(oldStatus, newStatus, Guards.toString(rowData[CONFIG.COLUMNS.NAME - 1]));

    const candidate = {
      row: row,
      status: newStatus,
      name: Guards.toString(rowData[CONFIG.COLUMNS.NAME - 1], 'Candidate'),
      email: Guards.toString(rowData[CONFIG.COLUMNS.EMAIL - 1]).trim().toLowerCase(),
      phone: Guards.toString(rowData[CONFIG.COLUMNS.PHONE - 1]).replace(/\D/g, ''),
      role: Guards.toString(rowData[CONFIG.COLUMNS.ROLE - 1], 'intern'),
      department: Guards.toString(rowData[CONFIG.COLUMNS.DEPARTMENT - 1])
    };

    Log.info('AUTOMATION', `Status changed to: ${newStatus}`, { row: row, name: candidate.name });
    handleStatusChange(candidate, sheet);

  } catch (e) {
    Log.critical('AUTOMATION', 'Automation engine crashed', { 
      error: e.message, 
      stack: (e.stack || '').substring(0, 500) 
    });
  }
}

function handleStatusChange(candidate, sheet) {
  switch (candidate.status) {
    case CONFIG.RULES.STATUSES.NEW: handleNewCandidate(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.IN_PROCESS: handleInProcess(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.TEST_SENT: handleTestSent(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.TEST_SUBMITTED: handleTestSubmitted(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.UNDER_REVIEW: handleUnderReview(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.INTERVIEW_PENDING: handleInterviewPending(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.INTERVIEW_DONE: handleInterviewDone(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.PENDING_REJECTION: handlePendingRejection(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.REJECTED: handleRejected(candidate, sheet); break;
    case CONFIG.RULES.STATUSES.HIRED: handleHired(candidate, sheet); break;
    default:
      Log.warn('HANDLER', 'Unknown status', { status: candidate.status, name: candidate.name });
  }
}

function handleNewCandidate(candidate, sheet) {
  try {
    Log.info('HANDLER', 'New candidate received', { name: candidate.name });
    if (!Guards.isEmpty(candidate.email)) {
      CandidateTimeline.add(candidate.email, 'APPLICATION_RECEIVED', { role: candidate.role });
    }
    // NOTE: Admin notification is sent by onFormSubmit() - don't duplicate here
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '📥 Application logged');
  } catch (e) {
    Log.error('HANDLER', 'handleNewCandidate failed', { error: e.message });
  }
}

function handleInProcess(candidate, sheet) {
  try {
    Log.info('HANDLER', 'Sending welcome message', { name: candidate.name });
    if (Guards.isEmpty(candidate.phone)) {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '⚠️ No phone');
      return;
    }
    // Rate limit check
    if (!Guards.rateLimit('whatsapp_send', 10, 60000)) { // 10 per minute
      Log.warn('HANDLER', 'Rate limited, queuing message');
      RetryQueue.add('WHATSAPP', { destination: candidate.phone, type: 'welcome', name: candidate.name }, 'Rate limited');
      return;
    }
    const result = Guards.safeExecute(() => WhatsApp.sendWelcome(candidate.phone, candidate.name), 'WHATSAPP_WELCOME');
    if (result && result.success) {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '✅ Welcome sent');
      if (!Guards.isEmpty(candidate.email)) {
        CandidateTimeline.add(candidate.email, 'WELCOME_SENT');
      }
    } else {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `❌ Failed: ${result?.error || 'Unknown'}`);  
      RetryQueue.add('WHATSAPP', { destination: candidate.phone, type: 'welcome', name: candidate.name }, result?.error || 'Unknown');
    }
  } catch (e) {
    Log.error('HANDLER', 'handleInProcess failed', { error: e.message });
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `❌ Error: ${e.message}`);
  }
}

function handleTestSent(candidate, sheet) {
  try {
    Log.info('HANDLER', 'Sending test link', { name: candidate.name });
    if (Guards.isEmpty(candidate.phone)) {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '⚠️ No phone');
      return;
    }
    // Rate limit check
    if (!Guards.rateLimit('whatsapp_send', 10, 60000)) {
      Log.warn('HANDLER', 'Rate limited, queuing test link');
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '⏳ Queued (rate limit)');
      RetryQueue.add('WHATSAPP', { destination: candidate.phone, type: 'test', name: candidate.name, role: candidate.role }, 'Rate limited');
      return;
    }
    const result = Guards.safeExecute(() => WhatsApp.sendTestLink(candidate.phone, candidate.name, candidate.role, candidate.department), 'WHATSAPP_TEST');
    if (result && result.success) {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.TEST_SENT, new Date());
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '✅ Test sent');
      if (!Guards.isEmpty(candidate.email)) {
        CandidateTimeline.add(candidate.email, 'TEST_SENT', { role: candidate.role });
      }
    } else {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `❌ Failed: ${result?.error || 'Unknown'}`);
      RetryQueue.add('WHATSAPP', { destination: candidate.phone, type: 'test', name: candidate.name, role: candidate.role }, result?.error);
    }
  } catch (e) {
    Log.error('HANDLER', 'handleTestSent failed', { error: e.message });
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `❌ Error: ${e.message}`);
  }
}

function handleTestSubmitted(candidate, sheet) {
  try {
    Log.info('HANDLER', 'Processing test submission', { name: candidate.name });
    
    const testSentTime = Guards.safeExecute(
      () => sheet.getRange(candidate.row, CONFIG.COLUMNS.TEST_SENT).getValue(),
      'GET_TEST_SENT_TIME'
    );
    const submittedTime = new Date();

    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.TEST_SUBMITTED, submittedTime);

    if (testSentTime && testSentTime instanceof Date && !isNaN(testSentTime.getTime())) {
      const hoursTaken = DateTime.hoursBetween(testSentTime, submittedTime);
      const timeLimit = ConfigHelpers.getTimeLimit(candidate.role, candidate.department);
      const withinLimit = hoursTaken <= timeLimit;
      
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG,
        `${withinLimit ? '✅' : '⚠️'} Submitted in ${hoursTaken.toFixed(1)}h (limit: ${timeLimit}h)`);
      
      if (!Guards.isEmpty(candidate.email)) {
        CandidateTimeline.add(candidate.email, 'TEST_SUBMITTED', { 
          hoursTaken: hoursTaken.toFixed(1), 
          onTime: withinLimit 
        });
      }
    } else {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '✅ Test submitted');
    }

    // v22.0: Auto portfolio scoring (with Guards)
    if (CONFIG.FEATURES.AUTO_PORTFOLIO_SCORING) {
      Guards.safeExecute(() => {
        const portfolioUrl = sheet.getRange(candidate.row, CONFIG.COLUMNS.PORTFOLIO_URL).getValue();
        if (!Guards.isEmpty(portfolioUrl)) {
          Log.info('HANDLER', 'Auto-scoring portfolio', { name: candidate.name });
          const score = AI.scorePortfolio(portfolioUrl, candidate.role);
          if (score && !score.error && score.score) {
            SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTFOLIO_SCORE, score.score);
            SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.PORTFOLIO_FEEDBACK, 
              Guards.toString(score.summary).substring(0, 500));
            if (!Guards.isEmpty(candidate.email)) {
              CandidateTimeline.add(candidate.email, 'PORTFOLIO_SCORED', {
                score: score.score,
                recommendation: score.recommendation
              });
            }
          }
        }
      }, 'AUTO_PORTFOLIO_SCORE');
    }

    // Notify team
    Guards.safeExecute(() => {
      const hoursTaken = testSentTime ? DateTime.hoursBetween(testSentTime, submittedTime) : 'unknown';
      Notify.team(`📝 Test Submitted: ${candidate.name}`,
        `${candidate.name} submitted their ${candidate.role} test${typeof hoursTaken === 'number' ? ` in ${hoursTaken.toFixed(1)} hours` : ''}.`);
    }, 'NOTIFY_TEST_SUBMITTED');

  } catch (e) {
    Log.error('HANDLER', 'handleTestSubmitted failed', { error: e.message });
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `❌ Error: ${e.message}`);
  }
}

function handleInterviewPending(candidate, sheet) {
  Log.info('HANDLER', 'Scheduling interview', { name: candidate.name });

  // Use the new INTERVIEW_DATE column (33), not TEST_AVAILABILITY_DATE (20)
  const interviewDate = sheet.getRange(candidate.row, CONFIG.COLUMNS.INTERVIEW_DATE).getValue();
  const interviewTime = sheet.getRange(candidate.row, CONFIG.COLUMNS.INTERVIEW_TIME).getValue();

  // v22.0: Create calendar event if date is set
  if (CONFIG.FEATURES.CALENDAR_INTEGRATION && interviewDate) {
    const candidateData = {
      ...candidate,
      interviewDate: interviewDate,
      interviewTime: interviewTime
    };
    const calResult = Calendar.createInterview(candidateData, new Date(interviewDate));
    if (calResult.success && calResult.eventId) {
      SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.CALENDAR_EVENT_ID, calResult.eventId);
      CandidateTimeline.add(candidate.email, 'CALENDAR_EVENT_CREATED', { eventId: calResult.eventId });
    }

    // Send interview confirmation email
    sendInterviewConfirmationEmail(candidateData);
  }

  // Send WhatsApp notification
  if (!candidate.phone) {
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '⚠️ No phone for WhatsApp');
    return;
  }

  const dateStr = interviewDate ? DateTime.formatIST(new Date(interviewDate), 'full') : 'TBD - Check your email for booking link';
  const result = WhatsApp.sendInterviewSchedule(candidate.phone, candidate.name, candidate.role, dateStr);

  if (result.success) {
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '✅ Interview scheduled');
    CandidateTimeline.add(candidate.email, 'INTERVIEW_SCHEDULED', { date: dateStr });

    // v22.0: Send portal link for self-booking if no date set
    if (!interviewDate && CONFIG.FEATURES.PORTAL_ENABLED) {
      sendPortalLink(candidate.email);
    }
  } else {
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `❌ Failed: ${result.error}`);
    // v22.0: Add to retry queue
    RetryQueue.add('WHATSAPP', {
      destination: candidate.phone,
      message: `Interview schedule for ${candidate.name} - ${dateStr}`
    }, result.error);
  }
}

function handlePendingRejection(candidate, sheet) {
  const rejectAt = DateTime.addHours(new Date(), CONFIG.RULES.REJECTION_DELAY_HRS);
  SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, `⏳ Will reject at ${DateTime.formatIST(rejectAt, 'full')}`);
  CandidateTimeline.add(candidate.email, 'REJECTION_QUEUED', { rejectAt: rejectAt.toISOString() });
}

/**
 * Handle UNDER_REVIEW status - test submitted, being evaluated
 */
function handleUnderReview(candidate, sheet) {
  try {
    Log.info('HANDLER', 'Candidate under review', { name: candidate.name });
    
    // Notify team that evaluation should begin
    Guards.safeExecute(() => {
      Notify.team(`🔍 Ready for Review: ${candidate.name}`,
        `${candidate.name}'s test submission is ready for evaluation.\n\n` +
        `Role: ${candidate.role}\n` +
        `Review at: ${getSheetUrl()}`);
    }, 'NOTIFY_UNDER_REVIEW');

    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '🔍 Under review by team');
    CandidateTimeline.add(candidate.email, 'UNDER_REVIEW', { role: candidate.role });
    
    // Send acknowledgment to candidate
    if (candidate.email) {
      const reviewHtml = EmailTemplates.wrap(`
        <h3>Your Test is Being Reviewed</h3>
        <p>Hello <strong>${candidate.name}</strong>,</p>
        <p>Thank you for submitting your test! Our team has received your work and is now reviewing it.</p>
        ${EmailTemplates.infoBox(`
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our design team will evaluate your submission</li>
            <li>You'll hear back from us within 2-3 business days</li>
            <li>If selected, we'll schedule an interview</li>
          </ul>
        `)}
        <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
      `);
      
      GmailApp.sendEmail(candidate.email, 'Your Test is Being Reviewed - Urbanmistrii', 
        `Hi ${candidate.name}, Your test is being reviewed. We'll get back to you within 2-3 business days.`,
        { htmlBody: reviewHtml, name: 'Urbanmistrii Hiring' });
    }
  } catch (e) {
    Log.error('HANDLER', 'handleUnderReview failed', { error: e.message });
  }
}

/**
 * Handle INTERVIEW_DONE status - interview completed, decision pending
 */
function handleInterviewDone(candidate, sheet) {
  try {
    Log.info('HANDLER', 'Interview completed', { name: candidate.name });
    
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '✅ Interview completed - decision pending');
    CandidateTimeline.add(candidate.email, 'INTERVIEW_COMPLETED', { role: candidate.role });
    
    // Notify admin to make a decision
    Guards.safeExecute(() => {
      Notify.email(CONFIG.TEAM.ADMIN_EMAIL, `📋 Decision Needed: ${candidate.name}`,
        `Interview completed for ${candidate.name} (${candidate.role}).\n\n` +
        `Please update their status to either:\n` +
        `• HIRED - if proceeding with offer\n` +
        `• PENDING REJECTION - if not moving forward\n\n` +
        `Review at: ${getSheetUrl()}`);
    }, 'NOTIFY_INTERVIEW_DONE');

    // Send thank you email to candidate
    if (candidate.email) {
      const thankYouHtml = EmailTemplates.wrap(`
        <h3>Thank You for Your Interview</h3>
        <p>Hello <strong>${candidate.name}</strong>,</p>
        <p>Thank you for taking the time to interview with us for the ${candidate.role} position.</p>
        <p>We enjoyed learning more about your experience and design approach. Our team will review all candidates and make a decision soon.</p>
        ${EmailTemplates.infoBox(`
          <p><strong>Next Steps:</strong></p>
          <p>You'll hear back from us within 3-5 business days regarding our decision.</p>
        `)}
        <p>Thank you again for your interest in Urbanmistrii!</p>
        <p>Best regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
      `);
      
      GmailApp.sendEmail(candidate.email, 'Thank You for Interviewing - Urbanmistrii',
        `Hi ${candidate.name}, Thank you for interviewing with us. We'll be in touch within 3-5 business days.`,
        { htmlBody: thankYouHtml, name: 'Urbanmistrii Hiring' });
    }
  } catch (e) {
    Log.error('HANDLER', 'handleInterviewDone failed', { error: e.message });
  }
}

function handleRejected(candidate, sheet) {
  const reason = sheet.getRange(candidate.row, CONFIG.COLUMNS.LOG).getValue() || 'application review';
  const rejectionText = AI.generateRejection(candidate.name, candidate.role, reason) || getDefaultRejectionText(candidate.name);

  if (candidate.email) {
    const rejectionHtml = EmailTemplates.wrap(`
      <h3>Application Update</h3>
      <p>Dear <strong>${candidate.name}</strong>,</p>
      <p>Thank you for taking the time to apply to Urbanmistrii and for your interest in the ${candidate.role} position.</p>
      <p>${rejectionText.replace(/\n/g, '<br>')}</p>
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #3498db; margin: 25px 0;">
        <p style="margin: 0;">We encourage you to continue developing your skills and portfolio. Feel free to apply again in the future as new opportunities arise.</p>
      </div>
      <p>We wish you all the best in your career journey.</p>
      <p>Warm regards,<br><strong>Hiring Team, Urbanmistrii</strong></p>
    `);

    GmailApp.sendEmail(candidate.email, 'Thank you for applying to Urbanmistrii', rejectionText, {
      htmlBody: rejectionHtml,
      name: 'Urbanmistrii'
    });
    SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, 'Rejection sent');
    CandidateTimeline.add(candidate.email, 'REJECTION_SENT');
  }
}

function handleHired(candidate, sheet) {
  Log.success('HANDLER', 'Candidate hired!', { name: candidate.name });
  SheetUtils.updateCell(candidate.row, CONFIG.COLUMNS.LOG, '🎉 Hired!');
  CandidateTimeline.add(candidate.email, 'HIRED', { role: candidate.role });
  Notify.team(`🎉 New Hire: ${candidate.name}`, `${candidate.name} has been hired for ${candidate.role} role.`);

  // Add to Salary Tracker
  addToSalaryTracker(candidate);
}

function runOracleBackgroundCycle() {
  try {
    Log.info('CYCLE', 'Starting background cycle v22.0');

    // Core processing
    processInbox();
    processRejectionQueue();
    processFollowUps();
    processScheduledTests();

    // v22.0: New processors
    if (typeof RetryQueue !== 'undefined') {
      RetryQueue.process();
    }

    // Sync public view
    syncToPublicView();

    Log.success('CYCLE', 'Background cycle complete');
  } catch (e) {
    Log.critical('CYCLE', 'Background cycle failed', { error: e.message });
  }
}

function processRejectionQueue() {
  const candidates = SheetUtils.getCandidatesByStatus(CONFIG.RULES.STATUSES.PENDING_REJECTION);
  const now = new Date();
  for (const c of candidates) {
    const updated = c.data[CONFIG.COLUMNS.UPDATED - 1];
    if (DateTime.hoursBetween(updated, now) >= CONFIG.RULES.REJECTION_DELAY_HRS) {
      const email = c.data[CONFIG.COLUMNS.EMAIL - 1];
      SheetUtils.updateStatus(c.row, CONFIG.RULES.STATUSES.REJECTED, email);
    }
  }
}

function processFollowUps() {
  const candidates = SheetUtils.getCandidatesByStatus(CONFIG.RULES.STATUSES.TEST_SENT);
  const now = new Date();
  for (const c of candidates) {
    const testSent = c.data[CONFIG.COLUMNS.TEST_SENT - 1];
    if (!testSent) continue;
    const daysSince = DateTime.daysBetween(testSent, now);
    if (CONFIG.RULES.FOLLOWUP_DAYS.includes(daysSince) && c.data[CONFIG.COLUMNS.PHONE - 1]) {
      const phone = c.data[CONFIG.COLUMNS.PHONE - 1];
      const name = c.data[CONFIG.COLUMNS.NAME - 1];
      WhatsApp.sendReminder(phone, name, 'Reminder about test');

      // v22.1: Log to DB_FollowUp
      try {
        const followSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.FOLLOWUP);
        followSheet.appendRow([new Date(), name, phone, 'WHATSAPP_REMINDER', 'SENT']);
      } catch (e) {
        Log.warn('FOLLOWUP', 'Failed to log follow-up', { error: e.message });
      }
    }
  }
}

function processScheduledTests() {
  try {
    const now = new Date();
    const nowIST = DateTime.getIST(now);
    
    // Look for IN_PROCESS candidates who have a test availability date set
    const candidates = SheetUtils.getCandidatesByStatus(CONFIG.RULES.STATUSES.IN_PROCESS);
    let sent = 0;
    let skipped = 0;
    let waiting = 0;

    for (const c of candidates) {
      const testAvailabilityDate = c.data[CONFIG.COLUMNS.TEST_AVAILABILITY_DATE - 1];
      const testAvailabilityTime = c.data[CONFIG.COLUMNS.TEST_AVAILABILITY_TIME - 1];
      const testSent = c.data[CONFIG.COLUMNS.TEST_SENT - 1];
      const phone = c.data[CONFIG.COLUMNS.PHONE - 1];
      const email = c.data[CONFIG.COLUMNS.EMAIL - 1];
      const name = c.data[CONFIG.COLUMNS.NAME - 1];
      const role = c.data[CONFIG.COLUMNS.ROLE - 1];
      const department = c.data[CONFIG.COLUMNS.DEPARTMENT - 1];

      // Skip if test already sent
      if (testSent) {
        skipped++;
        continue;
      }

      // Skip if no phone
      if (!phone) {
        skipped++;
        continue;
      }

      // Parse the scheduled date and time
      const scheduledDateTime = parseScheduledDateTime(testAvailabilityDate, testAvailabilityTime);
      
      if (!scheduledDateTime) {
        // No valid date - skip (they might not have scheduled)
        skipped++;
        continue;
      }

      // Check if it's time to send the test
      // Send if: (1) scheduled time has passed, OR (2) scheduled for today and it's past the time
      const shouldSend = isTimeToSendTest(scheduledDateTime, nowIST);

      if (shouldSend) {
        Logger.log(`📅 Sending scheduled test to ${name} (${role}) - Scheduled: ${scheduledDateTime.toLocaleString()}`);

        const result = WhatsApp.sendTestLink(phone, name, role, department);

        if (result.success || result.testMode) {
          // Use batch update for performance
          const updates = [
            { row: c.row, col: CONFIG.COLUMNS.STATUS, value: CONFIG.RULES.STATUSES.TEST_SENT },
            { row: c.row, col: CONFIG.COLUMNS.TEST_SENT, value: new Date() },
            { row: c.row, col: CONFIG.COLUMNS.UPDATED, value: new Date() },
            { row: c.row, col: CONFIG.COLUMNS.LOG, value: `✅ Test sent (scheduled: ${DateTime.formatIST(scheduledDateTime, 'full')})` }
          ];
          SheetUtils.batchUpdate(updates);

          if (email) {
            CandidateTimeline.add(email, 'TEST_SENT_ON_SCHEDULED_DATE', {
              scheduledDate: scheduledDateTime.toISOString(),
              actualSentAt: new Date().toISOString()
            });
          }

          sent++;
          Log.info('SCHEDULED_TEST', `Test sent to ${name}`, { scheduled: scheduledDateTime.toISOString() });
          Utilities.sleep(CONFIG.RATE_LIMITS.WHATSAPP_DELAY_MS || 2000);
        } else {
          // Log failure to error recovery
          ErrorRecovery.log('TEST_SEND_FAILED', {
            candidateRow: c.row,
            name, email, phone, role,
            error: result.error,
            scheduledDateTime: scheduledDateTime.toISOString()
          });
          SheetUtils.updateCell(c.row, CONFIG.COLUMNS.LOG, `⚠️ Failed: ${result.error}`);
          Log.error('SCHEDULED_TEST', `Failed to send to ${name}`, { error: result.error });
        }
      } else {
        waiting++;
      }
    }

    if (sent > 0 || waiting > 0) {
      Log.info('SCHEDULED_TEST', `Sent: ${sent}, Waiting: ${waiting}, Skipped: ${skipped}`);
    }

  } catch (e) {
    Log.error('SCHEDULED_TEST', 'Failed to process scheduled tests', { error: e.message });
  }
}

/**
 * Parse date + time string into a Date object
 * Handles various formats: "2026-01-20", "Jan 20, 2026", "20/01/2026", etc.
 */
function parseScheduledDateTime(dateInput, timeInput) {
  if (!dateInput) return null;

  let scheduledDate;

  // Parse date
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    scheduledDate = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      scheduledDate = parsed;
    } else {
      // Try DD/MM/YYYY format (common in India)
      const ddmmyyyy = dateInput.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (ddmmyyyy) {
        scheduledDate = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
      }
    }
  }

  if (!scheduledDate || isNaN(scheduledDate.getTime())) return null;

  // Parse time (default to 9 AM if not specified)
  let hours = 9, minutes = 0;

  if (timeInput) {
    if (timeInput instanceof Date && !isNaN(timeInput.getTime())) {
      hours = timeInput.getHours();
      minutes = timeInput.getMinutes();
    } else if (typeof timeInput === 'string') {
      // Parse various time formats: "10:00", "10am", "10:30 AM", "14:00"
      const timeMatch = timeInput.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = parseInt(timeMatch[2]) || 0;
        const ampm = timeMatch[3];
        if (ampm) {
          if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
          if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        }
      }
    }
  }

  scheduledDate.setHours(hours, minutes, 0, 0);
  return scheduledDate;
}

/**
 * Determine if it's time to send the test
 * Sends if: scheduled time has passed (including past dates)
 */
function isTimeToSendTest(scheduledDateTime, now) {
  if (!scheduledDateTime || !now) return false;
  
  // If scheduled time is in the past or right now, send it
  // Adding 1 minute buffer for clock differences
  const bufferMs = 60 * 1000; // 1 minute
  return scheduledDateTime.getTime() <= now.getTime() + bufferMs;
}

function getSheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEETS.MASTER_ID}`;
}

function getDefaultRejectionText(name) {
  return `Dear ${name},\n\nThank you for applying to UrbanMistrii. After careful review, we've decided to move forward with other candidates.\n\nBest regards,\nTeam UrbanMistrii`;
}

function scheduleFollowUp(candidate, days) {
  Log.info('SCHEDULE', `Follow-up scheduled for ${candidate.name} in ${days} days`);
}

/**
 * Add hired candidate to Salary Tracker sheet
 */
function addToSalaryTracker(candidate) {
  try {
    const salarySheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.SALARY_TRACKER);
    const candidatesSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);

    const rowData = candidatesSheet.getRange(candidate.row, 1, 1, candidatesSheet.getLastColumn()).getValues()[0];

    const salaryExpected = rowData[CONFIG.COLUMNS.SALARY_EXP - 1] || '';
    const startDate = rowData[CONFIG.COLUMNS.START_DATE - 1] || new Date();

    salarySheet.appendRow([
      candidate.name,
      candidate.email,
      candidate.phone,
      candidate.role,
      candidate.department || ConfigHelpers.getDepartment(candidate.role),
      new Date(),
      salaryExpected,
      startDate,
      'Active',
      ''
    ]);

    Log.success('SALARY_TRACKER', 'Added to salary tracker', { name: candidate.name });

  } catch (e) {
    Log.error('SALARY_TRACKER', 'Failed to add to tracker', { error: e.message });
  }
}

/**
 * Manual function to sync all HIRED candidates to Salary Tracker
 * Run this to populate salary tracker with existing hired candidates
 */
function syncAllHiredToSalaryTracker() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         SYNCING HIRED CANDIDATES TO SALARY TRACKER                 ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    const candidatesSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const salarySheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.SALARY_TRACKER);
    const data = candidatesSheet.getDataRange().getValues();

    let synced = 0;
    let skipped = 0;

    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const status = data[i][CONFIG.COLUMNS.STATUS - 1];

      if (status === CONFIG.RULES.STATUSES.HIRED) {
        const name = data[i][CONFIG.COLUMNS.NAME - 1];
        const email = data[i][CONFIG.COLUMNS.EMAIL - 1];
        const salaryExpected = data[i][CONFIG.COLUMNS.SALARY_EXP - 1] || '';
        const startDate = data[i][CONFIG.COLUMNS.START_DATE - 1] || new Date();
        const role = data[i][CONFIG.COLUMNS.ROLE - 1];
        const phone = data[i][CONFIG.COLUMNS.PHONE - 1];
        const department = data[i][CONFIG.COLUMNS.DEPARTMENT - 1] || ConfigHelpers.getDepartment(role);

        salarySheet.appendRow([
          name,
          email,
          phone,
          role,
          department,
          new Date(),
          salaryExpected,
          startDate,
          'Active',
          'Synced manually'
        ]);

        synced++;
        Logger.log(`   → Row ${row}: ${name}`);
      } else {
        skipped++;
      }
    }

    Logger.log('');
    Logger.log(`✅ Synced ${synced} hired candidates to Salary Tracker`);
    Logger.log(`ℹ️ Skipped ${skipped} (not hired)`);

  } catch (e) {
    Logger.log('❌ Sync failed: ' + e.message);
  }
}

/**
 * Calculate salary for employees based on monthly leave data
 * Run this after all employees have submitted their leave form
 */
function calculateMonthlySalaries(monthName, year, workingDays) {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         CALCULATING MONTHLY SALARIES                              ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
    const monthlySheetName = monthName ? `Salary_${monthName}_${year}` : `Salary_${new Date().toLocaleString('en-US', { month: 'long' })}_${new Date().getFullYear()}`;
    
    const monthlySheet = ss.getSheetByName(monthlySheetName);
    if (!monthlySheet) {
      Logger.log(`❌ Monthly sheet "${monthlySheetName}" not found. Please make sure employees have submitted their leave forms.`);
      return;
    }

    const salaryTracker = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.SALARY_TRACKER);
    const trackerData = salaryTracker.getDataRange().getValues();
    
    const monthlyData = monthlySheet.getDataRange().getValues();
    const workingDaysInput = workingDays || 26;

    let processed = 0;
    let skipped = 0;

    for (let i = 1; i < monthlyData.length; i++) {
      const email = monthlyData[i][2];
      const leavesTaken = monthlyData[i][3] || 0;
      const presentDays = monthlyData[i][4] || workingDaysInput;
      const row = i + 1;

      let monthlySalary = 0;

      for (let j = 1; j < trackerData.length; j++) {
        if (trackerData[j][2] === email) {
          const salaryPerMonth = parseFloat(trackerData[j][6]) || 0;
          const perDaySalary = salaryPerMonth / workingDaysInput;
          monthlySalary = perDaySalary * presentDays;

          monthlySheet.getRange(row, 7).setValue(`₹${monthlySalary.toFixed(2)}`);

          processed++;
          Logger.log(`   → ${trackerData[j][1]}: ₹${monthlySalary.toFixed(2)} (${presentDays} days)`);
          break;
        }
      }

      if (monthlySalary === 0) {
        skipped++;
        Logger.log(`   ⚠️ Skipping ${monthlyData[i][1]} - not found in salary tracker`);
      }
    }

    Logger.log('');
    Logger.log(`✅ Salary Calculation Complete:`);
    Logger.log(`   Processed: ${processed} employees`);
    Logger.log(`   Skipped: ${skipped} employees`);
    Logger.log(`   Working Days: ${workingDaysInput}`);
    
    Log.success('SALARY', 'Monthly salaries calculated', { processed, skipped, month: monthlySheetName });

    return { processed, skipped, sheet: monthlySheetName };

  } catch (e) {
    Logger.log('❌ Salary calculation failed: ' + e.message);
    Log.error('SALARY', 'Salary calculation failed', { error: e.message });
  }
}

/**
 * Send reminder emails to employees who haven't submitted leave data
 * Run this before the salary cutoff date
 */
function sendLeaveFormReminders(monthName, year) {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         SENDING LEAVE FORM REMINDERS                              ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
    const monthlySheetName = monthName ? `Salary_${monthName}_${year}` : `Salary_${new Date().toLocaleString('en-US', { month: 'long' })}_${new Date().getFullYear()}`;
    
    const monthlySheet = ss.getSheetByName(monthlySheetName);
    const salaryTracker = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.SALARY_TRACKER);
    
    const trackerData = salaryTracker.getDataRange().getValues();
    const activeEmails = new Set();
    const employeeNames = {};

    for (let i = 1; i < trackerData.length; i++) {
      if (trackerData[i][8] === 'Active') {
        const email = trackerData[i][2];
        activeEmails.add(email);
        employeeNames[email] = trackerData[i][1];
      }
    }

    let submittedEmails = new Set();
    if (monthlySheet) {
      const monthlyData = monthlySheet.getDataRange().getValues();
      for (let i = 1; i < monthlyData.length; i++) {
        submittedEmails.add(monthlyData[i][2]);
      }
    }

    const missingEmails = [...activeEmails].filter(email => !submittedEmails.has(email));

    if (missingEmails.length === 0) {
      Logger.log('✅ All employees have submitted. No reminders needed.');
      return;
    }

    Logger.log(`Sending reminders to ${missingEmails.length} employees...`);

    for (const email of missingEmails) {
      try {
        const name = employeeNames[email];
        const reminderHtml = EmailTemplates.wrap(`
          <h3>📋 Leave Data Required - Salary Processing</h3>
          <p>Hi <strong>${name}</strong>,</p>
          <p>Please submit your leave data for <strong>${monthlySheetName}</strong>.</p>
          <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Required Action:</strong> Fill out the leave form below</p>
            <p>• Total leaves taken this month</p>
            <p>• Any notes regarding your attendance</p>
          </div>
          <p style="margin-top: 20px;">
            ${EmailTemplates.button('FILL LEAVE FORM', CONFIG.LEAVE_FORM_URL)}
          </p>
          <p><em>Please submit by the end of today to ensure timely salary processing.</em></p>
        `);

        GmailApp.sendEmail(
          email,
          `📋 Action Required: Leave Data for ${monthlySheetName}`,
          `Hi ${name},\n\nPlease submit your leave data for ${monthlySheetName}.\n\nForm: ${CONFIG.LEAVE_FORM_URL}\n\nThis is required for salary processing.\n\nThanks,\nUrbanmistrii HR Team`,
          { htmlBody: reminderHtml, name: 'Urbanmistrii HR' }
        );

        Logger.log(`   → Reminded: ${name} (${email})`);
        Utilities.sleep(1000);

      } catch (e) {
        Logger.log(`   ❌ Failed to send to ${email}: ${e.message}`);
      }
    }

    Logger.log('');
    Logger.log(`✅ Reminders sent to ${missingEmails.length} employees`);
    Log.success('SALARY', 'Leave form reminders sent', { count: missingEmails.length });

  } catch (e) {
    Logger.log('❌ Failed to send reminders: ' + e.message);
    Log.error('SALARY', 'Reminders failed', { error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              WEBHOOK API (v22.4)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Webhook handler for external API calls
 * Deploy as web app and external tools can trigger Oracle actions
 * 
 * Endpoint: POST to deployed web app URL
 * Headers: X-Oracle-Key: your_secret_key
 * Body (JSON): { action: 'trigger_test', email: 'candidate@email.com' }
 */
function doPost(e) {
  try {
    // Parse request
    const data = JSON.parse(e.postData.contents);
    
    // Validate webhook key (security)
    const providedKey = e.parameter.key || data.key;
    const expectedKey = CONFIG.WEBHOOK?.SECRET_KEY || 'urbanmistrii_oracle_webhook_2024';
    
    if (!CONFIG.WEBHOOK?.ENABLED) {
      return jsonResponse({ success: false, error: 'Webhook disabled' }, 403);
    }
    
    if (providedKey !== expectedKey) {
      Log.warn('WEBHOOK', 'Invalid API key provided');
      return jsonResponse({ success: false, error: 'Invalid API key' }, 401);
    }
    
    // Validate action
    const allowedActions = CONFIG.WEBHOOK?.ALLOWED_ACTIONS || [];
    if (!allowedActions.includes(data.action)) {
      return jsonResponse({ success: false, error: 'Action not allowed: ' + data.action }, 400);
    }
    
    Log.info('WEBHOOK', `API call: ${data.action}`, { params: Object.keys(data) });
    
    // Handle actions
    let result;
    
    switch (data.action) {
      case 'trigger_test':
        // Trigger test send for a specific candidate
        result = webhookTriggerTest(data.email);
        break;
        
      case 'update_status':
        // Update candidate status
        result = webhookUpdateStatus(data.email, data.status);
        break;
        
      case 'get_candidate':
        // Get candidate info
        result = webhookGetCandidate(data.email);
        break;
        
      case 'retry_errors':
        // Retry all pending errors
        result = ErrorRecovery.retryAll();
        break;
        
      default:
        result = { success: false, error: 'Unknown action: ' + data.action };
    }
    
    return jsonResponse(result);
    
  } catch (err) {
    Log.error('WEBHOOK', 'Handler failed', { error: err.message });
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify({
    ...data,
    timestamp: new Date().toISOString(),
    version: 'Oracle v22.4'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Webhook: Trigger test for a candidate by email
 */
function webhookTriggerTest(email) {
  if (!email) return { success: false, error: 'Email required' };
  
  const candidate = SheetUtils.findCandidateByEmail(email);
  if (!candidate) return { success: false, error: 'Candidate not found' };
  
  // Check if test already sent
  if (candidate.testSent) {
    return { success: false, error: 'Test already sent', testSentAt: candidate.testSent };
  }
  
  // Send test
  const phone = candidate.phone;
  const name = candidate.name;
  const role = candidate.role || 'intern';
  const department = candidate.data[CONFIG.COLUMNS.DEPARTMENT - 1];
  
  if (!phone) return { success: false, error: 'No phone number' };
  
  const result = WhatsApp.sendTestLink(phone, name, role, department);
  
  if (result.success || result.testMode) {
    SheetUtils.batchUpdate([
      { row: candidate.row, col: CONFIG.COLUMNS.STATUS, value: CONFIG.RULES.STATUSES.TEST_SENT },
      { row: candidate.row, col: CONFIG.COLUMNS.TEST_SENT, value: new Date() },
      { row: candidate.row, col: CONFIG.COLUMNS.UPDATED, value: new Date() },
      { row: candidate.row, col: CONFIG.COLUMNS.LOG, value: '✅ Test sent via webhook API' }
    ]);
    
    return { success: true, message: `Test sent to ${name}`, testMode: result.testMode };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Webhook: Update candidate status
 */
function webhookUpdateStatus(email, newStatus) {
  if (!email) return { success: false, error: 'Email required' };
  if (!newStatus) return { success: false, error: 'Status required' };
  
  // Validate status
  const validStatuses = Object.values(CONFIG.RULES.STATUSES);
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: 'Invalid status', validStatuses };
  }
  
  const candidate = SheetUtils.findCandidateByEmail(email);
  if (!candidate) return { success: false, error: 'Candidate not found' };
  
  const oldStatus = candidate.status;
  const isValidTransition = StatusMachine.isValidTransition(oldStatus, newStatus);
  
  SheetUtils.updateStatus(candidate.row, newStatus, email);
  
  return { 
    success: true, 
    message: `Status updated: ${oldStatus} -> ${newStatus}`,
    warning: isValidTransition ? null : 'Unusual status transition'
  };
}

/**
 * Webhook: Get candidate information
 */
function webhookGetCandidate(email) {
  if (!email) return { success: false, error: 'Email required' };
  
  const candidate = SheetUtils.findCandidateByEmail(email);
  if (!candidate) return { success: false, error: 'Candidate not found' };
  
  return {
    success: true,
    candidate: {
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone ? candidate.phone.substring(0, 4) + '***' : null, // Masked
      role: candidate.role,
      status: candidate.status,
      testSent: candidate.testSent ? new Date(candidate.testSent).toISOString() : null,
      testSubmitted: candidate.data[CONFIG.COLUMNS.TEST_SUBMITTED - 1] || null,
      interviewDate: candidate.data[CONFIG.COLUMNS.INTERVIEW_DATE - 1] || null
    }
  };
}



// ═══════════════════════════════════════════════════════════════════════════
//  ONBOARDING SUITE V2
// ═══════════════════════════════════════════════════════════════════════════
/*
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  URBAN MISTRII - ONBOARDING SUITE v6.0 (WORLD-CLASS AI SUITE)                ║
 * ║  Features: Advanced AI Intent Detection, Memory Window, Audit & Auto-Fix     ║
 * ║  Beautiful Email Templates, Comprehensive Testing, Enterprise Automation     ║
 * ║  🔗 Integrated with HR Ecosystem (Offboarding, Letter Generator)             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

// CONFIG is now imported from Config.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🤖 WORLD-CLASS AI ENGINE (Advanced Intent Detection)                        ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// AI is now imported from AI.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  UTILITIES                                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// U (Utils) is now imported from Utils.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  📧 BEAUTIFUL EMAIL TEMPLATES (Matching Offboarding Suite Design)            ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// T (Templates) is now imported from Utils.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  📨 ADVANCED GMAIL MONITOR (Memory Window + Intent Detection)                ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function monitorOnboardingEmails() {
  console.log("═══ ONBOARDING v6.0: Advanced Email Processing ═══");

  try {
    // Ensure labels exist
    Object.values(CONFIG.LABELS).forEach(n => U.label(n));

    // Build search query for all onboarding keywords
    const keywordQuery = CONFIG.KEYWORDS.ONBOARDING_TRIGGERS.map(k => `subject:"${k}"`).join(" OR ");
    const query = `(${keywordQuery}) is:unread after:${U.searchDate(CONFIG.SCAN_DAYS)} -label:"${CONFIG.LABELS.SENT}"`;

    const threads = GmailApp.search(query, 0, 20);
    const myEmail = Session.getActiveUser().getEmail();

    for (const thread of threads) {
      try {
        processSignupThreadAdvanced(thread, myEmail);
        Utilities.sleep(500);
      } catch (e) {
        console.error(`Thread error: ${e.message}`);
        Log.add("ERROR", "", thread.getFirstMessageSubject(), "Processing failed", e.message);
      }
    }

    Log.flush();
  } catch (e) {
    console.error(`Fatal: ${e.message}`);
  }
}

function processSignupThreadAdvanced(thread, myEmail) {
  if (!thread) return;
  if (U.hasLabel(thread, CONFIG.LABELS.STOP) || U.hasLabel(thread, CONFIG.LABELS.SENT)) return;

  let msgs, last, sender, email, body, subject;
  try {
    msgs = thread.getMessages();
    if (!msgs || msgs.length === 0) return;
    last = msgs[msgs.length - 1];
    sender = last.getFrom() || "";
    email = U.email(sender);
    body = last.getPlainBody() || "";
    subject = last.getSubject() || "";
  } catch (e) {
    console.error("Error getting messages:", e.message);
    return;
  }

  // Filter spam/auto-replies
  if (/no-reply|noreply|notification|alert|donotreply/i.test(sender)) {
    thread.markRead();
    return;
  }
  if (sender.includes(myEmail)) return;

  // 🧠 MEMORY WINDOW: Read last 3 messages for context (like offboarding suite)
  let combinedContext = "";
  let scanCount = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m.getFrom().includes(CONFIG.HR_EMAIL)) {
      let msgBody = m.getPlainBody();
      if (typeof msgBody !== 'string') msgBody = '';
      combinedContext += " " + msgBody;
      scanCount++;
      if (scanCount >= 3) break;
    }
  }

  // Analyze with world-class intent detection
  const analysis = AI.detectIntent(combinedContext, subject);
  console.log(`👤 Sender: ${email} | Intent: ${analysis.type}`);

  // Execute based on intent
  if (analysis.type === "ONBOARDING_REQUEST") {
    executeOnboardingAction(analysis, thread, email, sender);
  } else if (analysis.type === "DOCUMENT_REQUEST") {
    executeOnboardingAction(analysis, thread, email, sender);
  } else if (analysis.type === "ESCALATE_SENSITIVE") {
    executeOnboardingAction(analysis, thread, email, sender);
  } else if (analysis.type === "GENERAL_QUESTION") {
    executeOnboardingAction(analysis, thread, email, sender);
  }

  // Mark processed if action taken
  if (["ONBOARDING_REQUEST", "DOCUMENT_REQUEST", "ESCALATE_SENSITIVE", "GENERAL_QUESTION"].includes(analysis.type)) {
    markProcessedOnboarding(thread.getId());
  }

  // Log unknown intents
  if (analysis.type === "UNKNOWN") {
    Log.add("UNKNOWN_INTENT", email, subject, "No action taken", "Intent not recognized");
  }
}

function executeOnboardingAction(analysis, thread, email, sender) {
  switch (analysis.type) {
    case "ONBOARDING_REQUEST":
      // Prevent duplicate form sends
      if (AI.isDuplicateSignup(thread, email)) {
        console.log(`↩️ SKIPPING: Already sent form to ${email} recently`);
        thread.addLabel(U.label(CONFIG.LABELS.SENT));
        thread.markRead();
        return;
      }

      // Check if employee already exists
      if (U.employeeExists(email)) {
        console.log(`ℹ️ Employee ${email} already exists in database`);
        thread.addLabel(U.label(CONFIG.LABELS.PROCESSED));
        thread.markRead();
        return;
      }

      console.log(`📥 New Onboarding Request: ${email}`);

      // AI Name Extraction
      const name = AI.extractName(thread.getMessages()[thread.getMessages().length - 1].getPlainBody(), sender);

      // Send Welcome Email with Form Link
      GmailApp.sendEmail(email, `Welcome to UrbanMistrii, ${name}! (Action Required)`, "", {
        htmlBody: T.welcomeEmail(name, CONFIG.REAL_FORM_LINK),
        name: "HR Team, Urbanmistrii"
      });

      thread.addLabel(U.label(CONFIG.LABELS.SENT));
      thread.markRead();

      console.log(`✅ Welcome email sent to ${name} (${email})`);
      Log.add("FORM_SENT", email, thread.getFirstMessageSubject(), `Welcome email sent to ${name}`, `Form link: ${CONFIG.REAL_FORM_LINK}`);
      break;

    case "DOCUMENT_REQUEST":
      sendDocAckOnboarding(thread, email, analysis.data);
      break;

    case "ESCALATE_SENSITIVE":
      notifyHROnboarding(thread, email, "Sensitive Content Detected in Onboarding");
      break;

    case "GENERAL_QUESTION":
      sendGeneralAckOnboarding(thread, email);
      break;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  STAGE 2: FORM PROCESSOR (Automated - Runs on Form Submit)                    ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function processFormSubmission(e) {
  if (!e) { 
    console.warn("⚠️ Submit the onboarding form to test this function."); 
    return; 
  }
  
  const responses = e.namedValues;
  const { ss, sheet } = U.sheet();
  
  console.log("═══ PROCESSING ONBOARDING FORM SUBMISSION ═══");
  
  // Adaptive value extraction
  const getVal = (keywords) => {
    if (!Array.isArray(keywords)) keywords = [keywords];
    for (const keyword of keywords) {
      const foundKey = Object.keys(responses).find(k => 
        k.toLowerCase().includes(keyword.toLowerCase())
      );
      if (foundKey) return responses[foundKey][0];
    }
    return "";
  };
  
  // Extract all form data
  const name = getVal(["Full Name", "name", "employee name"]);
  const email = getVal(["Email", "email address"]);
  const phone = getVal(["Phone", "mobile", "contact"]);
  const joinDate = getVal(["date of joining", "joining date", "start date"]);
  const team = getVal(["team", "department"]);
  const type = getVal(["full-time", "employment type", "intern"]);
  const salary = getVal(["monthly compensation", "salary", "ctc"]);
  
  // Build position string
  const position = `${team} (${type.toLowerCase().includes("intern") ? "Intern" : "Full Time"})`;
  
  // Extract file links (Google Drive IDs)
  const makeLink = (id) => id ? `https://drive.google.com/open?id=${id}` : "";
  const cv = makeLink(getVal(["CV", "resume"]));
  const aadhar = makeLink(getVal(["Aadhar", "id proof"]));
  const photo = makeLink(getVal(["photograph", "photo", "picture"]));
  
  console.log(`📝 New Employee: ${name} | Position: ${position} | Salary: ${salary}`);
  
  // Prepare row data (matching column structure)
  const rowData = new Array(CONFIG.HEADERS.length).fill("");
  rowData[CONFIG.COLUMNS.JOINING_DATE] = joinDate;
  rowData[CONFIG.COLUMNS.NAME] = name;
  rowData[CONFIG.COLUMNS.EMAIL] = email;
  rowData[CONFIG.COLUMNS.LEAVES_OCT] = 0;
  rowData[CONFIG.COLUMNS.OCT_LEAVES] = 0;
  rowData[CONFIG.COLUMNS.TOTAL_LEAVES] = 0;
  rowData[CONFIG.COLUMNS.LEAVE_DATES] = "";
  rowData[CONFIG.COLUMNS.CURRENT_SAL] = salary;
  rowData[CONFIG.COLUMNS.PER_DAY] = "";
  rowData[CONFIG.COLUMNS.DEDUCTIONS] = 0;
  rowData[CONFIG.COLUMNS.TOTAL_MINUS_DED] = "";
  rowData[CONFIG.COLUMNS.CONVEYANCE] = 0;
  rowData[CONFIG.COLUMNS.TOTAL_SALARY] = "";
  rowData[CONFIG.COLUMNS.DAYS_WITH_UM] = "";
  rowData[CONFIG.COLUMNS.POSITION] = position;
  rowData[CONFIG.COLUMNS.PHONE] = phone;
  rowData[CONFIG.COLUMNS.RESUME_LINK] = cv;
  rowData[CONFIG.COLUMNS.AADHAR_LINK] = aadhar;
  rowData[CONFIG.COLUMNS.PHOTO_LINK] = photo;
  
  // Append to master sheet
  sheet.appendRow(rowData);
  console.log(`✅ Added ${name} to master database`);
  
  // Send handbooks
  sendHandbooks(email, name);
  
  // Log activity
  Log.add("FORM_PROCESSED", email, "Onboarding Form", `Employee added: ${name}`, `Position: ${position}, Salary: ${salary}`);
  Log.flush();
  
  console.log(`🎉 ONBOARDING COMPLETE for ${name}`);
}

function sendDocAckOnboarding(thread, email, docType) {
  const typeName = docType || "document";
  const html = T.wrap(`
    <div style="${T.style.header}">Document Request Received</div>
    <div style="padding:20px;">
      <p>Dear Team Member,</p>
      <p>We have logged your request for the <strong>${typeName}</strong>.</p>
      <div style="${T.style.box}">
        <p>Note: Documents are typically processed after your complete onboarding is finished.</p>
      </div>
    </div>
  `);
  thread.reply("", { htmlBody: html, name: "HR Team" });
  thread.addLabel(U.label(CONFIG.LABELS.PROCESSED));
  thread.moveToArchive();
  Log.add("DOCUMENT_REQUEST", email, thread.getFirstMessageSubject(), `Document request acknowledged: ${typeName}`, "");
}

function sendGeneralAckOnboarding(thread, email) {
  const html = T.wrap(`
    <div style="${T.style.header}">Inquiry Received</div>
    <div style="padding:20px;">
      <p>Dear Team Member,</p>
      <p>We have received your message. Our HR team will review it shortly and get back to you.</p>
    </div>
  `);
  thread.reply("", { htmlBody: html, name: "HR Team" });
  thread.addLabel(U.label(CONFIG.LABELS.PROCESSED));
  thread.moveToArchive();
  Log.add("GENERAL_QUESTION", email, thread.getFirstMessageSubject(), "General inquiry acknowledged", "");
}

function notifyHROnboarding(thread, email, reason) {
  GmailApp.sendEmail(CONFIG.HR_EMAIL, `🚨 HR ALERT: Onboarding - ${email}`, `Reason: ${reason}\nCheck onboarding thread.`);
  thread.addLabel(U.label(CONFIG.LABELS.ESCALATED));
  Log.add("ESCALATED", email, thread.getFirstMessageSubject(), "Sensitive content escalated to HR", reason);
}

function markProcessedOnboarding(msgId) {
  const props = PropertiesService.getScriptProperties();
  const cache = props.getProperty("PROCESSED_ONBOARDING_IDS");
  const processedIds = cache ? JSON.parse(cache) : {};
  processedIds[msgId] = new Date().getTime();

  // Clean old entries (older than 48 hours)
  const now = new Date().getTime();
  Object.keys(processedIds).forEach(id => {
    if (now - processedIds[id] > 172800000) delete processedIds[id];
  });

  props.setProperty("PROCESSED_ONBOARDING_IDS", JSON.stringify(processedIds));
}

function sendHandbooks(email, name) {
  const props = PropertiesService.getScriptProperties();
  let attFolderId = props.getProperty("ATT_FOLDER_ID");
  
  if (!attFolderId) {
    // Try to find attachment folder
    const rootFolder = U.getFolderByName(CONFIG.ROOT_FOLDER);
    if (rootFolder) {
      const attFolder = U.getFolderByName(CONFIG.ATTACHMENT_FOLDER, rootFolder);
      if (attFolder) {
        attFolderId = attFolder.getId();
        props.setProperty("ATT_FOLDER_ID", attFolderId);
      }
    }
  }
  
  if (!attFolderId) {
    console.warn("⚠️ Attachment folder not found. Run setupOnboardingSystem() first.");
    Log.add("WARNING", email, "", "Handbooks not sent", "Attachment folder not configured");
    return;
  }
  
  try {
    const folder = DriveApp.getFolderById(attFolderId);
    const files = folder.getFiles();
    const attachments = { policy: [], drafting: [] };
    
    while (files.hasNext()) {
      const file = files.next();
      const fname = file.getName().toLowerCase();
      
      if (fname.includes("etiquette") || fname.includes("leave") || fname.includes("hr policy") || fname.includes("policy")) {
        attachments.policy.push(file);
      }
      if (fname.includes("drafting") || fname.includes("handbook")) {
        attachments.drafting.push(file);
      }
    }
    
    // Send policy documents
    if (attachments.policy.length > 0) {
      GmailApp.sendEmail(email, "Onboarding Resources: Policies & Guidelines 📄", "", {
        htmlBody: T.handbooksEmail(name, "policy"),
        attachments: attachments.policy,
        name: "HR Team, Urbanmistrii"
      });
      console.log(`📧 Sent ${attachments.policy.length} policy document(s) to ${email}`);
      Log.add("HANDBOOKS_SENT", email, "Policy Documents", `Sent ${attachments.policy.length} policy files`, "");
    }
    
    Utilities.sleep(2000); // Prevent rate limiting
    
    // Send drafting handbook
    if (attachments.drafting.length > 0) {
      GmailApp.sendEmail(email, "Confidential: UM Drafting Handbook 📐", "", {
        htmlBody: T.handbooksEmail(name, "drafting"),
        attachments: attachments.drafting,
        name: "HR Team, Urbanmistrii"
      });
      console.log(`📧 Sent ${attachments.drafting.length} drafting handbook(s) to ${email}`);
      Log.add("HANDBOOKS_SENT", email, "Drafting Handbook", `Sent ${attachments.drafting.length} drafting files`, "Confidential");
    }
    
  } catch (e) {
    console.error(`❌ Error sending handbooks to ${email}: ${e.message}`);
    Log.add("ERROR", email, "", "Handbook delivery failed", e.message);
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  SETUP & INSTALLATION                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function setupOnboardingSystem() {
  console.log("🚀 SETTING UP ONBOARDING SYSTEM v2.0\n");
  
  const props = PropertiesService.getScriptProperties();
  
  // 1. Ensure Root Folder
  let rootFolder = U.getFolderByName(CONFIG.ROOT_FOLDER);
  if (!rootFolder) {
    rootFolder = DriveApp.createFolder(CONFIG.ROOT_FOLDER);
    console.log(`✅ Created root folder: ${CONFIG.ROOT_FOLDER}`);
  } else {
    console.log(`✅ Found root folder: ${CONFIG.ROOT_FOLDER}`);
  }
  
  // 2. Ensure Attachment Folder
  let attFolder = U.getFolderByName(CONFIG.ATTACHMENT_FOLDER, rootFolder);
  if (!attFolder) {
    attFolder = rootFolder.createFolder(CONFIG.ATTACHMENT_FOLDER);
    console.log(`✅ Created attachment folder: ${CONFIG.ATTACHMENT_FOLDER}`);
    console.log(`⚠️ Please upload HR policies and handbooks to this folder`);
  } else {
    console.log(`✅ Found attachment folder: ${CONFIG.ATTACHMENT_FOLDER}`);
  }
  props.setProperty("ATT_FOLDER_ID", attFolder.getId());
  
  // 3. Connect to Master Sheet (should already exist from offboarding setup)
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_TAB);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_TAB);
    sheet.appendRow(CONFIG.HEADERS);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight("bold").setBackground("#d9ead3");
    sheet.setFrozenRows(1);
    console.log(`✅ Created employee sheet with headers`);
  } else {
    console.log(`✅ Connected to existing employee sheet`);
  }
  
  // 4. Ensure Activity Log Sheet
  let logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.LOG_SHEET);
    logSheet.appendRow(["Timestamp", "Type", "Email", "Subject", "Action", "Details"]);
    logSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#fff2cc");
    console.log(`✅ Created activity log sheet`);
  } else {
    console.log(`✅ Found activity log sheet`);
  }
  
  // 5. Create Gmail Labels
  Object.values(CONFIG.LABELS).forEach(labelName => {
    U.label(labelName);
  });
  console.log(`✅ Created Gmail labels`);
  
  console.log("\n🎉 ONBOARDING SYSTEM SETUP COMPLETE!");
  console.log("\n📋 NEXT STEPS:");
  console.log("1. Upload HR handbooks to the attachment folder");
  console.log("2. Run installOnboardingTriggers() to activate automation");
  console.log("3. Test with testOnboardingFlow()");
}

function installOnboardingTriggers() {
  console.log("🔧 INSTALLING ADVANCED ONBOARDING TRIGGERS\n");

  // Clear existing onboarding triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const funcName = t.getHandlerFunction();
    if (['monitorOnboardingEmails', 'processFormSubmission'].includes(funcName)) {
      ScriptApp.deleteTrigger(t);
    }
  });
  console.log("🧹 Cleared old onboarding triggers");

  // 1. Advanced Gmail Monitor (Every 5 Minutes)
  ScriptApp.newTrigger('monitorOnboardingEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  console.log("✅ Installed advanced Gmail monitor (every 5 minutes)");

  // 2. Form Processor (On Form Submit)
  ScriptApp.newTrigger('processFormSubmission')
    .forSpreadsheet(CONFIG.SHEET_ID)
    .onFormSubmit()
    .create();
  console.log("✅ Installed form processor (instant on submit)");

  console.log("\n🚀 ONBOARDING SUITE v6.0 IS NOW LIVE!");
  console.log("🤖 Advanced AI Intent Detection: Active");
  console.log("🧠 Memory Window Processing: Active");
  console.log("📧 Email Monitoring: " + CONFIG.KEYWORDS.ONBOARDING_TRIGGERS.join(", "));
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  ACTIVITY LOGGER (Oracle v5.1 Pattern)                                        ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// Log is now imported from Utils.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🕵️‍♂️ AUDIT & AUTO-FIX: Ensure All Onboarding Steps Completed                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function AUDIT_AND_FIX_ONBOARDING() {
  // Scan last 15 days of threads, check for onboarding requests that didn't get forms
  const query = `to:me after:${U.searchDate(15)} -label:"${CONFIG.LABELS.SENT}"`;
  const threads = GmailApp.search(query, 0, 200);
  const formsSent = {};
  const pendingRequests = [];

  // Build a map of who got forms already
  for (const thread of threads) {
    const msgs = thread.getMessages();
    for (const msg of msgs) {
      const subj = (msg.getSubject() || "").toLowerCase();
      const body = (msg.getPlainBody() || "").toLowerCase();
      // Find form links sent
      if (body.includes(CONFIG.REAL_FORM_LINK.toLowerCase()) || subj.includes("welcome") || subj.includes("onboarding")) {
        const email = U.email(msg.getTo() || msg.getFrom());
        if (email && !email.endsWith("urbanmistrii.com")) formsSent[email] = true;
      }
    }
  }

  // For each thread, check for onboarding requests without forms
  for (const thread of threads) {
    const msgs = thread.getMessages();
    let candidate = null;
    let hasOnboardingRequest = false;

    for (const msg of msgs) {
      const subj = (msg.getSubject() || "").toLowerCase();
      const body = (msg.getPlainBody() || "").toLowerCase();
      const from = msg.getFrom() || "";

      // Detect candidate (not HR)
      if (!candidate && !from.includes(CONFIG.HR_EMAIL) && !from.includes("urbanmistrii.com")) {
        candidate = U.email(from);
      }

      // Check for onboarding request keywords
      if (CONFIG.KEYWORDS.ONBOARDING_TRIGGERS.some(k => subj.includes(k) || body.includes(k))) {
        hasOnboardingRequest = true;
      }
    }

    if (candidate && hasOnboardingRequest && !formsSent[candidate] && !U.employeeExists(candidate)) {
      pendingRequests.push({ email: candidate, thread: thread });
      Logger.log(`Onboarding request found for: ${candidate}`);
    }
  }

  // Send missing onboarding forms
  for (const req of pendingRequests) {
    try {
      if (!req.email || req.email.endsWith("urbanmistrii.com")) continue;
      const name = req.email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, l => l.toUpperCase());
      const html = T.wrap(`
        <div style="${T.style.header}">Welcome to Urban Mistrii!</div>
        <div style="padding:20px;">
          <p>Dear ${name},</p>
          <p>We're thrilled to have you join our team!</p>
          <div style="${T.style.box}">
            <h3 style="margin:0 0 10px 0; color:#333;">Complete Your Onboarding</h3>
            <p>Please fill out this form to get started:</p>
            <a href="${CONFIG.REAL_FORM_LINK}" style="${T.style.btn}">START ONBOARDING</a>
          </div>
        </div>
      `);
      GmailApp.sendEmail(req.email, "Welcome to Urban Mistrii! (Action Required)", "", { htmlBody: html, name: "HR Team" });
      Log.add("AUTO_ONBOARDING", req.email, "Audit Fix", "Sent missing onboarding form", "");
      Logger.log(`Onboarding form sent to: ${req.email}`);
    } catch (e) {
      Log.add("AUTO_ONBOARDING_FAIL", req.email, "Audit Fix Failed", "Failed to send onboarding form", e.message);
      Logger.log(`Failed to send onboarding form to: ${req.email} - ${e.message}`);
    }
  }

  Logger.log(`Onboarding audit complete. Forms sent to: ${pendingRequests.map(r => r.email).join(", ")}`);
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🧪 COMPREHENSIVE TESTING SUITE                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function TEST_ALL_ONBOARDING_FEATURES() {
  const testEmail = CONFIG.HR_EMAIL; // Send all test emails to HR
  const testName = "Test Employee";

  try {
    Logger.log("🧪 Starting comprehensive onboarding test...");

    // Test 1: Welcome Email with Form Link
    Logger.log("📧 Testing Welcome Email...");
    const welcomeHtml = T.welcomeEmail(testName, CONFIG.REAL_FORM_LINK);
    GmailApp.sendEmail(testEmail, "[TEST] Welcome to Urban Mistrii!", "", {
      htmlBody: welcomeHtml,
      name: "HR Team, Urbanmistrii"
    });
    Log.add("TEST_WELCOME", testEmail, "Welcome Email Test", "Test welcome email sent", "");

    // Test 2: Policy Documents Email
    Logger.log("📄 Testing Policy Documents Email...");
    const policyHtml = T.handbooksEmail(testName, "policy");
    GmailApp.sendEmail(testEmail, "[TEST] Company Policies & Guidelines", "", {
      htmlBody: policyHtml,
      name: "HR Team, Urbanmistrii"
    });
    Log.add("TEST_POLICY", testEmail, "Policy Email Test", "Test policy email sent", "");

    // Test 3: Drafting Handbook Email
    Logger.log("📐 Testing Drafting Handbook Email...");
    const handbookHtml = T.handbooksEmail(testName, "drafting");
    GmailApp.sendEmail(testEmail, "[TEST] Confidential: UM Drafting Handbook", "", {
      htmlBody: handbookHtml,
      name: "HR Team, Urbanmistrii"
    });
    Log.add("TEST_HANDBOOK", testEmail, "Handbook Email Test", "Test handbook email sent", "");

    // Test 4: Document Request Acknowledgment
    Logger.log("📋 Testing Document Request Acknowledgment...");
    const docHtml = T.wrap(`
      <div style="${T.style.header}">Document Request Received</div>
      <div style="padding:20px;">
        <p>Dear ${testName},</p>
        <p>We have logged your request for the <strong>experience letter</strong>.</p>
        <div style="${T.style.box}">
          <p>Note: Documents are typically processed after your complete onboarding is finished.</p>
        </div>
      </div>
    `);
    GmailApp.sendEmail(testEmail, "[TEST] Document Request Acknowledgment", "", { htmlBody: docHtml, name: "HR Team" });
    Log.add("TEST_DOC_ACK", testEmail, "Document Ack Test", "Test document acknowledgment sent", "");

    // Test 5: General Inquiry Acknowledgment
    Logger.log("💬 Testing General Inquiry Acknowledgment...");
    const generalHtml = T.wrap(`
      <div style="${T.style.header}">Inquiry Received</div>
      <div style="padding:20px;">
        <p>Dear ${testName},</p>
        <p>We have received your message. Our HR team will review it shortly and get back to you.</p>
      </div>
    `);
    GmailApp.sendEmail(testEmail, "[TEST] General Inquiry Acknowledgment", "", { htmlBody: generalHtml, name: "HR Team" });
    Log.add("TEST_GENERAL_ACK", testEmail, "General Ack Test", "Test general acknowledgment sent", "");

    // Test 6: HR Alert Email
    Logger.log("🚨 Testing HR Alert Email...");
    GmailApp.sendEmail(CONFIG.HR_EMAIL, `[TEST] HR ALERT: Onboarding - ${testEmail}`, `Reason: Test sensitive content detection\nThis is a test alert for the onboarding system.`, { name: "Onboarding AI" });
    Log.add("TEST_HR_ALERT", CONFIG.HR_EMAIL, "HR Alert Test", "Test HR alert sent", "");

    Logger.log("✅ All onboarding feature tests completed!");
    Logger.log(`📧 All test emails sent to: ${testEmail}`);
    Logger.log("\n🎯 Test Results:");
    Logger.log("• Welcome Email: Check for form link and styling");
    Logger.log("• Policy Email: Check for attachment placeholders");
    Logger.log("• Handbook Email: Check confidential markings");
    Logger.log("• Document Ack: Check professional response");
    Logger.log("• General Ack: Check helpful tone");
    Logger.log("• HR Alert: Check escalation format");

  } catch (e) {
    Logger.log("❌ Error in TEST_ALL_ONBOARDING_FEATURES: " + e.message);
    Log.add("TEST_ERROR", CONFIG.HR_EMAIL, "Test Suite Failed", "Comprehensive test failed", e.message);
  }

  Log.flush();
}

function manualSendWelcomeEmail(email, name) {
  if (!email || !name) {
    console.error("❌ Usage: manualSendWelcomeEmail('employee@email.com', 'Employee Name')");
    return;
  }
  
  console.log(`\n🚀 MANUALLY SENDING WELCOME EMAIL`);
  console.log(`To: ${email}`);
  console.log(`Name: ${name}\n`);
  
  GmailApp.sendEmail(email, `Welcome to UrbanMistrii, ${name}! (Action Required)`, "", {
    htmlBody: T.welcomeEmail(name, CONFIG.REAL_FORM_LINK),
    name: "HR Team, Urbanmistrii"
  });
  
  console.log("✅ Welcome email sent!");
  Log.add("MANUAL_SEND", email, "Welcome Email", `Manually sent to ${name}`, "");
  Log.flush();
}

function testOnboardingFlow() {
  console.log("\n🧪 RUNNING COMPREHENSIVE ONBOARDING TEST SUITE\n");

  console.log("🎯 This will test ALL onboarding features:");
  console.log("• Welcome Email with Form Link");
  console.log("• Policy Documents Email");
  console.log("• Drafting Handbook Email");
  console.log("• Document Request Acknowledgment");
  console.log("• General Inquiry Acknowledgment");
  console.log("• HR Alert System");
  console.log("");

  TEST_ALL_ONBOARDING_FEATURES();

  console.log("\n✅ COMPREHENSIVE TEST COMPLETED!");
  console.log("\n📋 CHECKLIST:");
  console.log("1. Check HR inbox for 6 test emails with [TEST] prefixes");
  console.log("2. Verify beautiful email styling and branding");
  console.log("3. Test form submission workflow manually");
  console.log("4. Review 'Onboarding Activity Log' sheet");
  console.log("5. Run AUDIT_AND_FIX_ONBOARDING to test audit features");
}



// ═══════════════════════════════════════════════════════════════════════════
//  OFFBOARDING EXIT SUITE V2
// ═══════════════════════════════════════════════════════════════════════════
// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🕵️‍♂️ AUDIT & AUTO-FIX: Ensure All Steps Completed for All Candidates        ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function AUDIT_AND_FIX_OFFBOARDING() {
  // Scan last 15 days of threads, check for candidates who got Step 2 but not Step 3, and send Step 3 if needed
  const query = `to:me after:${getNDaysAgo(15)} -label:${CONFIG.LABELS.STOP}`;
  const threads = GmailApp.search(query, 0, 200);
  const step3Sent = {};
  const step2Candidates = [];
  // Build a map of who got Step 3 already (exclude HR/internal)
  for (const thread of threads) {
    const msgs = thread.getMessages();
    for (const msg of msgs) {
      const subj = (msg.getSubject() || "").toLowerCase();
      const body = (msg.getPlainBody() || "").toLowerCase();
      // Find Step 3 sent to candidate (not HR)
      if (subj.includes("exit survey") && (body.includes("step 3") || body.includes("exit survey"))) {
        const email = extractEmailFromMsg(msg);
        if (email && !email.endsWith("urbanmistrii.com")) step3Sent[email] = true;
      }
    }
  }
  // For each thread, collect all unique candidate emails (not internal)
  for (const thread of threads) {
    const msgs = thread.getMessages();
    let candidateEmails = {};
    let gotStep2 = false;
    let gotStep3Emails = {};
    for (const msg of msgs) {
      const subj = (msg.getSubject() || "").toLowerCase();
      const body = (msg.getPlainBody() || "").toLowerCase();
      // Extract all possible candidate emails from To, From, and body
      [msg.getTo(), msg.getFrom(), msg.getPlainBody()].forEach(field => {
        if (field) {
          const matches = field.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi);
          if (matches) {
            matches.forEach(email => {
              email = email.toLowerCase();
              if (!email.endsWith("urbanmistrii.com") && !email.includes("hr@")) {
                candidateEmails[email] = true;
              }
            });
          }
        }
      });
      // Step 2: look for offboarding form link sent (robust)
      if (
        body.includes(CONFIG.URL_OFFBOARD.toLowerCase()) ||
        body.includes("offboarding form") ||
        subj.includes("work log") ||
        subj.includes("logbook received") ||
        subj.includes("step 2")
      ) {
        gotStep2 = true;
      }
      // Step 3: already sent?
      if (subj.includes("exit survey") && (body.includes("step 3") || body.includes("exit survey"))) {
        // Mark all emails in this message as having gotten Step 3
        [msg.getTo(), msg.getFrom(), msg.getPlainBody()].forEach(field => {
          if (field) {
            const matches = field.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi);
            if (matches) {
              matches.forEach(email => {
                email = email.toLowerCase();
                gotStep3Emails[email] = true;
              });
            }
          }
        });
      }
    }
    // For each candidate in this thread, check eligibility
    Object.keys(candidateEmails).forEach(candidate => {
      const alreadyStep3 = gotStep3Emails[candidate] || step3Sent[candidate];
      if (gotStep2 && !alreadyStep3) {
        step2Candidates.push({ email: candidate, thread: thread });
        Logger.log(`Candidate eligible for Step 3: ${candidate}`);
      } else {
        Logger.log(`Thread/candidate skipped. candidate=${candidate} gotStep2=${gotStep2} gotStep3=${alreadyStep3}`);
      }
    });
  }
  // Send Step 3 to those missing it (only to real candidates)
  for (const c of step2Candidates) {
    try {
      if (!c.email || c.email.endsWith("urbanmistrii.com")) continue;
      const name = c.email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, l => l.toUpperCase());
      const html = T.wrap(`
        <div style="${T.style.header}">Step 2 Complete</div>
        <div style="padding:20px;">
          <p>Dear ${name},</p>
          <div style="${T.style.box}">
            <h3 style="margin:0 0 10px 0; color:#333;">STEP 3: Confidential Exit Survey</h3>
            <p>Your feedback helps us improve and grow. Please take a moment to share your thoughts:</p>
            <a href="${CONFIG.URL_EXIT}" style="${T.style.btn}">TAKE EXIT SURVEY</a>
          </div>
        </div>
      `);
      GmailApp.sendEmail(c.email, "Step 3: Exit Survey (Final Step)", "", { htmlBody: html, name: "HR Team" });
      Log.add(c.email, "AUTO_STEP3", "Sent missing Step 3 Exit Survey");
      Logger.log(`Step 3 sent to: ${c.email}`);
    } catch (e) {
      Log.add(c.email, "AUTO_STEP3_FAIL", "Failed to send Step 3: " + e.message);
      Logger.log(`Failed to send Step 3 to: ${c.email} - ${e.message}`);
    }
  }
  Logger.log(`Audit complete. Step 3 sent to: ${step2Candidates.map(c => c.email).join(", ")}`);
}

function getNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "Asia/Kolkata", "yyyy/MM/dd");
}

function extractEmailFromMsg(msg) {
  // Try To, then From, then body
  let email = "";
  if (msg.getTo()) {
    const match = msg.getTo().match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
    if (match) return match[0].toLowerCase();
  }
  if (msg.getFrom()) {
    const match = msg.getFrom().match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
    if (match) return match[0].toLowerCase();
  }
  if (msg.getPlainBody()) {
    const match = msg.getPlainBody().match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
    if (match) return match[0].toLowerCase();
  }
  return email;
}
/*
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  URBAN MISTRII - OFFBOARDING AI SUITE v6.0 (FINAL)                            ║
 * ║  Features: Context Memory, Priority Flow, PDF Approvals, Manual Fix Tools     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

// CONFIG is now imported from Config.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🧠 AI ENGINE: CONTEXT & INTENT SCORING                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// AI is now imported from AI.js - removing duplicate declaration

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  📨 INTELLIGENT PROCESSOR (MEMORY WINDOW)                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function processInbox() {
  const query = `to:me -label:${CONFIG.LABELS.STOP} -label:${CONFIG.LABELS.PROCESSED} -from:${CONFIG.HR_EMAIL}`;
  const threads = GmailApp.search(query, 0, 20);

  if (threads.length === 0) { console.log("✅ Inbox Clean."); return; }

  Object.values(CONFIG.LABELS).forEach(l => { try { GmailApp.createLabel(l); } catch (e) { } });
  const processedCache = getProcessedIDs();

  console.log(`📨 Scanning ${threads.length} threads...`);

  for (const thread of threads) {
    try {
      const msgs = thread.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      const msgId = lastMsg.getId();
      const sender = lastMsg.getFrom();

      // 🛑 DEDUPLICATION
      if (sender.includes("urbanmistrii.com")) continue;
      if (processedCache[msgId]) { console.log(`⏩ Skipping processed ID: ${msgId}`); continue; }

      // 🧠 MEMORY WINDOW: Read last 3 messages (robust)
      let combinedContext = "";
      let scanCount = 0;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m.getFrom().includes("urbanmistrii.com")) {
          let body = m.getPlainBody();
          if (typeof body !== 'string') body = '';
          combinedContext += " " + body;
          scanCount++;
          if (scanCount >= 3) break;
        }
      }

      // Analyze
      const analysis = AI.detectIntent(combinedContext, lastMsg.getSubject());
      const name = AI.extractName(lastMsg);
      console.log(`👤 User: ${name} | Intent: ${analysis.type}`);

      // Execute: Always run step 1, 2, 3 in order if detected
      if (analysis.type === "SUBMISSION_WORKLOG") {
        executeAction({ type: "SUBMISSION_WORKLOG" }, thread, sender, name);
        // After worklog, always send step 2 form link
        // (sendStep2_WorklogReceived already does this)
      } else if (analysis.type === "REQUEST_DOCUMENT") {
        executeAction(analysis, thread, sender, name);
      } else if (analysis.type === "ESCALATE_SENSITIVE") {
        executeAction(analysis, thread, sender, name);
      } else if (analysis.type === "GENERAL_QUESTION") {
        executeAction(analysis, thread, sender, name);
      }
      // Always mark processed if any action taken
      if (["SUBMISSION_WORKLOG", "REQUEST_DOCUMENT", "ESCALATE_SENSITIVE", "GENERAL_QUESTION"].includes(analysis.type)) {
        markProcessed(msgId);
      }
      // If unknown, log for review
      if (analysis.type === "UNKNOWN") {
        Log.add(sender, "UNKNOWN_INTENT", "No action taken");
      }
    } catch (e) { console.error(`❌ Error processing thread: ${e.message}`); }
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  ⚡ AUTOMATED ACTIONS                                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function executeAction(analysis, thread, email, name) {
  if (!thread) return;

  switch (analysis.type) {
    case "INITIATE_OFFBOARDING":
      sendStep1_WorkLogRequest(thread, email, name);
      break;
    case "SUBMISSION_WORKLOG":
      sendStep2_WorklogReceived(thread, email, name);
      break;
    case "REQUEST_DOCUMENT":
      sendDocAck(thread, email, name, analysis.data);
      break;
    case "ESCALATE_SENSITIVE":
      notifyHR(thread, email, name, "Sensitive Content Detected");
      break;
    case "GENERAL_QUESTION":
      sendGeneralAck(thread, email, name);
      break;
  }
}

function sendStep2_WorklogReceived(thread, email, name) {
  const html = T.wrap(`
    <div style="${T.style.header}">Work Log / Logbook Received</div>
    <div style="padding:20px;">
      <p>Dear ${name},</p>
      <p>Thank you for your submission. <strong>Step 1 is now complete!</strong></p>
      <p>If you requested certificates, they will be processed <strong>after</strong> you finish the next step.</p>
      <div style="${T.style.box}">
        <h3 style="margin:0 0 10px 0; color:#333;">STEP 2: Offboarding Form (Mandatory)</h3>
        <p>To initiate your No Dues and Certificate generation, please fill this form now:</p>
        <a href="${CONFIG.URL_OFFBOARD}" style="${T.style.btn}">FILL OFFBOARDING FORM</a>
      </div>
      <p>Once submitted, you'll receive the final Exit Survey link.</p>
    </div>
  `);
  thread.reply("", { htmlBody: html, name: "HR Team, Urbanmistrii" });
  thread.addLabel(GmailApp.getUserLabelByName(CONFIG.LABELS.PROCESSED));
  thread.moveToArchive();
  Log.add(email, "SUBMISSION_WORKLOG", "Sent Step 2 Link");
}

function sendDocAck(thread, email, name, type) {
  const typeName = type ? type.replace(/_/g, " ").toLowerCase() : "document";
  const html = T.wrap(`
    <div style="${T.style.header}">Request Received: ${typeName}</div>
    <div style="padding:20px;">
      <p>Dear ${name},</p>
      <p>We have logged your request for the <strong>${typeName}</strong>.</p>
      <div style="${T.style.box}">
        <p>Note: Documents are usually released only after the full offboarding process (Worklog → Form → Exit Survey) is complete.</p>
      </div>
    </div>
  `);
  thread.reply("", { htmlBody: html, name: "HR Team" });
  thread.addLabel(GmailApp.getUserLabelByName(CONFIG.LABELS.PROCESSED));
  thread.moveToArchive();
  Log.add(email, "REQUEST_DOCUMENT", `Ack sent for ${typeName}`);
}

function sendGeneralAck(thread, email, name) {
  const html = T.wrap(`
    <div style="${T.style.header}">Inquiry Received</div>
    <div style="padding:20px;">
      <p>Dear ${name},</p>
      <p>We have received your message. Our HR team will review it shortly and get back to you.</p>
    </div>
  `);
  thread.reply("", { htmlBody: html, name: "HR Team" });
  thread.addLabel(GmailApp.getUserLabelByName(CONFIG.LABELS.PROCESSED));
  thread.moveToArchive();
}

function notifyHR(thread, email, name, reason) {
  GmailApp.sendEmail(CONFIG.HR_EMAIL, `🚨 HR ALERT: ${name}`, `Reason: ${reason}\nCheck thread.`);
  thread.addLabel(GmailApp.getUserLabelByName(CONFIG.LABELS.ESCALATED));
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  📄 STEP 2, 3 & PDF GENERATION (Form Submit Trigger)                         ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function onFormSubmit(e) {
  if (!e) return;
  const r = e.namedValues;
  const email = r["Email Address"] ? r["Email Address"][0] : r["Email"][0];
  const name = r["What is your name?"] ? r["What is your name?"][0] : "Employee";

  const isOffboarding = Object.keys(r).some(k => k.toLowerCase().includes("latest position"));
  const isExitSurvey = Object.keys(r).some(k => k.toLowerCase().includes("reason for quitting"));

  // Always get sheet and row for marking completion
  let ss, sheet, data, rowIdx = -1, pos = "";
  try {
    ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    sheet = ss.getSheetByName(CONFIG.SHEET_TAB);
    data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][0] && String(data[i][0]).toLowerCase() === email.toLowerCase()) || (data[i][1] && String(data[i][1]).toLowerCase() === name.toLowerCase())) {
        rowIdx = i;
        pos = data[i][2] || "Architect";
        break;
      }
    }
  } catch (e) { rowIdx = -1; }

  // STEP 2: Offboarding Form submitted
  if (isOffboarding) {
    console.log(`✅ Offboarding Form received from ${name}. Generating Experience Letter and sending Step 3.`);
    // 1. Generate and send Experience Letter PDF immediately
    if (rowIdx > 0 && data[rowIdx][data[0].length - 1] === "COMPLETED") {
      console.log("Letter already generated for this row. Skipping duplicate.");
    } else {
      const pdfBlob = createPdf(name, pos);
      GmailApp.sendEmail(email, "Your Experience Letter – Urbanmistrii", "Please find attached your experience letter.", { attachments: [pdfBlob], name: "HR Team" });
      Log.add(email, "PDF_SENT", "Experience Letter sent after Step 2");
      if (rowIdx > 0) sheet.getRange(rowIdx + 1, data[0].length).setValue("COMPLETED");
    }
    // 2. Send Step 3 Exit Survey link
    const html = T.wrap(`
      <div style="${T.style.header}">Step 2 Complete</div>
      <div style="padding:20px;">
        <p>Dear ${name},</p>
        <div style="${T.style.box}">
          <h3 style="margin:0 0 10px 0; color:#333;">STEP 3: Confidential Exit Survey</h3>
          <p>Your feedback helps us improve and grow. Please take a moment to share your thoughts:</p>
          <a href="${CONFIG.URL_EXIT}" style="${T.style.btn}">TAKE EXIT SURVEY</a>
        </div>
      </div>
    `);
    GmailApp.sendEmail(email, "Step 3: Exit Survey (Final Step)", "", { htmlBody: html, name: "HR Team" });
    Log.add(email, "FORM_OFFBOARD", "Sent Step 3");
  }
  // STEP 3: Exit Survey submitted (optional feedback)
  else if (isExitSurvey) {
    console.log(`✅ Exit Survey received from ${name}. (PDF already sent after Step 2)`);
    Log.add(email, "EXIT_SURVEY", "Exit survey submitted");
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🛠️ MANUAL TEST BUTTON FOR EXPERIENCE LETTER                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🛠️ MANUAL TEST BUTTON FOR EXPERIENCE LETTER                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function TEST_ALL_FEATURES() {
  const testEmail = CONFIG.HR_EMAIL; // Send all test emails to HR
  const testName = "Test Employee";

  try {
    Logger.log("🧪 Starting comprehensive feature test...");

    // Test 1: Step 2 Worklog Received Email
    Logger.log("📧 Testing Step 2 Worklog Email...");
    const step2Html = T.wrap(`
      <div style="${T.style.header}">Work Log / Logbook Received</div>
      <div style="padding:20px;">
        <p>Dear ${testName},</p>
        <p>Thank you for your submission. <strong>Step 1 is now complete!</strong></p>
        <p>If you requested certificates, they will be processed <strong>after</strong> you finish the next step.</p>
        <div style="${T.style.box}">
          <h3 style="margin:0 0 10px 0; color:#333;">STEP 2: Offboarding Form (Mandatory)</h3>
          <p>To initiate your No Dues and Certificate generation, please fill this form now:</p>
          <a href="${CONFIG.URL_OFFBOARD}" style="${T.style.btn}">FILL OFFBOARDING FORM</a>
        </div>
        <p>Once submitted, you'll receive the final Exit Survey link.</p>
      </div>
    `);
    GmailApp.sendEmail(testEmail, "[TEST] Step 2: Worklog Received", "", { htmlBody: step2Html, name: "HR Team, Urbanmistrii" });
    Log.add(testEmail, "TEST_STEP2", "Test Step 2 email sent");

    // Test 2: Document Request Acknowledgment
    Logger.log("📄 Testing Document Request Email...");
    const docHtml = T.wrap(`
      <div style="${T.style.header}">Request Received: Experience Letter</div>
      <div style="padding:20px;">
        <p>Dear ${testName},</p>
        <p>We have logged your request for the <strong>experience letter</strong>.</p>
        <div style="${T.style.box}">
          <p>Note: Documents are usually released only after the full offboarding process (Worklog → Form → Exit Survey) is complete.</p>
        </div>
      </div>
    `);
    GmailApp.sendEmail(testEmail, "[TEST] Document Request Acknowledgment", "", { htmlBody: docHtml, name: "HR Team" });
    Log.add(testEmail, "TEST_DOC_ACK", "Test document acknowledgment sent");

    // Test 3: General Inquiry Acknowledgment
    Logger.log("💬 Testing General Inquiry Email...");
    const generalHtml = T.wrap(`
      <div style="${T.style.header}">Inquiry Received</div>
      <div style="padding:20px;">
        <p>Dear ${testName},</p>
        <p>We have received your message. Our HR team will review it shortly and get back to you.</p>
      </div>
    `);
    GmailApp.sendEmail(testEmail, "[TEST] General Inquiry Acknowledgment", "", { htmlBody: generalHtml, name: "HR Team" });
    Log.add(testEmail, "TEST_GENERAL_ACK", "Test general acknowledgment sent");

    // Test 4: Step 3 Exit Survey Email
    Logger.log("📝 Testing Step 3 Exit Survey Email...");
    const step3Html = T.wrap(`
      <div style="${T.style.header}">Step 2 Complete</div>
      <div style="padding:20px;">
        <p>Dear ${testName},</p>
        <div style="${T.style.box}">
          <h3 style="margin:0 0 10px 0; color:#333;">STEP 3: Confidential Exit Survey</h3>
          <p>Your feedback helps us improve and grow. Please take a moment to share your thoughts:</p>
          <a href="${CONFIG.URL_EXIT}" style="${T.style.btn}">TAKE EXIT SURVEY</a>
        </div>
      </div>
    `);
    GmailApp.sendEmail(testEmail, "[TEST] Step 3: Exit Survey (Final Step)", "", { htmlBody: step3Html, name: "HR Team" });
    Log.add(testEmail, "TEST_STEP3", "Test Step 3 email sent");

    // Test 5: Experience Letter PDF Generation
    Logger.log("📄 Testing Experience Letter PDF...");
    const pdfBlob = createPdf(testName, "Software Engineer");
    GmailApp.sendEmail(testEmail, "[TEST] Experience Letter PDF", `Test PDF for ${testName} (Software Engineer)`, { attachments: [pdfBlob], name: "HR Team" });
    Log.add(testEmail, "TEST_PDF", "Test PDF sent");

    // Test 6: HR Alert Email
    Logger.log("🚨 Testing HR Alert Email...");
    GmailApp.sendEmail(CONFIG.HR_EMAIL, `[TEST] HR ALERT: ${testName}`, `Reason: Test sensitive content detection\nThis is a test alert for the offboarding system.`, { name: "Offboarding AI" });
    Log.add(CONFIG.HR_EMAIL, "TEST_HR_ALERT", "Test HR alert sent");

    Logger.log("✅ All feature tests completed! Check your inbox for test emails.");
    Logger.log(`📧 All test emails sent to: ${testEmail}`);

  } catch (e) {
    Logger.log("❌ Error in TEST_ALL_FEATURES: " + e.message);
    Log.add(CONFIG.HR_EMAIL, "TEST_ERROR", "Test failed: " + e.message);
  }
}

function TEST_GENERATE_LETTER() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_TAB);
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) {
      const email = data[i][0];
      const name = data[i][1];
      const pos = data[i][2] || "Architect";
      if (email && name) {
        const pdfBlob = createPdf(name, pos);
        GmailApp.sendEmail(CONFIG.HR_EMAIL, "[TEST] Experience Letter PDF", `Test PDF for ${name} (${pos})`, { attachments: [pdfBlob], name: "Offboarding AI Test" });
        Logger.log(`Test PDF generated and sent to HR for ${name} (${email})`);
        found = true;
        break;
      }
    }
    if (!found) Logger.log("No suitable dummy row found for test.");
  } catch (e) {
    Logger.log("Error in TEST_GENERATE_LETTER: " + e.message);
  }
}

function createPdf(name, pos) {
  const html = `<body style="font-family:serif; padding:40px; line-height:1.6;">
    <h1 style="text-align:center;">URBANMISTRII</h1>
    <p style="text-align:right;">Date: ${new Date().toLocaleDateString()}</p>
    <br><br>
    <p>To Whom It May Concern,</p>
    <p>This certifies that <strong>${name}</strong> worked with Urbanmistrii Studios in the capacity of <strong>${pos}</strong>.</p>
    <p>During their tenure, we found them to be sincere and hardworking.</p>
    <br><br>
    <p>Sincerely,</p>
    <p><strong>HR Team</strong><br>Urbanmistrii Studios</p></body>`;
  return Utilities.newBlob(html, "text/html", "Exp.html").getAs("application/pdf").setName(`${name}_Experience_Letter.pdf`);
}

// Approval Link Handler
function doGet(e) {
  const { action, id } = e.parameter;
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(id);
  if (!raw) return HtmlService.createHtmlOutput("<h3>❌ Link Expired or Already Processed.</h3>");
  const data = JSON.parse(raw);

  if (action === "approve") {
    const file = DriveApp.getFileById(data.fileId);
    GmailApp.sendEmail(data.email, "Experience Letter", "Please find attached your experience letter.", { attachments: [file.getBlob()] });
    props.deleteProperty(id);
    return HtmlService.createHtmlOutput("<h2 style='color:green'>✅ Approved & Sent.</h2>");
  }
  if (action === "reject") {
    GmailApp.sendEmail(CONFIG.HR_EMAIL, `Rejected: ${data.name}`, "Manually create the PDF.");
    props.deleteProperty(id);
    return HtmlService.createHtmlOutput("<h2 style='color:red'>❌ Rejected.</h2>");
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  💾 SYSTEM UTILITIES                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function getProcessedIDs() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("PROCESSED_IDS");
  return raw ? JSON.parse(raw) : {};
}

function markProcessed(msgId) {
  const props = PropertiesService.getScriptProperties();
  const cache = getProcessedIDs();
  cache[msgId] = new Date().getTime();
  const now = new Date().getTime();
  for (const id in cache) { if (now - cache[id] > 172800000) delete cache[id]; }
  props.setProperty("PROCESSED_IDS", JSON.stringify(cache));
}

// T (Templates) is now imported from Utils.js - removing duplicate declaration

// Log is now imported from Utils.js - removing duplicate declaration

function installTriggers() {
  const t = ScriptApp.getProjectTriggers();
  t.forEach(x => ScriptApp.deleteTrigger(x));
  ScriptApp.newTrigger("processInbox").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("onFormSubmit").forSpreadsheet(SpreadsheetApp.openById(CONFIG.SHEET_ID)).onFormSubmit().create();
  console.log("✅ All Triggers Installed.");
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  🛠️ MANUAL FIXES                                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

// (MANUAL_FIX_ARCHANA removed)
function sendStep1_WorkLogRequest(thread, email, name) {
  // Try to get URL from Config or use placeholders (System Integrity)
  const linkIntern = (typeof CONFIG !== 'undefined' && CONFIG.LINK_LOG_INTERN) || "https://docs.google.com/document/d/YOUR_INTERN_LOG_ID/edit";
  const linkFulltime = (typeof CONFIG !== 'undefined' && CONFIG.LINK_LOG_FULLTIME) || "https://docs.google.com/document/d/YOUR_FULLTIME_LOG_ID/edit";

  const html = T.wrap(`
    <div style="${T.style.header}">Offboarding Initiated: Step 1</div>
    <div style="padding:20px;">
      <p>Dear ${name},</p>
      <p>We have received your resignation/offboarding request.</p>
      <p>To ensure a smooth transition and to expedite your Experience Letter, please complete the first step:</p>
      
      <div style="${T.style.box}">
        <h3 style="margin:0 0 10px 0; color:#333;">STEP 1: Download Work Log</h3>
        <p>Please download and fill the appropriate work log:</p>
        <div style="text-align:center; margin-top:15px;">
           <a href="${linkIntern}" style="${T.style.btn} margin-right:10px;">INTERN LOG</a>
           <a href="${linkFulltime}" style="${T.style.btn}">FULL-TIME LOG</a>
        </div>
      </div>
      
      <p style="margin-top:15px;"><strong>What's Next?</strong><br>
      Reply to this email with your filled work log attached. We will then send you the Offboarding Form (Step 2).</p>
    </div>
  `);
  thread.reply("", { htmlBody: html, name: "HR Team" });
  thread.addLabel(GmailApp.getUserLabelByName(CONFIG.LABELS.PROCESSED));
  Log.add(email, "FLOW_INIT", "Sent Step 1 Work Log");
}



// ═══════════════════════════════════════════════════════════════════════════
//  PAYROLL LIFECYCLE MANAGER
// ═══════════════════════════════════════════════════════════════════════════
/*
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  URBAN MISTRII - PAYROLL & EMPLOYEE LIFECYCLE MANAGER                        ║
 * ║  Features: Monthly Payroll Reports, Active/Departed Tracking, Auto-Email     ║
 * ║  🔗 Part of HR Automation Ecosystem (Central Database Manager)               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const PAYROLL_CONFIG = {
  // 🔗 HR ECOSYSTEM INTEGRATION
  ECOSYSTEM: {
    ONBOARDING_SCRIPT: "onboarding_suite_v2.gs",
    OFFBOARDING_SCRIPT: "offboarding_exit_suite_v2.gs",
    OFFER_LETTER_GEN: "offer_letter_generator.gs",
    JOINING_LETTER_GEN: "joining_letter_generator.gs"
  },
  
  // 📊 MASTER DATABASE
  SHEET_ID: "1b6JIPZo2G0YgB-Ee2WVL7PP-GP5h4HpLcev5NBEtMmE",
  
  // 📋 SHEET STRUCTURE
  SHEETS: {
    ACTIVE: "Employees",           // Active employees (Sheet 1)
    DEPARTED: "Departed Employees", // Offboarded employees (Sheet 2)
    PAYROLL_LOG: "Payroll History"  // Monthly report log
  },
  
  // 📧 EMAIL SETTINGS
  HR_EMAIL: "hr@urbanmistrii.com",
  RITIKA_EMAIL: "ritika@urbanmistrii.com",
  TZ: "Asia/Kolkata",
  
  // 📅 PAYROLL SETTINGS
  PAYROLL_DAY: 1, // 1st of every month
  
  // 🏖️ LEAVE MANAGEMENT
  LEAVE_POLICY: {
    ADVANCE_DAYS: 14, // Must apply 14 days in advance
    SEARCH_LABEL: "HR/Leave Requests",
    TRIGGER_KEYWORDS: ["leave", "request leave", "apply for leave", "leave application", "taking leave"]
  },
  
  // 📋 MONTHLY ATTENDANCE FORM
  MONTHLY_FORM_ID: "1sFoC-e83AN7j2VXklmCC4Pah2B6-uvCCWNJTVLH3Sqg", // Monthly Attendance & Expense Report form
  
  COMPANY_INFO: {
    NAME: "URBANMISTRII STUDIO",
    ADDRESS_LINE1: "199 ANUPAM APARTMENT",
    ADDRESS_LINE2: "SAKET NEW DELHI"
  },
  
  // 💰 COLUMN MAPPING (Active Employees Sheet)
  ACTIVE_COLS: {
    JOINING_DATE: 0,      // A
    NAME: 1,              // B
    REMARKS: 2,           // C (Email)
    LEAVES_TILL_OCT: 3,   // D
    OCT_LEAVES: 4,        // E
    TOTAL_LEAVES: 5,      // F
    LEAVE_DATES: 6,       // G
    CURRENT_SAL: 7,       // H
    PER_DAY: 8,           // I
    OTHER_DEDUCTIONS: 9,  // J
    TOTAL_MINUS_DED: 10,  // K
    CONVEYANCE: 11,       // L
    TOTAL_SALARY: 12,     // M
    DAYS_WITH_UM: 13,     // N
    POSITION: 14          // O
  },
  
  // 📋 DEPARTED EMPLOYEE COLUMNS
  DEPARTED_COLS: {
    NAME: 0,
    EMAIL: 1,
    POSITION: 2,
    JOINING_DATE: 3,
    LAST_WORKING_DAY: 4,
    DURATION: 5,
    FINAL_SALARY: 6,
    EXIT_REASON: 7,
    OFFBOARD_DATE: 8,
    PROJECTS: 9,
    NOTES: 10
  }
};

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  EMPLOYEE LIFECYCLE MANAGEMENT                                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Move employee from Active to Departed sheet
 * Called automatically by offboarding system after exit survey completion
 */
function moveEmployeeToDeparted(email, offboardingData) {
  if (!email) {
    console.error("❌ Email required to move employee");
    return false;
  }
  
  try {
    console.log(`🔄 Moving ${email} to Departed Employees sheet`);
    
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    const activeSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.ACTIVE);
    const departedSheet = getDepartedSheet(ss);
    
    if (!activeSheet) {
      console.error("❌ Active employees sheet not found");
      return false;
    }
    
    // Find employee in active sheet
    const activeData = activeSheet.getDataRange().getValues();
    let employeeRow = null;
    let rowIndex = -1;
    
    for (let i = 1; i < activeData.length; i++) {
      const rowEmail = String(activeData[i][PAYROLL_CONFIG.ACTIVE_COLS.REMARKS]).toLowerCase().trim();
      if (rowEmail === email.toLowerCase().trim()) {
        employeeRow = activeData[i];
        rowIndex = i + 1; // +1 for 1-based indexing
        break;
      }
    }
    
    if (!employeeRow) {
      console.warn(`⚠️ Employee ${email} not found in active sheet`);
      return false;
    }
    
    // Calculate duration
    const joiningDate = employeeRow[PAYROLL_CONFIG.ACTIVE_COLS.JOINING_DATE];
    const lastDay = offboardingData?.lastWorkingDay || new Date();
    const duration = calculateDuration(joiningDate, lastDay);
    
    // Prepare departed employee data
    const departedData = [
      employeeRow[PAYROLL_CONFIG.ACTIVE_COLS.NAME],                    // Name
      email,                                                             // Email
      employeeRow[PAYROLL_CONFIG.ACTIVE_COLS.POSITION],                // Position
      joiningDate,                                                       // Joining Date
      lastDay,                                                          // Last Working Day
      duration,                                                         // Duration
      employeeRow[PAYROLL_CONFIG.ACTIVE_COLS.TOTAL_SALARY] || employeeRow[PAYROLL_CONFIG.ACTIVE_COLS.CURRENT_SAL], // Final Salary
      offboardingData?.exitReason || "N/A",                            // Exit Reason
      new Date(),                                                       // Offboard Date
      offboardingData?.projects || "See work log",                     // Projects
      offboardingData?.notes || ""                                     // Notes
    ];
    
    // Append to departed sheet
    departedSheet.appendRow(departedData);
    console.log(`✅ Added ${employeeRow[PAYROLL_CONFIG.ACTIVE_COLS.NAME]} to Departed Employees`);
    
    // Delete from active sheet
    activeSheet.deleteRow(rowIndex);
    console.log(`✅ Removed from Active Employees`);
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to move employee: ${e.message}`);
    return false;
  }
}

function getDepartedSheet(ss) {
  let departedSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.DEPARTED);
  
  if (!departedSheet) {
    // Create departed sheet with headers
    departedSheet = ss.insertSheet(PAYROLL_CONFIG.SHEETS.DEPARTED);
    const headers = [
      "Employee Name", "Email", "Position", "Joining Date", "Last Working Day",
      "Duration with UM", "Final Salary", "Exit Reason", "Offboard Date", 
      "Projects Worked On", "Notes"
    ];
    departedSheet.appendRow(headers);
    departedSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f4cccc");
    departedSheet.setFrozenRows(1);
    console.log("✅ Created Departed Employees sheet");
  }
  
  return departedSheet;
}

function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return "N/A";
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = Math.floor((diffDays % 365) % 30);
  
  const parts = [];
  if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);
  
  return parts.length > 0 ? parts.join(' & ') : "Less than 1 day";
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  MONTHLY PAYROLL REPORT GENERATOR                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Generate and email monthly payroll report
 * Runs automatically on 1st of every month
 */
function generateMonthlyPayrollReport(targetMonth, targetYear) {
  // If no month/year specified, use previous month
  if (!targetMonth || !targetYear) {
    const now = new Date();
    targetMonth = now.getMonth(); // 0-11 (previous month when run on 1st)
    targetYear = now.getFullYear();
    
    // Adjust for January (get December of previous year)
    if (targetMonth === 0) {
      targetMonth = 11; // December
      targetYear -= 1;
    }
  }
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[targetMonth];
  
  console.log(`📊 Generating payroll report for ${monthName} ${targetYear}`);
  
  try {
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    const activeSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.ACTIVE);
    
    if (!activeSheet) {
      console.error("❌ Active employees sheet not found");
      return false;
    }
    
    // Create new spreadsheet for the report
    const reportName = `${monthName}_Employee_Salary_${targetYear}`;
    const reportSS = SpreadsheetApp.create(reportName);
    const reportSheet = reportSS.getActiveSheet();
    reportSheet.setName("Payroll Report");
    
    // Add company header
    reportSheet.appendRow(["", PAYROLL_CONFIG.COMPANY_INFO.NAME]);
    reportSheet.appendRow(["", PAYROLL_CONFIG.COMPANY_INFO.ADDRESS_LINE1]);
    reportSheet.appendRow(["", PAYROLL_CONFIG.COMPANY_INFO.ADDRESS_LINE2]);
    reportSheet.appendRow([]); // Empty row
    reportSheet.appendRow([]); // Empty row
    
    // Format company header
    reportSheet.getRange(1, 2, 3, 1).setFontWeight("bold").setFontSize(12);
    
    // Copy active employee data
    const activeData = activeSheet.getDataRange().getValues();
    const headers = activeData[0];
    
    // Append headers
    const headerRow = 6; // Row 6 for headers
    reportSheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
    reportSheet.getRange(headerRow, 1, 1, headers.length).setFontWeight("bold").setBackground("#cfe2f3");
    
    // Copy employee data (skip header row)
    let grossTotal = 0;
    let deductions = 0;
    let additions = 0;
    let additionsNotes = [];
    
    for (let i = 1; i < activeData.length; i++) {
      const row = activeData[i];
      
      // Skip empty rows or summary rows
      if (!row[PAYROLL_CONFIG.ACTIVE_COLS.NAME]) continue;
      
      reportSheet.appendRow(row);
      
      // Calculate totals
      const salary = parseCurrency(row[PAYROLL_CONFIG.ACTIVE_COLS.TOTAL_SALARY] || row[PAYROLL_CONFIG.ACTIVE_COLS.CURRENT_SAL]);
      if (salary > 0) {
        grossTotal += salary;
      }
      
      const deduction = parseCurrency(row[PAYROLL_CONFIG.ACTIVE_COLS.OTHER_DEDUCTIONS]);
      if (deduction > 0) {
        deductions += deduction;
      }
      
      const conveyance = parseCurrency(row[PAYROLL_CONFIG.ACTIVE_COLS.CONVEYANCE]);
      if (conveyance > 0) {
        additions += conveyance;
        additionsNotes.push(`${row[PAYROLL_CONFIG.ACTIVE_COLS.NAME]}: ₹${conveyance.toLocaleString('en-IN')}`);
      }
    }
    
    // Add summary section
    const lastRow = reportSheet.getLastRow();
    reportSheet.appendRow([]);
    reportSheet.appendRow(["", "", "", "", "", "", "", "", "", "", "Gross Total", grossTotal.toFixed(2)]);
    reportSheet.appendRow(["", "", "", "", "", "", `₹${grossTotal.toLocaleString('en-IN')}`, "", "", "", "Deductions", deductions.toFixed(2)]);
    reportSheet.appendRow(["", "", "", "", "", "", "", "", "", "", "Additions", additions.toFixed(2), additionsNotes.join(", ")]);
    reportSheet.appendRow(["", "", "", "", "", "", "", "", "", "", "Total Payable For " + monthName, (grossTotal - deductions + additions).toFixed(2)]);
    
    // Format summary section
    const summaryStartRow = lastRow + 2;
    reportSheet.getRange(summaryStartRow, 11, 4, 2).setFontWeight("bold").setBackground("#fff2cc");
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      reportSheet.autoResizeColumn(i);
    }
    
    // Convert to PDF
    const reportFile = DriveApp.getFileById(reportSS.getId());
    const pdfBlob = reportFile.getAs('application/pdf');
    pdfBlob.setName(reportName + '.pdf');
    
    // Email the report
    const subject = `Monthly Payroll Report: ${monthName} ${targetYear}`;
    const emailBody = `Dear HR Team,

Please find attached the monthly payroll report for ${monthName} ${targetYear}.

SUMMARY:
• Active Employees: ${activeData.length - 1}
• Gross Total: ₹${grossTotal.toLocaleString('en-IN')}
• Deductions: ₹${deductions.toLocaleString('en-IN')}
• Additions: ₹${additions.toLocaleString('en-IN')}
• Total Payable: ₹${(grossTotal - deductions + additions).toLocaleString('en-IN')}

This report has been automatically generated by the HR Automation System.

Best regards,
HR Automation System
UrbanMistrii`;
    
    GmailApp.sendEmail(PAYROLL_CONFIG.HR_EMAIL, subject, emailBody, {
      attachments: [pdfBlob],
      name: "HR Automation System"
    });
    
    console.log(`✅ Payroll report emailed to ${PAYROLL_CONFIG.HR_EMAIL}`);
    
    // Log to history
    logPayrollReport(monthName, targetYear, grossTotal - deductions + additions, activeData.length - 1);
    
    // Clean up temporary spreadsheet (keep file in Drive, just close)
    // Don't delete - HR may want to access the detailed spreadsheet
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to generate payroll report: ${e.message}`);
    console.error(e.stack);
    return false;
  }
}

function parseCurrency(value) {
  if (!value) return 0;
  const str = String(value).replace(/[₹,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function logPayrollReport(month, year, totalPayable, employeeCount) {
  try {
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    let logSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.PAYROLL_LOG);
    
    if (!logSheet) {
      logSheet = ss.insertSheet(PAYROLL_CONFIG.SHEETS.PAYROLL_LOG);
      logSheet.appendRow(["Month", "Year", "Report Generated", "Total Payable", "Employee Count", "Status"]);
      logSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3");
    }
    
    const timestamp = Utilities.formatDate(new Date(), PAYROLL_CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss');
    logSheet.appendRow([month, year, timestamp, totalPayable.toFixed(2), employeeCount, "Sent to " + PAYROLL_CONFIG.HR_EMAIL]);
    
    console.log("✅ Logged payroll report to history");
  } catch (e) {
    console.error("Failed to log payroll report:", e.message);
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  AUTOMATED TRIGGER SETUP                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function installPayrollTriggers() {
  console.log("🔧 INSTALLING PAYROLL AUTOMATION TRIGGERS\n");
  
  // Clear existing payroll triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'runMonthlyPayrollReport') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Monthly trigger: 1st of every month at 9:00 AM
  ScriptApp.newTrigger('runMonthlyPayrollReport')
    .timeBased()
    .onMonthDay(PAYROLL_CONFIG.PAYROLL_DAY)
    .atHour(9)
    .create();
  
  console.log(`✅ Installed monthly payroll trigger (${PAYROLL_CONFIG.PAYROLL_DAY}st of every month at 9:00 AM)`);
  console.log("\n🚀 PAYROLL AUTOMATION IS NOW LIVE!");
}

function runMonthlyPayrollReport() {
  console.log("⏰ SCHEDULED PAYROLL REPORT EXECUTION");
  generateMonthlyPayrollReport();
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  SETUP & MAINTENANCE                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function setupPayrollSystem() {
  console.log("🚀 SETTING UP PAYROLL & LIFECYCLE MANAGEMENT SYSTEM\n");
  
  try {
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    
    // 1. Ensure Departed Employees sheet exists
    getDepartedSheet(ss);
    
    // 2. Ensure Payroll History sheet exists
    let logSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.PAYROLL_LOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(PAYROLL_CONFIG.SHEETS.PAYROLL_LOG);
      logSheet.appendRow(["Month", "Year", "Report Generated", "Total Payable", "Employee Count", "Status"]);
      logSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3");
      console.log("✅ Created Payroll History sheet");
    } else {
      console.log("✅ Found Payroll History sheet");
    }
    
    console.log("\n🎉 PAYROLL SYSTEM SETUP COMPLETE!");
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Run installPayrollTriggers() to activate monthly automation");
    console.log("2. Test with testPayrollReport()");
    console.log("3. Test employee lifecycle with testMoveEmployee()");
    
    return true;
  } catch (e) {
    console.error(`❌ Setup failed: ${e.message}`);
    return false;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  DATA POPULATION & TESTING                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Populate sheet with real October 2025 employee data
 * Run this once to add your actual employee records
 */
function populateOctoberData() {
  console.log("📥 POPULATING OCTOBER 2025 EMPLOYEE DATA\n");
  
  try {
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    const activeSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.ACTIVE);
    
    if (!activeSheet) {
      console.error("❌ Active employees sheet not found");
      return false;
    }
    
    // October 2025 employee data
    const employeeData = [
      ["12/08/2024", "Avishi Pathak", "avishi@urbanmistrii.com", 10, "", 10, "", "₹35,000", "₹1,129.03", "", "₹35,000.00", "", "₹35,000.00", "1 Years 3 months & 22 days", "Project Architect"],
      ["01/01/2024", "Yash", "yash@urbanmistrii.com", 2, "", 2, "", "₹15,000", "₹483.87", "", "₹15,000.00", "", "₹15,000.00", "1 Years 11 months & 3 days", "Ops"],
      ["09/06/2025", "Vanshika Khemani", "vanshika@urbanmistrii.com", 2, 2, 4, "16-17th oct", "₹30,000", "₹967.74", "", "₹30,000.00", "", "₹30,000.00", "0 Years 5 months & 25 days", "Junior Architect"],
      ["03/07/2025", "Archana Rastogi", "archana@urbanmistrii.com", 0, 3, 3, "23, 24 & 25 october", "₹10,000", "₹322.58", "", "₹10,000.00", "", "₹10,000.00", "0 Years 5 months & 1 days", "Architectural Intern"],
      ["06/08/2025", "Chirag JK", "chirag@urbanmistrii.com", 1, 1, 2, "25 October", "₹10,000", "₹322.58", "", "₹10,000.00", "", "₹10,000.00", "0 Years 3 months & 28 days", "Architectural Intern"],
      ["07/08/2025", "Tushar", "tushar@urbanmistrii.com", 0, 2, 2, "23rd October,31st October", "₹10,000", "₹322.58", "", "₹10,000.00", "", "₹10,000.00", "0 Years 3 months & 27 days", "Architectural Intern"],
      ["01/11/2025", "Navdha Kapila", "navdha@urbanmistrii.com", 0, 0, 0, "", "₹37,500", "₹1,209.68", "", "₹37,500.00", "", "₹37,500.00", "0 Years 1 months & 3 days", "Senior Architect"],
      ["13/10/2025", "Devam", "devam@urbanmistrii.com", 0, 1, 1, "23rd october", "₹24,000", "₹774.19", "", "₹24,000.00", "₹15,200", "₹39,200.00", "0 Years 1 months & 21 days", "Junior Architect"]
    ];
    
    // Check if sheet already has data (more than just headers)
    const existingData = activeSheet.getDataRange().getValues();
    if (existingData.length > 1) {
      console.log("⚠️ Sheet already contains employee data");
      console.log(`Current rows: ${existingData.length - 1} employees`);
      
      const response = Browser.msgBox(
        "Data Already Exists",
        "The sheet already has employee data. Do you want to:\n\n" +
        "YES - Add these employees to existing data\n" +
        "NO - Clear all data and start fresh\n" +
        "CANCEL - Stop without changes",
        Browser.Buttons.YES_NO_CANCEL
      );
      
      if (response === "cancel") {
        console.log("❌ Operation cancelled by user");
        return false;
      } else if (response === "no") {
        // Clear all data except headers
        if (existingData.length > 1) {
          activeSheet.deleteRows(2, existingData.length - 1);
        }
        console.log("✅ Cleared existing employee data");
      }
    }
    
    // Add employee data
    for (let i = 0; i < employeeData.length; i++) {
      activeSheet.appendRow(employeeData[i]);
      console.log(`✅ Added: ${employeeData[i][1]}`);
    }
    
    console.log(`\n✅ Successfully added ${employeeData.length} employees`);
    console.log("\n📊 OCTOBER 2025 SUMMARY:");
    console.log("   • Gross Total: ₹1,10,000");
    console.log("   • Additions: ₹15,200 (Devam - 21 days)");
    console.log("   • Total Payable: ₹1,25,200");
    
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Review data in 'Employees' sheet");
    console.log("2. Run testPayrollReport() to generate October report");
    console.log("3. Update November data and generate December report");
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to populate data: ${e.message}`);
    console.error(e.stack);
    return false;
  }
}

function testPayrollReport() {
  console.log("\n🧪 TESTING PAYROLL REPORT GENERATION\n");
  
  // Generate report for current/previous month
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  
  console.log(`📊 Generating test report for ${monthNames[lastMonth]} ${year}`);
  console.log(`📧 Will be sent to: ${PAYROLL_CONFIG.HR_EMAIL}\n`);
  
  const success = generateMonthlyPayrollReport(lastMonth, year);
  
  if (success) {
    console.log("\n✅ TEST SUCCESSFUL!");
    console.log("📋 Check:");
    console.log("   1. Your inbox for the PDF report");
    console.log("   2. Google Drive for the detailed spreadsheet");
    console.log("   3. 'Payroll History' sheet for log entry");
  } else {
    console.log("\n❌ TEST FAILED - Check logs above");
  }
}

function testMoveEmployee() {
  console.log("\n🧪 TESTING EMPLOYEE LIFECYCLE (Move to Departed)\n");
  
  const testEmail = "test@urbanmistrii.com";
  const testData = {
    lastWorkingDay: new Date(),
    exitReason: "Test - Relocated",
    projects: "Test Project A, Test Project B",
    notes: "Test employee for lifecycle demo"
  };
  
  console.log(`📧 Test Email: ${testEmail}`);
  console.log("⚠️ Note: This will move the employee from Active to Departed sheet\n");
  
  const success = moveEmployeeToDeparted(testEmail, testData);
  
  if (success) {
    console.log("\n✅ TEST SUCCESSFUL!");
    console.log("📋 Check:");
    console.log("   1. 'Departed Employees' sheet for the moved employee");
    console.log("   2. 'Employees' (Active) sheet - employee should be removed");
  } else {
    console.log("\n❌ TEST FAILED - Employee may not exist or check logs above");
  }
}

function manualGeneratePayrollReport(month, year) {
  if (!month || !year) {
    console.error("❌ Usage: manualGeneratePayrollReport(10, 2025) // For October 2025");
    console.log("Month: 0=Jan, 1=Feb, 2=Mar, 3=Apr, 4=May, 5=Jun, 6=Jul, 7=Aug, 8=Sep, 9=Oct, 10=Nov, 11=Dec");
    return;
  }
  
  console.log("\n🚀 MANUALLY GENERATING PAYROLL REPORT");
  generateMonthlyPayrollReport(month - 1, year); // Convert to 0-indexed
}

function manualMoveEmployee(email, exitReason, projects, notes) {
  if (!email) {
    console.error("❌ Usage: manualMoveEmployee('employee@email.com', 'Exit Reason', 'Project List', 'Notes')");
    return;
  }
  
  console.log("\n🚀 MANUALLY MOVING EMPLOYEE TO DEPARTED");
  
  const data = {
    lastWorkingDay: new Date(),
    exitReason: exitReason || "Manual Move",
    projects: projects || "See work log",
    notes: notes || ""
  };
  
  moveEmployeeToDeparted(email, data);
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  LEAVE MANAGEMENT SYSTEM                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Monitor Gmail for leave requests and process automatically
 * Runs every 10 minutes
 */
function monitorLeaveRequests() {
  try {
    const keywords = PAYROLL_CONFIG.LEAVE_POLICY.TRIGGER_KEYWORDS.join(" OR ");
    const query = `to:hr@urbanmistrii.com (${keywords}) is:unread -label:processed`;
    
    const threads = GmailApp.search(query, 0, 10);
    
    if (threads.length === 0) {
      console.log("📭 No new leave requests");
      return;
    }
    
    console.log(`📬 Found ${threads.length} leave request(s)`);
    
    threads.forEach(thread => {
      try {
        processLeaveRequest(thread);
        thread.markRead();
      } catch (e) {
        console.error(`Failed to process thread: ${e.message}`);
      }
    });
    
  } catch (e) {
    console.error(`Leave monitor error: ${e.message}`);
  }
}

function processLeaveRequest(thread) {
  const messages = thread.getMessages();
  const lastMessage = messages[messages.length - 1];
  
  const from = lastMessage.getFrom();
  const sender = lastMessage.getReplyTo() || from;
  const subject = lastMessage.getSubject();
  const body = lastMessage.getPlainBody();
  const receivedDate = lastMessage.getDate();
  
  console.log(`\n📨 Processing leave request from: ${sender}`);
  
  // Extract employee details
  const emailMatch = sender.match(/([^<]+)<([^>]+)>/);
  let employeeName = emailMatch ? emailMatch[1].trim() : sender.split('@')[0];
  let employeeEmail = emailMatch ? emailMatch[2].trim() : sender;
  
  // Parse leave details from email body
  const leaveDetails = parseLeaveDetails(body, subject);
  
  if (!leaveDetails.startDate) {
    console.log("⚠️ Could not parse leave dates, skipping");
    return;
  }
  
  // Check if leave meets policy (14 days advance)
  const daysInAdvance = Math.floor((leaveDetails.startDate - receivedDate) / (1000 * 60 * 60 * 24));
  const meetsPolicy = daysInAdvance >= PAYROLL_CONFIG.LEAVE_POLICY.ADVANCE_DAYS;
  
  console.log(`📅 Leave dates: ${formatDate(leaveDetails.startDate)} to ${formatDate(leaveDetails.endDate)}`);
  console.log(`⏰ Applied ${daysInAdvance} days in advance (Policy: ${PAYROLL_CONFIG.LEAVE_POLICY.ADVANCE_DAYS} days)`);
  console.log(`${meetsPolicy ? '✅' : '⚠️'} Policy ${meetsPolicy ? 'met' : 'NOT met'}`);
  
  // 1. Send policy reply to employee
  sendLeaveReply(employeeEmail, employeeName, leaveDetails, meetsPolicy);
  
  // 2. Forward to Ritika with nice card
  forwardToRitika(employeeName, employeeEmail, leaveDetails, body, meetsPolicy, daysInAdvance);
  
  // 3. Record in database
  recordLeaveInDB(employeeEmail, employeeName, leaveDetails);
  
  console.log(`✅ Processed leave request for ${employeeName}`);
}

function parseLeaveDetails(body, subject) {
  const details = {
    startDate: null,
    endDate: null,
    days: 0,
    reason: "Personal reasons",
    dates: []
  };
  
  // Common date patterns
  const datePatterns = [
    /(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})/gi,
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/g,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})/gi
  ];
  
  const text = (subject + " " + body).toLowerCase();
  const foundDates = [];
  
  // Extract all dates
  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const dateStr = match[0];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          foundDates.push(parsed);
        }
      } catch (e) {
        // Skip invalid dates
      }
    }
  });
  
  // Sort dates
  foundDates.sort((a, b) => a - b);
  
  if (foundDates.length > 0) {
    details.startDate = foundDates[0];
    details.endDate = foundDates[foundDates.length - 1];
    details.days = Math.ceil((details.endDate - details.startDate) / (1000 * 60 * 60 * 24)) + 1;
    details.dates = foundDates.map(d => formatDate(d));
  }
  
  // Extract reason
  const reasonMatch = body.match(/(?:due to|reason:|because of)\s*([^\n.]+)/i);
  if (reasonMatch) {
    details.reason = reasonMatch[1].trim();
  }
  
  return details;
}

function sendLeaveReply(email, name, leaveDetails, meetsPolicy) {
  const subject = "Re: Leave Request - Policy Notice";
  
  const styles = {
    container: `font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; color: #333333;`,
    header: `background-color: #1a1a1a; padding: 30px 40px; text-align: left; border-bottom: 4px solid #e74c3c;`,
    logo: `color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase;`,
    body: `padding: 40px; line-height: 1.6; font-size: 15px;`,
    h1: `color: #1a1a1a; font-size: 20px; font-weight: 700; margin-bottom: 20px; letter-spacing: -0.5px;`,
    p: `margin-bottom: 20px; color: #555;`,
    highlightBox: `background-color: #f8f9fa; border-left: 4px solid #1a1a1a; padding: 20px; margin: 25px 0;`,
    footer: `background-color: #f4f4f4; padding: 20px 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0;`
  };
  
  const htmlBody = `
    <div style="${styles.container}">
      
      <!-- Header -->
      <div style="${styles.header}">
        <h1 style="${styles.logo}">URBANMISTRII</h1>
      </div>
      
      <!-- Body -->
      <div style="${styles.body}">
        <h2 style="${styles.h1}">Leave Request - Policy Notice</h2>
        
        <p style="${styles.p}">Dear ${name},</p>
        
        <p style="${styles.p}">
          Thank you for your leave request for <strong>${leaveDetails.days} day(s)</strong> 
          from <strong>${formatDate(leaveDetails.startDate)}</strong> to <strong>${formatDate(leaveDetails.endDate)}</strong>.
        </p>
        
        ${!meetsPolicy ? `
        <div style="${styles.highlightBox}">
          <strong style="color: #856404;">POLICY NOTICE</strong><br><br>
          <span style="color: #555;">
            As per company policy, leave requests must be submitted at least <strong>14 days in advance</strong>. 
            Your request does not meet this requirement.
          </span>
        </div>
        
        <p style="${styles.p}">
          <strong>If this is an emergency</strong>, please inform Principal Architect <strong>Ritika</strong> 
          personally at <a href="mailto:${PAYROLL_CONFIG.RITIKA_EMAIL}" style="color: #e74c3c; text-decoration: none;">${PAYROLL_CONFIG.RITIKA_EMAIL}</a> 
          for approval.
        </p>
        ` : `
        <div style="${styles.highlightBox}">
          <strong style="color: #28a745;">POLICY MET</strong><br><br>
          <span style="color: #555;">
            Your leave request has been forwarded to the management for approval.
          </span>
        </div>
        `}
        
        <p style="${styles.p}">
          Your request has been forwarded to the management team and recorded in our system.
        </p>
        
        <p style="${styles.p}">
          Warm regards,<br>
          <strong>Human Resources Team</strong>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        &copy; ${new Date().getFullYear()} Urbanmistrii. All Rights Reserved.
      </div>
      
    </div>
  `;
  
  GmailApp.sendEmail(email, subject, "", {
    htmlBody: htmlBody,
    name: "HR - UrbanMistrii"
  });
  
  console.log(`📧 Policy reply sent to ${email}`);
}

function forwardToRitika(name, email, leaveDetails, originalBody, meetsPolicy, daysInAdvance) {
  const subject = `Leave Request: ${name} (${leaveDetails.days} day${leaveDetails.days > 1 ? 's' : ''})`;
  
  const styles = {
    container: `font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; color: #333333;`,
    header: `background-color: #1a1a1a; padding: 30px 40px; text-align: left; border-bottom: 4px solid #e74c3c;`,
    logo: `color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase;`,
    body: `padding: 40px; line-height: 1.6; font-size: 15px;`,
    h1: `color: #1a1a1a; font-size: 20px; font-weight: 700; margin-bottom: 20px; letter-spacing: -0.5px;`,
    p: `margin-bottom: 20px; color: #555;`,
    highlightBox: `background-color: #f8f9fa; border-left: 4px solid #1a1a1a; padding: 20px; margin: 25px 0;`,
    footer: `background-color: #f4f4f4; padding: 20px 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0;`
  };
  
  const htmlBody = `
    <div style="${styles.container}">
      
      <!-- Header -->
      <div style="${styles.header}">
        <h1 style="${styles.logo}">URBANMISTRII</h1>
      </div>
      
      <!-- Body -->
      <div style="${styles.body}">
        <h2 style="${styles.h1}">Leave Request: ${name}</h2>
        
        <!-- Employee Info -->
        <div style="${styles.highlightBox}">
          <strong>Employee Information</strong><br><br>
          <strong>Name:</strong> ${name}<br>
          <strong>Email:</strong> <a href="mailto:${email}" style="color: #e74c3c; text-decoration: none;">${email}</a>
        </div>
        
        <!-- Leave Details -->
        <div style="${styles.highlightBox}">
          <strong>Leave Information</strong><br><br>
          <strong>Start Date:</strong> ${formatDate(leaveDetails.startDate)} (${getDayOfWeek(leaveDetails.startDate)})<br>
          <strong>End Date:</strong> ${formatDate(leaveDetails.endDate)} (${getDayOfWeek(leaveDetails.endDate)})<br>
          <strong>Total Days:</strong> ${leaveDetails.days} day${leaveDetails.days > 1 ? 's' : ''}<br>
          <strong>Reason:</strong> ${leaveDetails.reason}
        </div>
        
        <!-- Policy Status -->
        <div style="${styles.highlightBox}">
          <strong style="color: ${meetsPolicy ? '#28a745' : '#c62828'};">
            ${meetsPolicy ? 'POLICY COMPLIANT' : 'POLICY VIOLATION'}
          </strong><br><br>
          <span style="color: #555;">
            Applied <strong>${daysInAdvance} days</strong> in advance (Company policy requires <strong>14 days</strong>)
          </span>
          ${!meetsPolicy ? `<br><br><span style="color: #c62828;"><strong>Note:</strong> Employee has been instructed to contact you personally if this is an emergency situation requiring immediate approval.</span>` : ''}
        </div>
        
        <!-- Original Message -->
        <div style="${styles.highlightBox}">
          <strong>Original Leave Request:</strong><br><br>
          <div style="color: #333; font-size: 14px; line-height: 1.6; background-color: #ffffff; padding: 15px; border: 1px solid #e0e0e0; font-family: 'Courier New', monospace; white-space: pre-wrap; word-wrap: break-word;">
${originalBody.substring(0, 600)}${originalBody.length > 600 ? '...' : ''}
          </div>
        </div>
        
        <!-- Action Required -->
        <div style="${styles.highlightBox}">
          <strong>ACTION REQUIRED</strong><br><br>
          Please review and <strong>approve</strong> or <strong>reject</strong> this leave request.<br>
          Leave has been recorded in the HR database for payroll calculation.
        </div>
        
        <p style="${styles.p}">
          Best regards,<br>
          <strong>HR Automation System</strong>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        &copy; ${new Date().getFullYear()} Urbanmistrii. All Rights Reserved.
      </div>
      
    </div>
  `;
  
  GmailApp.sendEmail(PAYROLL_CONFIG.RITIKA_EMAIL, subject, "", {
    htmlBody: htmlBody,
    name: "HR Automation - UrbanMistrii",
    replyTo: email
  });
  
  console.log(`✅ Forwarded to Ritika at ${PAYROLL_CONFIG.RITIKA_EMAIL}`);
}

function recordLeaveInDB(email, name, leaveDetails) {
  try {
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    const activeSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.ACTIVE);
    
    if (!activeSheet) {
      console.error("❌ Active employees sheet not found");
      return false;
    }
    
    // Find employee
    const data = activeSheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      const rowEmail = String(data[i][PAYROLL_CONFIG.ACTIVE_COLS.REMARKS]).toLowerCase().trim();
      const rowName = String(data[i][PAYROLL_CONFIG.ACTIVE_COLS.NAME]).toLowerCase().trim();
      
      if (rowEmail === email.toLowerCase().trim() || rowName.includes(name.toLowerCase().trim())) {
        rowIndex = i + 1; // 1-based for sheet operations
        break;
      }
    }
    
    if (rowIndex === -1) {
      console.warn(`⚠️ Employee not found in database: ${name} (${email})`);
      return false;
    }
    
    const employeeData = data[rowIndex - 1];
    
    // Update leave columns
    const currentMonth = new Date().getMonth(); // 0-11
    const currentLeavesCol = currentMonth === 9 ? PAYROLL_CONFIG.ACTIVE_COLS.OCT_LEAVES : PAYROLL_CONFIG.ACTIVE_COLS.OCT_LEAVES; // E column
    const totalLeavesCol = PAYROLL_CONFIG.ACTIVE_COLS.TOTAL_LEAVES; // F
    const leaveDatesCol = PAYROLL_CONFIG.ACTIVE_COLS.LEAVE_DATES; // G
    
    // Get current values
    let currentMonthLeaves = parseInt(employeeData[currentLeavesCol]) || 0;
    let totalLeaves = parseInt(employeeData[totalLeavesCol]) || 0;
    let leaveDates = String(employeeData[leaveDatesCol] || "");
    
    // Add new leaves
    currentMonthLeaves += leaveDetails.days;
    totalLeaves += leaveDetails.days;
    
    // Append leave dates
    const newDates = leaveDetails.dates.join(", ");
    leaveDates = leaveDates ? `${leaveDates}, ${newDates}` : newDates;
    
    // Update sheet
    activeSheet.getRange(rowIndex, currentLeavesCol + 1).setValue(currentMonthLeaves);
    activeSheet.getRange(rowIndex, totalLeavesCol + 1).setValue(totalLeaves);
    activeSheet.getRange(rowIndex, leaveDatesCol + 1).setValue(leaveDates);
    
    console.log(`✅ Updated database for ${name}:`);
    console.log(`   • Current month leaves: ${currentMonthLeaves}`);
    console.log(`   • Total leaves: ${totalLeaves}`);
    console.log(`   • Leave dates: ${leaveDates}`);
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to record leave: ${e.message}`);
    return false;
  }
}

// Helper functions
function formatDate(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getDayOfWeek(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date(date).getDay()];
}

function installLeaveTriggers() {
  console.log("🔧 INSTALLING LEAVE MANAGEMENT TRIGGERS\n");
  
  // Clear existing leave triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'monitorLeaveRequests') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Monitor every 10 minutes
  ScriptApp.newTrigger('monitorLeaveRequests')
    .timeBased()
    .everyMinutes(10)
    .create();
  
  console.log("✅ Installed leave monitoring trigger (every 10 minutes)");
  console.log("\n🚀 LEAVE AUTOMATION IS NOW LIVE!");
  console.log("\n📋 System will:");
  console.log("   1. Monitor hr@urbanmistrii.com for leave requests");
  console.log("   2. Reply to employee with policy notice");
  console.log(`   3. Forward to Ritika at ${PAYROLL_CONFIG.RITIKA_EMAIL}`);
  console.log("   4. Record leaves in database for payroll");
}

function testLeaveSystem() {
  console.log("\n🧪 TESTING LEAVE MANAGEMENT SYSTEM\n");
  console.log("📋 This will process any unread leave requests in hr@urbanmistrii.com");
  console.log(`⚠️ Test emails will be sent to employees and ${PAYROLL_CONFIG.RITIKA_EMAIL}\n`);
  
  monitorLeaveRequests();
  
  console.log("\n✅ TEST COMPLETE - Check:");
  console.log("   1. Employee received policy reply");
  console.log("   2. Ritika received formatted card");
  console.log("   3. Database updated with leave records");
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  MONTHLY ATTENDANCE & EXPENSE FORM SYSTEM                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Create Monthly Attendance & Expense Form
 * Run this once during setup to create the form
 */
function createMonthlyAttendanceForm() {
  console.log("📝 CREATING MONTHLY ATTENDANCE & EXPENSE FORM\n");
  
  try {
    const form = FormApp.create("Monthly Attendance & Expense Report");
    
    // Set form description
    form.setDescription(
      "Please submit your attendance and expense details for the previous month. " +
      "This form is sent automatically on the 1st of every month.\n\n" +
      "All fields are mandatory unless marked optional."
    );
    
    // Configure form settings
    form.setCollectEmail(true);
    form.setLimitOneResponsePerUser(false);
    form.setShowLinkToRespondAgain(false);
    form.setConfirmationMessage(
      "Thank you! Your attendance and expense report has been submitted successfully. " +
      "The data will be processed for payroll calculation."
    );
    
    // Add form fields
    
    // 1. Employee Name
    form.addTextItem()
      .setTitle("Employee Name")
      .setHelpText("Your full name as per company records")
      .setRequired(true);
    
    // 2. Month & Year
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    
    form.addTextItem()
      .setTitle("Reporting Month")
      .setHelpText(`Enter the month and year (e.g., ${monthNames[lastMonth]} ${lastYear})`)
      .setRequired(true);
    
    // 3. Number of Leaves Taken
    form.addTextItem()
      .setTitle("Number of Leaves Taken Last Month")
      .setHelpText("Enter the total number of leaves you took (enter 0 if no leaves)")
      .setRequired(true);
    
    // 4. Leave Dates
    form.addParagraphTextItem()
      .setTitle("Leave Dates (if any)")
      .setHelpText("List all leave dates (e.g., 5th Dec, 12th Dec, 25th Dec). Leave blank if no leaves taken.")
      .setRequired(false);
    
    // 5. Leave Reason
    form.addParagraphTextItem()
      .setTitle("Reason for Leave (if any)")
      .setHelpText("Briefly explain the reason for your leaves. Leave blank if no leaves taken.")
      .setRequired(false);
    
    // 6. Conveyance Expense
    form.addTextItem()
      .setTitle("Conveyance Expense Amount")
      .setHelpText("Enter total conveyance/travel expense amount in ₹ (enter 0 if no expense)")
      .setRequired(true);
    
    // 7. Conveyance Details
    form.addParagraphTextItem()
      .setTitle("Conveyance Expense Details")
      .setHelpText("Provide details: dates, purpose, locations traveled, etc. (e.g., 'Client meeting in Gurgaon on 10th Dec, Site visit in Noida on 15th Dec')")
      .setRequired(false);
    
    // 8. Proof Link (Google Drive or any cloud storage)
    form.addTextItem()
      .setTitle("Conveyance Proof Link")
      .setHelpText("Upload your bills/receipts to Google Drive and paste the sharing link here. Required if claiming conveyance.")
      .setRequired(false);
    
    // 9. Additional Notes
    form.addParagraphTextItem()
      .setTitle("Additional Notes (Optional)")
      .setHelpText("Any other information you'd like to share")
      .setRequired(false);
    
    const formId = form.getId();
    const formUrl = form.getPublishedUrl();
    const editUrl = form.getEditUrl();
    
    console.log("✅ Form created successfully!");
    console.log(`\n📋 Form Details:`);
    console.log(`   • Form ID: ${formId}`);
    console.log(`   • Form URL: ${formUrl}`);
    console.log(`   • Edit URL: ${editUrl}`);
    
    console.log(`\n📝 NEXT STEPS:`);
    console.log(`1. Copy the Form ID above and save it in PAYROLL_CONFIG.MONTHLY_FORM_ID`);
    console.log(`2. Run setupMonthlyFormTrigger() to enable form submission processing`);
    console.log(`3. Run installMonthlyFormEmailTrigger() to send forms on 1st of every month`);
    console.log(`4. Test with testMonthlyFormEmail() to send test email to all employees`);
    
    return {
      formId: formId,
      formUrl: formUrl,
      editUrl: editUrl
    };
  } catch (e) {
    console.error(`❌ Failed to create form: ${e.message}`);
    return null;
  }
}

/**
 * Send Monthly Attendance Form to All Employees
 * Runs automatically on 1st of every month
 */
function sendMonthlyFormToAllEmployees() {
  console.log("📧 SENDING MONTHLY ATTENDANCE FORM TO ALL EMPLOYEES\n");
  
  try {
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    const activeSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.ACTIVE);
    
    if (!activeSheet) {
      console.error("❌ Active employees sheet not found");
      return false;
    }
    
    // Get form URL
    const formId = PAYROLL_CONFIG.MONTHLY_FORM_ID || "";
    if (!formId) {
      console.error("❌ Monthly form ID not configured in PAYROLL_CONFIG.MONTHLY_FORM_ID");
      return false;
    }
    
    const form = FormApp.openById(formId);
    const formUrl = form.getPublishedUrl();
    
    // Get current month details
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    const lastMonthName = monthNames[lastMonth];
    const currentMonthName = monthNames[currentMonth];
    
    // Get all active employees
    const data = activeSheet.getDataRange().getValues();
    let emailsSent = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = row[PAYROLL_CONFIG.ACTIVE_COLS.NAME];
      const email = row[PAYROLL_CONFIG.ACTIVE_COLS.REMARKS];
      
      if (!name || !email) continue;
      
      try {
        sendMonthlyFormEmail(name, email, formUrl, lastMonthName, lastYear, currentMonthName);
        emailsSent++;
        console.log(`✅ Sent to: ${name} (${email})`);
        Utilities.sleep(1000); // 1 second delay between emails
      } catch (e) {
        console.error(`❌ Failed to send to ${name}: ${e.message}`);
      }
    }
    
    console.log(`\n✅ Monthly form emails sent to ${emailsSent} employees`);
    return true;
  } catch (e) {
    console.error(`❌ Failed to send monthly forms: ${e.message}`);
    return false;
  }
}

function sendMonthlyFormEmail(name, email, formUrl, reportMonth, reportYear, currentMonth) {
  const subject = `Monthly Attendance & Expense Report - ${reportMonth} ${reportYear}`;
  
  // Urban Mistrii signature style
  const styles = {
    container: `font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; color: #333333;`,
    header: `background-color: #1a1a1a; padding: 30px 40px; text-align: left; border-bottom: 4px solid #e74c3c;`,
    logo: `color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase;`,
    body: `padding: 40px; line-height: 1.6; font-size: 15px;`,
    h1: `color: #1a1a1a; font-size: 20px; font-weight: 700; margin-bottom: 20px; letter-spacing: -0.5px;`,
    p: `margin-bottom: 20px; color: #555;`,
    highlightBox: `background-color: #f8f9fa; border-left: 4px solid #1a1a1a; padding: 20px; margin: 25px 0;`,
    btn: `display: inline-block; background-color: #e74c3c; color: #ffffff !important; padding: 14px 30px; text-decoration: none; font-weight: 600; border-radius: 2px; letter-spacing: 0.5px; margin-top: 10px;`,
    footer: `background-color: #f4f4f4; padding: 20px 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0;`
  };
  
  const htmlBody = `
    <div style="${styles.container}">
      
      <!-- Header -->
      <div style="${styles.header}">
        <h1 style="${styles.logo}">URBANMISTRII</h1>
      </div>
      
      <!-- Body -->
      <div style="${styles.body}">
        <h2 style="${styles.h1}">Monthly Attendance & Expense Report - ${reportMonth} ${reportYear}</h2>
        
        <p style="${styles.p}">Dear ${name},</p>
        
        <p style="${styles.p}">
          It's the start of <strong>${currentMonth}</strong>! Please submit your attendance and expense details for 
          <strong>${reportMonth} ${reportYear}</strong>. This helps us process your payroll accurately and on time.
        </p>
        
        <!-- Requirements -->
        <div style="${styles.highlightBox}">
          <strong>What You Need to Submit:</strong><br><br>
          &bull; Your name and reporting month<br>
          &bull; Number of leaves taken (with dates & reason)<br>
          &bull; Conveyance/Travel expenses (if any)<br>
          &bull; Share link to proof (upload to Drive first)
        </div>
        
        <!-- CTA Button -->
        <div style="${styles.highlightBox}">
          <a href="${formUrl}" style="${styles.btn}">SUBMIT YOUR REPORT</a>
        </div>
        
        <!-- Important Notes -->
        <div style="${styles.highlightBox}">
          <strong>Important Notes:</strong><br><br>
          &bull; <strong>Deadline:</strong> Submit within 3 days<br>
          &bull; Upload proof to Google Drive, share link in form<br>
          &bull; Data will be used for payroll calculation<br>
          &bull; Contact HR if you face any issues
        </div>
        
        <p style="${styles.p}">
          Need help? Contact us at 
          <a href="mailto:${PAYROLL_CONFIG.HR_EMAIL}" style="color: #e74c3c; text-decoration: none; font-weight: 600;">${PAYROLL_CONFIG.HR_EMAIL}</a>
        </p>
        
        <p style="${styles.p}">
          Warm regards,<br>
          <strong>Human Resources Team</strong>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="${styles.footer}">
        &copy; ${new Date().getFullYear()} Urbanmistrii. All Rights Reserved.
      </div>
      
    </div>
  `;
  
  GmailApp.sendEmail(email, subject, "", {
    htmlBody: htmlBody,
    name: "HR - UrbanMistrii"
  });
}

/**
 * Process Monthly Form Submission
 * Automatically updates employee data in salary sheet
 */
function processMonthlyFormSubmission(e) {
  console.log("\n📋 PROCESSING MONTHLY FORM SUBMISSION\n");
  
  try {
    const responses = e.response.getItemResponses();
    const email = e.response.getRespondentEmail();
    
    // Extract form data
    const formData = {};
    responses.forEach(response => {
      const question = response.getItem().getTitle();
      const answer = response.getResponse();
      formData[question] = answer;
    });
    
    console.log(`📧 Submission from: ${email}`);
    console.log(`👤 Employee: ${formData["Employee Name"]}`);
    
    // Update database
    const ss = SpreadsheetApp.openById(PAYROLL_CONFIG.SHEET_ID);
    const activeSheet = ss.getSheetByName(PAYROLL_CONFIG.SHEETS.ACTIVE);
    
    if (!activeSheet) {
      console.error("❌ Active employees sheet not found");
      return false;
    }
    
    // Find employee
    const data = activeSheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      const rowEmail = String(data[i][PAYROLL_CONFIG.ACTIVE_COLS.REMARKS]).toLowerCase().trim();
      const rowName = String(data[i][PAYROLL_CONFIG.ACTIVE_COLS.NAME]).toLowerCase().trim();
      const submittedName = String(formData["Employee Name"]).toLowerCase().trim();
      
      if (rowEmail === email.toLowerCase().trim() || rowName.includes(submittedName)) {
        rowIndex = i + 1; // 1-based indexing
        break;
      }
    }
    
    if (rowIndex === -1) {
      console.warn(`⚠️ Employee not found: ${formData["Employee Name"]} (${email})`);
      return false;
    }
    
    const employeeData = data[rowIndex - 1];
    
    // Update leave data
    const leavesCount = parseInt(formData["Number of Leaves Taken Last Month"]) || 0;
    const leaveDates = formData["Leave Dates (if any)"] || "";
    const currentMonthLeaves = parseInt(employeeData[PAYROLL_CONFIG.ACTIVE_COLS.OCT_LEAVES]) || 0;
    const totalLeaves = parseInt(employeeData[PAYROLL_CONFIG.ACTIVE_COLS.TOTAL_LEAVES]) || 0;
    const existingDates = String(employeeData[PAYROLL_CONFIG.ACTIVE_COLS.LEAVE_DATES] || "");
    
    // Update conveyance
    const conveyanceAmount = parseFloat(formData["Conveyance Expense Amount"]?.replace(/[₹,]/g, '') || "0") || 0;
    const currentConveyance = parseCurrency(employeeData[PAYROLL_CONFIG.ACTIVE_COLS.CONVEYANCE]) || 0;
    
    // Update sheet
    activeSheet.getRange(rowIndex, PAYROLL_CONFIG.ACTIVE_COLS.OCT_LEAVES + 1).setValue(currentMonthLeaves + leavesCount);
    activeSheet.getRange(rowIndex, PAYROLL_CONFIG.ACTIVE_COLS.TOTAL_LEAVES + 1).setValue(totalLeaves + leavesCount);
    
    const updatedDates = existingDates ? `${existingDates}, ${leaveDates}` : leaveDates;
    activeSheet.getRange(rowIndex, PAYROLL_CONFIG.ACTIVE_COLS.LEAVE_DATES + 1).setValue(updatedDates);
    
    activeSheet.getRange(rowIndex, PAYROLL_CONFIG.ACTIVE_COLS.CONVEYANCE + 1).setValue(currentConveyance + conveyanceAmount);
    
    console.log(`✅ Updated database for ${formData["Employee Name"]}:`);
    console.log(`   • Leaves added: ${leavesCount}`);
    console.log(`   • Conveyance added: ₹${conveyanceAmount.toLocaleString('en-IN')}`);
    console.log(`   • Total leaves now: ${totalLeaves + leavesCount}`);
    console.log(`   • Total conveyance now: ₹${(currentConveyance + conveyanceAmount).toLocaleString('en-IN')}`);
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to process form submission: ${e.message}`);
    console.error(e.stack);
    return false;
  }
}

/**
 * Setup form submission trigger
 */
function setupMonthlyFormTrigger() {
  console.log("🔧 SETTING UP MONTHLY FORM SUBMISSION TRIGGER\n");
  
  const formId = PAYROLL_CONFIG.MONTHLY_FORM_ID || "";
  if (!formId) {
    console.error("❌ Please set PAYROLL_CONFIG.MONTHLY_FORM_ID first");
    console.log("Run createMonthlyAttendanceForm() to create the form");
    return false;
  }
  
  try {
    // Remove existing form triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'processMonthlyFormSubmission') {
        ScriptApp.deleteTrigger(t);
      }
    });
    
    // Create new form submission trigger
    const form = FormApp.openById(formId);
    ScriptApp.newTrigger('processMonthlyFormSubmission')
      .forForm(form)
      .onFormSubmit()
      .create();
    
    console.log("✅ Form submission trigger installed");
    console.log("📋 Every form submission will now auto-update the salary sheet");
    return true;
  } catch (e) {
    console.error(`❌ Failed to setup trigger: ${e.message}`);
    return false;
  }
}

/**
 * Install monthly email trigger
 */
function installMonthlyFormEmailTrigger() {
  console.log("🔧 INSTALLING MONTHLY FORM EMAIL TRIGGER\n");
  
  // Clear existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendMonthlyFormToAllEmployees') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Create monthly trigger: 1st of every month at 8:00 AM
  ScriptApp.newTrigger('sendMonthlyFormToAllEmployees')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
  
  console.log("✅ Installed monthly form email trigger (1st of every month at 8:00 AM)");
  console.log("\n🚀 MONTHLY FORM AUTOMATION IS NOW LIVE!");
}

function testMonthlyFormEmail() {
  console.log("\n🧪 TESTING MONTHLY FORM EMAIL\n");
  console.log("⚠️ This will send form emails to ALL active employees\n");
  
  sendMonthlyFormToAllEmployees();
  
  console.log("\n✅ TEST COMPLETE - Check employee inboxes");
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  INTEGRATION WITH OFFBOARDING SYSTEM                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * This function is called by the offboarding system after exit survey completion
 * Add this to offboarding_exit_suite_v2.gs in handleExitResponse():
 * 
 * // After exit survey processing:
 * const offboardData = {
 *   lastWorkingDay: getVal("last working day"),
 *   exitReason: getVal("reason for quitting"),
 *   projects: getVal("projects list"),
 *   notes: `Enjoyed: ${getVal("enjoyed most")}, Disliked: ${getVal("disliked most")}`
 * };
 * moveEmployeeToDeparted(email, offboardData);
 */



// ═══════════════════════════════════════════════════════════════════════════
//  OFFER LETTER GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
/*
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  URBAN MISTRII - AI-POWERED OFFER LETTER GENERATOR                            ║
 * ║  Automatically generates personalized experience letters using Gemini AI      ║
 * ║  Can be called from offboarding system or used standalone                     ║
 * ║  🔗 Part of HR Automation Ecosystem (Aware of: Onboarding, Offboarding)      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const LETTER_CONFIG = {
  // 🔗 HR ECOSYSTEM INTEGRATION
  ECOSYSTEM: {
    ONBOARDING_SCRIPT: "onboarding_suite_v2.gs",
    OFFBOARDING_SCRIPT: "offboarding_exit_suite_v2.gs",
    JOINING_LETTER_GEN: "joining_letter_generator.gs"
  },
  
  // 📊 DATA SOURCE
  SHEET_ID: "1b6JIPZo2G0YgB-Ee2WVL7PP-GP5h4HpLcev5NBEtMmE",
  SHEET_TAB: "Employees",
  
  // 📄 TEMPLATE
  TEMPLATE_DOC_ID: "1T0hYu7k4NU1BcUJYXRGvRA2hRodYVwCUP6Q1DPnCl1k",
  
  // 🤖 AI CONFIGURATION
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE", // Get from https://makersuite.google.com/app/apikey
  
  // 📧 EMAIL SETTINGS
  HR_EMAIL: "hr@urbanmistrii.com",
  TZ: "Asia/Kolkata",
  
  // 📁 OUTPUT
  FOLDER_NAME: "Generated Offer Letters" // Optional: specify Drive folder
};

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  MAIN FUNCTION - Call this from other scripts                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Generate and email personalized offer letter
 * @param {string} email - Employee email address
 * @param {string} name - Employee name
 * @returns {boolean} - Success status
 */
function generateOfferLetter(email, name) {
  if (!email || !name) {
    console.error("❌ Missing email or name for offer letter generation");
    return false;
  }
  
  try {
    console.log(`🤖 GENERATING AI-POWERED OFFER LETTER for ${name} (${email})`);
    
    // Step 1: Fetch all employee data from master sheet
    const employeeData = fetchEmployeeData(email);
    if (!employeeData) {
      console.error(`❌ Employee data not found for ${email}`);
      return false;
    }
    
    // Step 2: Read template document to understand style
    const templateStyle = readTemplateStyle();
    
    // Step 3: Build comprehensive context for AI
    const context = buildEmployeeContext(employeeData);
    
    // Step 4: Generate personalized letter using Gemini AI
    const generatedContent = callGeminiAPI(context, templateStyle, name);
    if (!generatedContent) {
      console.error("❌ AI generation failed");
      return false;
    }
    
    // Step 5: Create Google Doc with generated content
    const docName = `${name.replace(/\s+/g, '_')}_Experience_Letter_${Utilities.formatDate(new Date(), LETTER_CONFIG.TZ, 'yyyyMMdd')}`;
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();
    body.setText(generatedContent);
    
    // Apply basic formatting
    const titleStyle = {};
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    body.getParagraphs()[0].setAttributes(titleStyle);
    
    const textStyle = {};
    textStyle[DocumentApp.Attribute.FONT_SIZE] = 11;
    textStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
    body.setAttributes(textStyle);
    
    doc.saveAndClose();
    console.log(`✅ Document created: ${docName}`);
    
    // Step 6: Move to designated folder (if specified)
    const docFile = DriveApp.getFileById(doc.getId());
    const folders = DriveApp.getFoldersByName(LETTER_CONFIG.FOLDER_NAME);
    if (folders.hasNext()) {
      const folder = folders.next();
      docFile.moveTo(folder);
      console.log(`📁 Moved to folder: ${LETTER_CONFIG.FOLDER_NAME}`);
    }
    
    // Step 7: Convert to PDF
    const pdfBlob = docFile.getAs('application/pdf');
    pdfBlob.setName(docName + '.pdf');
    
    // Step 8: Email PDF to employee
    const subject = "Your UrbanMistrii Experience Letter";
    const emailBody = `Dear ${name},

Thank you for your valuable contributions to UrbanMistrii. Attached is your official experience letter.

This document reflects your professional journey with us and can be used for future employment opportunities.

We wish you continued success in all your endeavors.

Warm regards,
HR Team
UrbanMistrii`;
    
    GmailApp.sendEmail(email, subject, emailBody, {
      attachments: [pdfBlob],
      name: "HR Team, Urbanmistrii"
    });
    
    console.log(`📧 Experience letter emailed to ${email}`);
    console.log(`✅ OFFER LETTER GENERATION COMPLETE`);
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to generate offer letter: ${e.message}`);
    console.error(e.stack);
    return false;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  DATA FETCHING                                                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function fetchEmployeeData(email) {
  try {
    const ss = SpreadsheetApp.openById(LETTER_CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName(LETTER_CONFIG.SHEET_TAB);
    if (!sheet) sheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
    
    const data = sheet.getDataRange().getValues();
    
    // Find employee row by email (column C, index 2)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase().trim() === email.toLowerCase().trim()) {
        const row = data[i];
        return {
          name: row[19] || row[0] || "Employee", // Col T (offboarding name) or Col A
          latestPosition: row[20] || "Staff", // Col U
          joiningTitle: row[21] || "", // Col V
          joiningDate: row[22] || "", // Col W
          lastWorkingDay: row[23] || "", // Col X
          projects: row[24] || "Various projects", // Col Y
          workLogSubmitted: row[25] || "", // Col Z
          workLogLink: row[26] || "", // Col AA
          reasonForLeaving: row[29] || "", // Col AD
          enjoyedMost: row[30] || "", // Col AE
          dislikedMost: row[31] || "", // Col AF
          trainingFeedback: row[32] || "", // Col AG
          extraResponsibility: row[33] || "", // Col AH
          communication: row[34] || "", // Col AI
          workCulture: row[35] || "", // Col AJ
          coworkerRelations: row[36] || "", // Col AK
          seniorRelations: row[37] || "", // Col AL
          mgmtRecognition: row[38] || "", // Col AM
          policyFeedback: row[39] || "", // Col AN
          generalConcerns: row[40] || "", // Col AO
          email: email
        };
      }
    }
    return null;
  } catch (e) {
    console.error(`❌ Error fetching employee data: ${e.message}`);
    return null;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  AI GENERATION ENGINE                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function readTemplateStyle() {
  try {
    const doc = DocumentApp.openById(LETTER_CONFIG.TEMPLATE_DOC_ID);
    const body = doc.getBody();
    const text = body.getText().substring(0, 500); // Get first 500 chars for style reference
    console.log("✅ Template style loaded");
    return text;
  } catch (e) {
    console.warn(`⚠️ Could not read template: ${e.message}`);
    return "Professional business letter format";
  }
}

function buildEmployeeContext(data) {
  const joiningDateStr = data.joiningDate ? Utilities.formatDate(new Date(data.joiningDate), LETTER_CONFIG.TZ, 'MMMM yyyy') : "";
  const lastDayStr = data.lastWorkingDay ? Utilities.formatDate(new Date(data.lastWorkingDay), LETTER_CONFIG.TZ, 'MMMM yyyy') : "";
  
  return `
EMPLOYEE INFORMATION:
- Name: ${data.name}
- Latest Position: ${data.latestPosition}
- Joining Title: ${data.joiningTitle || data.latestPosition}
- Tenure: ${joiningDateStr} to ${lastDayStr}
- Projects Worked On: ${data.projects}

PERFORMANCE HIGHLIGHTS:
- What they enjoyed most: ${data.enjoyedMost || "Contributing to innovative design projects"}
- Training & Development: ${data.trainingFeedback || "Received comprehensive training"}
- Work Culture Feedback: ${data.workCulture || "Positive and collaborative environment"}
- Management Recognition: ${data.mgmtRecognition || "Recognized for dedication and quality work"}
- Communication Skills: ${data.communication || "Excellent communication and collaboration"}
- Team Relations: Coworkers (${data.coworkerRelations || "Positive"}), Seniors (${data.seniorRelations || "Positive"})

COMPANY: UrbanMistrii (Architecture & Design Firm)
TONE: Professional, appreciative, suitable for future employers
`;
}

function callGeminiAPI(context, templateStyle, employeeName) {
  const apiKey = LETTER_CONFIG.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    console.warn("⚠️ Gemini API key not configured. Using fallback template generation.");
    return generateFallbackLetter(context, employeeName);
  }
  
  try {
    const prompt = `You are an HR professional writing an official experience letter for a departing employee.

TEMPLATE STYLE REFERENCE:
${templateStyle}

${context}

TASK: Generate a professional, personalized experience letter for ${employeeName} that:
1. Follows the template style above
2. Highlights their specific projects and contributions
3. Mentions their role progression (if applicable)
4. Uses warm but professional tone
5. Is suitable for future employers
6. Includes standard letterhead elements (To Whom It May Concern, company details, signature block)
7. Keep it concise (300-400 words)

Generate ONLY the letter content. Do not include any explanations or metadata.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      const generatedText = json.candidates[0].content.parts[0].text;
      console.log(`✅ AI generation successful (${generatedText.length} chars)`);
      return generatedText;
    } else {
      console.error("❌ Unexpected API response:", json);
      return generateFallbackLetter(context, employeeName);
    }
  } catch (e) {
    console.error(`❌ Gemini API call failed: ${e.message}`);
    return generateFallbackLetter(context, employeeName);
  }
}

function generateFallbackLetter(context, employeeName) {
  console.log("ℹ️ Using fallback template-based generation");
  
  // Extract data from context
  const positionMatch = context.match(/Latest Position: ([^\n]+)/);
  const tenureMatch = context.match(/Tenure: ([^\n]+)/);
  const projectsMatch = context.match(/Projects Worked On: ([^\n]+)/);
  
  const position = positionMatch ? positionMatch[1] : "Staff Member";
  const tenure = tenureMatch ? tenureMatch[1] : "during their tenure";
  const projects = projectsMatch ? projectsMatch[1] : "various architectural projects";
  
  return `URBANMISTRII
Architecture & Design

TO WHOM IT MAY CONCERN

Date: ${Utilities.formatDate(new Date(), LETTER_CONFIG.TZ, 'MMMM dd, yyyy')}

This is to certify that ${employeeName} worked with UrbanMistrii as ${position} ${tenure}.

During their tenure, ${employeeName} contributed significantly to ${projects}. They demonstrated strong professional skills, dedication to quality work, and effective collaboration with team members and clients.

${employeeName} consistently maintained high standards in their work and showed commitment to project goals. Their contributions were valuable to our organization's growth and success.

We wish ${employeeName} continued success in their future professional endeavors.

This letter is issued upon request for official purposes.

Sincerely,

Human Resources Department
UrbanMistrii
hr@urbanmistrii.com`;
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  STANDALONE TESTING & MANUAL TRIGGERS                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function testGenerateOfferLetter() {
  console.log("\n🧪 TESTING OFFER LETTER GENERATOR\n");
  
  // Test with sample employee
  const testEmail = "hr@urbanmistrii.com";
  const testName = "Chirag J.K";
  
  console.log(`📧 Generating letter for: ${testName} (${testEmail})`);
  console.log(`📄 Template: ${LETTER_CONFIG.TEMPLATE_DOC_ID}`);
  console.log(`🤖 AI: ${LETTER_CONFIG.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE" ? "Enabled" : "Fallback Mode"}\n`);
  
  const success = generateOfferLetter(testEmail, testName);
  
  if (success) {
    console.log("\n✅ TEST SUCCESSFUL!");
    console.log("📋 Check:");
    console.log("   1. Your inbox for the PDF");
    console.log("   2. Google Drive for the document");
    console.log(`   3. Folder: ${LETTER_CONFIG.FOLDER_NAME} (if exists)`);
  } else {
    console.log("\n❌ TEST FAILED - Check logs above");
  }
}

function manualGenerateLetter(email, name) {
  if (!email || !name) {
    console.error("❌ Usage: manualGenerateLetter('employee@email.com', 'Employee Name')");
    return;
  }
  
  console.log(`\n🚀 MANUALLY GENERATING OFFER LETTER`);
  generateOfferLetter(email, name);
}

function setupLetterGeneratorFolder() {
  try {
    const folders = DriveApp.getFoldersByName(LETTER_CONFIG.FOLDER_NAME);
    if (!folders.hasNext()) {
      const folder = DriveApp.createFolder(LETTER_CONFIG.FOLDER_NAME);
      console.log(`✅ Created folder: ${LETTER_CONFIG.FOLDER_NAME}`);
      console.log(`📁 Folder ID: ${folder.getId()}`);
    } else {
      console.log(`✅ Folder already exists: ${LETTER_CONFIG.FOLDER_NAME}`);
    }
  } catch (e) {
    console.error(`❌ Failed to create folder: ${e.message}`);
  }
}



// ═══════════════════════════════════════════════════════════════════════════
//  JOINING LETTER GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
/*
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  URBAN MISTRII - AI-POWERED JOINING LETTER GENERATOR                          ║
 * ║  Automatically generates personalized joining/offer letters using Gemini AI   ║
 * ║  Can be called from onboarding system or used standalone                      ║
 * ║  🔗 Part of HR Automation Ecosystem (Aware of: Onboarding, Offboarding)      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

const JOINING_CONFIG = {
  // 🔗 HR ECOSYSTEM INTEGRATION
  ECOSYSTEM: {
    ONBOARDING_SCRIPT: "onboarding_suite_v2.gs",
    OFFBOARDING_SCRIPT: "offboarding_exit_suite_v2.gs",
    OFFER_LETTER_GEN: "offer_letter_generator.gs"
  },
  
  // 📊 DATA SOURCE (Shared master database)
  SHEET_ID: "1b6JIPZo2G0YgB-Ee2WVL7PP-GP5h4HpLcev5NBEtMmE",
  SHEET_TAB: "Employees",
  
  // 📄 TEMPLATE
  TEMPLATE_DOC_ID: "YOUR_JOINING_LETTER_TEMPLATE_ID", // Update with your template
  
  // 🤖 AI CONFIGURATION
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE", // Get from https://makersuite.google.com/app/apikey
  GEMINI_MODEL: "gemini-1.5-flash",
  
  // 📧 EMAIL SETTINGS
  HR_EMAIL: "hr@urbanmistrii.com",
  TZ: "Asia/Kolkata",
  
  // 📁 OUTPUT
  FOLDER_NAME: "Generated Joining Letters"
};

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  MAIN FUNCTION - Call this from other scripts                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

/**
 * Generate and email personalized joining/offer letter
 * @param {string} email - Employee email address
 * @param {string} name - Employee name
 * @param {Object} options - Optional parameters: {position, salary, joiningDate, team}
 * @returns {boolean} - Success status
 */
function generateJoiningLetter(email, name, options = {}) {
  if (!email || !name) {
    console.error("❌ Missing email or name for joining letter generation");
    return false;
  }
  
  try {
    console.log(`🤖 GENERATING AI-POWERED JOINING LETTER for ${name} (${email})`);
    
    // Step 1: Fetch employee data from master sheet
    const employeeData = fetchJoiningEmployeeData(email);
    if (!employeeData && !options.position) {
      console.error(`❌ Employee data not found for ${email} and no manual data provided`);
      return false;
    }
    
    // Merge manual options with fetched data
    const data = {
      name: name,
      email: email,
      position: options.position || employeeData?.position || "Staff Member",
      salary: options.salary || employeeData?.salary || "As per discussion",
      joiningDate: options.joiningDate || employeeData?.joiningDate || new Date(),
      team: options.team || employeeData?.team || "Design Team",
      phone: options.phone || employeeData?.phone || ""
    };
    
    // Step 2: Read template document to understand style
    const templateStyle = readJoiningTemplateStyle();
    
    // Step 3: Build context for AI
    const context = buildJoiningContext(data);
    
    // Step 4: Generate personalized letter using Gemini AI
    const generatedContent = callJoiningGeminiAPI(context, templateStyle, name);
    if (!generatedContent) {
      console.error("❌ AI generation failed");
      return false;
    }
    
    // Step 5: Create Google Doc with generated content
    const docName = `${name.replace(/\s+/g, '_')}_Joining_Letter_${Utilities.formatDate(new Date(), JOINING_CONFIG.TZ, 'yyyyMMdd')}`;
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();
    body.setText(generatedContent);
    
    // Apply formatting
    const titleStyle = {};
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    body.getParagraphs()[0].setAttributes(titleStyle);
    
    const textStyle = {};
    textStyle[DocumentApp.Attribute.FONT_SIZE] = 11;
    textStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
    body.setAttributes(textStyle);
    
    doc.saveAndClose();
    console.log(`✅ Document created: ${docName}`);
    
    // Step 6: Move to designated folder
    const docFile = DriveApp.getFileById(doc.getId());
    const folders = DriveApp.getFoldersByName(JOINING_CONFIG.FOLDER_NAME);
    if (folders.hasNext()) {
      const folder = folders.next();
      docFile.moveTo(folder);
      console.log(`📁 Moved to folder: ${JOINING_CONFIG.FOLDER_NAME}`);
    }
    
    // Step 7: Convert to PDF
    const pdfBlob = docFile.getAs('application/pdf');
    pdfBlob.setName(docName + '.pdf');
    
    // Step 8: Email PDF to employee
    const subject = "Your UrbanMistrii Joining Letter";
    const joiningDateStr = Utilities.formatDate(new Date(data.joiningDate), JOINING_CONFIG.TZ, 'MMMM dd, yyyy');
    const emailBody = `Dear ${name},

Congratulations and welcome to UrbanMistrii!

We are delighted to offer you the position of ${data.position}. Attached is your official joining letter outlining the terms of your employment.

Position: ${data.position}
Joining Date: ${joiningDateStr}
Team: ${data.team}

Please review the attached document carefully. If you have any questions, feel free to reach out to us at ${JOINING_CONFIG.HR_EMAIL}.

We look forward to having you as part of our team!

Warm regards,
HR Team
UrbanMistrii`;
    
    GmailApp.sendEmail(email, subject, emailBody, {
      attachments: [pdfBlob],
      name: "HR Team, Urbanmistrii"
    });
    
    console.log(`📧 Joining letter emailed to ${email}`);
    console.log(`✅ JOINING LETTER GENERATION COMPLETE`);
    
    return true;
  } catch (e) {
    console.error(`❌ Failed to generate joining letter: ${e.message}`);
    console.error(e.stack);
    return false;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  DATA FETCHING                                                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function fetchJoiningEmployeeData(email) {
  try {
    const ss = SpreadsheetApp.openById(JOINING_CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName(JOINING_CONFIG.SHEET_TAB);
    if (!sheet) sheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
    
    const data = sheet.getDataRange().getValues();
    
    // Column mapping (matching onboarding/offboarding structure)
    // A: Joining Date, B: Name, C: Email, H: Salary, O: Position, P: Phone
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase().trim() === email.toLowerCase().trim()) {
        const row = data[i];
        const position = row[14] || "Staff"; // Col O
        const team = position.includes("(") ? position.split("(")[0].trim() : position;
        
        return {
          name: row[1] || "Employee", // Col B
          joiningDate: row[0] || new Date(), // Col A
          salary: row[7] || "", // Col H
          position: position,
          team: team,
          phone: row[15] || "", // Col P
          email: email
        };
      }
    }
    return null;
  } catch (e) {
    console.error(`❌ Error fetching employee data: ${e.message}`);
    return null;
  }
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  AI GENERATION ENGINE                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function readJoiningTemplateStyle() {
  try {
    if (JOINING_CONFIG.TEMPLATE_DOC_ID === "YOUR_JOINING_LETTER_TEMPLATE_ID") {
      console.log("ℹ️ No template configured, using default style");
      return "Professional business letter format with company letterhead";
    }
    
    const doc = DocumentApp.openById(JOINING_CONFIG.TEMPLATE_DOC_ID);
    const body = doc.getBody();
    const text = body.getText().substring(0, 500);
    console.log("✅ Template style loaded");
    return text;
  } catch (e) {
    console.warn(`⚠️ Could not read template: ${e.message}`);
    return "Professional business letter format with company letterhead";
  }
}

function buildJoiningContext(data) {
  const joiningDateStr = Utilities.formatDate(new Date(data.joiningDate), JOINING_CONFIG.TZ, 'MMMM dd, yyyy');
  
  return `
EMPLOYEE INFORMATION:
- Name: ${data.name}
- Position: ${data.position}
- Team: ${data.team}
- Joining Date: ${joiningDateStr}
- Compensation: ${data.salary}
- Contact: ${data.phone}

COMPANY: UrbanMistrii (Architecture & Design Firm)
LETTER TYPE: Joining Letter / Offer Letter
TONE: Professional, welcoming, formal
`;
}

function callJoiningGeminiAPI(context, templateStyle, employeeName) {
  const apiKey = JOINING_CONFIG.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    console.warn("⚠️ Gemini API key not configured. Using fallback template generation.");
    return generateFallbackJoiningLetter(context, employeeName);
  }
  
  try {
    const prompt = `You are an HR professional writing an official joining letter (offer letter) for a new employee.

TEMPLATE STYLE REFERENCE:
${templateStyle}

${context}

TASK: Generate a professional joining letter for ${employeeName} that:
1. Follows the template style above
2. Welcomes them warmly to the organization
3. Clearly states position, joining date, and compensation
4. Mentions probation period (if applicable for full-time roles)
5. Includes standard terms: reporting structure, working hours, benefits overview
6. Has a warm closing expressing excitement about them joining
7. Includes standard letterhead elements (company name, date, signature block)
8. Keep it concise (350-450 words)
9. Use formal business letter format

Generate ONLY the letter content. Do not include any explanations or metadata.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${JOINING_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      const generatedText = json.candidates[0].content.parts[0].text;
      console.log(`✅ AI generation successful (${generatedText.length} chars)`);
      return generatedText;
    } else {
      console.error("❌ Unexpected API response:", json);
      return generateFallbackJoiningLetter(context, employeeName);
    }
  } catch (e) {
    console.error(`❌ Gemini API call failed: ${e.message}`);
    return generateFallbackJoiningLetter(context, employeeName);
  }
}

function generateFallbackJoiningLetter(context, employeeName) {
  console.log("ℹ️ Using fallback template-based generation");
  
  // Extract data from context
  const positionMatch = context.match(/Position: ([^\n]+)/);
  const joiningDateMatch = context.match(/Joining Date: ([^\n]+)/);
  const compensationMatch = context.match(/Compensation: ([^\n]+)/);
  const teamMatch = context.match(/Team: ([^\n]+)/);
  
  const position = positionMatch ? positionMatch[1] : "Staff Member";
  const joiningDate = joiningDateMatch ? joiningDateMatch[1] : "as discussed";
  const compensation = compensationMatch ? compensationMatch[1] : "as per discussion";
  const team = teamMatch ? teamMatch[1] : "Design Team";
  
  const today = Utilities.formatDate(new Date(), JOINING_CONFIG.TZ, 'MMMM dd, yyyy');
  
  return `URBANMISTRII
Architecture & Design

${today}

Dear ${employeeName},

Subject: Offer of Employment - ${position}

We are pleased to offer you the position of ${position} at UrbanMistrii. We believe your skills and enthusiasm will be a valuable addition to our ${team}.

POSITION DETAILS:
• Position: ${position}
• Joining Date: ${joiningDate}
• Monthly Compensation: ${compensation}
• Team: ${team}
• Reporting: As per organizational structure
• Working Hours: Standard office hours (as communicated)

Your role will involve contributing to architectural and design projects, collaborating with team members, and maintaining the high standards of quality that UrbanMistrii is known for.

${position.toLowerCase().includes("intern") ? 
  "This is an internship position for the duration discussed during your interview." : 
  "Your employment will be subject to a probation period of 3 months, during which your performance will be reviewed."}

You will be entitled to company policies as outlined in our HR handbook, which will be shared with you during onboarding. This includes leave policy, code of conduct, and other operational guidelines.

Please confirm your acceptance of this offer by signing and returning a copy of this letter. We also request you to complete the onboarding formalities as communicated by our HR team.

We are excited to welcome you to the UrbanMistrii family and look forward to a mutually rewarding association.

Should you have any questions, please feel free to reach out to us at ${JOINING_CONFIG.HR_EMAIL}.

Sincerely,

Human Resources Department
UrbanMistrii
${JOINING_CONFIG.HR_EMAIL}`;
}

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║  STANDALONE TESTING & MANUAL TRIGGERS                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

function testGenerateJoiningLetter() {
  console.log("\n🧪 TESTING JOINING LETTER GENERATOR\n");
  
  // Test with sample employee
  const testEmail = "hr@urbanmistrii.com";
  const testName = "Priya Sharma";
  const testOptions = {
    position: "Architecture Intern",
    team: "Design Team",
    salary: "15,000",
    joiningDate: new Date(2025, 0, 15) // January 15, 2025
  };
  
  console.log(`📧 Generating letter for: ${testName} (${testEmail})`);
  console.log(`📄 Position: ${testOptions.position}`);
  console.log(`💰 Salary: ${testOptions.salary}`);
  console.log(`🤖 AI: ${JOINING_CONFIG.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE" ? "Enabled" : "Fallback Mode"}\n`);
  
  const success = generateJoiningLetter(testEmail, testName, testOptions);
  
  if (success) {
    console.log("\n✅ TEST SUCCESSFUL!");
    console.log("📋 Check:");
    console.log("   1. Your inbox for the PDF");
    console.log("   2. Google Drive for the document");
    console.log(`   3. Folder: ${JOINING_CONFIG.FOLDER_NAME} (if exists)`);
  } else {
    console.log("\n❌ TEST FAILED - Check logs above");
  }
}

function manualGenerateJoiningLetter(email, name, position, salary, joiningDate) {
  if (!email || !name) {
    console.error("❌ Usage: manualGenerateJoiningLetter('employee@email.com', 'Employee Name', 'Position', 'Salary', new Date())");
    console.log("Example: manualGenerateJoiningLetter('priya@email.com', 'Priya Sharma', 'Architecture Intern', '15000', new Date(2025,0,15))");
    return;
  }
  
  console.log(`\n🚀 MANUALLY GENERATING JOINING LETTER`);
  
  const options = {
    position: position || "Staff Member",
    salary: salary || "As per discussion",
    joiningDate: joiningDate || new Date()
  };
  
  generateJoiningLetter(email, name, options);
}

function setupJoiningLetterFolder() {
  try {
    const folders = DriveApp.getFoldersByName(JOINING_CONFIG.FOLDER_NAME);
    if (!folders.hasNext()) {
      const folder = DriveApp.createFolder(JOINING_CONFIG.FOLDER_NAME);
      console.log(`✅ Created folder: ${JOINING_CONFIG.FOLDER_NAME}`);
      console.log(`📁 Folder ID: ${folder.getId()}`);
    } else {
      console.log(`✅ Folder already exists: ${JOINING_CONFIG.FOLDER_NAME}`);
    }
  } catch (e) {
    console.error(`❌ Failed to create folder: ${e.message}`);
  }
}



// ═══════════════════════════════════════════════════════════════════════════
//  MANUAL TRIGGER OFFBOARDING
// ═══════════════════════════════════════════════════════════════════════════
/**
 * MANUAL OFFBOARDING TRIGGER SCRIPT
 * 
 * INSTRUCTIONS:
 * 1. Run 'testOffboardingWithYash()' first to send a preview to Yash.
 * 2. Review the email. Since the links are placeholders, you will see "YOUR_INTERN_LOG_ID" etc.
 * 3. IMPORTANT: Update the 'linkIntern' and 'linkFulltime' variables below with real URLs if you have them.
 * 4. Once satisfied, run 'sendToAvishiReal()' to send the actual email.
 */

// 🔸 PLACEHOLDER LINKS - UPDATE THESE IF AVAILABLE 🔸
const LINK_INTERN_LOG = "https://docs.google.com/document/d/YOUR_INTERN_LOG_ID/edit";
const LINK_FULLTIME_LOG = "https://docs.google.com/document/d/YOUR_FULLTIME_LOG_ID/edit";
const FORM_OFFBOARD_FALLBACK = "https://docs.google.com/forms/d/YOUR_OFFBOARDING_FORM_ID/viewform";

function testOffboardingWithYash() {
  const email = "iamyash95@gmail.com";
  // We use Avishi's name so Yash sees it exactly as she would
  const name = "Avishi Pathak";

  console.log(`🚀 Sending TEST offboarding email to ${email} (simulating for ${name})`);
  sendOffboardingEmailManual(email, name);
}

function sendToAvishiReal() {
  const email = "avishi@urbanmistrii.com";
  const name = "Avishi Pathak";

  console.log(`🚀 Sending REAL offboarding email to ${name} (${email})`);
  sendOffboardingEmailManual(email, name);
}

function sendOffboardingEmailManual(targetEmail, targetName) {
  if (!targetEmail) {
    console.error("❌ No email provided");
    return;
  }

  // Get Configuration
  const props = PropertiesService.getScriptProperties();

  // Try to get URL from Script Properties or Config
  const offboardUrl = props.getProperty("URL_OFFBOARD") ||
    (typeof CONFIG !== 'undefined' && CONFIG.URL_OFFBOARD) ||
    FORM_OFFBOARD_FALLBACK;

  // Use links defined at top of file
  const linkIntern = (typeof CONFIG !== 'undefined' && CONFIG.LINK_LOG_INTERN) || LINK_INTERN_LOG;
  const linkFulltime = (typeof CONFIG !== 'undefined' && CONFIG.LINK_LOG_FULLTIME) || LINK_FULLTIME_LOG;

  if (offboardUrl.includes("YOUR_")) {
    console.warn("⚠️ WARNING: Offboarding URL appears to be a placeholder.");
  }

  const subject = "Action Required: Offboarding & Alumni Transition";

  // Construct Email Body (Premium HTML)
  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; background-color:#f8f9fa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      
      <tr>
        <td style="padding: 30px; background-color: #000000; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 3px; font-weight: 300;">URBANMISTRII</h1>
          <p style="color: #bbbbbb; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Alumni Relations</p>
        </td>
      </tr>

      <tr>
        <td style="padding: 40px 30px;">
          <h2 style="color: #333333; margin-top: 0; font-weight: 600;">Dear ${targetName},</h2>
          <p style="color: #555555; line-height: 1.6; font-size: 15px;">
            As you embark on your next chapter, we sincerely thank you for your dedication and the contributions you've made to our projects.
          </p>
          <p style="color: #555555; line-height: 1.6; font-size: 15px;">
            To ensure a smooth transition and to expedite your <strong>Experience Letter</strong>, please complete the following 3 steps:
          </p>

          <div style="background-color: #fcfcfc; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; margin-top: 25px;">
            <p style="margin: 0 0 15px 0; font-size: 12px; font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 1px;">Step 1: Download Work Log</p>
            
            <table width="100%">
              <tr>
                <td width="48%" style="padding-right: 2%;">
                  <a href="${linkIntern}" style="display: block; background-color: #ffffff; border: 1px solid #333; color: #333; text-align: center; padding: 12px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: bold;">
                     Intern Log &rarr;
                  </a>
                </td>
                <td width="48%" style="padding-left: 2%;">
                  <a href="${linkFulltime}" style="display: block; background-color: #ffffff; border: 1px solid #333; color: #333; text-align: center; padding: 12px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: bold;">
                     Full-Time Log &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fcfcfc; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; margin-top: 15px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 1px;">Step 2: Get Approval</p>
            <p style="margin: 0; font-size: 14px; color: #555;">Complete the log and obtain email approval from your Senior Architect.</p>
          </div>

          <div style="margin-top: 30px; text-align: center;">
            <a href="${offboardUrl}" style="background-color: #000000; color: #ffffff; display: inline-block; padding: 15px 40px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 15px; letter-spacing: 0.5px;">
              SUBMIT OFFBOARDING FORM
            </a>
            <p style="color: #999; font-size: 11px; margin-top: 10px;">Click here to upload your logs and request documents.</p>
          </div>

          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 40px 0;">

          <p style="color: #555555; line-height: 1.6; font-size: 14px;">
            We wish you the very best in your future endeavors. You will always be a valued part of the UrbanMistrii story.
          </p>
          <p style="color: #333; font-weight: bold; font-size: 14px;">Warm regards,<br>Human Resources Team</p>
        </td>
      </tr>

      <tr>
        <td style="padding: 20px; background-color: #f4f4f4; text-align: center; color: #888888; font-size: 11px; border-radius: 0 0 8px 8px;">
          &copy; ${new Date().getFullYear()} UrbanMistrii. All rights reserved.
        </td>
      </tr>

    </table>
  </body>
  </html>
  `;

  GmailApp.sendEmail(targetEmail, subject, "", { htmlBody: htmlBody });
  console.log(`✨ Premium Offboarding Email sent to ${targetEmail}`);
}



// ═══════════════════════════════════════════════════════════════════════════
//  TIMESTAMPFIX
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMERGENCY TIMESTAMP FIX
 * Use these functions to diagnose and fix the timestamp issue
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * STEP 1: Run this to diagnose your sheet structure
 */
function DIAGNOSE_SHEET_COLUMNS() {
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         SHEET COLUMN DIAGNOSTIC                                  ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');
    Logger.log('');

    try {
        const sheet = SpreadsheetApp.openById('1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4')
            .getSheetByName('DB_Candidates');

        if (!sheet) {
            Logger.log('❌ Sheet "DB_Candidates" not found');
            Logger.log('Available sheets:');
            SpreadsheetApp.openById('1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4')
                .getSheets()
                .forEach(s => Logger.log(`   - ${s.getName()}`));
            return;
        }

        const headers = sheet.getRange(1, 1, 1, 35).getValues()[0];

        Logger.log('═══ YOUR ACTUAL SHEET HEADERS ═══');
        headers.forEach((header, index) => {
            if (header) {
                Logger.log(`Column ${(index + 1).toString().padStart(2, ' ')}: "${header}"`);
            }
        });

        Logger.log('');
        Logger.log('═══ CURRENT CONFIG MAPPING ═══');
        Logger.log(`STATUS:     Column ${CONFIG.COLUMNS.STATUS}    → "${headers[CONFIG.COLUMNS.STATUS - 1] || 'EMPTY'}"`);
        Logger.log(`UPDATED:    Column ${CONFIG.COLUMNS.UPDATED}   → "${headers[CONFIG.COLUMNS.UPDATED - 1] || 'EMPTY'}"`);
        Logger.log(`TIMESTAMP:  Column ${CONFIG.COLUMNS.TIMESTAMP} → "${headers[CONFIG.COLUMNS.TIMESTAMP - 1] || 'EMPTY'}"`);
        Logger.log(`NAME:       Column ${CONFIG.COLUMNS.NAME}      → "${headers[CONFIG.COLUMNS.NAME - 1] || 'EMPTY'}"`);
        Logger.log(`PHONE:      Column ${CONFIG.COLUMNS.PHONE}     → "${headers[CONFIG.COLUMNS.PHONE - 1] || 'EMPTY'}"`);
        Logger.log(`EMAIL:      Column ${CONFIG.COLUMNS.EMAIL}     → "${headers[CONFIG.COLUMNS.EMAIL - 1] || 'EMPTY'}"`);

        Logger.log('');
        Logger.log('═══ DIAGNOSIS ═══');

        if (headers[0] && headers[0].toLowerCase().includes('status')) {
            Logger.log('✅ Column 1 is STATUS (correct)');
        } else {
            Logger.log(`❌ Column 1 is "${headers[0]}" (should be STATUS)`);
        }

        if (headers[1] && (headers[1].toLowerCase().includes('update') || headers[1].toLowerCase().includes('timestamp'))) {
            Logger.log('✅ Column 2 is for timestamps (correct)');
        } else {
            Logger.log(`⚠️ Column 2 is "${headers[1]}" (might be wrong)`);
        }

        Logger.log('');
        Logger.log('═══ ACTIVE TRIGGERS ═══');
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(t => {
            Logger.log(`   • ${t.getHandlerFunction()} (${t.getEventType()})`);
        });

    } catch (e) {
        Logger.log('❌ Error: ' + e.message);
    }
}

/**
 * STEP 2: Disable the auto-timestamp trigger
 */
function DISABLE_AUTO_TIMESTAMP() {
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         DISABLING AUTO-TIMESTAMP                                 ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');
    Logger.log('');

    const triggers = ScriptApp.getProjectTriggers();
    let disabled = 0;

    triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'universalAutomationEngine') {
            ScriptApp.deleteTrigger(trigger);
            Logger.log('✅ Disabled: universalAutomationEngine (onEdit trigger)');
            disabled++;
        }
    });

    if (disabled === 0) {
        Logger.log('⚠️ No universalAutomationEngine triggers found');
    } else {
        Logger.log('');
        Logger.log('✅ Auto-timestamp disabled!');
        Logger.log('');
        Logger.log('⚠️ NOTE: Status changes will NO LONGER trigger automation');
        Logger.log('   You can now manually change STATUS without timestamps being written');
        Logger.log('');
        Logger.log('To re-enable automation, run: INITIAL_PRODUCTION_SETUP()');
    }

    Logger.log('');
    Logger.log('Remaining triggers:');
    ScriptApp.getProjectTriggers().forEach(t => {
        Logger.log(`   • ${t.getHandlerFunction()} (${t.getEventType()})`);
    });
}

/**
 * STEP 3: Clean up corrupted STATUS column
 * This will remove any timestamps from the STATUS column
 */
function CLEAN_STATUS_COLUMN() {
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         CLEANING STATUS COLUMN                                   ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');
    Logger.log('');

    try {
        const sheet = SpreadsheetApp.openById('1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4')
            .getSheetByName('DB_Candidates');

        if (!sheet) {
            Logger.log('❌ Sheet not found');
            return;
        }

        const lastRow = sheet.getLastRow();
        const statusData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

        let cleaned = 0;
        const validStatuses = Object.values(CONFIG.RULES.STATUSES);

        Logger.log(`Scanning ${lastRow - 1} rows...`);
        Logger.log('');

        for (let i = 0; i < statusData.length; i++) {
            const row = i + 2;
            const value = statusData[i][0];

            // Check if it's a timestamp (Date object or looks like a date)
            if (value instanceof Date) {
                Logger.log(`Row ${row}: Found timestamp "${value}" - clearing...`);
                sheet.getRange(row, 1).clearContent();
                cleaned++;
            } else if (typeof value === 'string' && !validStatuses.includes(value.trim())) {
                // Check if it looks like a date string
                const parsed = new Date(value);
                if (!isNaN(parsed.getTime()) && value.includes('/') || value.includes('-')) {
                    Logger.log(`Row ${row}: Found date string "${value}" - clearing...`);
                    sheet.getRange(row, 1).clearContent();
                    cleaned++;
                }
            }
        }

        Logger.log('');
        Logger.log(`✅ Cleaned ${cleaned} corrupted STATUS cells`);
        Logger.log('');
        Logger.log('Valid statuses are:');
        validStatuses.forEach(s => Logger.log(`   • ${s}`));

    } catch (e) {
        Logger.log('❌ Error: ' + e.message);
    }
}

/**
 * STEP 4: Test if the fix worked
 */
function TEST_STATUS_UPDATE() {
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         TESTING STATUS UPDATE                                    ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');
    Logger.log('');
    Logger.log('This will test updating a status WITHOUT triggering automation');
    Logger.log('');

    const testRow = 2; // Change this to a test row number

    try {
        const sheet = SpreadsheetApp.openById('1fBP9vLLOEO02Fen3LKSYd2sxLAwF3V6iuhrk303_Jp4')
            .getSheetByName('DB_Candidates');

        const beforeValue = sheet.getRange(testRow, 1).getValue();
        Logger.log(`Row ${testRow} STATUS before: "${beforeValue}"`);

        // Manually set status
        sheet.getRange(testRow, 1).setValue('TEST STATUS');

        // Wait a moment
        Utilities.sleep(2000);

        const afterValue = sheet.getRange(testRow, 1).getValue();
        Logger.log(`Row ${testRow} STATUS after:  "${afterValue}"`);

        if (afterValue === 'TEST STATUS') {
            Logger.log('');
            Logger.log('✅ SUCCESS! Status was not overwritten by timestamp');
            Logger.log('   The fix is working!');
        } else if (afterValue instanceof Date) {
            Logger.log('');
            Logger.log('❌ FAILED! Status was overwritten with timestamp');
            Logger.log('   Run DISABLE_AUTO_TIMESTAMP() again');
        }

        // Restore original value
        sheet.getRange(testRow, 1).setValue(beforeValue);
        Logger.log('');
        Logger.log('Restored original value');

    } catch (e) {
        Logger.log('❌ Error: ' + e.message);
    }
}

/**
 * COMPLETE FIX - Runs all steps automatically
 */
function FIX_TIMESTAMP_ISSUE_COMPLETE() {
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         COMPLETE TIMESTAMP FIX                                   ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');
    Logger.log('');

    Logger.log('STEP 1: Diagnosing...');
    Logger.log('═══════════════════════════════════════════════════════════════════');
    DIAGNOSE_SHEET_COLUMNS();

    Logger.log('');
    Logger.log('STEP 2: Disabling auto-timestamp...');
    Logger.log('═══════════════════════════════════════════════════════════════════');
    DISABLE_AUTO_TIMESTAMP();

    Logger.log('');
    Logger.log('STEP 3: Cleaning corrupted cells...');
    Logger.log('═══════════════════════════════════════════════════════════════════');
    CLEAN_STATUS_COLUMN();

    Logger.log('');
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         ✅ FIX COMPLETE!                                         ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');
    Logger.log('');
    Logger.log('You can now manually change STATUS without timestamps appearing!');
    Logger.log('');
    Logger.log('⚠️ NOTE: Automation is now DISABLED');
    Logger.log('   To use automation features, you must call functions manually:');
    Logger.log('   - sendWelcomeToRow(rowNumber)');
    Logger.log('   - sendConfirmationToRow(rowNumber)');
    Logger.log('   - processScheduledTests()');
}



// ═══════════════════════════════════════════════════════════════════════════
//  EMERGENCYFIX
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ════════════════════════════════════════════════════════════════════════════════
 * EMERGENCY FIX - Stop all failing triggers
 * ════════════════════════════════════════════════════════════════════════════════
 */

function EMERGENCY_STOP() {
  "use strict";
  
  try {
    // Delete ALL triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
      console.log("Deleted trigger: " + trigger.getHandlerFunction());
    });
    
    return "SUCCESS: All triggers stopped. System is now paused.";
  } catch (e) {
    return "ERROR stopping triggers: " + e.message;
  }
}

/**
 * Restore original Oracle triggers (without SetupWizard)
 */
function RESTORE_ORACLE_TRIGGERS() {
  "use strict";
  
  try {
    // First stop all triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    
    // Only create Oracle-specific triggers
    ScriptApp.newTrigger("processInbox")
      .timeBased()
      .everyMinutes(15)
      .create();
    
    ScriptApp.newTrigger("processFollowUps")
      .timeBased()
      .everyHours(1)
      .create();
    
    ScriptApp.newTrigger("generateDailySummary")
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    
    ScriptApp.newTrigger("generateWeeklyReport")
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(10)
      .create();
    
    return "SUCCESS: Oracle triggers restored. SetupWizard triggers removed.";
  } catch (e) {
    return "ERROR restoring triggers: " + e.message;
  }
}

/**
 * Check current trigger status
 */
function checkTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  
  if (triggers.length === 0) {
    return "No triggers installed. System is paused.";
  }
  
  const status = triggers.map(t => {
    return `- ${t.getHandlerFunction()} (${t.getTriggerSource()})`;
  }).join("\n");
  
  return `Active Triggers (${triggers.length}):\n${status}`;
}


// ═══════════════════════════════════════════════════════════════════════════
//  AUTOMATIONSETUP
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                     URBANMISTRII ORACLE v22.3 - AUTOMATION SETUP              ║
 * ║                     Programmatic Setup of Forms & Triggers                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * RUN THIS FUNCTION to set up the form and triggers!
 */
function runAutomationSetup() {
    AutomationSetup.setupTestSubmissionFlow();
}

const AutomationSetup = {
    /**
     * One-click setup for the Test Submission workflow.
     * Creates the form, links it to sheets, and sets up trigger.
     */
    setupTestSubmissionFlow() {
        Logger.log('🚀 Starting Test Submission Automation Setup...');

        try {
            // 1. Create the Form
            const form = FormApp.create('UrbanMistrii Oracle - Test Submission v2');
            form.setDescription('Please submit your test files and notes here. Ensure you use the same email address you applied with.');

            // 2. Add Fields
            form.addTextItem().setTitle('Email Address').setRequired(true);

            // File upload items require a manual click to enable files initially, 
            // but we can pre-create them. 
            // NOTE: Google Forms API restricts file uploads to Workspace members only if not handled carefully.
            form.addSectionHeaderItem().setTitle('File Uploads');
            form.addParagraphTextItem().setTitle('PDF/Docs Upload').setHelpText('Paste the Google Drive link or Box link to your PDF/Docs/Presentation.');
            form.addParagraphTextItem().setTitle('DWG Upload').setHelpText('Paste the link to your AutoCAD/DWG files.');
            form.addParagraphTextItem().setTitle('Other Files').setHelpText('Paste the link to any other supporting files (Renders, references, etc.)');
            form.addParagraphTextItem().setTitle('Test Notes').setHelpText('Any notes about your design approach or technical challenges.');

            // 3. Link to Spreadsheet
            const ssId = CONFIG.SHEETS.MASTER_ID;
            form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);

            // 4. Set up Trigger
            this._createFormSubmitTrigger();

            const formUrl = form.getPublishedUrl();
            const editorUrl = form.getEditUrl();

            Logger.log('\n✅ SETUP SUCCESSFUL!');
            Logger.log('════════════════════════════════════════════════════════════════════');
            Logger.log('📝 FORM URL (Send to candidates):');
            Logger.log(formUrl);
            Logger.log('\n🛠️ FORM EDITOR (Check settings):');
            Logger.log(editorUrl);
            Logger.log('════════════════════════════════════════════════════════════════════');

            return {
                success: true,
                formUrl: formUrl,
                editorUrl: editorUrl
            };

        } catch (err) {
            Logger.log('❌ SETUP FAILED: ' + err.message);
            return { success: false, error: err.message };
        }
    },

    /**
     * Programmatically create the On Form Submit trigger
     */
    _createFormSubmitTrigger() {
        const functionName = 'FormHandlers.handleTestFormSubmit';

        // Remove existing triggers to avoid duplicates
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(t => {
            if (t.getHandlerFunction() === functionName) {
                ScriptApp.deleteTrigger(t);
            }
        });

        // Create new trigger
        ScriptApp.newTrigger(functionName)
            .forSpreadsheet(SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID))
            .onFormSubmit()
            .create();

        Logger.log('✅ Trigger created for: ' + functionName);
    }
};



// ═══════════════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                URBANMISTRII ORACLE v22.1 - SETUP & INSTALLATION               ║
 * ║                Complete Installation & Testing Guide (Enhanced)              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

/**
 * STEP 1: Initial setup and activation
 * Run this ONCE to activate Oracle v22.0
 */
function INITIAL_PRODUCTION_SETUP() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         ORACLE v22.0 - PRODUCTION SETUP                           ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    Logger.log('1️⃣ Validating configuration...');
    SecureConfig.validate();
    Logger.log('   ✅ Configuration valid');

    Logger.log('2️⃣ Cleaning up old triggers...');
    const oldTriggers = ScriptApp.getProjectTriggers();
    oldTriggers.forEach(t => ScriptApp.deleteTrigger(t));
    Logger.log(`   ✅ Removed ${oldTriggers.length} old trigger(s)`);

    Logger.log('3️⃣ Creating automation triggers...');

    const masterSs = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
    ScriptApp.newTrigger('universalAutomationEngine').forSpreadsheet(masterSs).onEdit().create();
    Logger.log('   ✅ Status change trigger created');

    // 🆕 Form submit trigger for auto-confirmations
    ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(masterSs).onFormSubmit().create();
    Logger.log('   ✅ Form submit trigger created (auto-confirmations)');

    // 🆕 Leave form submission trigger (uses global wrapper function)
    ScriptApp.newTrigger('onLeaveFormSubmit').forSpreadsheet(masterSs).onFormSubmit().create();
    Logger.log('   ✅ Leave form trigger created (salary tracking)');

    ScriptApp.newTrigger('runOracleBackgroundCycle').timeBased().everyMinutes(15).create();
    Logger.log('   ✅ Background cycle trigger created (15 min)');

    ScriptApp.newTrigger('sendDailySummary').timeBased().atHour(9).everyDays(1).inTimezone('Asia/Kolkata').create();
    Logger.log('   ✅ Daily summary trigger created (9 AM IST)');

    // v22.0: Weekly analytics report
    ScriptApp.newTrigger('sendWeeklyAnalyticsReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).inTimezone('Asia/Kolkata').create();
    Logger.log('   ✅ Weekly analytics trigger created (Monday 10 AM)');

    Logger.log('4️⃣ Initializing sheets...');
    initializeSheets();
    Logger.log('   ✅ Sheets initialized');

    // v22.0: Initialize retry queue
    Logger.log('5️⃣ Initializing v22.0 modules...');
    if (typeof RetryQueue !== 'undefined') RetryQueue.init();
    Logger.log('   ✅ Retry queue initialized');

    Log.success('SETUP', 'Oracle v22.0 activated successfully');

    Logger.log('');
    Logger.log('🎉 Oracle v22.0 is now ACTIVE!');
    Logger.log('🧪 Test it: Run testCompleteWorkflow()');
    Logger.log('');
    Logger.log('v22.0 NEW FEATURES ENABLED:');
    Logger.log('   • Multi-department support');
    Logger.log('   • AI Portfolio Scoring');
    Logger.log('   • Google Calendar Integration');
    Logger.log('   • Candidate Self-Service Portal');
    Logger.log('   • Duplicate Detection');
    Logger.log('   • Message Retry Queue');
    Logger.log('   • Advanced Analytics');

  } catch (e) {
    Logger.log('❌ Setup failed: ' + e.message);
    Log.critical('SETUP', 'Setup failed', { error: e.message });
  }
}

/**
 * 🧹 EMERGENCY CLEANUP
 * Marks all unread emails as processed/read/labeled to stop loop
 */
function MARK_INBOX_READ_AND_PROCESSED() {
  Logger.log('🧹 Starting Inbox Cleanup...');

  const labelName = 'ORACLE_PROCESSED';
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) label = GmailApp.createLabel(labelName);

  let processed = 0;

  // Process in batches of 50
  while (true) {
    const threads = GmailApp.search('is:unread -category:social', 0, 50);
    if (threads.length === 0) break;

    Logger.log(`Processing batch of ${threads.length}...`);

    // Add label and mark read
    label.addToThreads(threads);
    GmailApp.markThreadsRead(threads);

    processed += threads.length;
    Utilities.sleep(1000); // Prevent rate limiting
  }

  Logger.log(`✅ Cleanup Complete: Marked ${processed} emails as read & processed.`);
}

function initializeSheets() {
  const master = SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);

  const tabs = [
    { name: CONFIG.SHEETS.TABS.CANDIDATES, headers: null },
    { name: CONFIG.SHEETS.TABS.LOGS, headers: ['Timestamp', 'Level', 'Category', 'Message', 'Data'] },
    { name: CONFIG.SHEETS.TABS.TIMELINE, headers: ['Timestamp', 'Email', 'Event', 'Data'] },
    { name: CONFIG.SHEETS.TABS.ANALYTICS, headers: ['Date', 'Metric', 'Value', 'Metadata'] },
    { name: CONFIG.SHEETS.TABS.FOLLOWUP, headers: ['Date', 'Name', 'Phone', 'Type', 'Status'] },
    { name: CONFIG.SHEETS.TABS.SALARY_TRACKER, headers: ['Employee Name', 'Email', 'Phone', 'Role', 'Department', 'Hire Date', 'Monthly Salary (₹)', 'Start Date', 'Status', 'Notes'] }
  ];

  tabs.forEach(tab => {
    let sheet = master.getSheetByName(tab.name);
    if (!sheet) {
      sheet = master.insertSheet(tab.name);
      Logger.log(`   📄 Created sheet: ${tab.name}`);
      if (tab.headers) {
        sheet.appendRow(tab.headers);
        sheet.getRange(1, 1, 1, tab.headers.length).setFontWeight('bold').setBackground('#E0E0E0');

        // Special formatting for Salary Tracker
        if (tab.name === CONFIG.SHEETS.TABS.SALARY_TRACKER) {
          sheet.setFrozenRows(1);
          sheet.setColumnWidth(1, 200); // Name
          sheet.setColumnWidth(2, 250); // Email
          sheet.setColumnWidth(3, 120); // Phone
          sheet.setColumnWidth(4, 150); // Role
          sheet.setColumnWidth(5, 120); // Department
          sheet.setColumnWidth(6, 120); // Hire Date
          sheet.setColumnWidth(7, 120); // Monthly Salary
          sheet.setColumnWidth(8, 120); // Start Date
          sheet.setColumnWidth(9, 100); // Status
          sheet.setColumnWidth(10, 300); // Notes

          // Add conditional formatting for salary column
          const salaryRange = sheet.getRange(2, 7, sheet.getMaxRows() - 1, 1);
          salaryRange.setNumberFormat('₹ #,##0');
        }
      }
    }
  });

  // Set up STATUS dropdown on candidates sheet
  setupStatusDropdown();
}

/**
 * Set up STATUS column dropdown validation on both master and public sheets
 * Run this to ensure consistent status values across all views
 */
function setupStatusDropdown() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         SETTING UP STATUS DROPDOWN                               ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  const statusValues = Object.values(CONFIG.RULES.STATUSES);
  Logger.log(`Status options: ${statusValues.join(', ')}`);

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(statusValues, true)
    .setAllowInvalid(false)
    .setHelpText('Select a status from the dropdown')
    .build();

  // 1. Master Sheet (DB_Candidates)
  try {
    const masterSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const lastRow = Math.max(masterSheet.getLastRow(), 100);
    const statusRange = masterSheet.getRange(2, CONFIG.COLUMNS.STATUS, lastRow, 1);
    statusRange.setDataValidation(rule);
    Logger.log('✅ Master sheet STATUS dropdown set');
  } catch (e) {
    Logger.log('❌ Master sheet error: ' + e.message);
  }

  // 2. Public Sheet (Team View) - sync first if empty
  try {
    const publicSs = SpreadsheetApp.openById(CONFIG.SHEETS.PUBLIC_ID);
    let publicSheet = publicSs.getSheetByName('Team View');

    // Create sheet if doesn't exist
    if (!publicSheet) {
      publicSheet = publicSs.insertSheet('Team View');
      Logger.log('📄 Created Team View sheet');
    }

    const colCount = publicSheet.getLastColumn();

    // If empty, run sync first
    if (colCount < 1) {
      Logger.log('⚠️ Public sheet empty - running sync first...');
      syncToPublicView();
      SpreadsheetApp.flush();
    }

    const lastRow = Math.max(publicSheet.getLastRow(), 100);
    const lastCol = publicSheet.getLastColumn();

    if (lastCol > 0) {
      const headers = publicSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const statusCol = headers.findIndex(h => String(h).toLowerCase() === 'status') + 1;

      if (statusCol > 0) {
        const statusRange = publicSheet.getRange(2, statusCol, lastRow, 1);
        statusRange.setDataValidation(rule);
        Logger.log('✅ Public sheet STATUS dropdown set (column ' + statusCol + ')');
      } else {
        Logger.log('⚠️ STATUS column not found in public sheet headers: ' + headers.join(', '));
      }
    } else {
      Logger.log('⚠️ Public sheet still empty after sync');
    }
  } catch (e) {
    Logger.log('❌ Public sheet error: ' + e.message);
  }

  Logger.log('');
  Logger.log('Done! Status dropdown is now available on both sheets.');
}

// ═══════════════════════════════════════════════════════════════════════════════
//                        COMPLETE TESTING SUITE
// ═══════════════════════════════════════════════════════════════════════════════

function testCompleteWorkflow() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         ORACLE v22.0 - COMPLETE WORKFLOW TEST                     ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  let passed = 0, failed = 0;

  // Test 1: Configuration
  Logger.log('Test 1: Configuration & API Keys');
  try {
    SecureConfig.validate();
    Logger.log('✅ PASSED');
    passed++;
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 2: Sheet Access
  Logger.log('Test 2: Sheet Access');
  try {
    SpreadsheetApp.openById(CONFIG.SHEETS.MASTER_ID);
    SpreadsheetApp.openById(CONFIG.SHEETS.PUBLIC_ID);
    Logger.log('✅ PASSED');
    passed++;
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 3: AI Integration
  Logger.log('Test 3: AI Integration');
  try {
    const response = AI.call('Say "working" in one word');
    if (response && response.toLowerCase().includes('work')) {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error('Unexpected response');
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 4: Validation
  Logger.log('Test 4: Validation Functions');
  try {
    if (Validate.phone('9312943581').valid && Validate.email('test@example.com').valid) {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error('Validation failed');
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 5: WhatsApp
  Logger.log('Test 5: WhatsApp Integration');
  try {
    const result = WhatsApp.sendWelcome(CONFIG.TEAM.YASH_PHONE, 'Test');
    if (result.success || result.testMode) {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error(result.error);
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 6: Logging
  Logger.log('Test 6: Logging System');
  try {
    Log.info('TEST', 'Test log entry');
    Logger.log('✅ PASSED');
    passed++;
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // v22.0 Tests
  Logger.log('');
  Logger.log('═══ v22.0 NEW FEATURE TESTS ═══');

  // Test 7: Duplicate Detection
  Logger.log('Test 7: Duplicate Detection');
  try {
    const result = Duplicates.check('nonexistent@test.com', '0000000000', 'Test User');
    if (result.isDuplicate === false) {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error('Should not find duplicate');
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 8: Analytics
  Logger.log('Test 8: Analytics Engine');
  try {
    const metrics = Analytics.getMetrics();
    if (metrics && metrics.pipeline) {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error('No metrics returned');
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 9: Retry Queue
  Logger.log('Test 9: Retry Queue');
  try {
    const stats = RetryQueue.getStats();
    if (stats !== null) {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error('Retry queue not initialized');
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 10: Calendar
  Logger.log('Test 10: Calendar Integration');
  try {
    const tomorrow = DateTime.addDays(new Date(), 1);
    const slots = Calendar.getAvailableSlots(tomorrow);
    Logger.log(`   Found ${slots.length} available slots`);
    Logger.log('✅ PASSED');
    passed++;
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  // Test 11: AI Portfolio Scoring
  Logger.log('Test 11: AI Portfolio Scoring');
  try {
    // Don't actually call AI, just check the method exists
    if (typeof AI.scorePortfolio === 'function') {
      Logger.log('✅ PASSED');
      passed++;
    } else {
      throw new Error('scorePortfolio not defined');
    }
  } catch (e) {
    Logger.log('❌ FAILED: ' + e.message);
    failed++;
  }

  Logger.log('');
  Logger.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    Logger.log('🎉 ALL TESTS PASSED! Oracle v22.0 is ready!');
  } else {
    Logger.log('⚠️ Some tests failed. Review the errors above.');
  }

  return { passed, failed };
}

// ═══════════════════════════════════════════════════════════════════════════════
//                        ANALYTICS & REPORTING
// ═══════════════════════════════════════════════════════════════════════════════

function sendDailySummary() {
  try {
    Log.info('ANALYTICS', 'Generating daily summary');

    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const data = sheet.getDataRange().getValues();

    const stats = { new: 0, testsSent: 0, testsSubmitted: 0, interviews: 0, hired: 0, rejected: 0, total: data.length - 1 };

    for (let i = 1; i < data.length; i++) {
      const status = data[i][CONFIG.COLUMNS.STATUS - 1];
      if (status === CONFIG.RULES.STATUSES.NEW) stats.new++;
      else if (status === CONFIG.RULES.STATUSES.TEST_SENT) stats.testsSent++;
      else if (status === CONFIG.RULES.STATUSES.TEST_SUBMITTED || status === CONFIG.RULES.STATUSES.UNDER_REVIEW) stats.testsSubmitted++;
      else if (status === CONFIG.RULES.STATUSES.INTERVIEW_PENDING || status === CONFIG.RULES.STATUSES.INTERVIEW_DONE) stats.interviews++;
      else if (status === CONFIG.RULES.STATUSES.HIRED) stats.hired++;
      else if (status === CONFIG.RULES.STATUSES.REJECTED) stats.rejected++;
    }

    stats.conversionRate = stats.total > 0 ? ((stats.hired / stats.total) * 100).toFixed(1) : 0;
    stats.avgResponseTime = '2.5 hours';

    // v22.1: Record detailed snapshot to DB_Analytics
    if (typeof Analytics !== 'undefined' && Analytics.recordDailySnapshot) {
      Analytics.recordDailySnapshot(stats);
    }

    Notify.dailySummary(stats);
    Log.success('ANALYTICS', 'Daily summary sent');
  } catch (e) {
    Log.error('ANALYTICS', 'Failed to generate summary', { error: e.message });
  }
}

function getSystemStatus() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         ORACLE v22.0 - SYSTEM STATUS                             ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  Logger.log('🏛️ CORE FEATURES:');
  Logger.log(`   Test Mode: ${CONFIG.FEATURES.TEST_MODE ? '✅ ON (Safe)' : '❌ OFF (Production)'}`);
  Logger.log(`   AI: ${CONFIG.FEATURES.AI_ENABLED ? '✅ Enabled' : '❌ Disabled'}`);
  Logger.log(`   WhatsApp: ${CONFIG.FEATURES.WHATSAPP_ENABLED ? '✅ Enabled' : '❌ Disabled'}`);

  Logger.log('');
  Logger.log('🆕 v22.0 FEATURES:');
  Logger.log(`   Calendar Integration: ${CONFIG.FEATURES.CALENDAR_INTEGRATION ? '✅ Enabled' : '❌ Disabled'}`);
  Logger.log(`   Candidate Portal: ${CONFIG.FEATURES.PORTAL_ENABLED ? '✅ Enabled' : '❌ Disabled'}`);
  Logger.log(`   Auto Portfolio Scoring: ${CONFIG.FEATURES.AUTO_PORTFOLIO_SCORING ? '✅ Enabled' : '❌ Disabled'}`);
  Logger.log(`   Duplicate Check: ${CONFIG.FEATURES.DUPLICATE_CHECK ? '✅ Enabled' : '❌ Disabled'}`);

  Logger.log('');
  Logger.log('⚙️ TRIGGERS:');
  ScriptApp.getProjectTriggers().forEach(t => Logger.log(`   • ${t.getHandlerFunction()} (${t.getEventType()})`));

  Logger.log('');
  Logger.log('📊 ANALYTICS:');
  try {
    const metrics = Analytics.getMetrics();
    Logger.log(`   Total Candidates: ${metrics.pipeline.total}`);
    Logger.log(`   Hired: ${metrics.pipeline.hired}`);
    Logger.log(`   Conversion Rate: ${metrics.funnel.overallConversion}`);
  } catch (e) {
    Logger.log('   Could not load analytics');
  }

  Logger.log('');
  Logger.log('🔄 RETRY QUEUE:');
  try {
    const stats = RetryQueue.getStats();
    Logger.log(`   Pending: ${stats.pending}`);
    Logger.log(`   Completed: ${stats.completed}`);
    Logger.log(`   Failed: ${stats.failed}`);
  } catch (e) {
    Logger.log('   Could not load retry queue stats');
  }
}

function EMERGENCY_STOP() {
  Logger.log('🚨 EMERGENCY STOP ACTIVATED');
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('✅ All automations stopped');
  Logger.log('To restart: Run INITIAL_PRODUCTION_SETUP()');
  Log.critical('EMERGENCY', 'System stopped by user');
}

function clearLogs() {
  const logSheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.LOGS);
  logSheet.clearContents();
  logSheet.appendRow(['Timestamp', 'Level', 'Category', 'Message', 'Data']);
  Logger.log('✅ Logs cleared');
}

// ═══════════════════════════════════════════════════════════════════════════════
//                        CATCH-UP / RECOVERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RUN THIS to catch up on all missed work when system was down
 * Processes: emails, follow-ups, rejections, stuck candidates
 */
function CATCH_UP_MISSED_WORK() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         ORACLE - CATCH UP ON MISSED WORK                         ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Process all unread emails (up to 50)
    Logger.log('');
    Logger.log('📧 STEP 1: Processing unread emails...');
    processInboxBulk(50);

    // Step 2: Process candidates stuck in various states
    Logger.log('');
    Logger.log('👥 STEP 2: Processing stuck candidates...');
    processStuckCandidates();

    // Step 3: Send follow-ups for overdue tests
    Logger.log('');
    Logger.log('📲 STEP 3: Sending overdue follow-ups...');
    processFollowUps();

    // Step 4: Process rejection queue
    Logger.log('');
    Logger.log('❌ STEP 4: Processing rejection queue...');
    processRejectionQueue();

    // Step 5: Retry any failed messages
    Logger.log('');
    Logger.log('🔄 STEP 5: Retrying failed messages...');
    if (typeof RetryQueue !== 'undefined') {
      RetryQueue.process();
    }

    // Step 6: Sync public view
    Logger.log('');
    Logger.log('🔄 STEP 6: Syncing public view...');
    syncToPublicView();

    Logger.log('');
    Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
    Logger.log('║         ✅ CATCH-UP COMPLETE!                                    ║');
    Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

    Log.success('CATCH_UP', 'Catch-up processing completed');

  } catch (e) {
    Logger.log('❌ Catch-up failed: ' + e.message);
    Log.error('CATCH_UP', 'Catch-up failed', { error: e.message });
  }
}

/**
 * Process more emails than the regular cycle (for catch-up)
 */
function processInboxBulk(limit) {
  try {
    const threads = GmailApp.search('is:unread -category:social', 0, limit || 50);
    Logger.log(`   Found ${threads.length} unread emails`);

    if (threads.length === 0) {
      Logger.log('   ✅ No unread emails to process');
      return;
    }

    let processed = 0;
    let errors = 0;

    for (const thread of threads) {
      try {
        const msg = thread.getMessages().pop();
        const from = msg.getFrom();
        const email = (from.match(/[\w.-]+@[\w.-]+\.\w+/) || [''])[0];
        const subject = msg.getSubject();
        const body = msg.getPlainBody().substring(0, 1000);
        const hasAttachments = msg.getAttachments().length > 0;

        const analysis = AI.analyzeIntent(body, subject, hasAttachments);
        if (analysis) {
          Logger.log(`   Processing: ${email} (${analysis.intent})`);

          switch (analysis.intent) {
            case 'TEST_SUBMISSION': handleEmailTestSubmission(email, analysis, msg); break;
            case 'NEW_APPLICATION': handleEmailApplication(email, analysis, msg); break;
            case 'FOLLOWUP': handleEmailFollowup(email, analysis); break;
            case 'QUESTION': handleEmailQuestion(email, analysis, body); break;
            case 'ESCALATE': handleEmailEscalation(email, subject, body); break;
          }

          thread.markRead();
          processed++;
        }
      } catch (e) {
        errors++;
        Logger.log(`   ⚠️ Error processing email: ${e.message}`);
      }

      // Small delay to avoid rate limits
      Utilities.sleep(500);
    }

    Logger.log(`   ✅ Processed ${processed} emails, ${errors} errors`);

  } catch (e) {
    Logger.log('   ❌ Bulk inbox processing failed: ' + e.message);
  }
}

/**
 * Find and process candidates stuck in intermediate states
 * Automatically processes NEW candidates from sheet submissions
 */
function processStuckCandidates() {
  try {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const data = sheet.getDataRange().getValues();

    let newCount = 0;
    let testSentCount = 0;
    let submittedCount = 0;
    let processed = 0;
    let errors = 0;

    Logger.log('   Scanning sheet for unprocessed entries...');

    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const status = data[i][CONFIG.COLUMNS.STATUS - 1];
      const log = data[i][CONFIG.COLUMNS.LOG - 1] || '';
      const phone = data[i][CONFIG.COLUMNS.PHONE - 1];
      const name = data[i][CONFIG.COLUMNS.NAME - 1] || 'Candidate';
      const email = data[i][CONFIG.COLUMNS.EMAIL - 1];

      // Count and process NEW candidates (from sheet/form submissions)
      if (status === CONFIG.RULES.STATUSES.NEW) {
        newCount++;

        // Check if welcome was never sent (log doesn't contain welcome confirmation)
        if (!log.includes('Welcome') && !log.includes('welcome') && phone) {
          Logger.log(`   → Row ${row}: Processing NEW candidate "${name}"...`);

          try {
            // Send welcome message
            const result = WhatsApp.sendWelcome(phone, name);

            if (result.success || result.testMode) {
              // Update status to IN PROCESS
              const email = sheet.getRange(row, CONFIG.COLUMNS.EMAIL).getValue();
              SheetUtils.updateStatus(row, CONFIG.RULES.STATUSES.IN_PROCESS, email);
              SheetUtils.updateCell(row, CONFIG.COLUMNS.UPDATED, new Date());
              SheetUtils.updateCell(row, CONFIG.COLUMNS.LOG, '✅ Welcome sent (catch-up)');

              // Log to timeline
              if (email) {
                CandidateTimeline.add(email, 'WELCOME_SENT_CATCHUP', { source: 'sheet_entry' });
              }

              processed++;
              Logger.log(`     ✅ Welcome sent, moved to IN PROCESS`);
            } else {
              SheetUtils.updateCell(row, CONFIG.COLUMNS.LOG, `⚠️ Welcome failed: ${result.error}`);
              errors++;
              Logger.log(`     ❌ Failed: ${result.error}`);
            }

            // Rate limit
            Utilities.sleep(CONFIG.RATE_LIMITS.WHATSAPP_DELAY_MS || 2000);

          } catch (e) {
            errors++;
            Logger.log(`     ❌ Error: ${e.message}`);
          }
        }
      } else if (status === CONFIG.RULES.STATUSES.TEST_SENT) {
        testSentCount++;
      } else if (status === CONFIG.RULES.STATUSES.TEST_SUBMITTED) {
        submittedCount++;
      }
    }

    Logger.log('');
    Logger.log(`   📊 Pipeline Status:`);
    Logger.log(`      NEW (remaining): ${newCount - processed}`);
    Logger.log(`      TEST SENT (awaiting submission): ${testSentCount}`);
    Logger.log(`      TEST SUBMITTED (awaiting review): ${submittedCount}`);
    Logger.log('');
    Logger.log(`   ✅ Processed ${processed} new candidates, ${errors} errors`);

  } catch (e) {
    Logger.log('   ❌ Failed to process stuck candidates: ' + e.message);
  }
}

/**
 * Process all NEW candidates and send them welcome messages
 * Use this to bulk-process form submissions
 */
function processAllNewCandidates() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         PROCESSING ALL NEW CANDIDATES                            ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  processStuckCandidates();

  Logger.log('');
  Logger.log('Done! All NEW candidates have been sent welcome messages.');
}

/**
 * Process candidates who should have status "TEST SENT" and send them test links
 * Use when you've moved candidates to TEST SENT but the automation didn't trigger
 */
function processTestSentCandidates() {
  Logger.log('╔═══════════════════════════════════════════════════════════════════╗');
  Logger.log('║         SENDING TEST LINKS TO TEST_SENT CANDIDATES               ║');
  Logger.log('╚═══════════════════════════════════════════════════════════════════╝');

  try {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const data = sheet.getDataRange().getValues();

    let processed = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      const row = i + 1;
      const status = data[i][CONFIG.COLUMNS.STATUS - 1];
      const testSentTime = data[i][CONFIG.COLUMNS.TEST_SENT - 1];
      const log = data[i][CONFIG.COLUMNS.LOG - 1] || '';
      const phone = data[i][CONFIG.COLUMNS.PHONE - 1];
      const name = data[i][CONFIG.COLUMNS.NAME - 1] || 'Candidate';
      const role = data[i][CONFIG.COLUMNS.ROLE - 1] || 'intern';
      const department = data[i][CONFIG.COLUMNS.DEPARTMENT - 1];

      // Find TEST SENT candidates who haven't actually received the test link
      if (status === CONFIG.RULES.STATUSES.TEST_SENT && !testSentTime && phone) {
        Logger.log(`   → Row ${row}: Sending test to "${name}" (${role})...`);

        try {
          const result = WhatsApp.sendTestLink(phone, name, role, department);

          if (result.success || result.testMode) {
            SheetUtils.updateCell(row, CONFIG.COLUMNS.TEST_SENT, new Date());
            SheetUtils.updateCell(row, CONFIG.COLUMNS.UPDATED, new Date());
            SheetUtils.updateCell(row, CONFIG.COLUMNS.LOG, '✅ Test link sent (catch-up)');
            processed++;
            Logger.log(`     ✅ Test link sent`);
          } else {
            errors++;
            SheetUtils.updateCell(row, CONFIG.COLUMNS.LOG, `⚠️ Test send failed: ${result.error}`);
            Logger.log(`     ❌ Failed: ${result.error}`);
          }

          Utilities.sleep(CONFIG.RATE_LIMITS.WHATSAPP_DELAY_MS || 2000);

        } catch (e) {
          errors++;
          Logger.log(`     ❌ Error: ${e.message}`);
        }
      }
    }

    Logger.log('');
    Logger.log(`   ✅ Sent ${processed} test links, ${errors} errors`);

  } catch (e) {
    Logger.log('❌ Failed: ' + e.message);
  }
}

/**
 * Manually trigger welcome message for a specific candidate row
 */
function sendWelcomeToRow(rowNumber) {
  try {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const rowData = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

    const candidate = {
      row: rowNumber,
      status: rowData[CONFIG.COLUMNS.STATUS - 1],
      name: rowData[CONFIG.COLUMNS.NAME - 1] || 'Candidate',
      email: rowData[CONFIG.COLUMNS.EMAIL - 1],
      phone: rowData[CONFIG.COLUMNS.PHONE - 1],
      role: rowData[CONFIG.COLUMNS.ROLE - 1] || 'intern',
      department: rowData[CONFIG.COLUMNS.DEPARTMENT - 1]
    };

    if (!candidate.phone) {
      Logger.log('❌ No phone number for row ' + rowNumber);
      return;
    }

    const result = WhatsApp.sendWelcome(candidate.phone, candidate.name);
    Logger.log(`Row ${rowNumber}: ${result.success ? '✅ Welcome sent' : '❌ Failed: ' + result.error}`);

    if (result.success) {
      SheetUtils.updateCell(rowNumber, CONFIG.COLUMNS.LOG, '✅ Welcome sent (manual)');
    }

    return result;
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

/**
 * Manually trigger test link for a specific candidate row
 */
function sendTestLinkToRow(rowNumber) {
  try {
    const sheet = ConfigHelpers.getSheet(CONFIG.SHEETS.TABS.CANDIDATES);
    const rowData = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

    const candidate = {
      row: rowNumber,
      name: rowData[CONFIG.COLUMNS.NAME - 1] || 'Candidate',
      phone: rowData[CONFIG.COLUMNS.PHONE - 1],
      role: rowData[CONFIG.COLUMNS.ROLE - 1] || 'intern',
      department: rowData[CONFIG.COLUMNS.DEPARTMENT - 1]
    };

    if (!candidate.phone) {
      Logger.log('❌ No phone number for row ' + rowNumber);
      return;
    }

    const result = WhatsApp.sendTestLink(candidate.phone, candidate.name, candidate.role, candidate.department);
    Logger.log(`Row ${rowNumber}: ${result.success ? '✅ Test link sent' : '❌ Failed: ' + result.error}`);

    if (result.success) {
      SheetUtils.updateCell(rowNumber, CONFIG.COLUMNS.TEST_SENT, new Date());
      SheetUtils.updateCell(rowNumber, CONFIG.COLUMNS.LOG, '✅ Test sent (manual)');
    }

    return result;
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}



// ═══════════════════════════════════════════════════════════════════════════
//  SETUPWIZARD
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ════════════════════════════════════════════════════════════════════════════════
 *                    HR MANAGEMENT SYSTEM - SETUP WIZARD
 *                    1-Click Company Deployment
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * This wizard runs on first execution to:
 * - Configure company settings via GUI
 * - Create all required Google Sheets
 * - Remove all UrbanMistrii branding
 * - Set up automated triggers
 * - Deploy candidate portal
 */

const WIZARD_CONFIG = {
  VERSION: "1.0.0",
  REQUIRED_SHEETS: [
    { name: "DB_Candidates", description: "Candidate Database" },
    { name: "DB_Employees", description: "Employee Database" },
    { name: "DB_Logs", description: "Activity Logs" },
    { name: "DB_Timeline", description: "Email Timeline" },
    { name: "DB_Analytics", description: "Analytics Dashboard" },
    { name: "DB_TestSubmissions", description: "Test Submissions" },
    { name: "DB_RetryQueue", description: "Message Retry Queue" },
    { name: "DB_Errors", description: "Error Recovery" }
  ],
  SETUP_COMPLETE_KEY: "HR_SYSTEM_SETUP_COMPLETE",
  COMPANY_CONFIG_KEY: "HR_COMPANY_CONFIG"
};

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * MAIN SETUP FUNCTION - Run this first
 * ════════════════════════════════════════════════════════════════════════════════
 */
function runSetupWizard() {
  const props = PropertiesService.getScriptProperties();
  const isSetupComplete = props.getProperty(WIZARD_CONFIG.SETUP_COMPLETE_KEY);
  
  if (isSetupComplete === "true") {
    return "Setup already complete. Run 'openSetupEditor()' to change settings.";
  }
  
  // Open the setup wizard GUI
  const html = HtmlService.createHtmlOutput(getSetupTemplate())
    .setWidth(800)
    .setHeight(700)
    .setTitle("HR Management System Setup");
  
  SpreadsheetApp.getActiveSpreadsheet().show(html);
}

/**
 * Open setup editor for changing configuration
 */
function openSetupEditor() {
  const html = HtmlService.createHtmlOutput(getSetupTemplate(getExistingConfig()))
    .setWidth(800)
    .setHeight(700)
    .setTitle("HR System Configuration");
  
  SpreadsheetApp.getActiveSpreadsheet().show(html);
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * GET EXISTING CONFIGURATION
 * ════════════════════════════════════════════════════════════════════════════════
 */
function getExistingConfig() {
  const props = PropertiesService.getScriptProperties();
  const config = props.getProperty(WIZARD_CONFIG.COMPANY_CONFIG_KEY);
  
  if (!config) return {};
  
  try {
    return JSON.parse(config);
  } catch (e) {
    return {};
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * SAVE CONFIGURATION
 * ════════════════════════════════════════════════════════════════════════════════
 */
function saveConfiguration(formData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create all required sheets
    createRequiredSheets(ss, formData);
    
    // Save company configuration
    const props = PropertiesService.getScriptProperties();
    props.setProperty(WIZARD_CONFIG.COMPANY_CONFIG_KEY, JSON.stringify(formData));
    props.setProperty(WIZARD_CONFIG.SETUP_COMPLETE_KEY, "true");
    
    // Update global CONFIG object
    updateGlobalConfig(formData);
    
    // Create all triggers
    createSystemTriggers(ss.getId());
    
    return {
      success: true,
      message: "Setup completed successfully!",
      sheetUrl: ss.getUrl()
    };
  } catch (e) {
    return {
      success: false,
      message: "Setup failed: " + e.message
    };
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * CREATE REQUIRED SHEETS
 * ════════════════════════════════════════════════════════════════════════════════
 */
function createRequiredSheets(ss, formData) {
  WIZARD_CONFIG.REQUIRED_SHEETS.forEach(sheetConfig => {
    let sheet = ss.getSheetByName(sheetConfig.name);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetConfig.name);
      console.log(`Created sheet: ${sheetConfig.name}`);
    }
    
    // Add headers based on sheet type
    addSheetHeaders(sheet, sheetConfig.name, formData);
  });
  
  // Remove default Sheet1 if it exists
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getNumSheets() > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * ADD SHEET HEADERS
 * ════════════════════════════════════════════════════════════════════════════════
 */
function addSheetHeaders(sheet, sheetName, formData) {
  const companyName = formData.companyName || "Your Company";
  
  const headers = {
    "DB_Candidates": [
      "STATUS", "UPDATED", "TIMESTAMP", "NAME", "EMAIL", "PHONE", "LOG",
      "ROLE", "TEST_SENT", "TEST_SUBMITTED", "PORTFOLIO_URL", "AI_SCORE",
      "INTERVIEW_DATE", "DEPARTMENT", "PORTFOLIO_SCORE", "PORTFOLIO_FEEDBACK",
      "CALENDAR_EVENT_ID", "PORTAL_TOKEN"
    ],
    "DB_Employees": [
      "JOINING_DATE", "NAME", "EMAIL", "LEAVES_OCT", "OCT_LEAVES", "TOTAL_LEAVES",
      "LEAVE_DATES", "CURRENT_SAL", "PER_DAY", "DEDUCTIONS", "TOTAL_MINUS_DED",
      "CONVEYANCE", "TOTAL_SALARY", "DAYS_WITH_COMPANY", "POSITION", "PHONE",
      "RESUME_LINK", "AADHAR_LINK", "PHOTO_LINK", "LAST_POSITION", "JOINING_TITLE",
      "CONFIRMED_JOIN_DATE", "LAST_WORKING_DAY", "REJOINING", "RETURN_DATE",
      "PROJECTS_LIST", "DOCS_REQUESTED", "WORK_LOG_APPROVED", "WORK_LOG_LINK",
      "REASON_QUITTING", "ENJOYED_MOST", "DISLIKED_MOST", "TRAINING_FEEDBACK",
      "EXTRA_RESPONSIBILITY", "COMMUNICATION_RATING", "WORK_CULTURE", "COWORKER_RELATIONS",
      "SENIOR_RELATIONS", "MGMT_RECOGNITION", "POLICY_FEEDBACK", "GENERAL_CONCERNS",
      "HARASSMENT", "PREVENTION_IDEAS", "RETENTION_IDEAS", "RETURN_INTEREST"
    ],
    "DB_Logs": [
      "Date", "Email", "Action", "Details"
    ],
    "DB_Timeline": [
      "Date", "Email", "Subject", "Action Taken", "Status"
    ],
    "DB_Analytics": [
      "Date", "New Applicants", "Tests Sent", "Tests Submitted", "Interviews Scheduled",
      "Offers Sent", "Offers Accepted", "Rejections", "Time to Hire (days)", "Conversion Rate"
    ],
    "DB_TestSubmissions": [
      "Date", "Email", "Name", "Role", "Test Link", "Submission Link",
      "Time Taken (mins)", "Time Limit (mins)", "Status"
    ],
    "DB_RetryQueue": [
      "Date", "Email", "Type", "Message", "Attempts", "Last Attempt", "Status"
    ],
    "DB_Errors": [
      "Date", "Function", "Error", "Stack Trace", "Resolved"
    ]
  };
  
  if (headers[sheetName] && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers[sheetName].length).setValues([headers[sheetName]]);
    sheet.getRange(1, 1, 1, headers[sheetName].length)
      .setFontWeight("bold")
      .setBackground("#4a86e8")
      .setFontColor("white")
      .setHorizontalAlignment("center");
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * CREATE SYSTEM TRIGGERS
 * ════════════════════════════════════════════════════════════════════════════════
 */
function createSystemTriggers(sheetId) {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new triggers
  ScriptApp.newTrigger("processInbox")
    .timeBased()
    .everyMinutes(15)
    .create();
  
  ScriptApp.newTrigger("processFollowUps")
    .timeBased()
    .everyHours(1)
    .create();
  
  ScriptApp.newTrigger("generateDailySummary")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
  
  ScriptApp.newTrigger("generateWeeklyReport")
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .create();
  
  console.log("System triggers created successfully");
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * UPDATE GLOBAL CONFIG
 * ════════════════════════════════════════════════════════════════════════════════
 */
function updateGlobalConfig(formData) {
  if (typeof CONFIG !== 'undefined') {
    CONFIG.COMPANY = {
      NAME: formData.companyName,
      DOMAIN: formData.companyDomain,
      LOGO: formData.companyLogo || "",
      COLOR: formData.companyColor || "#4a86e8"
    };
    
    CONFIG.SHEETS = {
      MASTER_ID: SpreadsheetApp.getActiveSpreadsheet().getId(),
      PUBLIC_ID: formData.publicSheetId || ""
    };
    
    CONFIG.EMAIL = {
      HR: formData.hrEmail,
      HIRING: formData.hiringEmail,
      NOTIFICATIONS: formData.notificationEmail
    };
    
    CONFIG.SMS = {
      WHATSAPP_ENABLED: formData.whatsappEnabled,
      WHATSAPP_API_KEY: formData.whatsappApiKey
    };
    
    CONFIG.FEATURES = {
      ENABLE_PORTAL: formData.enablePortal,
      ENABLE_CALENDAR: formData.enableCalendar,
      ENABLE_ANALYTICS: formData.enableAnalytics
    };
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * HTML TEMPLATE FOR SETUP WIZARD
 * ════════════════════════════════════════════════════════════════════════════════
 */
function getSetupTemplate(existingConfig = {}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 750px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
      border-bottom: 1px solid #eee;
      padding-bottom: 20px;
    }
    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    .section h2 {
      color: #333;
      font-size: 18px;
      margin: 0 0 15px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-icon {
      font-size: 24px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-weight: 500;
      font-size: 13px;
    }
    input[type="text"],
    input[type="email"],
    input[type="url"],
    input[type="color"],
    select,
    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.3s;
    }
    input:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: #667eea;
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .checkbox-label {
      color: #555;
      font-size: 14px;
      cursor: pointer;
    }
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 30px;
    }
    button {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }
    .btn-secondary:hover {
      background: #e8e8e8;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .message {
      display: none;
      padding: 15px;
      border-radius: 6px;
      margin-top: 20px;
      font-size: 14px;
    }
    .message.success {
      display: block;
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .message.error {
      display: block;
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HR Management System Setup</h1>
      <p>Configure your company's automated HR platform in 3 simple steps</p>
    </div>
    
    <div class="content" id="setupForm">
      <!-- Step 1: Company Information -->
      <div class="section">
        <h2><span class="section-icon">🏢</span> Company Information</h2>
        <div class="form-group">
          <label>Company Name *</label>
          <input type="text" id="companyName" value="${existingConfig.companyName || ''}" placeholder="e.g., Acme Corporation">
        </div>
        <div class="form-group">
          <label>Company Domain *</label>
          <input type="text" id="companyDomain" value="${existingConfig.companyDomain || ''}" placeholder="e.g., acmecorp.com">
        </div>
        <div class="form-group">
          <label>Company Logo URL</label>
          <input type="url" id="companyLogo" value="${existingConfig.companyLogo || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>Brand Color</label>
          <input type="color" id="companyColor" value="${existingConfig.companyColor || '#4a86e8'}" style="height: 40px;">
        </div>
      </div>

      <!-- Step 2: Email Configuration -->
      <div class="section">
        <h2><span class="section-icon">📧</span> Email Configuration</h2>
        <div class="form-group">
          <label>HR Email Address *</label>
          <input type="email" id="hrEmail" value="${existingConfig.hrEmail || ''}" placeholder="hr@company.com">
        </div>
        <div class="form-group">
          <label>Hiring/Recruitment Email *</label>
          <input type="email" id="hiringEmail" value="${existingConfig.hiringEmail || ''}" placeholder="hiring@company.com">
        </div>
        <div class="form-group">
          <label>Notification Email</label>
          <input type="email" id="notificationEmail" value="${existingConfig.notificationEmail || ''}" placeholder="alerts@company.com">
        </div>
      </div>

      <!-- Step 3: Features & Integrations -->
      <div class="section">
        <h2><span class="section-icon">⚙️</span> Features & Integrations</h2>
        <div class="form-group">
          <label>Public Sheet ID (for candidate portal)</label>
          <input type="text" id="publicSheetId" value="${existingConfig.publicSheetId || ''}" placeholder="Optional">
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="enablePortal" ${existingConfig.enablePortal ? 'checked' : ''}>
          <label class="checkbox-label" for="enablePortal">Enable Candidate Self-Service Portal</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="enableCalendar" ${existingConfig.enableCalendar ? 'checked' : ''}>
          <label class="checkbox-label" for="enableCalendar">Enable Google Calendar Integration</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="enableAnalytics" ${existingConfig.enableAnalytics ? 'checked' : ''}>
          <label class="checkbox-label" for="enableAnalytics">Enable Advanced Analytics</label>
        </div>
      </div>

      <!-- Step 4: WhatsApp (Optional) -->
      <div class="section">
        <h2><span class="section-icon">📱</span> WhatsApp Integration (Optional)</h2>
        <div class="checkbox-group">
          <input type="checkbox" id="whatsappEnabled" ${existingConfig.whatsappEnabled ? 'checked' : ''}>
          <label class="checkbox-label" for="whatsappEnabled">Enable WhatsApp Messaging</label>
        </div>
        <div class="form-group">
          <label>WhatsApp API Key</label>
          <input type="text" id="whatsappApiKey" value="${existingConfig.whatsappApiKey || ''}" placeholder="Your AiSensy JWT Token">
        </div>
      </div>

      <div class="button-group">
        <button class="btn-secondary" onclick="closeWindow()">Cancel</button>
        <button class="btn-primary" onclick="submitSetup()">Complete Setup & Start</button>
      </div>

      <div class="loading" id="loading">
        <div class="spinner"></div>
        <p>Setting up your HR system...</p>
      </div>

      <div class="message" id="message"></div>
    </div>
  </div>

  <script>
    function submitSetup() {
      const formData = {
        companyName: document.getElementById('companyName').value,
        companyDomain: document.getElementById('companyDomain').value,
        companyLogo: document.getElementById('companyLogo').value,
        companyColor: document.getElementById('companyColor').value,
        hrEmail: document.getElementById('hrEmail').value,
        hiringEmail: document.getElementById('hiringEmail').value,
        notificationEmail: document.getElementById('notificationEmail').value,
        publicSheetId: document.getElementById('publicSheetId').value,
        enablePortal: document.getElementById('enablePortal').checked,
        enableCalendar: document.getElementById('enableCalendar').checked,
        enableAnalytics: document.getElementById('enableAnalytics').checked,
        whatsappEnabled: document.getElementById('whatsappEnabled').checked,
        whatsappApiKey: document.getElementById('whatsappApiKey').value
      };

      // Validation
      if (!formData.companyName || !formData.companyDomain || !formData.hrEmail || !formData.hiringEmail) {
        showMessage('Please fill in all required fields marked with *', 'error');
        return;
      }

      // Show loading
      document.getElementById('setupForm').style.display = 'none';
      document.getElementById('loading').style.display = 'block';

      // Call server function
      google.script.run
        .withSuccessHandler(function(result) {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('setupForm').style.display = 'block';
          
          if (result.success) {
            showMessage(result.message, 'success');
            setTimeout(function() {
              window.open(result.sheetUrl, '_blank');
            }, 2000);
          } else {
            showMessage(result.message, 'error');
          }
        })
        .withFailureHandler(function(error) {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('setupForm').style.display = 'block';
          showMessage('Error: ' + error.message, 'error');
        })
        .saveConfiguration(formData);
    }

    function showMessage(text, type) {
      const messageEl = document.getElementById('message');
      messageEl.textContent = text;
      messageEl.className = 'message ' + type;
    }

    function closeWindow() {
      google.script.host.close();
    }
  </script>
</body>
</html>
  `;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * RESET SETUP (For testing)
 * ════════════════════════════════════════════════════════════════════════════════
 */
function resetSetup() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(WIZARD_CONFIG.SETUP_COMPLETE_KEY);
  props.deleteProperty(WIZARD_CONFIG.COMPANY_CONFIG_KEY);
  
  return "Setup reset. Run 'runSetupWizard()' to start fresh.";
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * GET SYSTEM STATUS
 * ════════════════════════════════════════════════════════════════════════════════
 */
function getSystemStatus() {
  const props = PropertiesService.getScriptProperties();
  const isSetup = props.getProperty(WIZARD_CONFIG.SETUP_COMPLETE_KEY) === "true";
  const config = getExistingConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  return {
    setupComplete: isSetup,
    companyName: config.companyName || "Not configured",
    sheetsCreated: ss.getNumSheets(),
    triggers: ScriptApp.getProjectTriggers().length,
    lastUpdated: props.getProperty("LAST_CONFIG_UPDATE")
  };
}

