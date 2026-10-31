import { NextResponse } from 'next/server';
import abbreviations from 'audio-reader-highlight/data/common-abbreviations.json';

export async function GET() {
  return NextResponse.json(abbreviations, {
    headers: {
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
