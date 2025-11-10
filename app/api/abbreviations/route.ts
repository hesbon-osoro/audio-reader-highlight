import { NextResponse } from 'next/server';

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const abbreviations = require('../../../lib/data/common-abbreviations.json');
  return NextResponse.json(abbreviations, {
    headers: {
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
