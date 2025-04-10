# Greyzone Game Room App

## Table of Contents
- [Mission](#mission)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Bugs and Issues](#bugs-and-issues)
- [Important Features](#important-features)

---
## Mission
This is an optimized and more scalable version of the Game Room App. We have streamlined the system by removing unnecessary components, leaving only the core features: monitor and room screens. Games are now modular, audios are fetched only on demand, and the ReportLightClickAction now utilizes WebSockets for more efficient communication.


---

## Technologies Used

The following technologies and frameworks are used in this application:

![HTML](https://img.shields.io/badge/HTML-5-orange?style=flat-square&logo=html5&logoColor=white)  
![CSS](https://img.shields.io/badge/CSS-3-blue?style=flat-square&logo=css3&logoColor=white)  
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=flat-square&logo=javascript&logoColor=white)  
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?style=flat-square&logo=bootstrap&logoColor=white)  
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react&logoColor=white)  
![Node.js](https://img.shields.io/badge/Node.js-16-green?style=flat-square&logo=node.js&logoColor=white)

---

## Installation

To get started with the Greyzone Game Room App, follow these steps:

1. **Install Dependencies**  
   - Install the necessary dependencies for both the backend and frontend:
   ```bash 
   npm install
   ```

2. **Build the Frontend**  
   - Build the frontend for production:
   ```bash 
   npm run build
   ```

3. **Start the Backend**  
   - Start the backend server:
   ```bash 
   npm start
   ```

---
## Bugs and Issues
1. Light animations in monitor screen might lag, I don't know if the reason is because of limited hardware specs of the Raspberry Pi or my network connection. The animations are working fine if you are using a powerful machine like a desktop or laptop. For now I've added a throttle to the `sendLightsInstructions()` method that limits the amount of updates that is sent to the frontend.

---
## Important Features
Here are some of the key features of the **Greyzone Game Room App:**

1. **GameManager**
   - Responsible for loading the game files.

2. **Room WebSocket Listener**
   - The `Room` component contains the `setupWebSocketListener()` method, which listens for light click events from the frontend. This ensures seamless real-time interaction between the app and the user.

3. **Light and Shape Configurations**
   - Light configurations are stored in the `light-config.json` file, while shape configurations are managed in the `shape-config.json` file.

4. **Room-Specific Configuration**
   - The `game-config.json` file stores unique data for each room. This file must be manually configured with the following parameters:
   ```json
   {
      "roomType": "doubleGrid",
      "hostname": "gra-1.local",
      "gameRules": [1],
      "gameLevels": [1, 2, 3],
      "prepareLights": "/lights-config.json",
      "prepareShapes": "/shapes-config.json"
   }
   ```
   - The configuration file allows you to specify:
      - `roomType`: Defines the type of room (e.g., `"doubleGrid"`).
      - `hostname`: The hostname of the machine running the server.
      - `gameRules`: A list of available game rules.
      - `gameLevels`: A list of available game levels.
      - `prepareLights` and `prepareShapes`: Optional paths to light and shape configuration files based on the type of game.

5. **Game Modules**
   - Game modules must be placed inside the `games` directory. These modules are automatically detected by the system and can be loaded dynamically.

6. **Uncaught Exceptions**
   - Uncaught exceptions are now forwarded to the `Game Facility App`