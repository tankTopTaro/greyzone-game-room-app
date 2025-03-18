import express from 'express'
import gamesListController from '../controllers/gamesListController.js'

const router = express.Router()

router.get('/', gamesListController.getGames)

export default router