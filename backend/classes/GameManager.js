import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default class GameManager {
    constructor(env) {
        this.env = env
    }

    async loadGame(roomType, rule, level, players, team, book_room_until, roomInstance) {
        try {
            const gamePath = path.join(__dirname, '../games', `${roomType}.js`)

            console.log(gamePath)

            if (!fs.existsSync(gamePath)) {
                throw new Error(`Game ${roomType} not found.`)
            }

            const { default: GameClass } = await import(`../games/${roomType}.js`)

            return new GameClass(rule, level, players, team, book_room_until, this.env, roomInstance)
        } catch (error) {
            console.error(error)
            return null
        }
    }
}