import { useEffect, useRef, useCallback, useState } from 'react'

type WSEvent = { event: string; data: unknown }
type Listener = (data: unknown) => void

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Map<string, Set<Listener>>>(new Map())
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/ws`

    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        try {
          const msg: WSEvent = JSON.parse(e.data)
          const listeners = listenersRef.current.get(msg.event)
          listeners?.forEach((fn) => fn(msg.data))
        } catch {}
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const on = useCallback((event: string, fn: Listener) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set())
    }
    listenersRef.current.get(event)!.add(fn)
    return () => { listenersRef.current.get(event)?.delete(fn) }
  }, [])

  return { connected, on }
}
