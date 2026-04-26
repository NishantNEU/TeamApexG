// ============================================
// REAL AI AGENT ENGINE
// ============================================
// Each agent type has a system prompt and processes real work
// using the Anthropic Claude API.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export interface AgentTask {
  service_type: string;
  input: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  output: Record<string, any>;
  processing_time_ms: number;
  model_used: string;
}

// ---- Call Claude API ----

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1500
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.content
    .map((block: any) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

// ---- Agent Definitions ----

const AGENT_CONFIGS: Record<
  string,
  {
    systemPrompt: string;
    buildUserMessage: (input: Record<string, any>) => string;
    parseResponse: (raw: string, input: Record<string, any>) => Record<string, any>;
  }
> = {
  summarizer: {
    systemPrompt: `You are a professional summarization agent in the Arbiter trust network. You produce clear, accurate, concise summaries. You are being evaluated for quality — your reputation depends on it.

Always respond with ONLY a JSON object in this format:
{
  "summary": "your summary here",
  "key_points": ["point 1", "point 2", "point 3"],
  "word_count": number,
  "confidence": 0.0-1.0
}`,

    buildUserMessage: (input) => {
      const maxLength = input.max_length || 100;
      return `Summarize the following text in ${maxLength} words or fewer:\n\n${input.text}`;
    },

    parseResponse: (raw, input) => {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return {
        summary: raw.slice(0, 500),
        key_points: [],
        word_count: raw.split(/\s+/).length,
        confidence: 0.8,
      };
    },
  },

  code_review: {
    systemPrompt: `You are an expert code review agent in the Arbiter trust network. You analyze code for bugs, security issues, performance problems, and best practices. Your reputation depends on thoroughness and accuracy.

Always respond with ONLY a JSON object in this format:
{
  "review": "overall assessment",
  "issues": [
    {"severity": "critical|warning|info", "line": "relevant code", "description": "what's wrong", "fix": "how to fix"}
  ],
  "score": 0-100,
  "suggestions": ["suggestion 1", "suggestion 2"]
}`,

    buildUserMessage: (input) => {
      const lang = input.language || "unknown";
      const focus = input.focus || "correctness, security, and performance";
      return `Review this ${lang} code. Focus on: ${focus}\n\n\`\`\`${lang}\n${input.code}\n\`\`\``;
    },

    parseResponse: (raw, input) => {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return {
        review: raw.slice(0, 500),
        issues: [],
        score: 70,
        suggestions: [],
      };
    },
  },

  translator: {
    systemPrompt: `You are a professional translation agent in the Arbiter trust network. You produce accurate, natural-sounding translations. Your reputation depends on quality.

Always respond with ONLY a JSON object in this format:
{
  "translation": "translated text",
  "source_language": "detected or provided source",
  "target_language": "target language",
  "confidence": 0.0-1.0,
  "notes": "any translation notes"
}`,

    buildUserMessage: (input) => {
      const source = input.source_language || "auto-detect";
      const target = input.target_language || "English";
      return `Translate from ${source} to ${target}:\n\n${input.text}`;
    },

    parseResponse: (raw, input) => {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return {
        translation: raw.slice(0, 1000),
        source_language: input.source_language || "unknown",
        target_language: input.target_language || "English",
        confidence: 0.8,
        notes: "",
      };
    },
  },

  data_analysis: {
    systemPrompt: `You are a data analysis agent in the Arbiter trust network. You analyze data and provide clear, actionable insights. Your reputation depends on accuracy and usefulness.

Always respond with ONLY a JSON object in this format:
{
  "analysis": "main findings",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "confidence": 0.0-1.0
}`,

    buildUserMessage: (input) => {
      const question = input.question || "Analyze this data and provide insights.";
      return `${question}\n\nData:\n${JSON.stringify(input.data || input.text, null, 2)}`;
    },

    parseResponse: (raw, input) => {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return {
        analysis: raw.slice(0, 500),
        insights: [],
        recommendations: [],
        confidence: 0.7,
      };
    },
  },

  general: {
    systemPrompt: `You are a general-purpose AI agent in the Arbiter trust network. You complete tasks accurately and thoroughly. Your reputation depends on quality.

Always respond with ONLY a JSON object in this format:
{
  "result": "your response",
  "confidence": 0.0-1.0
}`,

    buildUserMessage: (input) => {
      return input.prompt || input.text || JSON.stringify(input);
    },

    parseResponse: (raw, input) => {
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return { result: raw.slice(0, 1000), confidence: 0.7 };
    },
  },
};

// ---- Main Execute Function ----

export async function executeAgentTask(task: AgentTask): Promise<AgentResult> {
  const startTime = Date.now();

  const config = AGENT_CONFIGS[task.service_type] || AGENT_CONFIGS.general;

  try {
    const userMessage = config.buildUserMessage(task.input);
    const rawResponse = await callClaude(config.systemPrompt, userMessage);
    const output = config.parseResponse(rawResponse, task.input);

    return {
      success: true,
      output,
      processing_time_ms: Date.now() - startTime,
      model_used: "claude-sonnet-4-6",
    };
  } catch (err: any) {
    return {
      success: false,
      output: { error: err.message || "Agent task failed" },
      processing_time_ms: Date.now() - startTime,
      model_used: "claude-sonnet-4-6",
    };
  }
}

// ---- Get available agent types ----

export function getAvailableAgentTypes(): string[] {
  return Object.keys(AGENT_CONFIGS);
}

// ---- Get placeholder inputs for each type ----

export function getPlaceholderInput(serviceType: string): Record<string, any> {
  switch (serviceType) {
    case "summarizer":
      return {
        text: "Paste the text you want summarized here...",
        max_length: 100,
      };
    case "code_review":
      return {
        code: "function add(a, b) {\n  return a + b;\n}",
        language: "javascript",
        focus: "correctness and security",
      };
    case "translator":
      return {
        text: "Hello, how are you today?",
        source_language: "English",
        target_language: "Spanish",
      };
    case "data_analysis":
      return {
        text: "Paste your data here...",
        question: "What patterns or insights can you find?",
      };
    default:
      return {
        text: "Describe your task here...",
      };
  }
}
