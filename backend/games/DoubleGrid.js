import Game from '../classes/Game.js'
import Shape from '../classes/Shape.js'
import { hsvToRgb } from '../utils/utils.js'

const blueGreen1 = hsvToRgb([130,220,255])
const black = hsvToRgb([0,0,0])

export default class DoubleGrid extends Game {
    constructor (players, rule, level, team, book_room_until, env, roomInstance, timeForLevel = 60, timeToPrepare) {
        super(players, rule, level, team, book_room_until, env, roomInstance, timeForLevel, timeToPrepare)
        this.running = false
      }

    start() {
      const ruleHandlers = {
         1: () => {
            this.lightIdsSequence = []

            const numbersSequence = this.makeNumberSequence(12)
      
            console.log('TEST: numbersSequence: ', numbersSequence)
      
            this.room.lightGroups.wallScreens.forEach((light, i) => {
               light.color = [0, 0, numbersSequence[i]]
            })
      
            this.room.lightGroups.wallButtons.forEach((light, i) => {
               light.color = blueGreen1
               light.onClick = 'report'
               this.lightIdsSequence[numbersSequence[i]] = light.id
            })
      
            this.lightIdsSequence.splice(0, 1)
         }
      }

      this.running = true

      super.start()

      console.log(`DoubleGrid is running!`)

      if(!ruleHandlers[this.rule]) {
         console.warn(`No handlers for this rule ${this.rule}`)
      }

      ruleHandlers[this.rule]()
    }

    setupGame() {
      this.lastLevelStartedAt = Date.now()

      if (this.animationMetronome) {
         clearInterval(this.animationMetronome)
     }
      
      this.animationMetronome = setInterval(() =>{
         this.updateShapes()
         this.updateCountdown()
         this.applyShapesOnLights()
         this.room.sendLightsInstructionsIfIdle()
     } , 1000/25)   
    }

    stop() {
      if (this.running) {
         this.running = false
         this.reset()
         console.log('Game has been stopped')
         const message = {
            type: 'roomDisabled',
            message: 'Room has been disabled.'
         }
         
         this.room.socket.broadcastMessage('monitor', message)
         this.room.socket.broadcastMessage('room-screen', message)
      }
    }

    makeNumberSequence(size) {
        const numbersSequence = Array.from({ length: size }, (_, i) => i + 1)
        this.shuffleArray(numbersSequence)
        return numbersSequence
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = this.getRandomInt(0, i)
            let temp = array[i] // Store current value
            array[i] = array[j] // Swap values
            array[j] = temp // Assign stored value to new position
        }
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    handleGameSpecificLightAction(clickedLight, whileColorWas) {
      if (this.isWaitingForChoiceButton) return

      const ruleHandlers = {
         1: () => {
               if (this.room.lightGroups['mainFloor'].includes(clickedLight)) {
                  this.handleMainFloorClick(clickedLight, whileColorWas)
               } else if (this.room.lightGroups['wallButtons'].includes(clickedLight)) {
                  this.handleWallButtonClick(clickedLight)
               }
         },
      }

      if(!ruleHandlers[this.rule]) {
         console.warn(`No handlers for this rule ${this.rule}`)
      }

      //console.log(`TEST from DoubleGrid: lightId: ${clickedLight}, whileColorWas: ${whileColorWas}`)
      ruleHandlers[this.rule]()
    }

    handleMainFloorClick(clickedLight, whileColorWas) {
        if (Array.isArray(whileColorWas)) whileColorWas = whileColorWas.join(',')

        if (whileColorWas !== '255,0,0') return
        
        this.removeLife()
        this.createShape(clickedLight)
        this.broadcastFailure()
    }

    handleWallButtonClick(clickedLight) {
        if (clickedLight.id === this.lightIdsSequence[0]) {
            this.handleCorrectButtonClick(clickedLight)
        } else {
            this.handleIncorrectButtonClick()
        }
    }

    handleCorrectButtonClick(clickedLight) {
        clickedLight.color = black
        clickedLight.onClick = 'ignore'

        //console.log('Correct button clicked')
        this.broadcastSuccess()

        this.lightIdsSequence.shift()

        if (this.lightIdsSequence.length === 0) {
            this.levelCompleted()
        }
    }

    handleIncorrectButtonClick() {
        this.removeLife()
        this.broadcastFailure()
    }

    createShape(clickedLight) {
        this.shapes.push(new Shape(
            clickedLight.posX + clickedLight.width / 2,
            clickedLight.posY + clickedLight.height / 2,
            'rectangle',
            clickedLight.width / 2,
            clickedLight.height / 2,
            [255, 100, 0],
            'ignore',
            [{ x: 0, y: 0 }],
            0,
            'mainFloor',
            2000
        ))
    }

    broadcastFailure() {
        const message = {
            type: 'playerFailed',
        }
        this.room.socket.broadcastMessage('monitor', message)
        this.room.socket.broadcastMessage('room-screen', message)
    }

    broadcastSuccess() {
        const message = {
            type: 'playerSuccess',
            'cache-audio-file-and-play': 'playerScored'
        }
        this.room.socket.broadcastMessage('monitor', message)
        this.room.socket.broadcastMessage('room-screen', message)
    }

    endGame() {
        const message = {
            type: 'levelCompleted',
            'cache-audio-file-and-play': 'levelCompleted'
        }

        this.room.socket.broadcastMessage('monitor', message)
        this.room.socket.broadcastMessage('room-screen', message)

        this.endAndExit()
    }
}