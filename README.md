# 🌟 Spotlite — Modern Social Media Platform

Spotlite is a full-stack social media application inspired by Instagram, built using the **MERN** stack (MongoDB, Express.js, Node.js, HTML5/CSS3/JavaScript). It features real-time interactions, post photo filters, category explore feeds, stories, messaging, interactive notification overlays, AI caption generation, and analytics dashboards.

---

## ✨ Key Features

- **🔐 User Authentication**: JWT authentication, hashed passwords with `bcryptjs`, protected API routes, and session persistence.
- **📸 Post Creation & Photo Filters**: Upload images or load via URL, apply live photo filter presets (`Original`, `Warm Glow`, `Vivid`, `Vintage`, `Noir B&W`, `Cyberpunk`), tag location, select mandatory post mood, and assign category filters.
- **🏷️ Category & Mood Explore Feeds**: Filter posts across 15 categories (`Funny`, `Anime`, `Movies`, `National News`, `Study`, `Travel`, `Food`, `Fitness`, `Tech & Code`, `Gaming`, `Music`, `Art`, `Happy`, `General`, `Other`).
- **📖 Dynamic Stories**: User story avatar rings with animated rainbow gradients and full-screen story viewer overlay with countdown progress bar.
- **💬 Direct Messaging & Chat**: Real-time message exchange with active conversation list, shared post cards in chat, and typing notifications.
- **🔔 Interactive Notifications**: Notification bell overlay tracking followers, likes, comments, and mentions.
- **❤️ Reactions & Bookmarks**: Double-tap image to like with pop heart animation, quick comment emoji pills, bookmarking, and post link sharing.
- **🤖 AI Caption & Hashtag Generator**: Automatic caption suggestions and auto-category matching based on post mood.
- **📊 User Portfolio Analytics**: Real-time engagement rates, total likes, total comments, top performing post metrics, and verification badges.
- **⚡ Keyboard Shortcuts**: `Ctrl + K` (or `Cmd + K`) for instant quick search slider, and `Escape` to close all modals.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System, Glassmorphism, Micro-animations), JavaScript ES6+
- **Backend**: Node.js, Express.js RESTful API, Express Rate Limiting
- **Database**: MongoDB with Mongoose ORM
- **Authentication**: JSON Web Tokens (JWT) & Bcrypt Encryption
- **Audio Engine**: Web Audio API Synthesizer for UI sound effects

---

## 📁 Project Structure

```txt
GV.js/
├── public/                 # Client Frontend Assets & Pages
│   ├── index.html          # Main Feed & Explore Page
│   ├── profile.html        # Profile & User Grid Page
│   ├── messages.html       # Direct Chat & Messaging Page
│   ├── login.html          # Authentication Login Page
│   ├── signup.html         # User Registration Page
│   ├── style.css           # Core Design System & CSS Utility Tokens
│   └── app.js              # Client Application Logic & API Layer
├── server.js               # Express Server & MongoDB API Routes
├── .env                    # Environment Configuration File
├── package.json            # NPM Dependencies & Scripts
└── README.md               # Production Documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas cluster)

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/PRUDHVI0143/Spotlite.git
   cd Spotlite
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   JWT_SECRET=super_secret_spotlite_key
   MONGODB_URI=mongodb://127.0.0.1:27017/spotlite_db
   ```

4. **Run Server**:
   ```bash
   npm run dev
   # or
   npm start
   ```

5. **Access the App**:
   Open `http://localhost:5000` in your web browser!

---

## 📡 Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token |
| `GET` | `/api/posts` | Fetch feed posts (supports `?category=...`) |
| `GET` | `/api/posts/explore` | Fetch explore feed ranked by engagement score |
| `POST` | `/api/posts` | Create a new post (Mandatory image & mood) |
| `POST` | `/api/posts/:id/like` | Toggle like on a post |
| `POST` | `/api/posts/:id/comment` | Add a comment to a post |
| `POST` | `/api/posts/:id/save` | Bookmark / Save a post |
| `GET` | `/api/notifications` | Fetch user notifications |
| `GET` | `/api/users/analytics` | Fetch portfolio analytics & engagement rate |

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
