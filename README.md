# GymBuddy

GymBuddy is a web application that helps College of Staten Island students find gym partners based on their availability and workout preferences.

## Features

- User account creation and authentication
- Interactive calendar for scheduling gym sessions
- Universal calendar to view potential gym buddies' availability
- Matching system to find compatible workout partners
- Real-time messaging system
- Friend management functionality
- Profile customization with gym preferences

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or newer)
- [MongoDB](https://www.mongodb.com/try/download/community)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)
- Live Server extension for VS Code

## Installation

1. Download MongoDB and Node.js from browser

2. Git clone  ``` https://github.com/junyaokh822/GymBuddy.git ```

3. Download the Live Server extension on VS Code

4. After installing all files for the project, use "npm install" on C: Desktop/../GymBuddy

5. Inside .env file from gymbuddy-backend folder, change:
   ```
   EMAIL_USER=#with your email address#
   EMAIL_PASS=your_app_password
   ```
   Create your own app password following these instructions: [Generate an App Password for Gmail](https://support.google.com/mail/thread/205453566/how-to-generate-an-app-password)

## How to Start

1. Open a terminal and go to C: Desktop/../GymBuddy/gymbuddy-backend directory, inside the terminal type "node server.js" (it should then show MongoDB is connected successfully)

2. Right-click on index.html from the frontend and open with Live Server

## Project Structure

- `/`: Frontend files (HTML, CSS, JS)
- `/gymbuddy-backend/`: Backend server and API
  - `/models/`: MongoDB schema definitions
  - `/routes/`: API route handlers
  - `/middleware/`: Custom middleware functions
  - `/utils/`: Utility functions and helpers

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB
- Real-time Communication: Socket.IO
- Authentication: JWT (JSON Web Tokens)

## Usage

1. Create an account or log in if you already have one
2. Update your profile with your gym preferences
3. Use the calendar to schedule your gym sessions and mark them as shared
4. Find potential gym buddies with similar schedules
5. Connect with other users through the messaging system
6. Manage your friends list

## License

This project is licensed under the MIT License - see the LICENSE file for details.