/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react"
import axios from 'axios'
import WebSocketService from '../utils/WebSocketService.js'

const WS_URL = 'ws://gra-1.local:8082'
const CLIENT = 'room-screen'

const Room = () => {
   const [prepTime, setPrepTime] = useState(null)
   const [countdown, setCountdown] = useState(null)
   const [lifes, setLifes] = useState(0)
   const [heartLoss, setHeartLoss] = useState(false)
   const [status, setStatus] = useState("")
   const [statusType, setStatusType] = useState("")
   const [roomInfo, setRoomInfo] = useState("")
   const [roomType, setRoomType] = useState("")
   const [bookRoomUntil, setBookRoomUntil] = useState("")
   const [bookRoomCountdown, setBookRoomCountdown] = useState("06:00")
   const [colors, setColors] = useState([])
   const [players, setPlayers] = useState([])
   const [team, setTeam] = useState({})


   const wsService = useRef(null)

   const audioCache = useRef(new Map())

   const displayedTime = prepTime > 0 ? prepTime : countdown
   const [playerImageUrls, setPlayerImageUrls] = useState({})

   const heartSVG = (<svg id="heart" xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-heart">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                     </svg>)

   const heartbreakSVG = (<svg id="heart-broken" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-heart-broken">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                              <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                              <path d="M12 6l-2 4l4 3l-2 4v3" />
                           </svg>)

   const handleWebSocketMessage = (data) => {
      console.log('Received data: ', data)
      const messageHandlers = {
         'bookRoomCountdown': () => setBookRoomCountdown(data.remainingTime),
         'bookRoomExpired': () => {
            setStatus(data.message)
            setStatusType('room')
         },
         'bookRoomWarning': () => {
            setStatus(data.message)
            setStatusType('room')
         },
         'colorNames': () => {
            playAudio(data['cache-audio-file-and-play'])
         },
         'colorNamesEnd': () => {
            wsService.current.send({
               type: 'colorNamesEnd'
            })
         },
         'endAndExit': () => {
            console.log(data)
            setPlayers([])
            setColors([])
            setTeam({})
            setLifes(0)
            setPrepTime(15)
            setCountdown(0)
            setStatus('')
            setRoomInfo('')
            setRoomType('')
            setBookRoomUntil('')
            setStatusType('')
         },
         'levelCompleted': () => {
            setStatus(data.message)
            playAudio(data['cache-audio-file-and-play'])
         },
         'levelFailed': () => {
            setStatus(data.message)
            playAudio(data['cache-audio-file-and-play'])
         },
         'newLevelStarts': () => {
            setCountdown(data.countdown)
            setLifes(data.lifes)
            setRoomInfo(`Level ${data.level}`)
            setRoomType(data.roomType)
            setPlayers(data.players)
            setTeam(data.team || '')
            setBookRoomUntil(formatDate(data.bookRoomUntil))
            setColors([])
            setStatusType('')
         },
         'offerNextLevel': () => {
            setStatus(data.message)
            setStatusType('player')
         },
         'offerSameLevel': () => {
            setStatus(data.message)
            setStatusType('player')
         },
         'playerSuccess': () => {
            playAudio(data['cache-audio-file-and-play'])
            addColor(data.color)
         },
         'playerFailed': () => addColor(data.color),
         'roomDisabled': () => setStatus(data.message),
         'storedGameStates': () => {
            const state = data.data
            setPlayers(state.players)
            setTeam(state.team)
            setRoomInfo(`Level ${state.level}`)
            setRoomType(state.roomType)
            setPrepTime(state.prepTime)
            setCountdown(state.countdown)
            setLifes(state.lifes)
            setBookRoomUntil(state.book_room_until)
         },
         'timeIsUp': () => setStatus(data.message),
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

   useEffect(() => {
      document.title = 'GRA | Room'
      
      if (!wsService.current) {
         wsService.current = new WebSocketService(WS_URL, CLIENT)
         wsService.current.connect()
         console.log('WebSocket connected')
      }

      wsService.current.addListener(handleWebSocketMessage)

      return () => {
         console.log('Cleaning up WebSocket')
         if (wsService.current) {
            wsService.current.removeListener(handleWebSocketMessage)
            wsService.current.close()
            wsService.current = null
         }
      }
   }, [])

   const addColor = (newColor) => {
      if (!newColor || (Array.isArray(newColor) && newColor.every((val) => val === 0))) return

      setColors((prevColors) => {
         if (prevColors.length >=6) return [newColor]

         return [...prevColors, newColor]
      })
   }

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

   const getPlayerImageUrl = async (playerId) => {
      const facilityUrl = `https://192.168.254.100:3001/api/images/players/${playerId}.jpg`
      const centralUrl = `https://greyzone-central-server-app.onrender.com/api/images/players/${playerId}.jpg`

      try {
         const response = await fetch(facilityUrl, { method: 'HEAD' })
         if (response.ok) return facilityUrl
      } catch (error) {
         // If facility image is not available, fallback to central server
      }

      return centralUrl
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
      const prefetchImages = async () => {
         const urls = {};
         for (const player of players) {
            if (player.id) {
               const url = await getPlayerImageUrl(player.id);
               urls[player.id] = url;
            }
         }
         setPlayerImageUrls(urls);
      };
   
      if (players.length > 0) {
         prefetchImages();
      }
   }, [players])

  return (
   <div id="room" className="container d-flex flex-column align-items-center justify-content-center text-white">
      <div id="hud-container" className={`hud d-flex w-100 h-100 flex-column align-items-center justify-content-center text-white ${statusType ? 'd-none' : ''}`}>
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
                  {roomType === 'basketball' && (
                     <div id="color-sequence" className={`d-flex cursor-none justify-content-center gap-2 mb-3`} style={{cursor: 'none'}}>
                        {[...Array(6)].map((_, index) => (
                           <span
                              key={index}
                              className="rounded-circle border border-2 border-white d-flex align-items-center justify-content-center"
                              style={{
                                 width: '40px',
                                 height: '40px',
                                 cursor: 'none',
                                 backgroundColor: colors[index] ? `rgb(${colors[index].join(', ')})` : 'transparent'
                              }}
                           >
                           </span>
                        ))}
                     </div>
                  )}
               </div>
            </div>

            <div className="w-100 d-flex flex-column gap-2 align-items-center justify-content-center flex-grow-1 mb-2">
               <span id="room-info" className="fs-2 mb-2">{roomInfo}</span>
               <small id="bookRoomUntil" className='fs-6'>
                  {bookRoomCountdown}
                </small>
            </div>

            <div className="w-100 d-flex flex-column gap-2 align-items-center justify-content-center flex-grow-1">
               <h4 className='display-6 mb-2'>
                  {team?.name}
               </h4>
               {/* Players */}
               <div className="w-100 d-flex flex-column align-items-center">
                  <ul id="room-players" className="fs-2 list-unstyled">
                     {Array.isArray(players) && players.length > 0 ? (
                        players.map((player, index) => (
                           <li key={index} id="lists" className="list-item mb-2">
                              <img 
                                 src={playerImageUrls[player.id] || 'https://placehold.co/40x40?text=No+Image'}
                                 alt={player.nick_name || 'Unknown'}
                                 className="avatar"
                              />
                              <div className="d-flex flex-column align-items-start">
                                 <span>{player.nick_name ?? 'Unknown'}</span>
                              </div>
                           </li>
                        ))
                     ) : (
                        <li>No players</li>
                     )}
                  </ul>
               </div>
            </div>
      </div>  
      
      <div id="player-message-container" className={`w-100 h-100 gap-2 align-items-center justify-content-center ${statusType === 'player' ? 'd-flex' : 'd-none'}`}>
            <span id="player-message" className="fs-1">{status}</span>
      </div>

      <div id="room-message-container" className={`w-100 h-100 gap-2 align-items-center justify-content-center ${statusType === 'room' ? 'd-flex' : 'd-none'}`}>
            <span id="room-message" className="fs-1">{status}</span>
      </div>
   </div>
  )
}

export default Room