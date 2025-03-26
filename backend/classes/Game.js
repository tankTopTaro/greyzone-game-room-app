import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import Shape from './Shape.js'
import { hsvToRgb, areRectanglesIntersecting } from '../utils/utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const blueGreen1 = hsvToRgb([130,220,255])
const black = hsvToRgb([0,0,0])
const yellow = hsvToRgb([42,255,255])
const green = hsvToRgb([85,255,255])
const red = hsvToRgb([0,255,255])

export default class Game {
    constructor(rule, level, players = [], team, book_room_until, env, roomInstance, timeForLevel = 60, timeToPrepare = 15) {
        this.players = players
        this.rule = rule
        this.level = level
        this.team = team
        this.book_room_until = book_room_until
        this.env = env
        this.room = roomInstance
        this.timeForLevel = timeForLevel

        this.animationMetronome = undefined
        this.bookRoomInterval = undefined
        this.shapes = []
        this.status = undefined
        this.gameStartedAt = undefined
        this.lastLevelStartedAt = undefined
        this.lastLevelCreatedAt = Date.now()
        this.createdAt = Date.now()

        this.timeToPrepare = timeToPrepare
        this.preparationInterval = undefined
        this.preparationIntervalStartedAt = undefined
    }

    async init() {
        let result

        await this.prepareAndGreet()
            .then(() => {
                this.room.isFree = false
                this.trackBookRoomTime()
                this.start()
                result = true
            })
            .catch((e) => {
                console.log('CATCH: prepareAndGreet() failed')
                console.log(e)
                this.room.currentGameSession = undefined
                console.log('Game session cancelled.')
                console.log('Room remains free.')
                result = e
                // TODO: reportErrorToCentral(e)
            })

        return result
    }

    reset() {
        if (this.animationMetronome) {
            clearInterval(this.animationMetronome)
            this.animationMetronome = undefined
        }

        if (this.bookRoomInterval) {
            clearInterval(this.bookRoomInterval)
            this.bookRoomInterval = undefined
        }

        if (this.preparationInterval) {
            clearInterval(this.preparationInterval)
            this.preparationInterval = undefined
        }
        
        this.status = undefined
        this.shapes = []
        this.lastLevelCreatedAt = Date.now()
        this.room.lights.forEach(light => {
            light.color = black
            light.onClick = 'ignore'
        })
        this.room.sendLightsInstructionsIfIdle()
    }

    prepareAndGreet() {
        let prepared = this.prepare()
        let greeted = this.greet()

        return Promise.all([prepared, greeted])
            .then((results) => {
                console.log('Both promise are resolved!')
                console.log('Result of prepare():', results[0])
                console.log('Result of greet(): ', results[1])
            })
    }

    greet() {
        return new Promise((resolve) => {
            console.log('Greeting sound starts...')
            setTimeout(() => {
                console.log('Greeting sound ends...')
                resolve(true)
            }, 2000)
        })
    }
    
    async prepare() {
        return new Promise((resolve, reject) => {
            console.log('preparation starts...')
            this.lastLifeLostAt = 0
            this.countdown = this.timeForLevel
            this.lifes = 5
            this.prepTime = this.timeToPrepare

            this.room.socket.broadcastMessage('monitor', {
               type: 'newLevelStarts',
               rule: this.rule,
               level: this.level,
               countdown: this.countdown,
               lifes: this.lifes,
               roomType: this.room.type,
               players: this.players,
               team: this.team,
               bookRoomUntil: this.book_room_until
           })

           this.preparationIntervalStartedAt = Date.now()

            this.preparationInterval = setInterval(() => {
               this.updatePreparationInterval()

               if (this.prepTime === 0) {
                  clearInterval(this.preparationInterval)

                  setTimeout(async () => {
                     try {
                        clearInterval(this.animationMetronome);
                        await this.prepareShapes();
                        console.log('preparation ends...');
                        this.status = 'prepared';
                        resolve(true); // Now resolve after preparation is complete
                     } catch (error) {
                        console.log('CATCH: prepareShapes() failed');
                        reject(error);
                     }
                  }, 1000);
               }
            }, 1000)
        })
    }

    async prepareShapes() {
        try {
            const SHAPES_CONFIG_PATH = path.join(__dirname, '../config', path.basename(this.room.config.prepareShapes))

            const shapesData = await fs.promises.readFile(SHAPES_CONFIG_PATH, 'utf8')
            const configurations = JSON.parse(shapesData)

            // console.log(`Level ${this.level} Config: ${configurations[this.level]}`)

            const levelConfig = configurations[this.level]

            if (!levelConfig) {
                console.warn(`Invalid level: ${this.level}`)
            }

            // create shapes
            levelConfig.shapes.forEach((shape, index) => {
                let pathDotsToUse = levelConfig.pathDots

                switch(this.level) {
                    case 1:
                    case 2:
                        pathDotsToUse = index === 1 && levelConfig.extraPathDots.length > 0 ? levelConfig.extraPathDots : levelConfig.pathDots
                        break
                    case 3:
                        pathDotsToUse = index === 1 && levelConfig.safeDots.length > 0 ? levelConfig.safeDots : levelConfig.pathDots
                        break
                    default:
                        break
                }

                this.shapes.push(new Shape(shape.x, shape.y, 'rectangle', shape.width, shape.height, shape.color, shape.action, pathDotsToUse, shape.speed, 'mainFloor'))
            })
            
            // console.log(`Loaded shapes configurations for type: ${this.room.type}`)
        } catch (error) {
            console.error(`Error loading shapes config: ${error.message}`)
        }
    }

    handleLightClickAction(lightId, whileColorWas) {
        let clickedLight = this.GetLightById(lightId)
        this.handleGameSpecificLightAction(clickedLight, whileColorWas)
    }

    handleGameSpecificLightAction(clickedLight, whileColorWas) {
        throw new Error('handleGameSpecificLightAction must be implemented in subclasses')
    }

    GetLightById(lightId) {
        let res
        this.room.lights.some((light) => {
            if(light.id === lightId){
                res = light
                return true
            }
        })
        return res
    }

    updateShapes() {
        let now = Date.now()
        this.shapes.forEach((shape) => {
            if(shape.active){
                if(shape.activeUntil !== undefined && shape.activeUntil < now) {
                    shape.active = false
                } else {
                    shape.update()
                }
            }
        })
    }

    applyShapesOnLights() {
        // scanning the shapes array reversly to focus on the last layer
        this.room.lights.forEach((light) => {
            if(!light.isAffectedByAnimation){return false}
            let lightHasColor = false

            for (let i = this.shapes.length - 1; i >= 0; i--) {
                const shape = this.shapes[i]
                if(!shape.active){continue}
                if(!(this.room.lightGroups[shape.affectsLightGroup].includes(light))){continue}
                // does that shape cross into that light ?
                let areIntersecting = false
                if(shape.shape === 'rectangle' && light.shape === 'rectangle'){
                    areIntersecting = areRectanglesIntersecting(shape, light)
                }else{
                    throw new Error('intersection not computable for these shapes (TODO).')
                }
                if(areIntersecting){
                    light.color = shape.color
                    light.onClick = shape.onClick
                    lightHasColor = true
                    break
                }
            }

            if(lightHasColor === false && light.isAffectedByAnimation === true){
                light.color = [0,0,0]
                light.onClick = 'ignore'
            }
        })
    }

    levelCompleted() {
       this.room.socket.broadcastMessage('monitor', {
         type: 'levelCompleted',
         message: 'Player Wins',
         'cache-audio-file-and-play': 'levelCompleted'
      })
         
      this.startNextLevel()
    }

    levelFailed() {
      const now = Date.now();
      const bookRoomTime = this.book_room_until ? new Date(this.book_room_until + 'Z').getTime() : 0;

      this.room.socket.broadcastMessage('monitor', {
         type: 'levelFailed',
         message: 'Player Lose',
         'cache-audio-file-and-play': 'levelFailed'
      });

      if (bookRoomTime > now) {
         this.startSameLevel();
      } else {
         // Time is up, end the session
         this.endAndExit();
      }
   }  

    async startSameLevel() {
      this.room.socket.broadcastMessage('monitor', {
         type: 'offerSameLevel',
         message: 'Game Over! Press Yellow Button to play again, press Red Button to leave the room.'
      })

      this.reset()
      this.timeToPrepare = 0
      await this.prepare()
      this.start()
    }

    async startNextLevel() {
      this.room.socket.broadcastMessage('monitor', {
            type: 'offerNextLevel',
            message: 'Game Over! Press Green Button to proceed to next level, press Red Button to leave the room.'
         })
   
      // Reset current game session properly
      this.reset()
      this.room.isFree = false
   
      // Properly assign the new game session
      this.room.currentGameSession = await this.room.gameManager.loadGame(
         this.room.type,
         this.rule, 
         parseInt(this.level, 10) + 1, 
         this.players, 
         this.team,
         this.book_room_until,
         this.room
      )

      if (this.room.currentGameSession) {
         this.room.currentGameSession.start()
      }
    }

    updateCountdown() {
        if (this.status === undefined) return

        let timeLeft = Math.round((this.lastLevelStartedAt + (this.timeForLevel * 1000) - Date.now()) / 1000)

        if (timeLeft !== this.countdown) {
            if (timeLeft >= 0) {
                const message = {
                  type: 'updateCountdown',
                  countdown: this.countdown
                }

                this.room.socket.broadcastMessage('monitor', message)
                this.countdown = timeLeft
            } else {
                this.room.socket.broadcastMessage('monitor', { 
                  type: 'timeIsUp', 
                  message: 'Player ran out of time.'
               })
                this.levelFailed()
            }
        }
    }

    removeLife() {
        if(this.lastLifeLostAt < (Date.now() - 2000)){
            this.lastLifeLostAt = Date.now()

            if(this.lifes > 0) {
                this.lifes--
                this.updateLifes()
            }
        }
    }

    updateLifes() {
      this.room.socket.broadcastMessage('monitor', {
         type: 'updateLifes',
         lifes: this.lifes,
         'cache-audio-file-and-play': 'playerLoseLife'
      })

      if (this.lifes === 0) {
         this.levelFailed()
      }
    }

    updatePreparationInterval() {
      let timeLeft = Math.round((this.preparationIntervalStartedAt + (this.timeToPrepare * 1000) - Date.now()) / 1000)

      if (timeLeft != this.prepTime) {
         //console.log('TIMELEFT: ', timeLeft, 'PREPTIME: ', this.prepTime)
         if (timeLeft >= 0) {
            this.prepTime = timeLeft
            if (this.prepTime === 15) {
               this.room.socket.broadcastMessage('monitor', {
                  type: 'updatePreparationInterval',
                  countdown: this.prepTime,
                  'cache-audio-file': '321go'
               })
            } else if (this.prepTime === 3) {
               this.room.socket.broadcastMessage('monitor', {
                  type: 'updatePreparationInterval',
                  countdown: this.prepTime,
                  'play-audio-file': '321go'
               })
            } else {
               this.room.socket.broadcastMessage('monitor', {
                  type: 'updatePreparationInterval',
                  countdown: this.prepTime
               })
            }
         }
      }
    }

    start() {
      if (this.status === 'running') {
         console.warn('Game is already running. Ignoring start call.')
         return
      }

      this.setupGame()
      this.gameStartedAt = Date.now()
      this.status = 'running'
      console.log('Game Session started.')
    }
  
    setupGame() {
      console.log('Setting up game...')
    }

    async endAndExit() {
      console.log('Game Ended...')
      this.reset()
      this.room.isFree = true

      if (this.room.waitingGameSession !== undefined) {
         this.room.currentGameSession = this.room.waitingGameSession
         this.room.waitingGameSession = undefined

         await this.room.currentGameSession.start()
      }
    }

    trackBookRoomTime() {
      if(!this.book_room_until) return

      const warningTime = 6 * 60 * 1000 // 6-minutes before timeout
      const checkInterval = 30 * 1000  // check every 30 seconds

      const bookRoomTime = new Date(this.book_room_until + 'Z').getTime()

      this.bookRoomInterval = setInterval(() => {
         const now = Date.now()
         const timeLeft = bookRoomTime - now

         if (timeLeft <= 0) {
            clearInterval(this.bookRoomInterval)
            console.warn(`Time is up.`)
            this.room.socket.broadcastMessage('monitor', {
               type: 'bookRoomExpired',
               message: 'Time is up! Please exit or extend your session.'
            })
            this.endAndExit()
         } else if (timeLeft <= warningTime) {
            console.warn(`WARNING: You have ${Math.ceil(timeLeft / 60000)} minutes lefts.`)
            this.room.socket.broadcastMessage('monitor', {
               type: 'bookRoomWarning',
               message: `Time is almost up! You have ${Math.ceil(timeLeft / 60000)} minutes lefts.`
            })
         }
      }, checkInterval)
    }
}