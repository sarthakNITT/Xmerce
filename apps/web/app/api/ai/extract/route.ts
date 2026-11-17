import { NextResponse } from 'next/server';
import { callExtractionsApi } from '../../../../lib/openrouter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { state, fields, model } = body;

    if (!state || !fields) {
      return NextResponse.json(
        { error: 'Missing state or fields in request body' },
        { status: 400 }
      );
    }

    const result = await callExtractionsApi({
      state,
      fields,
      model,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/ai/extract error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal extraction service error' },
      { status: 500 }
    );
  }
}
