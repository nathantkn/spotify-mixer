import { useEffect, useState } from 'react'
import { MixView } from './components/mix/MixView'
import { StartScreen } from './components/start/StartScreen'
import { PlanProvider } from './state/PlanContext'

/** Two screens: start | mix. A session is one opening of a plan. */
export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [session])

  if (!session) return <StartScreen onOpen={setSession} />

  return (
    <PlanProvider key={session.key} initial={session.plan} saveOnOpen={session.saveOnOpen}>
      <MixView session={session} onExit={() => setSession(null)} />
    </PlanProvider>
  )
}
