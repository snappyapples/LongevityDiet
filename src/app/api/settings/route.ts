import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'

interface UserSettings {
  weight: number
}

const defaultSettings: UserSettings = {
  weight: 180,
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function dbRowToSettings(row: any): UserSettings {
  return {
    weight: typeof row?.weight === 'number' ? row.weight : defaultSettings.weight,
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
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // If no settings row exists, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json(defaultSettings)
      }
      throw error
    }

    return NextResponse.json(dbRowToSettings(data))
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json(defaultSettings)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const settings: UserSettings = await request.json()

    // Only weight is written through the UI. Other columns on the settings
    // table (age, sex, height_*, activity_level, calorie/protein/fiber goals,
    // scoring_mode) are legacy from the dropped macros mode — we leave them
    // alone here. A future migration can drop them.
    const { data, error } = await supabase
      .from('settings')
      .upsert(
        {
          user_id: user.id,
          weight: settings.weight,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(dbRowToSettings(data))
  } catch (error) {
    console.error('Save settings error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
