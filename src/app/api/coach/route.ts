import { NextRequest, NextResponse } from 'next/server'
import { getOpenAI } from '@/lib/openai'
import { getServerUser } from '@/lib/supabase-server'
import { COACH_SYSTEM_PROMPT, buildCoachContext, type CoachContext } from '@/lib/coach'
import type { CoachMessage, CoachResponse } from '@/types'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    suggestedMemories: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['reply', 'suggestedMemories'],
  additionalProperties: false,
} as const

const MAX_HISTORY = 20 // keep the last N turns to bound prompt size

export async function POST(request: NextRequest) {
  try {
    // Coach is a personal feature — require an authenticated session.
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const messages: CoachMessage[] = Array.isArray(body?.messages) ? body.messages : []
    const context: CoachContext | undefined = body?.context

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }
    if (!context) {
      return NextResponse.json({ error: 'Missing context' }, { status: 400 })
    }

    const trimmedHistory = messages.slice(-MAX_HISTORY)

    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `${COACH_SYSTEM_PROMPT}\n\n${buildCoachContext(context)}`,
        },
        ...trimmedHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'coach_response',
          schema: RESPONSE_SCHEMA,
          strict: true,
        },
      },
    })

    const content = completion.choices[0]?.message?.content || '{}'

    let parsed: CoachResponse
    try {
      const raw = JSON.parse(content)
      parsed = {
        reply: typeof raw?.reply === 'string' ? raw.reply : '',
        suggestedMemories: Array.isArray(raw?.suggestedMemories)
          ? raw.suggestedMemories
              .filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
              .map((m: string) => m.trim())
              .slice(0, 5)
          : [],
      }
    } catch {
      console.error('Failed to parse coach response:', content)
      return NextResponse.json({ error: 'Failed to parse coach response' }, { status: 500 })
    }

    if (!parsed.reply) {
      return NextResponse.json({ error: 'Empty coach response' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Coach error:', error)
    return NextResponse.json({ error: 'Failed to get coach response' }, { status: 500 })
  }
}
