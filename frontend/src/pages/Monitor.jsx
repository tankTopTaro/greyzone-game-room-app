/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react"
import axios from 'axios'
import WebSocketService from "../utils/WebSocketService.js"

const WS_URL = 'ws://gra-1.local:8082'
const CLIENT = 'monitor'

const Monitor = () => {
    const [prepTime, setPrepTime] = useState(15)
    const [countdown, setCountdown] = useState(0)
    const [lifes, setLifes] = useState(0)
    const [status, setStatus] = useState("")
    const [roomInfo, setRoomInfo] = useState("")
    const [bookRoomUntil, setBookRoomUntil] = useState("")
    const [players, setPlayers] = useState([])
    const [team, setTeam] = useState({})

    const canvasRef = useRef(null)
    const MAX_POINTS = 10
    const REMOVE_INTERVAL = 1000
    const [clickPoints, setClickPoints] = useState([])

    const [room, setRoom] = useState(null)
    const [lights, setLights] = useState([])
    const [scale, setScale] = useState(1)

    const MAX_BUFFERED_UPDATES = 50
    const bufferedLightUpdates = useRef([])

    const audioCache = useRef(new Map())
    const wsService = useRef(null)

    const displayedTime = prepTime > 0 ? prepTime : countdown

    const handleWebSocketMessage = (data) => {
      const messageHandlers = {
         'bookRoomExpired': () => console.log(data),
         'bookRoomWarning': () => console.log(data),
          'colorNames': () => {
             console.log(data)
             //playAudio(data['cache-audio-file-and-play'])
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
             setStatus(data.message)
             //playAudio(data['cache-audio-file-and-play'])
          },
          'levelFailed': () => {
             setStatus(data.message)
             //playAudio(data['cache-audio-file-and-play'])
          },
          'newLevelStarts': () => {
             setStatus('')
             setCountdown(data.countdown)
             setLifes(data.lifes)
             setRoomInfo(`${data.roomType} | Rule ${data.rule} Level ${data.level}`)
             setPlayers(data.players)
             setTeam(data.team || '')
             setBookRoomUntil(formatDate(data.bookRoomUntil))
          },
          'offerNextLevel': () => {
            setStatus(data.message)
         },
          'offerSameLevel': () => {
            setStatus(data.message)
         },
          'playerSuccess': () => {
             //playAudio(data['cache-audio-file-and-play'])
          },
          'playerFailed': () => console.log('playerFailed'),
          'roomDisabled': () => setStatus(data.message),
          'storedGameStates': () => {
               const state = data.data
               setPlayers(state.players)
               setTeam(state.team)
               setRoomInfo(`${state.roomType} | Rule ${state.rule} Level ${state.level}`)
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
             setLifes(data.lifes)
             //playAudio(data['cache-audio-file-and-play'])
          },
          'updateLight': () => handleUpdateLight(data),
          'updatePreparationInterval': () => {
             setPrepTime(data.countdown)
             //if (data['cache-audio-file']) preloadAudio(data['cache-audio-file'])
             
             //if (data['play-audio-file']) playAudio(data['play-audio-file'])
          }
      }

      if (!messageHandlers[data.type]) {console.warn(`No handler for this message type ${data.type}`)}

       messageHandlers[data.type]()
    }

    useEffect(() => {
      document.title = 'GRA | Monitor'
      
      if (!wsService.current) {
        wsService.current = new WebSocketService(WS_URL, CLIENT)
        wsService.current.connect()
      }

      wsService.current.addListener(handleWebSocketMessage)

      return () => {
        if (wsService.current) {
          wsService.current.removeListener(handleWebSocketMessage)
          wsService.current.close()
          wsService.current = null
        }
      }
    }, [])

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

    const handleCanvasClick = (ev) => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      const x = (event.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.offsetWidth)
      const y = (event.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.offsetHeight)
      const xScaled = x / scale
      const yScaled = y / scale

      setClickPoints((prev) => {
         const newPoints = [...prev, { x, y }]
         return newPoints.length > MAX_POINTS ? newPoints.slice(-MAX_POINTS) : newPoints
      })

      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, 10, 0, 2 * Math.PI)
      ctx.fillStyle = "rgba(255, 255, 0, 0.6)"
      ctx.fill()
      ctx.closePath()
      ctx.restore()

      let clickedLight = null
      for (let i = lights.length - 1; i >= 0; i--) {
        const light = lights[i]
        if (
          light.shape === "rectangle" &&
          xScaled >= light.posX &&
          xScaled <= light.posX + light.width &&
          yScaled >= light.posY &&
          yScaled <= light.posY + light.height
        ) {
          clickedLight = light
          break
        }
      }

      if (clickedLight) {
          if (clickedLight.onClick === "ignore") {
              console.log("Click ignored", clickedLight.color)
          } else {
              // console.log(`Click sent (whileColorWas: ${clickedLight.color}, whileOnClickWas: ${clickedLight.onClick})`)
              reportLightClickAction(clickedLight)
          }
      }
    }

    const reportLightClickAction = (light) => {
      wsService.current.send({
        type: 'lightClickAction', 
        lightId: light.id,
        whileColorWas: light.color
      })
    }

    const drawRoom = (ctx) => {
      if (!room) return

      const canvas = canvasRef.current
      canvas.width = window.innerWidth
      setScale(canvas.width / room.width)
      canvas.height = room.height * scale

      ctx.fillStyle = "rgb(43, 51, 55)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      lights.forEach((light) => {
        if (!light.color) {
          light.color = [0, 0, 0]
          light.onClick = "ignore"
        }
        drawLight(ctx, light)
      })

      clickPoints.forEach(({ x, y }) => {
         ctx.beginPath()
         ctx.arc(x, y, 10, 0, 2 * Math.PI)
         ctx.fillStyle = "rgba(255, 255, 0, 0.6)"
         ctx.fill()
         ctx.closePath()
       })
    }

    const drawLight = (ctx, light) => {
      if (light.type === "ledSwitch") {
        ctx.fillStyle = `rgb(${light.color[0]}, ${light.color[1]}, ${light.color[2]})`
        ctx.fillRect(light.posX * scale, light.posY * scale, light.width * scale, light.height * scale)
      } else if (light.type === "screen") {
        ctx.fillStyle = "rgb(0, 0, 0)"
        ctx.fillRect(light.posX * scale, light.posY * scale, light.width * scale, light.height * scale)
        ctx.font = "22px Arial"
        ctx.fillStyle = "white"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const text = light.color.filter((c) => c !== 0).join(",")
        ctx.fillText(text, light.posX * scale + (light.width * scale) / 2, light.posY * scale + (light.height * scale) / 2)
      }
    }

    const applyBufferedLightUpdates = () => {
      const ctx = canvasRef.current.getContext("2d")

      bufferedLightUpdates.current.forEach((lightUpdate) => {
         const updatedLights = lights.map((light) =>
            light.id === lightUpdate.lightId ? { ...light, color: lightUpdate.color } : light
         )
         setLights(updatedLights)
         drawLight(ctx, updatedLights.find((l) => l.id === lightUpdate.lightId))
      })
      
      bufferedLightUpdates.current = []
    }

    const handleUpdateLight = (data) => {
      let light = data
      bufferedLightUpdates.current.push(light)

      setLights((prevLights) => {
         if (!prevLights[light.lightId]) {
            console.warn(`Light ID ${light.lightId} does not exist in lights array`, prevLights)
            return prevLights // Prevents modifying an undefined index
         }

         const updatedLights = [...prevLights] // Create a new array
         updatedLights[light.lightId] = {
            ...updatedLights[light.lightId],
            color: light.color,
            onClick: light.onClick,
         }

         return updatedLights
      })
    }

    useEffect(() => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      const handleResize = () => {
         if (!room) return

         canvas.width = window.innerWidth
         setScale(canvas.width / room.width)

         canvas.height = room.height * scale

         drawRoom(ctx)
      }

      window.addEventListener('resize', handleResize)

      const fetchRoomData = async () => {
          try {
              const response = await axios.get('/get/roomData')
              
              if (response.status === 200 && response.data) {
                  setRoom(response.data.room)
                  setLights(response.data.lights)
              }
          } catch (error) {
              console.error('Failed to fetch room data', error)
          }
      }

      fetchRoomData()

      return () => {
          window.removeEventListener('resize', handleResize)
      }
    }, [room, scale])

    useEffect(() => {
      if (room && lights.length) {
          drawRoom(canvasRef.current.getContext('2d'))
          applyBufferedLightUpdates()
      }
    }, [room, lights])

    useEffect(() => {
      const prefetchImages = async () => {
         for (const player of players) {
            if (player.id) {
               const img = new Image()
               img.src = await getPlayerImageUrl(player.id)
            }
         }
      }

      if (players.length > 0) {
         prefetchImages()
      }
    }, [players])

    useEffect(() => {
      const interval = setInterval(() => {
         setClickPoints((prev) => prev.slice(1))
      }, REMOVE_INTERVAL)

      return () => clearInterval(interval)
    }, [])

    return (
      <div id="monitor" className="d-flex">
        {/* Left Column */}
        <div className="col-8 container py-2 px-4">
          <canvas
              ref={canvasRef} 
              id="canvas1" 
              className="row justify-content-center mb-4" 
              onClick={handleCanvasClick}
              style={{ width: "100%" }}>
          </canvas>
          
          <div className="container py-3 text-white">
            {/* Game Status */}
            <div id="gameStatus" className="row justify-content-center w-100">
               <div className="d-flex justify-content-between">
                  
                  {/* Countdown Timer */}
                  <div className="d-flex gap-2 align-items-center text-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                        <path d="M12 7v5" />
                     </svg>
                     <span id="countdown"> 
                        {formatTime(displayedTime)}
                     </span>
                  </div>

                  {/* Lives */}
                  <div className="d-flex gap-2 align-items-center text-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                     </svg>
                     <span id="lifes">{lifes}</span>
                  </div>
               </div>
            </div>

           
            <div className="d-flex justify-content-between w-100 text-white">
               {/* Room Info */}
               <span id="roomInfo" className='fs-6'>
                  {roomInfo || "Room information not available"}
               </span>

               {/* Game Status */}
               <span id="status" className="fs-6">
                  {status}
               </span>
            </div>
            
            {/* Book Room Until */}
            <div className="row justify-content-center w-100 text-white">
               <small id="bookRoomUntil" className='fs-6'>
                  {bookRoomUntil ? `Booked Until: ${bookRoomUntil}` : "No booking information"}
               </small>
            </div>
          </div>
        </div>
         {/* Right Column */}
         <div className="col-4 container py-2 text-white">
            {/* Team Name */}
            <h4 className='display-6'>
               {team?.name || "No team assigned"}
            </h4>

            {/* Players */}
            <div className="w-100 d-flex flex-column">
               <ul id="room-players" className="fs-2 list-unstyled">
                  {Array.isArray(players) && players.length > 0 ? (
                     players.map((player, index) => (
                        <li key={index} id="lists" className="list-item mb-2">
                           <img 
                              src={player.id ? `https://greyzone-central-server-app.onrender.com/api/images/players/${player.id}.jpg` : 'https://placehold.co/40x40?text=No+Image'}
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
    )
}

export default Monitor
