import { NextResponse } from 'next/server';

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const units = require('../../../lib/data/common-units.json');
  return NextResponse.json(units, {
    headers: {
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
