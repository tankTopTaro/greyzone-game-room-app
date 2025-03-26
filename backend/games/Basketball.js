import Game from '../classes/Game.js'
import Shape from '../classes/Shape.js'
import { hsvToRgb } from '../utils/utils.js'

const blueGreen1 = hsvToRgb([130,220,255])
const black = hsvToRgb([0,0,0])

export default class Basketball extends Game {
    constructor (players, rule, level, team, book_room_until, env, roomInstance) {
        super(players, rule, level, team, book_room_until, env, roomInstance, 25, 15)
        this.running = false
        this.showColor = undefined
      }

    async start() {
      const ruleHandlers = {
         1: () => {
            this.lightColorSequence = []
            this.currentColorIndex = 0

            this.colors = [
               { rgb: [255, 0, 0], name: 'red' },
               { rgb: [0, 255, 0], name: 'green' },
               { rgb: [0, 0, 255], name: 'blue' },
               { rgb: [255, 255, 0], name: 'yellow' },
               { rgb: [255, 0, 255], name: 'purple' }
            ]

            const colorsSequence = this.makeColorSequence(3, this.colors)

            console.log('Color sequence:', colorsSequence.map(c => c.name))

            this.lightColorSequence = new Array(colorsSequence.length).fill(null)

            this.showColorSequence(colorsSequence)
         }
      }

      this.running = true

      console.log("Starting preparation countdown...");

      super.start()
      
      console.log(`Basketball is running!`)

      if(!ruleHandlers[this.rule]) {
         console.warn(`No handlers for this rule ${this.rule}`)
      }

      ruleHandlers[this.rule]()
    }

    setupGame() {
      const handleMonitorMessage = (message) => {
         try {
            const data = JSON.parse(message)
   
            if (data.type === 'colorNamesEnd') {
               if (this.animationMetronome) {
                  clearInterval(this.animationMetronome)
               }
               this.lastLevelStartedAt = Date.now()
   
               this.animationMetronome = setInterval(() => {
                  this.updateCountdown()
                  this.updateShapes()
                  this.applyShapesOnLights()
                  this.room.sendLightsInstructionsIfIdle()
               }, 1000)
            }
         } catch (error) {
            console.error('Error parsing WebSocket message:', error)
         }
      }
   
      // Remove previous instance of Basketball's listener before adding a new one
      this.room.socket.off('monitor', handleMonitorMessage)
      this.room.socket.onClientMessage('monitor', handleMonitorMessage)
    }

    stop() {
      if (this.running) {
         this.running = false
         if (this.showColor) {
            clearInterval(this.showColor)
            this.showColor = undefined
         }
         this.reset()
         console.log('Game has been stopped')
         this.room.socket.broadcastMessage('monitor', {
            type: 'roomDisabled',
            message: 'Room has been disabled.'
         })
      }
    }

    showColorSequence(colorsSequence) {
      this.showColor = setInterval(() => {
         const currentColor = colorsSequence[this.currentColorIndex]
         console.log('Showing color:', currentColor.name)
         
         this.room.socket.broadcastMessage('monitor', {
            type: 'colorNames',
            'cache-audio-file-and-play': currentColor.name
         })

         this.room.lightGroups.wallButtons.forEach((light) => {
            light.color = colorsSequence[this.currentColorIndex].rgb
         })

         this.currentColorIndex++

         if (this.currentColorIndex >= colorsSequence.length) {
            setTimeout(() => {
               clearInterval(this.showColor)

               const shuffledColors = this.shuffleArray([...this.colors])
               this.room.lightGroups.wallButtons.forEach((light, i) => {
                  light.color = shuffledColors[i].rgb
               })

               this.room.socket.broadcastMessage('monitor', {
                  type: 'colorNamesEnd'
               })
            }, 1000)
         }
      }, 1000)

      this.room.lightGroups.wallButtons.forEach((light, i) => {
         light.onClick = 'report'
         this.lightColorSequence[i] = colorsSequence[i % colorsSequence.length]
     }) 

     this.lightColorSequence.length = colorsSequence.length
    }

    makeColorSequence(size, colors) {
      return Array.from({ length: size }, () => colors[this.getRandomInt(0, colors.length - 1)])
    }

    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
         let j = this.getRandomInt(0, i)
         let temp = array[i] // Store current value
         array[i] = array[j] // Swap values
         array[j] = temp // Assign stored value to new position
      }
      return array
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    handleGameSpecificLightAction(clickedLight, whileColorWas) {
      const ruleHandlers = {
          1: () => {
              if (this.room.lightGroups.wallButtons.includes(clickedLight)) {
                  this.handleWallButtonClick(clickedLight)
              }
          }
      }

      if (!ruleHandlers[this.rule]) {
          console.warn(`No handlers for this rule ${this.rule}`)
          return
      }

      ruleHandlers[this.rule]()
    }

    handleWallButtonClick(clickedLight) {
      console.log(clickedLight.color)
      console.log(this.lightColorSequence[0].rgb)
      if (clickedLight.color === this.lightColorSequence[0].rgb) {
          this.handleCorrectButtonClick()
      } else {
          this.handleIncorrectButtonClick()
      }
    }

    handleCorrectButtonClick() {
      this.lightColorSequence.splice(0, 1)
      this.broadcastSuccess()
      
      if (this.lightColorSequence.length === 0) {
          this.startSameLevel()
      }
    }

    handleIncorrectButtonClick() {
         this.removeLife()
         this.broadcastFailure()
    }

    broadcastFailure() {
        const message = {
            type: 'playerFailed',
        }
        this.room.socket.broadcastMessage('monitor', message)
    }

    broadcastSuccess() {
        const message = {
            type: 'playerSuccess',
            'cache-audio-file-and-play': 'playerScored'
        }
        this.room.socket.broadcastMessage('monitor', message)
    }

    endGame() {
        const message = {
            type: 'levelCompleted',
            'cache-audio-file-and-play': 'levelCompleted'
        }

        this.room.socket.broadcastMessage('monitor', message)

        this.endAndExit()
    }
}