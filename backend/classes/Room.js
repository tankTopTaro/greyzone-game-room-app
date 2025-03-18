import express, { response } from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import os from 'os'

import Socket from '../classes/Socket.js'
import GameManager from './GameManager.js'

import startGameSessionRoute from '../routes/startGameSession.js'
import gamesListRoute from '../routes/gamesList.js'
import toggleRoomRoute from '../routes/toggleRoom.js'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

export default class Room {
    constructor() {
        this.socket = new Socket(8082)
        this.enabled = true
        this.gameManager = new GameManager({ difficulty: 'medium' })
        this.currentGame = null // Track current game
        this.init()
    }

    init() {
        this.startServer()
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

    async startGame(roomType, rule, level, players, team, book_room_until) {
        const game = await this.gameManager.loadGame(roomType, rule, level, players, team, book_room_until, this)

        if (game) game.start()
    }

    async notifyFacility() {
        const gra_id = os.hostname()
        const apiURL = `http://localhost:3001/api/game-room/${gra_id}/available`

        try {
            const response = await axios.post(api, {status: 'available'})
            if (response.status === 200) {
                console.log('Facility notified:', response.data)
            }
        } catch (error) {
            console.error('Error notifying facility:', error)
        }
    }
}
