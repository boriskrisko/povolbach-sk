import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/storage';

interface Story {
  id: string;
  title: string;
  status: string;
  link: string;
  notes: string;
}

export async function GET() {
  const data = readData<Story[]>('stories.json');
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const story = await request.json();
  const data = readData<Story[]>('stories.json');
  story.id = Date.now().toString();
  data.push(story);
  writeData('stories.json', data);
  return NextResponse.json(story, { status: 201 });
}

export async function PUT(request: Request) {
  const updated = await request.json();
  const data = readData<Story[]>('stories.json');
  const idx = data.findIndex((s) => s.id === updated.id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  data[idx] = { ...data[idx], ...updated };
  writeData('stories.json', data);
  return NextResponse.json(data[idx]);
}
