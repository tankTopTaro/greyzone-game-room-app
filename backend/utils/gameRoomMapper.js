import fs from 'fs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import getAvailableGames from './getAvailableGames'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const GAME_ROOM_MAP = path.join(__dirname, '../configs/game-room-map.json')
const HOSTNAME = process.env.HOSTNAME

export default function gameRoomMapper () {
    let mapping = {}

    if (fs.existsSync(GAME_ROOM_MAP)) {
        mapping = JSON.parse(fs.readFileSync(GAME_ROOM_MAP, 'utf8'))
    }

    if (mapping[HOSTNAME]) {
        console.log(`Hostname "${HOSTNAME}" is already mapped to game: ${mapping[HOSTNAME]}`)
        return
    }

    const availableGames = getAvailableGames()

    const unmappedGame = availableGames.find(game => !Object.values(mapping).includes(game))

    if (!unmappedGame) {
        console.log('No available games to assign.')
        return
    }

    mapping[HOSTNAME] = unmappedGame
    
    fs.writeFileSync(GAME_ROOM_MAP, JSON.stringify(mapping, null, 2))
    console.log(`Mapped "${HOSTNAME}" to game: ${unmappedGame}`)
}