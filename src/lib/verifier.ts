// ============================================
// AI-Powered Quality Verifier
// ============================================
// Uses Anthropic Claude to assess whether a seller's
// output satisfactorily completes the buyer's request.

interface VerificationInput {
  service_type: string;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
}

interface VerificationResult {
  passed: boolean;
  score: number;
  reasoning: string;
  issues: string[];
}

export async function verifyJobOutput(
  input: VerificationInput
): Promise<VerificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("No ANTHROPIC_API_KEY set — using fallback verification");
    return {
      passed: true,
      score: 70,
      reasoning: "Fallback verification — API key not configured",
      issues: [],
    };
  }

  try {
    const prompt = buildVerificationPrompt(input);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error("Anthropic API error:", response.status);
      return fallbackVerification(input);
    }

    const data = await response.json();
    const text = data.content
      .map((block: any) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse verification response");
      return fallbackVerification(input);
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      passed: result.passed === true,
      score: Math.min(100, Math.max(0, result.score || 0)),
      reasoning: result.reasoning || "No reasoning provided",
      issues: result.issues || [],
    };
  } catch (err) {
    console.error("Verification error:", err);
    return fallbackVerification(input);
  }
}

function buildVerificationPrompt(input: VerificationInput): string {
  return `You are a quality verification agent for the Arbiter trust network. Your job is to assess whether a seller agent's output satisfactorily completes a buyer agent's request.

SERVICE TYPE: ${input.service_type}

BUYER'S REQUEST (input_data):
${JSON.stringify(input.input_data, null, 2)}

SELLER'S OUTPUT (output_data):
${JSON.stringify(input.output_data, null, 2)}

Evaluate the output based on these criteria:
1. RELEVANCE — Does the output address what was requested?
2. COMPLETENESS — Does it cover the full scope of the request?
3. QUALITY — Is the output well-formed, accurate, and useful?
4. HONESTY — Does the output appear genuine (not filler, gibberish, or copy-pasted nonsense)?

Respond with ONLY a JSON object in this exact format, no other text:
{
  "passed": true or false,
  "score": 0-100,
  "reasoning": "One paragraph explaining your assessment",
  "issues": ["issue 1", "issue 2"] or [] if no issues
}

A score of 60+ means PASS. Below 60 means FAIL.
Be fair but strict. Agents stake real money on their reputation.`;
}

// Fallback when no API key or API fails
// Uses simple heuristics to check output quality
function fallbackVerification(
  input: VerificationInput
): VerificationResult {
  const output = input.output_data;

  let score = 50;
  const issues: string[] = [];

  if (!output || Object.keys(output).length === 0) {
    return {
      passed: false,
      score: 0,
      reasoning: "Output is empty — no work was delivered.",
      issues: ["Empty output"],
    };
  }

  const outputStr = JSON.stringify(output);

  if (outputStr.length < 20) {
    score -= 30;
    issues.push("Output is extremely short");
  } else if (outputStr.length > 50) {
    score += 15;
  }

  const inputStr = JSON.stringify(input.input_data).toLowerCase();
  const outputLower = outputStr.toLowerCase();

  const inputWords = inputStr
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4);

  const matchingWords = inputWords.filter((w) => outputLower.includes(w));
  const overlapRatio =
    inputWords.length > 0 ? matchingWords.length / inputWords.length : 0;

  if (overlapRatio > 0.3) {
    score += 20;
  } else if (overlapRatio < 0.1) {
    score -= 15;
    issues.push("Output appears unrelated to the request");
  }

  const gibberishPatterns = [
    /(.)\1{10,}/,
    /lorem ipsum/i,
    /test test test/,
    /asdf/,
  ];

  for (const pattern of gibberishPatterns) {
    if (pattern.test(outputStr)) {
      score -= 25;
      issues.push("Output appears to contain gibberish or placeholder text");
      break;
    }
  }

  if (typeof output === "object" && Object.keys(output).length >= 2) {
    score += 10;
  }

  score = Math.min(100, Math.max(0, score));

  return {
    passed: score >= 60,
    score,
    reasoning:
      score >= 60
        ? "Output meets minimum quality standards based on heuristic analysis."
        : "Output did not meet quality standards. " +
          (issues.length > 0
            ? `Issues: ${issues.join(", ")}`
            : "Score was below threshold."),
    issues,
  };
}
