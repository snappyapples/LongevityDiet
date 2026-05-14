'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Loader2,
  Brain,
  MessageCircle,
  Plus,
  Trash2,
  Sparkles,
  Check,
  X,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { CoachMemory, LongevityReport, Meal } from '@/types'
import type { CoachContext } from '@/lib/coach'
import { getRankedComponentTips } from '@/lib/longevity-score'
import { getTodayProtein, getProteinTarget } from '@/lib/protein-target'

interface ThreadMessage {
  role: 'user' | 'assistant'
  content: string
  suggestedMemories?: string[]
}

function mealTypeForTime(now: Date = new Date()): string {
  const h = now.getHours() + now.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 10.5 && h < 15) return 'lunch'
  if (h >= 15 && h < 20.5) return 'dinner'
  return 'snack'
}

const STARTERS = [
  'Give me lunch ideas',
  "What's my biggest gap right now?",
  'I need a high-protein snack',
  'Plan my dinner around my gaps',
]

interface CoachSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: LongevityReport
  meals: Meal[]
  weightLbs: number
}

export function CoachSheet({ open, onOpenChange, report, meals, weightLbs }: CoachSheetProps) {
  const [view, setView] = useState<'chat' | 'memory'>('chat')
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [memories, setMemories] = useState<CoachMemory[]>([])
  const [newMemory, setNewMemory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/coach-memory')
      .then((r) => r.json())
      .then((d) => setMemories(d.memories || []))
      .catch((e) => console.error('Failed to load coach memory:', e))
  }, [open])

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, sending])

  const buildContext = useCallback((): CoachContext => {
    const tips = getRankedComponentTips(report)
    return {
      rollingScore: report.rollingScore,
      rollingHasData: report.rollingHasData,
      componentGaps: tips.map((t) => ({
        label: t.label,
        current: t.current,
        max: t.max,
        gapPoints: t.gapPoints,
        kind: t.kind,
      })),
      proteinCurrent: getTodayProtein(meals, new Date()),
      proteinTarget: getProteinTarget(weightLbs),
      mealType: mealTypeForTime(),
      memories: memories.map((m) => m.fact),
    }
  }, [report, meals, weightLbs, memories])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setError(null)
    const nextMessages: ThreadMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          context: buildContext(),
        }),
      })
      if (!res.ok) throw new Error('Coach request failed')
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || '',
          suggestedMemories: Array.isArray(data.suggestedMemories) ? data.suggestedMemories : [],
        },
      ])
    } catch (e) {
      console.error(e)
      setError('Coach is unavailable right now. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const confirmMemory = async (messageIdx: number, fact: string) => {
    try {
      const res = await fetch('/api/coach-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact, source: 'ai' }),
      })
      if (!res.ok) throw new Error('Failed to save memory')
      const data = await res.json()
      if (data.memory) setMemories((prev) => [...prev, data.memory])
      setMessages((prev) =>
        prev.map((m, i) =>
          i === messageIdx
            ? { ...m, suggestedMemories: (m.suggestedMemories || []).filter((f) => f !== fact) }
            : m,
        ),
      )
    } catch (e) {
      console.error(e)
      setError('Failed to save that memory.')
    }
  }

  const dismissMemory = (messageIdx: number, fact: string) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === messageIdx
          ? { ...m, suggestedMemories: (m.suggestedMemories || []).filter((f) => f !== fact) }
          : m,
      ),
    )
  }

  const addManualMemory = async () => {
    const fact = newMemory.trim()
    if (!fact) return
    try {
      const res = await fetch('/api/coach-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact, source: 'user' }),
      })
      if (!res.ok) throw new Error('Failed to add memory')
      const data = await res.json()
      if (data.memory) setMemories((prev) => [...prev, data.memory])
      setNewMemory('')
    } catch (e) {
      console.error(e)
      setError('Failed to add that memory.')
    }
  }

  const deleteMemory = async (id: string) => {
    const snapshot = memories
    setMemories((m) => m.filter((x) => x.id !== id))
    try {
      const res = await fetch(`/api/coach-memory?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete memory')
    } catch (e) {
      console.error(e)
      setMemories(snapshot)
      setError('Failed to delete that memory.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] flex flex-col max-w-lg mx-auto p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold">
              {view === 'chat' ? 'Meal Coach' : 'Coach Memory'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView((v) => (v === 'chat' ? 'memory' : 'chat'))}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label={view === 'chat' ? 'Manage memory' : 'Back to chat'}
            >
              {view === 'chat' ? (
                <Brain className="w-5 h-5" />
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-medium">
              Dismiss
            </button>
          </div>
        )}

        {view === 'memory' ? (
          /* ---- Manage memory ---- */
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              What the coach remembers about you. It reads all of this on every conversation —
              keep entries short and prune anything stale.
            </p>

            <div className="space-y-2">
              {memories.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Nothing remembered yet. Tell the coach your preferences in chat, or add one
                  below.
                </p>
              )}
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-2 p-2.5 rounded-md bg-secondary/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{m.fact}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.source === 'ai' ? 'Coach noticed this' : 'You added this'}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Delete memory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="e.g., I don't eat pork"
                className="flex-1 text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addManualMemory()
                  }
                }}
              />
              <Button onClick={addManualMemory} disabled={!newMemory.trim()} size="sm" className="h-10">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        ) : (
          /* ---- Chat ---- */
          <>
            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && !sending && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Ask for meal ideas tuned to your current gaps. I&apos;ll remember your
                    preferences as we go — tap the{' '}
                    <Brain className="w-3.5 h-3.5 inline -mt-0.5" /> icon anytime to see what I
                    know.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="px-3 py-1.5 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary text-sm font-medium transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm whitespace-pre-wrap'
                        : 'max-w-[92%] space-y-2'
                    }
                  >
                    {m.role === 'assistant' ? (
                      <>
                        <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-secondary text-sm whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </div>
                        {(m.suggestedMemories || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-1">
                            {(m.suggestedMemories || []).map((fact) => (
                              <div
                                key={fact}
                                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                              >
                                <Brain className="w-3.5 h-3.5" />
                                <span>Remember: {fact}</span>
                                <button
                                  onClick={() => confirmMemory(i, fact)}
                                  className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20"
                                  aria-label="Save to memory"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => dismissMemory(i, fact)}
                                  className="p-0.5 rounded-full hover:bg-primary/20"
                                  aria-label="Dismiss"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t px-4 py-3">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for meal ideas, or tell me a preference…"
                  className="flex-1 min-h-[44px] max-h-32 text-base resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  disabled={sending}
                />
                <Button
                  onClick={() => send(input)}
                  disabled={!input.trim() || sending}
                  className="h-11 w-11 shrink-0 p-0"
                  aria-label="Send"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
