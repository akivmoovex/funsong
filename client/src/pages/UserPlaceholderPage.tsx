type Props = {
  title: string
  description: string
}

export function UserPlaceholderPage({ title, description }: Props) {
  return (
    <section className="rounded-3xl border border-white/15 bg-slate-900/35 p-6 text-white shadow-xl">
      <h1 className="text-2xl font-black text-amber-100">{title}</h1>
      <p className="mt-2 text-sm text-white/80">{description}</p>
    </section>
  )
}
