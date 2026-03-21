import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/storage';

interface Metric {
  id: string;
  icon: string;
  label: string;
  actual: number;
  target: number;
}

export async function GET() {
  const data = readData<Metric[]>('metrics.json');
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  writeData('metrics.json', body);
  return NextResponse.json({ ok: true });
}
