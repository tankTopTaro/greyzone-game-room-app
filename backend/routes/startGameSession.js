import express from 'express'
import startGameSessionController from '../controllers/startGameSessionController.js'

const router = express.Router()

router.post('/', startGameSessionController.startGame)

export default router