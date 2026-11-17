import { NextResponse } from 'next/server';
import { getPersonalizedRecommendations } from '../../../lib/recommendations';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { previousPurchases = [], recentSearches = [], cartItems = [], limit = 4 } = body;

    const recommendations = await getPersonalizedRecommendations(
      {
        previousPurchases,
        recentSearches,
        cartItems,
      },
      limit
    );

    return NextResponse.json({
      success: true,
      recommendations,
      vectorEngineStatus: 'ready_for_pgvector_attachment',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
