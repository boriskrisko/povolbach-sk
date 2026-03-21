import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/storage';

interface EvalEntry {
  id: string;
  date: string;
  energy: string;
  signal: string;
  traction: string;
  assumption: string;
  kill: string;
}

export async function GET() {
  const data = readData<EvalEntry[]>('evals.json');
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const entry = await request.json();
  const data = readData<EvalEntry[]>('evals.json');
  entry.id = Date.now().toString();
  data.unshift(entry);
  writeData('evals.json', data);
  return NextResponse.json(entry, { status: 201 });
}
