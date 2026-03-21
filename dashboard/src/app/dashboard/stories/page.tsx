'use client';

import { useState, useEffect } from 'react';

interface Story {
  id: string;
  title: string;
  status: string;
  link: string;
  notes: string;
}

const columns = [
  { key: 'idea', label: 'Idea', color: '#6b7280' },
  { key: 'drafted', label: 'Drafted', color: '#3b82f6' },
  { key: 'published', label: 'Published', color: '#22c55e' },
  { key: 'tracked', label: 'Tracked', color: '#a855f7' },
];

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'link' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetch('/api/stories').then((r) => r.json()).then(setStories);
  }, []);

  async function addStory(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), status: 'idea', link: '', notes: '' }),
    });
    const story = await res.json();
    setStories([...stories, story]);
    setNewTitle('');
  }

  async function moveStory(id: string, newStatus: string) {
    const updated = stories.map((s) => (s.id === id ? { ...s, status: newStatus } : s));
    setStories(updated);
    const story = updated.find((s) => s.id === id)!;
    await fetch('/api/stories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(story),
    });
  }

  async function saveField(id: string, field: 'link' | 'notes') {
    const updated = stories.map((s) =>
      s.id === id ? { ...s, [field]: editValue } : s
    );
    setStories(updated);
    setEditingId(null);
    setEditField(null);
    const story = updated.find((s) => s.id === id)!;
    await fetch('/api/stories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(story),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Data Stories</h1>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {columns.map((col) => {
          const colStories = stories.filter((s) => s.status === col.key);
          return (
            <div key={col.key}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <h2 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wider">
                  {col.label}
                </h2>
                <span className="text-xs text-[#6b7280] bg-[#1f2937] px-1.5 py-0.5 rounded">
                  {colStories.length}
                </span>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {colStories.map((story) => (
                  <div
                    key={story.id}
                    className="bg-[#111827] border border-[#1f2937] rounded-lg p-3"
                  >
                    <p className="text-sm text-white mb-2">{story.title}</p>

                    {/* Move buttons */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {columns
                        .filter((c) => c.key !== story.status)
                        .map((c) => (
                          <button
                            key={c.key}
                            onClick={() => moveStory(story.id, c.key)}
                            className="text-xs px-2 py-0.5 rounded text-[#9ca3af] hover:text-white bg-[#1f2937] hover:bg-[#374151] transition-colors"
                          >
                            → {c.label}
                          </button>
                        ))}
                    </div>

                    {/* Link field (published/tracked) */}
                    {(story.status === 'published' || story.status === 'tracked') && (
                      <div className="mb-1">
                        {editingId === story.id && editField === 'link' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveField(story.id, 'link')}
                            onKeyDown={(e) => e.key === 'Enter' && saveField(story.id, 'link')}
                            placeholder="URL..."
                            autoFocus
                            className="w-full text-xs px-2 py-1 bg-[#0a0a0a] border border-[#3b82f6] rounded text-white focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(story.id);
                              setEditField('link');
                              setEditValue(story.link);
                            }}
                            className="text-xs text-[#3b82f6] hover:underline"
                          >
                            {story.link || '+ Add link'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Notes field (tracked) */}
                    {story.status === 'tracked' && (
                      <div>
                        {editingId === story.id && editField === 'notes' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveField(story.id, 'notes')}
                            onKeyDown={(e) => e.key === 'Enter' && saveField(story.id, 'notes')}
                            placeholder="Performance notes..."
                            autoFocus
                            className="w-full text-xs px-2 py-1 bg-[#0a0a0a] border border-[#3b82f6] rounded text-white focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(story.id);
                              setEditField('notes');
                              setEditValue(story.notes);
                            }}
                            className="text-xs text-[#6b7280] hover:text-white"
                          >
                            {story.notes || '+ Add notes'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add story */}
      <form onSubmit={addStory} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New story idea..."
          className="flex-1 px-4 py-2.5 bg-[#111827] border border-[#1f2937] rounded-lg text-white text-sm placeholder-[#4b5563] focus:outline-none focus:border-[#3b82f6]"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-sm font-medium transition-colors"
        >
          Add
        </button>
      </form>
    </div>
  );
}
