import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAME_STATES_PATH = path.join(__dirname, '../assets/db/game_states.json')

let roomInstance = null

const startGameSessionController = {
    setRoomInstance: (instance) => {
        roomInstance = instance
    },

    startGame: async (req, res) => {
        const { team, players, room, book_room_until, is_collaborative } = req.body

        if (!room || !players) {
            return res.status(400).json({ error: 'Missing data'})
        }

        const [roomType, rule, level] = room.split(',')

        if (!roomType || !rule || !level || !players.length) {
            return res.status(400).json({ error: 'Invalid room format or missing players' })
        }

        // Check if a game session is already running
        if (roomInstance.currentGameSession && roomInstance.currentGameSession.status === 'running') {
            return res.status(403).json({ error: 'gameroom-busy' })
        }

        // Start the session
        await roomInstance.startGame(roomType, rule, level, players, team, book_room_until, is_collaborative)

        res.json({ message: `Game started in ${roomType} with rule: ${rule}, level: ${level}` })
    }
}

export default startGameSessionController