# 🎬 Shotnest

> A modern filmmaking shot planner built for structured, efficient pre-production workflows.

---

## 📖 Overview

**Shotnest** is a web-based shot planning tool designed for filmmakers, directors, and cinematographers who need a clean, organized way to plan their shots before stepping on set. It eliminates the chaos of spreadsheets and handwritten notes by providing a dedicated, structured environment for pre-production planning.

Whether you're shooting a short film, a commercial, or a full-length feature, Shotnest helps you organize every shot — from camera angles to scene descriptions — so your production day runs smoothly.

---

## ✨ Features

- 🎥 **Shot List Management** — Create, edit, and delete shots with detailed metadata
- 📋 **Scene Organization** — Group shots by scene for a clear production structure
- 💾 **Persistent Storage** — All data stored locally via SQLite — no cloud dependency
- 🖥️ **Clean UI** — Minimal, distraction-free interface focused on productivity
- ⚡ **Fast & Lightweight** — Runs entirely on a local Node.js server with no heavy frameworks

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite (`shotnest.db`) |
| Runtime | Node.js |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (comes with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/RehanAslam2004/Shotnest.git

# 2. Navigate into the project directory
cd Shotnest

# 3. Install dependencies
npm install

# 4. Start the server
node server.js
```

### Running the App

Once the server is running, open your browser and go to:

```
http://localhost:3000
```

> The port may vary depending on your `server.js` configuration.

---

## 📁 Project Structure

```
Shotnest/
├── data/               # Application data files
├── public/             # Static frontend assets (HTML, CSS, JS)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server.js           # Express server & API routes
├── shotnest.db         # SQLite database file
├── package.json        # Project metadata & dependencies
└── .gitignore
```

## 🌐 Live Demo

👉 [https://shotnest.onrender.com](https://shotnest.onrender.com)

---

## 📄 License

**All Rights Reserved © Muhammad Rehan**

This project and its source code are proprietary. No part of this codebase may be copied, modified, distributed, or used — commercially or otherwise — without explicit written permission from the author.

---

## 👤 Author

**Muhammad Rehan**
- GitHub: [@RehanAslam2004](https://github.com/RehanAslam2004)

