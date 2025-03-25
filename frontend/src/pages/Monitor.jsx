/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import axios from 'axios'
import WebSocketService from "../utils/WebSocketService.js"

const WS_URL = 'ws://localhost:8081'
const CLIENT = 'monitor'

const Monitor = () => {
    const [countdown, setCountdown] = useState("00:00");
    const [status, setStatus] = useState("");
    const [lifes, setLifes] = useState(5);
    const [roomInfo, setRoomInfo] = useState("");
    const [currentPlayers, setCurrentPlayers] = useState([]);
    const [nextPlayers, setNextPlayers] = useState([]);

    const wsService = useRef(null)

    const canvasRef = useRef(null)
    const MAX_POINTS = 10
    const REMOVE_INTERVAL = 1000
    const [clickPoints, setClickPoints] = useState([])
    const [room, setRoom] = useState(null)
    const [lights, setLights] = useState([])
    const [scale, setScale] = useState(1)

    const [lightsAreDrawn, setLightsAreDrawn] = useState(false)
    const bufferedLightUpdates = useRef([])

    const audioCache = useRef(new Map())

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

    const handleCanvasClick = (ev) => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      const x = (event.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.offsetWidth);
      const y = (event.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.offsetHeight);
      const xScaled = x / scale;
      const yScaled = y / scale;

      setClickPoints((prev) => {
         const newPoints = [...prev, { x, y }]
         return newPoints.length > MAX_POINTS ? newPoints.slice(-MAX_POINTS) : newPoints;
      })

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255, 255, 0, 0.6)";
      ctx.fill();
      ctx.closePath();
      ctx.restore();

      let clickedLight = null;
      for (let i = lights.length - 1; i >= 0; i--) {
        const light = lights[i];
        if (
          light.shape === "rectangle" &&
          xScaled >= light.posX &&
          xScaled <= light.posX + light.width &&
          yScaled >= light.posY &&
          yScaled <= light.posY + light.height
        ) {
          clickedLight = light;
          break;
        }
      }

      if (clickedLight) {
          if (clickedLight.onClick === "ignore") {
              console.log("Click ignored", clickedLight.color);
          } else {
              // console.log(`Click sent (whileColorWas: ${clickedLight.color}, whileOnClickWas: ${clickedLight.onClick})`);
              reportLightClickAction(clickedLight);
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
      canvas.width = window.innerWidth;
      setScale(canvas.width / room.width);
      canvas.height = room.height * scale;

      ctx.fillStyle = "rgb(43, 51, 55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      lights.forEach((light) => {
        if (!light.color) {
          light.color = [0, 0, 0];
          light.onClick = "ignore";
        }
        drawLight(ctx, light);
      });

      clickPoints.forEach(({ x, y }) => {
         ctx.beginPath();
         ctx.arc(x, y, 10, 0, 2 * Math.PI);
         ctx.fillStyle = "rgba(255, 255, 0, 0.6)";
         ctx.fill();
         ctx.closePath();
       });
    }

    const drawLight = (ctx, light) => {
      if (light.type === "ledSwitch") {
        ctx.fillStyle = `rgb(${light.color[0]}, ${light.color[1]}, ${light.color[2]})`;
        ctx.fillRect(light.posX * scale, light.posY * scale, light.width * scale, light.height * scale);
      } else if (light.type === "screen") {
        ctx.fillStyle = "rgb(0, 0, 0)";
        ctx.fillRect(light.posX * scale, light.posY * scale, light.width * scale, light.height * scale);
        ctx.font = "22px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const text = light.color.filter((c) => c !== 0).join(",");
        ctx.fillText(text, light.posX * scale + (light.width * scale) / 2, light.posY * scale + (light.height * scale) / 2);
      }
    }

    const applyBufferedLightUpdates = () => {
      const ctx = canvasRef.current.getContext("2d");
      bufferedLightUpdates.current.forEach((lightUpdate) => {
        const updatedLights = lights.map((light) =>
          light.id === lightUpdate.lightId ? { ...light, color: lightUpdate.color } : light
        );
        setLights(updatedLights);
        drawLight(ctx, updatedLights.find((l) => l.id === lightUpdate.lightId));
      });
      bufferedLightUpdates.current = [];
    }

    // WebSocket Types Methods
    const handleUpdateLight = (data) => {
      let light = data;
            
      if (!lightsAreDrawn) {
         bufferedLightUpdates.current.push(light);
         return;
      }

      setLights((prevLights) => {
         if (!prevLights[light.lightId]) {
            console.warn(`Light ID ${light.lightId} does not exist in lights array`, prevLights);
            return prevLights; // Prevents modifying an undefined index
         }

         const updatedLights = [...prevLights]; // Create a new array
         updatedLights[light.lightId] = {
            ...updatedLights[light.lightId],
            color: light.color,
            onClick: light.onClick,
         };

         return updatedLights;
      });
    }

    useEffect(() => {
      document.title = 'GRA | Monitor'
      
      if (!wsService.current) {
        wsService.current = new WebSocketService(WS_URL, CLIENT)
        wsService.current.connect()
      }

      const handleWebSocketMessage = (data) => {
        const messageHandlers = {
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
            'levelCompleted': () => {
               console.log(data.message)
               playAudio(data['cache-audio-file-and-play'])
            },
            'levelFailed': () => {
               console.log(data.message)
               playAudio(data['cache-audio-file-and-play'])
            },
            'newLevelStarts': () => {
               setCountdown(data.countdown)
               setLifes(data.lifes)
               setRoomInfo(`${data.roomType} | Rule ${data.rule} Level ${data.level}`)
            },
            'offerNextLevel': () => console.log(data.message),
            'offerSameLevel': () => console.log(data.message),
            'playerSuccess': () => {
               playAudio(data['cache-audio-file-and-play'])
            },
            'playerFailed': () => console.log('playerFailed'),
            'timeIsUp': () => console.log(data.message),
            'updateCountdown': () => {
               setCountdown(data.countdown)
            },
            'updateLifes': () => {
               setLifes(data.lifes)
               playAudio(data['cache-audio-file-and-play'])
            },
            'updateLight': () => handleUpdateLight(data),
        }

        if (!messageHandlers[data.type]) {console.warn(`No handler for this message type ${data.type}`)}

         messageHandlers[data.type]()
      }

      wsService.current.addListener(handleWebSocketMessage)

      wsService.current.send({ type: 'subscribe' })

      return () => {
        if (wsService.current) {
          wsService.current.removeListener(handleWebSocketMessage)
          wsService.current.close()
          wsService.current = null
        }
      }
    }, [])

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
              const response = await axios.get('http://localhost:3002/get/roomData')
              
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
      }
    }, [room, lights])

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
                <span id="countdown">{countdown}</span>
              </div>

              {/* Game Status */}
              <div className="d-flex gap-2 align-items-center text-center">
                <span id="status">{status}</span>
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

          {/* Room Info */}
          <div className="row justify-content-center w-100 text-white">
            <small id="roomInfo" className="fs-6">{roomInfo}</small>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-4 container py-2">
          <div id="lists" className="row w-100 d-flex flex-column justify-content-between align-items-start text-white mt-4">
            
            {/* Current Players */}
            <div className="w-100 d-flex flex-column">
              <h4 className="fs-4 mb-3">Current Players</h4>
              <ul id="current-players" className="list-unstyled">
                {currentPlayers.length > 0 ? (
                  currentPlayers.map((player, index) => <li key={index}>{player}</li>)
                ) : (
                  <li>No players</li>
                )}
              </ul>
            </div>

            {/* Next Players */}
            <div className="w-100 d-flex flex-column">
              <h4 className="fs-4 mb-3">Next Players</h4>
              <ul id="next-players" className="list-unstyled">
                {nextPlayers.length > 0 ? (
                  nextPlayers.map((player, index) => <li key={index}>{player}</li>)
                ) : (
                  <li>No next players</li>
                )}
              </ul>
            </div>

          </div>
        </div>
      </div>
    );
};

export default Monitor;
