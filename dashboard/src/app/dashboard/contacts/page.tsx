'use client';

import { useState, useEffect } from 'react';

interface Contact {
  id: string;
  name: string;
  type: string;
  outlet: string;
  status: string;
  angle: string;
  notes: string;
}

const types = ['all', 'media', 'municipal', 'event', 'other'];
const statuses = ['lead', 'contacted', 'responded', 'interviewed', 'published'];

const statusColors: Record<string, string> = {
  lead: 'bg-[#6b7280]',
  contacted: 'bg-[#3b82f6]',
  responded: 'bg-[#f59e0b]',
  interviewed: 'bg-[#22c55e]',
  published: 'bg-[#a855f7]',
};

const emptyContact: Omit<Contact, 'id'> = {
  name: '',
  type: 'media',
  outlet: '',
  status: 'lead',
  angle: '',
  notes: '',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyContact);

  useEffect(() => {
    fetch('/api/contacts').then((r) => r.json()).then(setContacts);
  }, []);

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.type === filter);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const contact = await res.json();
    setContacts([...contacts, contact]);
    setForm(emptyContact);
    setShowAdd(false);
  }

  async function updateStatus(id: string, status: string) {
    const updated = contacts.map((c) => (c.id === id ? { ...c, status } : c));
    setContacts(updated);
    const contact = updated.find((c) => c.id === id)!;
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    });
  }

  async function deleteContact(id: string) {
    setContacts(contacts.filter((c) => c.id !== id));
    await fetch('/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-[#6b7280]">Media outreach & Phase 3 interviews</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add Contact'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={addContact}
          className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="px-3 py-2 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-white text-sm focus:outline-none focus:border-[#3b82f6]"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="px-3 py-2 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-white text-sm focus:outline-none focus:border-[#3b82f6]"
          >
            {types.filter((t) => t !== 'all').map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={form.outlet}
            onChange={(e) => setForm({ ...form, outlet: e.target.value })}
            placeholder="Outlet / Organization"
            className="px-3 py-2 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-white text-sm focus:outline-none focus:border-[#3b82f6]"
          />
          <input
            type="text"
            value={form.angle}
            onChange={(e) => setForm({ ...form, angle: e.target.value })}
            placeholder="Story angle"
            className="px-3 py-2 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-white text-sm focus:outline-none focus:border-[#3b82f6]"
          />
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            className="sm:col-span-2 px-3 py-2 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-white text-sm focus:outline-none focus:border-[#3b82f6]"
          />
          <button
            type="submit"
            className="sm:col-span-2 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Save Contact
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === t
                ? 'bg-[#1f2937] text-white'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#111827]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="text-center text-[#6b7280] py-12">No contacts yet</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <div
              key={contact.id}
              className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-sm">{contact.name}</span>
                  <span className="text-xs text-[#6b7280] bg-[#1f2937] px-2 py-0.5 rounded capitalize">
                    {contact.type}
                  </span>
                </div>
                {contact.outlet && (
                  <div className="text-xs text-[#9ca3af]">{contact.outlet}</div>
                )}
                {contact.angle && (
                  <div className="text-xs text-[#6b7280] mt-1">Angle: {contact.angle}</div>
                )}
                {contact.notes && (
                  <div className="text-xs text-[#4b5563] mt-1">{contact.notes}</div>
                )}
              </div>

              <select
                value={contact.status}
                onChange={(e) => updateStatus(contact.id, e.target.value)}
                className={`text-xs px-2 py-1 rounded-lg text-white border-0 focus:outline-none cursor-pointer ${statusColors[contact.status]}`}
              >
                {statuses.map((s) => (
                  <option key={s} value={s} className="bg-[#111827]">
                    {s}
                  </option>
                ))}
              </select>

              <button
                onClick={() => deleteContact(contact.id)}
                className="text-[#6b7280] hover:text-[#ef4444] transition-colors text-sm"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
