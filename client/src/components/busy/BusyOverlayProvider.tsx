import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { BusyOverlayView } from './BusyOverlayView'

const DEFAULT_MSG = 'Working on it...'

type RunOpts = { message?: string }

type BusyContextValue = {
  runBusy: <T>(fn: () => Promise<T>, opts?: RunOpts) => Promise<T>
}

const BusyContext = createContext<BusyContextValue | null>(null)

export function BusyOverlayProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState(DEFAULT_MSG)
  const depthRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runBusy = useCallback(async <T,>(fn: () => Promise<T>, opts?: RunOpts): Promise<T> => {
    const text = (opts?.message && opts.message.trim()) || DEFAULT_MSG
    setMessage(text)
    depthRef.current += 1
    if (depthRef.current === 1) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (depthRef.current > 0) setVisible(true)
      }, 1000)
    }
    try {
      return await fn()
    } finally {
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setVisible(false)
      }
    }
  }, [])

  return (
    <BusyContext.Provider value={{ runBusy }}>
      {children}
      {visible ? <BusyOverlayView message={message} /> : null}
    </BusyContext.Provider>
  )
}

export function useDelayedBusy() {
  const c = useContext(BusyContext)
  if (!c) {
    throw new Error('useDelayedBusy must be used within BusyOverlayProvider')
  }
  return c
}
