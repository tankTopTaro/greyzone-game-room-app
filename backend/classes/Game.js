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
    constructor(rule, level, players = [], team, book_room_until, env, roomInstance, timeForLevel = 60) {
        this.players = players
        this.rule = rule
        this.level = level
        this.team = team
        this.book_room_until = book_room_until
        this.env = env
        this.room = roomInstance
        this.timeForLevel = timeForLevel

        this.animationMetronome = undefined
        this.shapes = []
        this.status = undefined
        this.gameStartedAt = undefined
        this.lastLevelStartedAt = undefined
        this.levelsStartedWhileSessionIsWaiting = 0
        this.lastLevelCreatedAt = Date.now()
        this.createdAt = Date.now()
    }

    async init() {
        let result

        await this.prepareAndGreet()
            .then(() => {
                this.room.isFree = false
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
                // TODO: reportErrorToCentral(e);
            });

        return result
    }

    reset() {
        if (this.animationMetronome) {
            clearInterval(this.animationMetronome)
            this.animationMetronome = undefined
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
            console.log('Greeting sound starts...');
            setTimeout(() => {
                console.log('Greeting sound ends...');
                resolve(true);
            }, 2000);
        })
    }
    
    async prepare() {
        return new Promise((resolve, reject) => {
            console.log('preparation starts...')

            this.lastLifeLostAt = 0

            this.countdown = this.timeForLevel
            this.lifes = 5

            let message = {
                type: 'newLevelStarts',
                rule: this.rule,
                level: this.level,
                countdown: this.countdown,
                lifes: this.lifes,
                roomType: this.room.type
            }

            this.room.socket.broadcastMessage('monitor', message)

            setTimeout(async () => {
                try {
                    await this.prepareShapes()
                    console.log('preparation ends...')
                    this.status = 'prepared'
                    resolve(true)
                } catch (error) {
                    console.log('CATCH: prepareShapes() failed')
                    reject(e)
                }
            }, 1000)
        })
    }

    async prepareShapes() {
        try {
            const SHAPES_CONFIG_PATH = path.join(__dirname, '../config', path.basename(this.room.config.prepareShapes))

            const shapesData = await fs.promises.readFile(SHAPES_CONFIG_PATH, 'utf8')
            const configurations = JSON.parse(shapesData)

            const levelConfig = configurations[this.level]

            if (!levelConfig) {
                console.warn(`Invalid level: ${this.level}`)
            }

            // create shapes
            levelConfig.shapes.forEach((shape, index) => {
                let pathDotsToUse = levelConfig.pathDots

                switch(this.level) {
                    case "1":
                    case "2":
                        pathDotsToUse = index === 1 && levelConfig.extraPathDots.length > 0 ? levelConfig.extraPathDots : levelConfig.pathDots
                        break
                    case "3":
                        pathDotsToUse = index === 1 && levelConfig.safeDots.length > 0 ? levelConfig.safeDots : levelConfig.pathDots
                        break
                    default:
                        break;
                }

                this.shapes.push(new Shape(shape.x, shape.y, 'rectangle', shape.width, shape.height, shape.color, shape.action, pathDotsToUse, shape.speed, 'mainFloor'))
            })
            
            console.log(`Loaded shapes configurations for type: ${this.room.type}`);
        } catch (error) {
            console.error(`Error loading shapes config: ${error.message}`)
        }
    }

    handleLightClickAction(lightId, whileColorWas) {
        let clickedLight = this.GetLightById(lightId)
        console.log('TEST: clickedLight '+clickedLight+' whileColorWas: '+ whileColorWas)
    
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
                const shape = this.shapes[i];
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
                    break;
                }
            }

            if(lightHasColor === false && light.isAffectedByAnimation === true){
                light.color = [0,0,0]
                light.onClick = 'ignore'
            }
        })
    }

    levelCompleted() {
        clearInterval(this.animationMetronome)

        if(this.room.waitingGameSession === undefined) {

        } else if(this.levelsStartedWhileSessionIsWaiting < 3) {

        } else {
            this.end()
        }
    }

    levelFailed() {
        clearInterval(this.animationMetronome)

        if(this.room.waitingGameSession === undefined) {

        } else {
            this.end()
        }
    }

    offerSameLevel() {
        this.startSameLevel()
    }

    offerNextLevel() {
        this.startNextLevel()
    }

    async startSameLevel() {
        if(this.room.waitingGameSession !== undefined) {
            this.levelsStartedWhileSessionIsWaiting++
        }
        this.reset()
        await this.prepare()
        this.start()
    }

    async startNextLevel() {
        if(this.room.waitingGameSession !== undefined) {
            this.levelsStartedWhileSessionIsWaiting++
        }
        this.level++
        this.reset()
        await this.prepare()
        this.start()
    }

    updateCountdown() {
        if (this.status === undefined) return

        let timeLeft = Math.round((this.lastLevelStartedAt + (this.timeForLevel * 1000) - Date.now()) / 1000)

        if (timeLeft !== this.countdown) {
            if (timeLeft >= 0) {
                //console.log('COUNTDOWN:', this.countdown)
                this.countdown = timeLeft
            } else {
                console.log('TIME IS UP')
                this.end()
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
        if (this.lifes === 0) {
            console.log('NO MORE LIFES')
        }
    }

    start() {
        console.log('Starting the Game...')
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

        this.gameStartedAt = Date.now()
        this.status = 'running'
        console.log('Game Session started.')
    }

    async end() {
        this.reset()
        this.room.isFree = true
        console.log(`Ending game: ${this.constructor.name}`)
    }
}