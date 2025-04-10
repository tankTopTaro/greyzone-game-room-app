import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import getAvailableGames from '../utils/getAvailableGames.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAMES_DIR = path.join(__dirname, '../games')
const DB_PATH = path.join(__dirname, '../assets/db/db.json')

export default class GameManager {
    constructor(env) {
        this.env = env
    }

    async loadGame(roomInstance, roomType, rule, level, players, team, book_room_until, is_collaborative, timeToPrepare) {
        try {
            console.log('BOOK_ROOM_UNTIL: ', book_room_until)
            console.log('DATE_NOW:', Date.now())
            
            // get all available game files
            const availableGames = getAvailableGames()

            // find a case-insensitive match for roomType
            const matchedGame = availableGames.find(game => game.toLowerCase() === roomType.toLowerCase())

            if (!matchedGame) throw new Error(`Game ${roomType} not found.`)

            const gamePath = path.join(GAMES_DIR, `${matchedGame}.js`)

            console.log(`Loading game: ${gamePath}`)

            const { default: GameClass } = await import(`file://${gamePath}`)

            const gameInstance = new GameClass(roomInstance, rule, level, players, team, book_room_until, is_collaborative, undefined, timeToPrepare)

            const result = await gameInstance.init()

            if (result !== true) {
                console.log('Game failed to initialize properly')
                return null
            }

            return gameInstance
        } catch (error) {
            console.error(error)
            return null
        }
    }
}