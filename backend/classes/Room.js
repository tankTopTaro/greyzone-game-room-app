import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import os from 'os'

import Socket from '../classes/Socket.js'
import GameManager from './GameManager.js'
import Light from './Light.js'

import startGameSessionRoute from '../routes/startGameSession.js'
import gamesListRoute from '../routes/gamesList.js'
import toggleRoomRoute from '../routes/toggleRoom.js'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_PATH = path.join(__dirname, '../config/game-config.json')

dotenv.config()

export default class Room {
    constructor() {
        this.socket = new Socket(8081)
        this.gameManager = new GameManager()
        this.currentGame = null // Track current game

        this.enabled = true // Enabling/Disabling the Room
        this.isFree = true  
        this.currentGameSession = undefined
        this.waitingGameSession = undefined

        this.width
        this.height

        this.lights = []
        this.lightCounter = 0
        this.lightGroups = {}

        this.sendLightsInstructionsIsBusy = false
        this.sendLightsInstructionsRequestPending = false

        this.created_at = Date.now()

        this.config = {}
        this.type = 'MonkeyRun'

        this.init()
    }

    async init() {
        try {
            // Load game config
            const configData = await fs.promises.readFile(CONFIG_PATH, 'utf8')
            this.config = JSON.parse(configData)
            this.type = this.config.roomType || 'MonkeyRun'
            console.log(`Room initialized with type: ${this.type}`)
        } catch (error) {
            console.error(`Error loading config: ${error.message}`)
            this.config = {}
            this.type = 'MonkeyRun'
        }

        await this.prepareLights()
        await this.measure()
        this.startServer()

        this.setupWebSocketListeners()
    }

    setupWebSocketListeners() {
        this.socket.onClientMessage('monitor', (message) => {
            try {
                const data = JSON.parse(message)
                //console.log('Received message from monitor:', data)

                if (data.type === 'lightClickAction') {
                    //console.log(`Light ID: ${data.lightId} | WhileColorWas: ${data.whileColorWas}`)
                    this.currentGameSession.handleLightClickAction(parseInt(data.lightId, 10), data.whileColorWas)
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error)
            }
        })
    }

    async prepareLights() {
        try {
            if (!this.config.prepareLights) {
                console.warn("Missing 'prepareLights' path in game-config.json")
            }

            // Load the lights config file
            const LIGHTS_CONFIG_PATH = path.join(__dirname, '../config', path.basename(this.config.prepareLights))
            const lightsData = await fs.promises.readFile(LIGHTS_CONFIG_PATH, 'utf8')
            const configurations = JSON.parse(lightsData)
        
            // Get the corresponding configuration for the given type
            const matrices = configurations[this.type] || [];

            if (matrices.length === 0) {
                console.warn(`No light configurations for this room: ${this.type}`)
            }
        
            // Apply the configurations
            matrices.forEach(({ x, y, shape, type, w, h, cols, rows, spacingX, spacingY, label, active }) => {
                this.addMatrix(x, y, shape, type, w, h, cols, rows, spacingX, spacingY, label, active);
            });

            console.log(`Loaded ${matrices.length} light configurations for type: ${this.type}`);
        } catch (error) {
            console.error(`Error loading lights config: ${error.message}`)
        }
    }    

    addMatrix(matrixPosX,matrixPosY,elementsShape,elementsType,matrixWidth,matrixHeight,tileWidth,tileHeight,marginX,marginY,lightGroup,isAffectedByAnimation){
        let numberOfTilesX = Math.floor(matrixWidth / (tileWidth+marginX))
        let numberOfTilesY = Math.floor(matrixHeight / (tileHeight+marginY))
        for (let i = 0; i < numberOfTilesX; i++) {
            for (let j = 0; j < numberOfTilesY; j++) {

                let light = new Light(this.lightCounter,matrixPosX+(i*(tileWidth+marginX)),matrixPosY+(j*(tileHeight+marginY)), elementsShape, elementsType, tileWidth, tileHeight,isAffectedByAnimation)
                if (!(lightGroup in this.lightGroups)){
                    this.lightGroups[lightGroup] = []
                }
                this.lightGroups[lightGroup].push(light)
                this.lights.push(light)
                this.lightCounter++

            }
        }
    }

    measure(){
        let minX,maxX,minY,maxY = undefined
        this.lights.forEach((light) => {
            if(minX === undefined || light.posX < minX){minX = light.posX}
            if(maxX === undefined || (light.posX+light.width) > maxX){maxX = (light.posX+light.width)}
            if(minY === undefined || light.posY < minY){minY = light.posY}
            if(maxY === undefined || (light.posY+light.height) > maxY){maxY = (light.posY+light.height)}
        })
        this.padding = {'left':minX,'top':minY}
        this.width = maxX + minX
        this.height = maxY + minY
    }

    startServer() {
        // Prepare server
        this.server = express()
        const serverPort = 3002
        const serverHostname = process.env.HOSTNAME || '0.0.0.0'

        // Middleware to set no-cache headers for all routes
        this.server.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Surrogate-Control', 'no-store')
            next()
        })

        this.server.use(express.json())
        this.server.use(cors())
        this.server.use(express.static(path.join(__dirname, '../../frontend/dist')))

        // API routes
        this.server.use((req, res, next) => {
            // Allow the /api/toggle-room to work
            if (!this.enabled && req.path.startsWith('/api/') && req.path !== '/api/toggle-room' && req.path !== '/api/health' && req.path !== '/api/room-status') {
                //console.log('Room enabled: ', this.enabled)
                return res.status(503).json({ error: 'Room is currently disabled' })
            }
            next()
        })
        this.server.use('/api/start-game-session', startGameSessionRoute)
        this.server.use('/api/games-list', gamesListRoute)
        this.server.use('/api/toggle-room', toggleRoomRoute)
        this.server.use('/api/room-status', (req, res) => { res.json({enabled: this.enabled})})
        this.server.get('/api/health', (req, res) => { res.json({status: 'ok', hostname: process.env.HOSTNAME}) }); 

        // Frontend routes
        this.server.get('/game/request', async (req, res) => {

        })
        this.server.get('/get/roomData', (req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.json({
                room:{ width: this.width, height: this.height },
                lights: this.lights
            })
        })
        this.server.get('*', (req, res) => {
            const filePath = path.join(__dirname, '../../frontend/dist/index.html')
            res.sendFile(filePath)
        })

        // Start server
        this.server.listen(serverPort, serverHostname, () => {
            console.log(`Server running at http://${serverHostname}:${serverPort}/`)
            console.log(`Monitor running at http://${serverHostname}:${serverPort}/monitor`)
            console.log(`Room Screen running at http://${serverHostname}:${serverPort}/room-screen`)
        })
    }

    sendLightsInstructionsIfIdle(){
        if(this.sendLightsInstructionsIsBusy){
            if(this.sendLightsInstructionsRequestIsPending){
                console.log('WARNING : Animation frame LOST ! (received sendLightsInstructionsIfIdle while sendLightsInstructionsRequestIsPending Already)')
                return false
            }
            this.sendLightsInstructionsRequestIsPending = true
            console.log('WARNING : Animation frame delayed (received sendLightsInstructionsIfIdle while sendLightsInstructionsIsBusy)')
            return false
        }
        this.sendLightsInstructionsIsBusy = true

        this.sendLightsInstructions()

        this.sendLightsInstructionsIsBusy = false
        if(this.sendLightsInstructionsRequestIsPending){
            this.sendLightsInstructionsRequestIsPending = false
            this.sendLightsInstructionsIfIdle()
            console.log('WARNING : doing another sendLightsInstructionsIfIdle in a row')
            return true
        }
        return true
    }

    sendLightsInstructions(){
        this.lights.forEach((light) => {
            light.newInstructionString = JSON.stringify(light.color)
            if(light.lastHardwareInstructionString !== light.newInstructionString){
                this.sendHardwareInstruction(light)
            }
            if(light.lastSocketInstructionString !== light.newInstructionString){
                this.sendSocketInstructionForMonitor(light)
            }

        })
    }

    async sendHardwareInstruction(light){
        let newInstructionString = light.newInstructionString
        let response = await this.sendToHardware(light.hardwareAddress,light.color)
        if(response === true){
            light.lastHardwareInstructionString = newInstructionString
        }else{
            console.log('WARNING : sendToHardware FAILS ! for following light:')
            console.log(light)
        }
    }

    async sendSocketInstructionForMonitor(light){

        let newInstructionString = light.newInstructionString
        //console.log('TEST Changing light id:',light.id,' to: ', newInstructionString)
        let response = await this.sendToSocketForMonitor(light)
        if(response === true){
            light.lastSocketInstructionString = newInstructionString
        }else{
            console.log('WARNING : sendToSocketForMonitor FAILS ! for following light:')
            console.log(light)
        }
    }

    async sendToHardware(){
        // TODO
        return true
    }

    async sendToSocketForMonitor(light){
        let message = {'type':'updateLight','lightId':light.id,'color':light.color,'onClick':light.onClick}
        this.socket.broadcastMessage('monitor', JSON.stringify(message))
        return true
    }

    async startGame(roomType, rule, level, players, team, book_room_until) {
        const game = await this.gameManager.loadGame(roomType, rule, level, players, team, book_room_until, this)

        if (game) {
            this.currentGameSession = game
            game.start()
        }
    }

    async notifyFacility() {
        const gra_id = os.hostname()
        const apiURL = `http://localhost:3001/api/game-room/${gra_id}/available`

        try {
            const response = await axios.post(apiURL, {status: 'available'})
            if (response.status === 200) {
                console.log('Facility notified:', response.data)
            }
        } catch (error) {
            console.error('Error notifying facility:', error)
        }
    }

}
