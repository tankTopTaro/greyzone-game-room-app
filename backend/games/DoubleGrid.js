import Game from '../classes/Game.js'
import Shape from '../classes/Shape.js';
import { hsvToRgb } from '../utils/utils.js';

const blueGreen1 = hsvToRgb([130,220,255])
const black = hsvToRgb([0,0,0])

export default class DoubleGrid extends Game {
    constructor (players, rule, level, team, book_room_until, env, roomInstance) {
        super(players, rule, level, team, book_room_until, env, roomInstance, 60)
    }

    start() {
        super.start()

        console.log(`DoubleGrid is running!`)

        if (this.rule !== 1) return

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

    stop() {
        console.log('Game has been stopped')
    }

    makeNumberSequence(size) {
        const numbersSequence = Array.from({ length: size }, (_, i) => i + 1);
        this.shuffleArray(numbersSequence);
        return numbersSequence;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.getRandomInt(0, i)
            [array[i], array[j]] = [array[j], array[i]]
        }
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    handleGameSpecificLightAction(clickedLight, whileColorWas) {
        const ruleHandlers = {
            1: () => {
                if (this.room.lightGroups['mainFloor'].includes(clickedLight)) {
                    this.handleMainFloorClick(clickedLight, whileColorWas)
                } else if (this.room.lightGroups['wallButtons'].includes(clickedLight)) {
                    this.handleWallButtonClick(clickedLights)
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
        console.log('MAIN FLOOR CLICK')
        console.log('whileColorWas:', whileColorWas)

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

        console.log('Correct button clicked')
        this.broadcastSuccess()

        this.lightIdsSequence.shift()

        if (this.lightIdsSequence.length === 0) {
            this.level === 3 ? this.endGame() : setTimeout(() => this.levelCompleted(), 50)
        }
    }

    handleIncorrectButtonClick() {
        this.removeLife()
        this.broadcastFailure()
    }

    createShape(clickedLight) {
        console.log('Create shape')
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
            type: 'playerFailed'
        }

        this.room.socket.broadcastMessage('monitor', message)
    }

    broadcastSuccess() {
        const message = {
            type: 'playerSuccess'
        }

        this.room.socket.broadcastMessage('monitor', message)
    }

    endGame() {
        const message = {
            type: 'levelCompleted'
        }

        this.room.socket.broadcastMessage('monitor', message)

        setTimeout(() => this.end(), 50)
        this.room.isFree = true
    }
}