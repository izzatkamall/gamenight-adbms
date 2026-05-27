import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_MIDDLEWARE_WS_URL

export function useVotingWS(roomId, userId) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [tallies, setTallies]     = useState([])   // [{ game_id, votes }]
  const [winner, setWinner]       = useState(null)  // winning game_id
  const [hasVoted, setHasVoted]   = useState(false)

  useEffect(() => {
    if (!roomId || !userId || !WS_URL) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room_id: roomId, user_id: userId }))
    }

    ws.onmessage = e => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      switch (msg.type) {
        case 'joined':      setConnected(true);            break
        case 'vote_update': setTallies(msg.tallies ?? []); break
        case 'vote_end':    setWinner(msg.winner_game_id); break
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => { ws.close(); wsRef.current = null }
  }, [roomId, userId])

  const castVote = useCallback((votingSessionId, gameId) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1 /* OPEN */ || hasVoted) return
    ws.send(JSON.stringify({
      type: 'vote',
      voting_session_id: votingSessionId,
      game_id: gameId,
    }))
    setHasVoted(true)
  }, [hasVoted])

  return { connected, tallies, winner, hasVoted, castVote }
}
