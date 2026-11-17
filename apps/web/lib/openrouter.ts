const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
const EXTRACTIONS_URL = 'https://openrouter.ai/api/alpha/extractions';
const DEFAULT_MODEL = 'perplexity/pplx-decider-flash-v1.3:free';

export interface DecisionQuestion {
  type: 'noul' | 'choice' | 'score' | 'box';
  instructions: string;
  criteria?: Record<string, string> | string[];
}

export interface ExtractionField {
  type: 'text' | 'number' | 'date' | 'time' | 'datetime' | 'list' | 'duration' | 'estimate' | 'forecast';
  instructions?: string;
  null_threshold?: number;
  [key: string]: any;
}

export interface DecisionsRequest {
  model?: string;
  state: any;
  questions: Record<string, DecisionQuestion>;
}

export interface ExtractionsRequest {
  model?: string;
  state: string;
  fields: Record<string, ExtractionField>;
}

export async function callDecisionsApi(req: DecisionsRequest) {
  const model = req.model || DEFAULT_MODEL;

  const response = await fetch(DECISIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'NovaTech Computers',
    },
    body: JSON.stringify({
      model,
      state: req.state,
      questions: req.questions,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Decisions API failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function callExtractionsApi(req: ExtractionsRequest) {
  const model = req.model || DEFAULT_MODEL;

  const response = await fetch(EXTRACTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'NovaTech Computers',
    },
    body: JSON.stringify({
      model,
      state: req.state,
      fields: req.fields,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter Extractions API failed (${response.status}): ${errorText}`);
  }

  return response.json();
}
