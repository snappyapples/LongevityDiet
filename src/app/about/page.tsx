import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  Salad,
  Apple,
  Bean,
  Wheat,
  Nut,
  Droplet,
  Fish,
  CupSoda,
  Beef,
  Package,
  Check,
  X,
  ArrowRight,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Longevity Diet — The science-backed diet for a longer, healthier life.',
  description:
    'Most diets tell you what not to eat. The Longevity Diet measures what your body actually needs — backed by 20+ years of Harvard-led nutrition research.',
}

interface Component {
  icon: typeof Salad
  name: string
  max: number
  kind: 'add' | 'avoid'
  why: string
}

const POSITIVES: Component[] = [
  { icon: Salad, name: 'Vegetables', max: 15, kind: 'add', why: '5 servings/day. Leafy greens and cruciferous count double for biological effect.' },
  { icon: Apple, name: 'Fruit', max: 10, kind: 'add', why: '2 servings/day. Whole fruit, not juice — fiber matters.' },
  { icon: Bean, name: 'Legumes & Soy', max: 10, kind: 'add', why: '1 serving/day. Beans, lentils, tofu, tempeh — the most under-eaten longevity food.' },
  { icon: Wheat, name: 'Whole Grains', max: 10, kind: 'add', why: '3 servings/day. Oats, quinoa, brown rice, 100% whole-wheat — not refined.' },
  { icon: Nut, name: 'Nuts & Seeds', max: 5, kind: 'add', why: '1 oz/day. Walnuts, almonds, pistachios, chia, flax.' },
  { icon: Droplet, name: 'Healthy Fat', max: 10, kind: 'add', why: 'Extra-virgin olive oil, avocado, fatty fish, nuts. Replaces saturated/refined.' },
  { icon: Fish, name: 'Fish & Omega-3', max: 10, kind: 'add', why: '2 servings/week of fatty fish — salmon, sardines, mackerel.' },
]

const NEGATIVES: Component[] = [
  { icon: CupSoda, name: 'Sugary Drinks', max: 10, kind: 'avoid', why: 'Soda, sweetened coffee, fruit juice. Liquid calories that bypass satiety.' },
  { icon: Beef, name: 'Red & Processed Meat', max: 10, kind: 'avoid', why: 'Bacon, deli meat, sausage count double. Beef and lamb count once.' },
  { icon: Package, name: 'Ultra-Processed Food', max: 10, kind: 'avoid', why: 'Packaged snacks, fast food, sweetened cereals — NOVA category 4.' },
]

interface Footnote {
  n: number
  text: React.ReactNode
}

const FOOTNOTES: Footnote[] = [
  {
    n: 1,
    text: (
      <>
        Chiuve SE et al. <em>Alternative dietary indices both strongly predict risk of chronic disease.</em>{' '}
        J Nutr. 2012;142(6):1009–18.{' '}
        <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/22513989/" target="_blank" rel="noopener noreferrer">
          PMID 22513989
        </a>
        . The AHEI-2010 score predicts chronic disease risk better than the USDA&apos;s own dietary guidelines.
      </>
    ),
  },
  {
    n: 2,
    text: (
      <>
        Harvard T.H. Chan School of Public Health.{' '}
        <a className="underline" href="https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/" target="_blank" rel="noopener noreferrer">
          Healthy Eating Plate
        </a>
        .
      </>
    ),
  },
  {
    n: 3,
    text: (
      <>
        Monteiro CA et al. <em>Ultra-processed foods: what they are and how to identify them.</em>{' '}
        Public Health Nutr. 2019;22(5):936–41. NOVA classification — distinguishes industrial formulations
        from minimally-processed food.
      </>
    ),
  },
  {
    n: 4,
    text: (
      <>
        Pagliai G et al. <em>Consumption of ultra-processed foods and health status: a systematic review and meta-analysis.</em>{' '}
        Br J Nutr. 2021;125:308–18. ~10% increase in all-cause mortality per 10% UPF increment in diet.
      </>
    ),
  },
  {
    n: 5,
    text: (
      <>
        Estruch R et al. <em>Primary prevention of cardiovascular disease with a Mediterranean diet supplemented with extra-virgin olive oil or nuts.</em>{' '}
        N Engl J Med. 2018;378:e34. The PREDIMED trial — ~30% reduction in major cardiovascular events.
      </>
    ),
  },
  {
    n: 6,
    text: (
      <>
        Mozaffarian D, Rimm EB. <em>Fish intake, contaminants, and human health: evaluating the risks and the benefits.</em>{' '}
        JAMA. 2006;296(15):1885–99. Two servings/week of fatty fish reduces coronary death risk by ~36%.
      </>
    ),
  },
  {
    n: 7,
    text: (
      <>
        IARC Monographs Working Group. <em>Carcinogenicity of consumption of red and processed meat.</em>{' '}
        Lancet Oncol. 2015;16(16):1599–600. Processed meat: Group 1 (carcinogenic to humans). Red meat: Group 2A (probably carcinogenic).
      </>
    ),
  },
  {
    n: 8,
    text: (
      <>
        Malik VS et al. <em>Long-term consumption of sugar-sweetened and artificially sweetened beverages and risk of mortality in US adults.</em>{' '}
        Circulation. 2019;139(18):2113–25.
      </>
    ),
  },
  {
    n: 9,
    text: (
      <>
        Aune D et al. <em>Whole grain consumption and risk of cardiovascular disease, cancer, and all cause and cause specific mortality.</em>{' '}
        BMJ. 2016;353:i2716. Dose-response meta-analysis of 45 prospective studies.
      </>
    ),
  },
  {
    n: 10,
    text: (
      <>
        Bauer J et al. <em>Evidence-based recommendations for optimal dietary protein intake in older people: a position paper from the PROT-AGE Study Group.</em>{' '}
        J Am Med Dir Assoc. 2013;14:542–59. Plus Attia P. <em>Outlive: The Science and Art of Longevity</em>. Random House, 2023, ch. 15 on protein and muscle.
      </>
    ),
  },
]

function Fn({ n }: { n: number }) {
  return (
    <a
      href={`#fn-${n}`}
      className="text-nutrition-green-dark hover:underline align-super text-[0.7em] font-semibold ml-0.5"
    >
      [{n}]
    </a>
  )
}

function ComponentCard({ c }: { c: Component }) {
  const Icon = c.icon
  const isAdd = c.kind === 'add'
  const accent = isAdd ? 'text-nutrition-green-dark' : 'text-quality-red'
  const bg = isAdd ? 'bg-nutrition-green-soft/30' : 'bg-red-50'
  const badge = isAdd ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-nutrition-green-dark">
      <Check className="w-3 h-3" /> Add
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-quality-red">
      <X className="w-3 h-3" /> Limit
    </span>
  )
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg bg-white flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-right">
          {badge}
          <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{c.max} pts</div>
        </div>
      </div>
      <h3 className="font-semibold text-base">{c.name}</h3>
      <p className="text-sm text-muted-foreground mt-1 leading-snug">{c.why}</p>
    </div>
  )
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-nutrition-green-dark to-nutrition-green text-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/about" className="flex items-center">
            <Logo size="md" className="text-white [&_span]:text-white" />
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              Sign In <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-14 pb-12 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-nutrition-green-dark mb-3">
          Longevity Diet
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          Eat for the years you want.
        </h1>
        <p className="mt-5 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          The science-backed diet for a longer, healthier life.
        </p>
        <p className="mt-6 text-base text-foreground/80 max-w-2xl mx-auto leading-relaxed">
          We don&apos;t just track what you avoid. We measure what you&apos;re actually eating — and tell you,
          every day, what your body is missing. Built on 20+ years of Harvard-led nutrition research<Fn n={1} />,
          the IARC monographs<Fn n={7} />, and the PREDIMED trial<Fn n={5} />.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/login">
            <Button size="lg" className="text-base">
              Sign In <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button size="lg" variant="ghost" className="text-base">
              How it works
            </Button>
          </a>
        </div>
      </section>

      {/* Framing */}
      <section className="max-w-3xl mx-auto px-4 py-14 border-t">
        <h2 className="text-3xl font-bold tracking-tight">
          Most diets tell you what <em>not</em> to eat.
        </h2>
        <p className="mt-5 text-lg text-foreground/80 leading-relaxed">
          Cut sugar. Skip the carbs. Avoid red meat. The diet industry is built on subtraction.
        </p>
        <p className="mt-4 text-lg text-foreground/80 leading-relaxed">
          But the data on human longevity is overwhelmingly <strong>additive</strong>. The people who live the
          longest, healthiest lives aren&apos;t the ones who avoid the most — they&apos;re the ones who hit the most
          targets. Five servings of vegetables. Two servings of fatty fish a week. A daily handful of nuts. Beans
          and lentils most days. Olive oil instead of butter<Fn n={5} />.
        </p>
        <p className="mt-4 text-lg text-foreground/80 leading-relaxed">
          You can&apos;t avoid your way to longevity. You have to <em>eat</em> your way there.
        </p>
      </section>

      {/* The 10 components */}
      <section className="max-w-5xl mx-auto px-4 py-14 border-t">
        <h2 className="text-3xl font-bold tracking-tight">The 10 components.</h2>
        <p className="mt-3 text-lg text-muted-foreground max-w-3xl">
          A 0–100 score adapted from the Alternative Healthy Eating Index (AHEI-2010)<Fn n={1} /> — Harvard&apos;s
          gold-standard dietary quality measure, validated against chronic disease outcomes in hundreds of thousands
          of people followed for decades.
        </p>

        <h3 className="mt-10 text-sm font-semibold uppercase tracking-widest text-nutrition-green-dark">
          Eat more of these (70 points)
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {POSITIVES.map((c) => (
            <ComponentCard key={c.name} c={c} />
          ))}
        </div>

        <h3 className="mt-12 text-sm font-semibold uppercase tracking-widest text-quality-red">
          Limit these (30 points)
        </h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NEGATIVES.map((c) => (
            <ComponentCard key={c.name} c={c} />
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground max-w-3xl">
          70 of the 100 points come from foods you should be <em>adding</em>. That ratio is deliberate. Most people
          score poorly not because they eat too much junk, but because they eat too little of what protects them.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-3xl mx-auto px-4 py-14 border-t">
        <h2 className="text-3xl font-bold tracking-tight">How it works.</h2>

        <div className="mt-8 space-y-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-nutrition-green-dark">
              Density, not maximalism
            </div>
            <h3 className="mt-1 text-xl font-semibold">A bigger salad isn&apos;t a better salad.</h3>
            <p className="mt-2 text-base text-foreground/80 leading-relaxed">
              Every positive component is measured <strong>per 1,000 calories</strong>, not in absolute servings.
              A 1,400-calorie day with 5 servings of vegetables scores the same as a 2,800-calorie day with 10.
              The score rewards the <em>quality</em> of what you eat, not how much of it.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-nutrition-green-dark">
              Rolling 7-day window
            </div>
            <h3 className="mt-1 text-xl font-semibold">Habits, not perfect days.</h3>
            <p className="mt-2 text-base text-foreground/80 leading-relaxed">
              Your score is a continuous 7-day rolling average. One pizza on Friday doesn&apos;t crash your week —
              it gets diluted by six other days. There&apos;s no daily reset, no streak to break. The score moves
              smoothly as your habits move.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-nutrition-green-dark">
              Protein is a separate rail
            </div>
            <h3 className="mt-1 text-xl font-semibold">Different physiology, different target.</h3>
            <p className="mt-2 text-base text-foreground/80 leading-relaxed">
              Protein doesn&apos;t belong in a longevity quality score — it&apos;s a structural nutrient with its
              own daily target. We use the Attia &quot;gentle&quot; recommendation: <strong>0.7g per pound of body
              weight</strong>, daily<Fn n={10} />. A 200 lb adult needs ~140g/day to preserve muscle mass into older
              age. Hit that consistently and you&apos;ll lose less muscle, fall less, recover faster.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-nutrition-green-dark">
              AI does the boring part
            </div>
            <h3 className="mt-1 text-xl font-semibold">Log meals in plain English.</h3>
            <p className="mt-2 text-base text-foreground/80 leading-relaxed">
              Type &quot;oatmeal with blueberries and almond butter, coffee.&quot; The parser breaks it into
              ingredients, classifies each one (vegetables? legumes? omega-3 fish?), and updates your score
              instantly. No barcode scanning. No portion-size guessing. No 500-item food database lookups. And a
              built-in AI coach with persistent memory suggests meals to close the gaps your score is showing.
            </p>
          </div>
        </div>
      </section>

      {/* Concrete proof */}
      <section className="max-w-3xl mx-auto px-4 py-14 border-t">
        <h2 className="text-3xl font-bold tracking-tight">What does a 100/100 week look like?</h2>
        <p className="mt-4 text-lg text-foreground/80 leading-relaxed">
          Not deprivation. Not 90 minutes of meal prep on Sunday. Just real food, eaten on purpose. Here&apos;s a
          full 7-day pattern that hits every target — including the protein rail — built around a 220-pound adult.
        </p>
        <div className="mt-6">
          <a
            href="/weekly-plan.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-base font-semibold text-nutrition-green-dark hover:underline"
          >
            See the 7-day plan <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Science */}
      <section className="max-w-3xl mx-auto px-4 py-14 border-t">
        <h2 className="text-3xl font-bold tracking-tight">The science.</h2>
        <p className="mt-4 text-lg text-foreground/80 leading-relaxed">
          Every component in the score is anchored to peer-reviewed evidence. The AHEI-2010<Fn n={1} /> predicts
          chronic disease risk better than the USDA&apos;s dietary guidelines. Ultra-processed food intake
          tracks linearly with mortality<Fn n={4} />. Two servings of fatty fish per week cuts coronary death risk
          by roughly a third<Fn n={6} />. Whole grain intake reduces all-cause mortality dose-dependently<Fn n={9} />.
          Processed meat is a Group 1 carcinogen — the same category as tobacco smoke and asbestos<Fn n={7} />.
        </p>
        <p className="mt-4 text-lg text-foreground/80 leading-relaxed">
          We didn&apos;t invent any of this. We just made it possible to act on it, every day, in 30 seconds.
        </p>
      </section>

      {/* Footnotes */}
      <section className="max-w-3xl mx-auto px-4 py-14 border-t">
        <h2 className="text-lg font-semibold tracking-tight text-muted-foreground uppercase">References</h2>
        <ol className="mt-4 space-y-3 text-sm text-foreground/70 leading-relaxed">
          {FOOTNOTES.map((fn) => (
            <li key={fn.n} id={`fn-${fn.n}`} className="flex gap-3">
              <span className="font-semibold text-nutrition-green-dark shrink-0 tabular-nums">[{fn.n}]</span>
              <span>{fn.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 border-t text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Eat for the years you want.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          The Longevity Diet is invite-only while we&apos;re onboarding the first cohort.
        </p>
        <div className="mt-8">
          <Link href="/login">
            <Button size="lg" className="text-base">
              Sign In <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 border-t mt-12">
        <div className="flex items-center justify-between flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={true} />
          </div>
          <div>© {new Date().getFullYear()} Longevity Diet</div>
        </div>
      </footer>
    </main>
  )
}
