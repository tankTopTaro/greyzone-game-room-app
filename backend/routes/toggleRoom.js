import express from 'express'
import toggleRoomController from '../controllers/toggleRoomController.js'

const router = express.Router()

router.post('/', toggleRoomController.toggleRoom)

export default router