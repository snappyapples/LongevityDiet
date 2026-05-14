import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import type { CoachMemory } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
function dbRowToMemory(row: any): CoachMemory {
  return {
    id: row.id,
    fact: row.fact,
    source: row.source === 'ai' ? 'ai' : 'user',
    createdAt: row.created_at,
  }
}

export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('coach_memory')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ memories: (data || []).map(dbRowToMemory) })
  } catch (error) {
    console.error('Get coach memory error:', error)
    return NextResponse.json({ error: 'Failed to get coach memory' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const fact = typeof body?.fact === 'string' ? body.fact.trim() : ''
    const source = body?.source === 'ai' ? 'ai' : 'user'

    if (!fact) {
      return NextResponse.json({ error: 'Missing fact' }, { status: 400 })
    }
    if (fact.length > 280) {
      return NextResponse.json({ error: 'Fact too long' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('coach_memory')
      .insert({ user_id: user.id, fact, source })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ memory: dbRowToMemory(data) })
  } catch (error) {
    console.error('Add coach memory error:', error)
    return NextResponse.json({ error: 'Failed to add coach memory' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing memory id' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('coach_memory')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete coach memory error:', error)
    return NextResponse.json({ error: 'Failed to delete coach memory' }, { status: 500 })
  }
}
