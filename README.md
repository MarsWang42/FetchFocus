# 🐕 FetchFocus

> A gentle companion that helps you stay focused on what matters

<p align="center">
  <img src="public/running_puppy.png" alt="FetchFocus Mascot" width="120" />
</p>

FetchFocus is a browser extension that acts like a friendly pup 🐕 helping you stay on task. It uses gentle, playful nudges to bring your attention back when you drift away from your focus—whether that's doomscrolling, rapid tab-switching, or wandering into distracting sites.

## ✨ Features

### 🎯 Focus Sessions
- Start focus sessions with a description and optional keywords
- Optionally attach a specific tab as your "focus tab"
- Track focus duration in real-time
- Complete or end sessions with a single click

### 🐾 Friendly Nudges
FetchFocus detects when you're getting distracted and sends gentle, pup-themed nudges:

| Behavior | Detection | Example Nudge |
|----------|-----------|---------------|
| **Doomscrolling** | Detects extended scrolling on social media/feeds | *"I'm confused. I thought we were working on something else? Let's go back."* 🐕 |
| **Rapid Tab Switching** | 10+ unique tabs in 1 minute | *"Browser Zoomies? ⚡ You're running all over the place! Sit. Stay. Focus on one tab."* |
| **Stagnant Off-Topic Tab** | Lingering on unrelated pages | *"Barking up the wrong tree? 🌳 This page looks interesting, but it doesn't look like our project."* |
| **Away from Focus Tab** | 10+ minutes away from your work | *"Miss me? 🐕 It's been a while! Your focus tab is getting lonely over there."* |

### 🤖 Local AI Content Analysis
- Uses **Chrome's built-in Gemini Nano** for on-device AI
- Summarizes your focus tab content for smart drift detection
- Compares current browsing against your focus context
- **100% local processing** — your data never leaves your device

### ⚫ Blacklist & Whitelist
- **Blacklist**: Block distracting sites with a friendly warning overlay
- **Whitelist**: Mark work-related sites to never trigger drift nudges
- Supports wildcard patterns (e.g., `*.reddit.com`)

### ✅ Todo List & Calendar
- Simple todo list integrated with focus sessions
- Starting a focus session can auto-create a todo
- Track completed tasks on a calendar view
- See daily completion counts

### 🌐 Internationalization
- Full support for **English** and **Chinese (Simplified)**
- All nudge messages, UI text, and button labels are localized

## 🚀 Getting Started

### Prerequisites
- **Chrome** or Chromium-based browser (version 125+ for AI features)
- **Bun** package manager (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fetch-focus.git
cd fetch-focus

# Install dependencies
bun install

# Build the extension
bun run build
```

### Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder from the project

### Enable AI Features (Optional)
To use the AI-powered content analysis, enable these Chrome flags:
1. `chrome://flags/#prompt-api-for-gemini-nano`
2. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
3. `chrome://flags/#summarization-api-for-gemini-nano`

Then relaunch Chrome for changes to take effect.

## 📁 Project Structure

```
fetch-focus/
├── assets/              # Global CSS
├── components/          # React components
│   ├── ui/              # Base UI components (Button, Card, etc.)
│   ├── NudgeOverlay.tsx # Focus nudge overlay
│   ├── CalendarView.tsx # Task calendar
│   └── BlacklistWarningOverlay.ts
├── entrypoints/         # Extension entry points
│   ├── background.ts    # Service worker
│   ├── content.ts       # Content script
│   ├── popup/           # Popup UI
│   └── configs/         # Settings page
├── lib/                 # Core logic
│   ├── storage.ts       # Chrome storage helpers
│   ├── aiService.ts     # AI integration
│   ├── messageHandlers.ts
│   └── types.ts
├── public/
│   ├── _locales/        # i18n translations
│   └── icon/            # Extension icons
└── wxt.config.ts        # WXT configuration
```

## 🛠️ Tech Stack

- **[WXT](https://wxt.dev/)** — Next-gen browser extension framework
- **[React 19](https://react.dev/)** — UI library
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety
- **[Tailwind CSS 4](https://tailwindcss.com/)** — Styling
- **[Framer Motion](https://www.framer.com/motion/)** — Animations
- **[Vitest](https://vitest.dev/)** — Testing framework
- **Chrome Built-in AI** — Local Gemini Nano for content analysis

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development with hot reload |
| `bun run dev:firefox` | Development for Firefox |
| `bun run build` | Production build for Chrome |
| `bun run build:firefox` | Production build for Firefox |
| `bun run zip` | Create distributable zip |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run typecheck` | TypeScript type checking |

## 🔒 Privacy

FetchFocus is designed with privacy in mind:

- **All AI processing is local** — Uses Chrome's on-device Gemini Nano
- **No external servers** — Your browsing data never leaves your computer
- **Minimal permissions** — Only requests what's necessary (storage, tabs, scripting)

## 📄 License

This project is private. All rights reserved.

---

<p align="center">
  <i>"Your gentle focus companion 🐕"</i>
</p>
