import roomInstance from "./utils/roomInstance.js"
import startGameSessionController from "./controllers/startGameSessionController.js"
import gamesListController from "./controllers/gamesListController.js"
import toggleRoomController from "./controllers/toggleRoomController.js"

gamesListController.setRoomInstance(roomInstance)
startGameSessionController.setRoomInstance(roomInstance)
toggleRoomController.setRoomInstance(roomInstance)