import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { Meal, FoodItem, MealType, MealContext, DayData } from '@/types'
import { format, subDays } from 'date-fns'

// Helper to transform database row to Meal type
function dbRowToMeal(row: any): Meal {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    items: row.items,
    totalCalories: row.total_calories,
    totalProtein: row.total_protein,
    totalFiber: row.total_fiber,
    context: row.context,
    createdAt: row.created_at,
  }
}

// Helper to aggregate meals into day data
function aggregateDays(meals: Meal[], numDays: number, todayStr?: string): DayData[] {
  const today = todayStr ? new Date(todayStr + 'T12:00:00') : new Date()
  const days: DayData[] = []

  for (let i = 0; i < numDays; i++) {
    const date = format(subDays(today, i), 'yyyy-MM-dd')
    const dayMeals = meals.filter(m => m.date === date)

    const totalCalories = dayMeals.reduce((sum, m) => sum + m.totalCalories, 0)
    const totalProtein = dayMeals.reduce((sum, m) => sum + m.totalProtein, 0)
    const totalFiber = dayMeals.reduce((sum, m) => sum + m.totalFiber, 0)

    days.push({
      date,
      meals: dayMeals,
      totalCalories,
      totalProtein,
      totalFiber,
    })
  }

  return days
}

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days')
    const todayParam = searchParams.get('today')

    if (days) {
      const numDays = parseInt(days, 10)
      const todayDate = todayParam ? new Date(todayParam + 'T12:00:00') : new Date()
      const startDate = format(subDays(todayDate, numDays - 1), 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error

      const meals = (data || []).map(dbRowToMeal)
      const dayData = aggregateDays(meals, numDays, todayParam || undefined)

      return NextResponse.json({ days: dayData })
    }

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const meals = (data || []).map(dbRowToMeal)
    return NextResponse.json({ meals })
  } catch (error) {
    console.error('Get meals error:', error)
    return NextResponse.json(
      { error: 'Failed to get meals' },
      { status: 500 }
    )
  }
}

interface CreateMealBody {
  type: MealType
  date: string
  items: FoodItem[]
  context?: MealContext
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const body: CreateMealBody = await request.json()
    const { type, date, items, context } = body

    if (!type || !date || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const totalCalories = items.reduce((sum, i) => sum + i.calories, 0)
    const totalProtein = items.reduce((sum, i) => sum + i.protein, 0)
    const totalFiber = items.reduce((sum, i) => sum + i.fiber, 0)

    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        type,
        date,
        items,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_fiber: totalFiber,
        context,
      })
      .select()
      .single()

    if (error) throw error

    const meal = dbRowToMeal(data)
    return NextResponse.json({ meal })
  } catch (error) {
    console.error('Create meal error:', error)
    return NextResponse.json(
      { error: 'Failed to create meal' },
      { status: 500 }
    )
  }
}

interface UpdateMealBody {
  id: string
  type: MealType
  date: string
  items: FoodItem[]
  context?: MealContext
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const body: UpdateMealBody = await request.json()
    const { id, type, date, items, context } = body

    if (!id || !type || !date || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const totalCalories = items.reduce((sum, i) => sum + i.calories, 0)
    const totalProtein = items.reduce((sum, i) => sum + i.protein, 0)
    const totalFiber = items.reduce((sum, i) => sum + i.fiber, 0)

    const { data, error } = await supabase
      .from('meals')
      .update({
        type,
        date,
        items,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_fiber: totalFiber,
        context,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    const meal = dbRowToMeal(data)
    return NextResponse.json({ meal })
  } catch (error) {
    console.error('Update meal error:', error)
    return NextResponse.json(
      { error: 'Failed to update meal' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing meal id' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete meal error:', error)
    return NextResponse.json(
      { error: 'Failed to delete meal' },
      { status: 500 }
    )
  }
}
