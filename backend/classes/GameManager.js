import path from 'path'
import { fileURLToPath } from 'url'
import getAvailableGames from '../utils/getAvailableGames.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAMES_DIR = path.join(__dirname, '../games')
export default class GameManager {
    constructor(env) {
        this.env = env
    }

    async loadGame(roomType, rule, level, players, team, book_room_until, roomInstance) {
        try {
            // get all available game files
            const availableGames = getAvailableGames()

            // find a case-insensitive match for roomType
            const matchedGame = availableGames.find(game => game.toLowerCase() === roomType.toLowerCase())

            if (!matchedGame) throw new Error(`Game ${roomType} not found.`)

            const gamePath = path.join(GAMES_DIR, `${matchedGame}.js`)

            console.log(`Loading game: ${gamePath}`)

            const { default: GameClass } = await import(`file://${gamePath}`)

            const gameInstance = new GameClass(rule, level, players, team, book_room_until, this.env, roomInstance)

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