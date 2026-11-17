import { NextResponse } from 'next/server';
import { callDecisionsApi } from '../../../../lib/openrouter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { state, questions, model } = body;

    if (!state || !questions) {
      return NextResponse.json(
        { error: 'Missing state or questions in request body' },
        { status: 400 }
      );
    }

    const result = await callDecisionsApi({
      state,
      questions,
      model,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/ai/decide error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal decision service error' },
      { status: 500 }
    );
  }
}
