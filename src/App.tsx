import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, Heart, Sparkles } from 'lucide-react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-svh bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <main className="mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-indigo-200 backdrop-blur"
        >
          <Sparkles className="size-4 text-amber-300" />
          Vite + React + TypeScript
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-4"
        >
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-indigo-500/20 ring-1 ring-indigo-400/30">
            <Globe className="size-10 text-indigo-300" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Family Atlas
          </h1>
          <p className="mx-auto max-w-xl text-lg text-slate-300">
            Tailwind CSS, Framer Motion, and Lucide React are ready to go.
          </p>
        </motion.div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCount((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-6 py-3 text-base font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
        >
          <Heart className="size-5 fill-current" />
          Count is {count}
        </motion.button>
      </main>
    </div>
  )
}

export default App
