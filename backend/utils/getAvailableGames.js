import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAME_DIR = path.join(__dirname, '../games')

export default function getAvailableGames () {
    return fs.readdirSync(GAME_DIR)
        .map(file => path.basename(file, '.js'))
}