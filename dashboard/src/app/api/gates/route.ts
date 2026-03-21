import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/storage';

export async function GET() {
  const data = readData<Record<string, boolean>>('gates.json');
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  writeData('gates.json', body);
  return NextResponse.json({ ok: true });
}
