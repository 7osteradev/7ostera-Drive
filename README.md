# 7ostera Drive 🚀

An open-source, self-hosted cloud file storage platform — like Google Drive, but yours.

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

## Features

- 🔐 **Authentication** — Register, login, logout with JWT + bcrypt
- 📁 **Folders** — Create folders, navigate with breadcrumbs
- ⬆️ **Upload** — Drag & drop or click, with progress bar (up to 500MB)
- ⬇️ **Download** — One-click file download
- 🔍 **Search** — Real-time file search
- 👁️ **Preview** — Images, videos, audio, PDFs, text/code in-browser
- 🔗 **Share Links** — Public share links, anyone can view/download with the link
- 🌓 **Dark Mode** — Persisted theme toggle
- 📊 **Storage Indicator** — See how much space you're using
- 🗑️ **Delete / Rename** — Right-click context menu on any file or folder

## Quick Start

### Requirements
- Node.js 18+
- npm

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

### 3. Start the server
```bash
npm start
```

### 4. Open in browser
```
http://localhost:3000
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcryptjs |
| File storage | Local filesystem |
| Frontend | Vanilla HTML/CSS/JS |
| Design | Vercel-inspired minimal UI |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | — | **Change this!** Secret for JWT signing |
| `ENCRYPTION_KEY` | — | **Change this!** Secret for file encryption |
| `MAX_FILE_SIZE_MB` | `500` | Max upload size in MB |

## Project Structure

```
7ostera-drive/
├── server/
│   ├── index.js          # Express entry point
│   ├── db.js             # SQLite setup
│   ├── middleware/auth.js # JWT middleware
│   └── routes/
│       ├── auth.js       # Auth API
│       └── files.js      # Files API
├── public/
│   ├── index.html        # Landing + login page
│   ├── dashboard.html    # Drive UI
│   ├── share.html        # Public share viewer
│   ├── css/main.css      # Design system
│   └── js/
│       ├── auth.js       # Auth page logic
│       └── drive.js      # Drive UI logic
```

## License

MIT © 7osteradev — Free to use, fork, and contribute.
