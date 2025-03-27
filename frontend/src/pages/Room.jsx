/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react"
import axios from 'axios'
import WebSocketService from '../utils/WebSocketService.js'

const WS_URL = 'ws://localhost:8082'
const CLIENT = 'room-screen'

const Room = () => {
   const [prepTime, setPrepTime] = useState(15)
   const [countdown, setCountdown] = useState(0)
   const [lifes, setLifes] = useState(0)
   const [heartLoss, setHeartLoss] = useState(false)
   const [status, setStatus] = useState("")
   const [roomInfo, setRoomInfo] = useState("")
   const [bookRoomUntil, setBookRoomUntil] = useState("")
   const [players, setPlayers] = useState([])
   const [team, setTeam] = useState({})

   const wsService = useRef(null)

   const audioCache = useRef(new Map())

   const displayedTime = prepTime > 0 ? prepTime : countdown

   const heartSVG = (<svg id="heart" xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-heart">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                     </svg>)

   const heartbreakSVG = (<svg id="heart-broken" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-heart-broken">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                              <path d="M12 6l-2 4l4 3l-2 4v3" />
                           </svg>)

   const preloadAudio = async (audioName) => {
      if (audioCache.current.has(audioName)) return   // Already cached

      try {
         const response = await axios.get(`/api/game-audio/${audioName}`)

         if (response.status === 200) {
            const data = response.data
            const audio = new Audio(data.url)

            audio.preload = 'auto'
            audioCache.current.set(audioName, audio)
         }
      } catch (error) {
         console.error(`Failed to preload ${audioName}:`, error)
      }
   }

   const playAudio = async (audioName) => {
      if (!audioCache.current.has(audioName)) {
         console.warn(`Audio not preloaded. Preloading ${audioName} now...`)
         await preloadAudio(audioName)
      }

      return new Promise((resolve, reject) => {
         const audio = audioCache.current.get(audioName)

         if (!audio) {
            reject(new Error(`Audio not found: ${audioName}`))
            return
         }

         const clone = audio.cloneNode()
         clone.muted = true
         clone.play()
            .then(() => {
               clone.muted = false
               resolve()
            })
            .catch((err) => {
               console.error(`Autoplay failed: ${audioName}`, err)
               reject(err)
            })
      })
   }

   const prefetchImages = (players) => {
      players.forEach((player) => {
         if (player.id) {
            const img = new Image()
            img.src = `https://greyzone-central-server-app.onrender.com/api/images/players/${player.id}.jpg`
         }
      })
   }

   /** WebSocket methods */
   const handleWebSocketMessage = (data) => {
      const messageHandlers = {
          'bookRoomExpired': () => console.log(data),
          'bookRoomWarning': () => console.log(data),
          'colorNames': () => {
             console.log(data)
             playAudio(data['cache-audio-file-and-play'])
          },
          'colorNamesEnd': () => {
             console.log(data)
             wsService.current.send({
                type: 'colorNamesEnd'
             })
          },
          'endAndExit': () => {
            setPlayers([])
            setTeam({})
            setLifes(0)
            setPrepTime(15)
            setCountdown(0)
            setStatus('')
            setRoomInfo('')
            setBookRoomUntil('')
          },
          'levelCompleted': () => {
             console.log(data.message)
             setStatus(data.message)
             playAudio(data['cache-audio-file-and-play'])
          },
          'levelFailed': () => {
             console.log(data.message)
             setStatus(data.message)
             playAudio(data['cache-audio-file-and-play'])
             setTimeout(() => {
                setStatus('')
                setCountdown(0)
                setLifes(0)
             })
          },
          'newLevelStarts': () => {
             setCountdown(data.countdown)
             setLifes(data.lifes)
             setRoomInfo(`Level ${data.level}`)
             setPlayers(data.players)
             setTeam(data.team || '')
             setBookRoomUntil(formatDate(data.bookRoomUntil))

             if (Array.isArray(data.players) && data.players.length > 0) {
               prefetchImages(data.players)
             }
          },
          'offerNextLevel': () => console.log(data.message),
          'offerSameLevel': () => console.log(data.message),
          'playerSuccess': () => {
             playAudio(data['cache-audio-file-and-play'])
          },
          'playerFailed': () => console.log('playerFailed'),
          'roomDisabled': () => console.log(data.message),
          'storedGameStates': () => {
            const state = data.data
            setPlayers(state.players)
            setTeam(state.team)
            setRoomInfo(`Level ${state.level}`)
            setPrepTime(state.prepTime)
            setCountdown(state.countdown)
            setLifes(state.lifes)
            setBookRoomUntil(state.book_room_until)
         },
          'timeIsUp': () => console.log(data.message),
          'updateCountdown': () => {
             setCountdown(data.countdown)
          },
          'updateLifes': () => {
            playAudio(data['cache-audio-file-and-play'])

            if (data.lifes < lifes) {
               setHeartLoss(true)
               setTimeout(() => {
                  setLifes(data.lifes)
                  setHeartLoss(false)
               }, 500)
            } else {
               setLifes(data.lifes)
            }
          },
          'updatePreparationInterval': () => {
             setPrepTime(data.countdown)
             if (data['cache-audio-file']) preloadAudio(data['cache-audio-file'])
             
             if (data['play-audio-file']) playAudio(data['play-audio-file'])
          }
      }

      if (!messageHandlers[data.type]) {console.warn(`No handler for this message type ${data.type}`)}

       messageHandlers[data.type]()
   }

   const formatTime = (seconds) => { 
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60

      return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
   }

   const formatDate = (isoString) => {
      if (!isoString) return 'No booking information'

      const date = new Date(isoString)
      return date.toLocaleString('en-US', {
         month: 'long',
         day: 'numeric',
         year: 'numeric',
         hour: 'numeric',
         minute: 'numeric',
         hour12: true
      })
   }

   useEffect(() => {
      document.title = 'GRA | Room'
      
      if (!wsService.current) {
         wsService.current = new WebSocketService(WS_URL, CLIENT)
         wsService.current.connect()
         console.log('WebSocket connected')
      }

      wsService.current.addListener(handleWebSocketMessage)

      wsService.current.send({ type: 'subscribe' })

      return () => {
         console.log('Cleaning up WebSocket')
         if (wsService.current) {
            wsService.current.removeListener(handleWebSocketMessage)
            wsService.current.close()
            wsService.current = null
         }
      }
   }, [])

  return (
   <div id="room" className="container d-flex flex-column align-items-center justify-content-center text-white">
      <div id="hud-container" className="hud d-flex w-100 h-100 flex-column align-items-center justify-content-center text-white">
            <div id="lifes-container" className="w-100 d-flex gap-2 align-items-center justify-content-center flex-grow-1">
               {Array.from({ length: lifes }, (_, index) => (
                  <div key={index} className={`heart ${heartLoss ? 'heart-lost' : ''}`}>
                     {heartSVG}
                  </div>
               ))}

               {Array.from({ length: Math.max(0, 5 - lifes)}, (_, index) => (
                  <div key={`broken-${index}`} className='heart-broken'>
                     {heartbreakSVG}
                  </div>
               ))}
            </div>

            <div className="w-100 d-flex flex-column align-items-center">
               <span
                  id="countdown"
                  className="text-center d-flex align-items-center justify-content-center"
               >
                  {formatTime(displayedTime)}
               </span>

               <div
                  id="score-container"
                  className="d-flex flex-column align-items-center justify-content-center flex-grow-1 py-4"
               >
                  <div id="color-sequence" className="d-flex invisible cursor-none justify-content-center gap-2 mb-3" style={{cursor: 'none'}}>
                        <span
                           className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                           style={{width: '40px', height: '40px', cursor: 'none'}}
                        ></span>
                        <span
                           className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                           style={{width: '40px', height: '40px', cursor: 'none'}}
                        ></span>
                        <span
                           className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                           style={{width: '40px', height: '40px', cursor: 'none'}}
                        >                
                        </span>
                        <span
                           className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                           style={{width: '40px', height: '40px', cursor: 'none'}}
                        ></span>
                        <span
                           className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                           style={{width: '40px', height: '40px', cursor: 'none'}}
                        ></span>
                        <span
                           className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                           style={{width: '40px', height: '40px', cursor: 'none'}}
                        ></span>
                  </div>
               </div>
            </div>

            <div className="w-100 d-flex flex-column gap-2 align-items-center justify-content-center flex-grow-1">
               <span id="room-info" className="fs-2">{roomInfo}</span>
            </div>

            <div className="w-100 d-flex flex-column gap-2 align-items-center justify-content-center flex-grow-1">
               <h4 className='fs-6'>
                  {team?.name}
               </h4>
               <ul id="room-players" className="fs-2 list-unstyled">
                  {Array.isArray(players) && players.length > 0 ? (
                     players.map((player, index) => (
                        <li key={index} className="d-flex align-items-center gap-2 mb-2">
                           <img 
                              src={player.id ? `https://greyzone-central-server-app.onrender.com/api/images/players/${player.id}.jpg` : 'https://placehold.co/40x40?text=No+Image'}
                              alt={player.nick_name || 'Unknown'}
                              width="40"
                              height="40"
                              className="rounded-circle"
                           />
                           <span>{player.nick_name ?? 'Unknown'}</span>
                        </li>
                     ))
                  ) : (
                     <li>No players</li>
                  )}
               </ul>
            </div>
      </div>  
      
      <div id="player-message-container" className="w-100 h-100 d-none gap-2 align-items-center justify-content-center">
            <span id="player-message" className="fs-1">{status}</span>
      </div>

      <div className="room-message-container w-100 h-100 d-none gap-2 align-items-center justify-content-center">
            <span id="room-message" className="fs-1">Hello</span>
      </div>
   </div>
  )
}

export default Room