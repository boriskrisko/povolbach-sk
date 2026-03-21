import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/storage';

interface Contact {
  id: string;
  name: string;
  type: string;
  outlet: string;
  status: string;
  angle: string;
  notes: string;
}

export async function GET() {
  const data = readData<Contact[]>('contacts.json');
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const contact = await request.json();
  const data = readData<Contact[]>('contacts.json');
  contact.id = Date.now().toString();
  data.push(contact);
  writeData('contacts.json', data);
  return NextResponse.json(contact, { status: 201 });
}

export async function PUT(request: Request) {
  const updated = await request.json();
  const data = readData<Contact[]>('contacts.json');
  const idx = data.findIndex((c) => c.id === updated.id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  data[idx] = { ...data[idx], ...updated };
  writeData('contacts.json', data);
  return NextResponse.json(data[idx]);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  const data = readData<Contact[]>('contacts.json');
  const filtered = data.filter((c) => c.id !== id);
  writeData('contacts.json', filtered);
  return NextResponse.json({ ok: true });
}
