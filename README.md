# gram Sathi · सहकार साथी

**AI-Powered Multilingual Cooperative & Farmer Assistant**

> A hackathon prototype that provides instant AI-powered guidance on cooperative laws, PACS services, government schemes, crop insurance, and financial literacy — in any Indian language.

---

## Features

| Feature | Details |
|---------|---------|
| 🤖 **AI Chat** | Google Gemini 1.5 Flash powers every response |
| 🌐 **Multilingual** | 14+ Indian languages: Hindi, Punjabi, Bengali, Tamil, Telugu, Gujarati, Marathi, Kannada, Malayalam, Odia, Assamese, Urdu, Hinglish, English |
| 🎙️ **Voice Input** | Real microphone support via Web Speech API (Chrome/Edge) |
| 🔊 **Text-to-Speech** | AI responses read aloud in the detected language |
| 📚 **Knowledge Base** | CSV-backed RAG system — answers are grounded in verified data |
| 🔍 **Auto Language Detection** | Detects language from Unicode ranges + Hinglish keywords |
| 📱 **Mobile Responsive** | Works on desktop, tablet, and mobile |
| 💾 **Chat History** | Conversations saved in `localStorage` |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Google Gemini API key ([Get one free](https://aistudio.google.com/app/apikey))

### 1. Clone and setup

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Add your Gemini API key

```bash
# In the project root (d:/AgriTech/)
copy .env.example .env
```

Open `.env` and add your key:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run the application

**Terminal 1 — Start the backend:**

```bash
cd server
npm run dev
```

You should see:
```
🚀 gram Sathi API server running on http://localhost:3001
✅ Knowledge base loaded successfully
📚 Knowledge base: 35 records loaded
```

**Terminal 2 — Start the frontend:**

```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
d:/AgriTech/
├── client/                    # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/          # ChatWindow, MessageBubble, ChatInput, WelcomeScreen
│   │   │   ├── Sidebar/       # Conversation history + categories
│   │   │   └── Header.tsx     # Brand header with language selector
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   └── ChatPage.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts     # Chat state management
│   │   │   ├── useVoice.ts    # STT + TTS via Web Speech API
│   │   │   └── useChatHistory.ts  # localStorage persistence
│   │   ├── services/
│   │   │   └── api.ts         # Backend API calls (no keys here!)
│   │   └── types/
│   │       └── index.ts       # Shared TypeScript types
│   └── package.json
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   └── chat.ts        # POST /api/chat, GET /api/stats
│   │   ├── services/
│   │   │   ├── gemini.ts      # Gemini API integration
│   │   │   ├── knowledgeBase.ts  # CSV loader + TF-IDF retrieval
│   │   │   └── languageDetection.ts  # Unicode + keyword detection
│   │   └── index.ts           # Express server entry
│   └── package.json
│
├── data/
│   └── knowledge.csv          # ← Replace with your CSV here
│
├── .env                       # Your API key (never committed)
├── .env.example               # Template
└── README.md
```

---

## How to Add/Replace the CSV Knowledge Base

1. Place your CSV file at: `data/knowledge.csv`
2. The CSV can have any column names — the system auto-detects them
3. Recommended columns: `category`, `topic`, `title`, `question`, `answer`, `keywords`, `source`, `url`
4. Restart the server — the CSV is loaded at startup

**How retrieval works:**
- At startup, the server loads all CSV rows into memory
- When a user asks a question, TF-IDF scoring finds the top 5 most relevant rows
- Those rows are sent as context to Gemini along with the user's question
- Gemini generates a grounded answer using that context

---

## How Voice Works

**Speech-to-Text (STT):**
- Uses browser's native `SpeechRecognition` API (Chrome/Edge)
- Click the microphone button and speak
- Transcript auto-fills the input and submits
- Fallback message shown if browser doesn't support it

**Text-to-Speech (TTS):**
- Click the speaker icon on any AI response
- Uses browser's `SpeechSynthesis` API
- Automatically selects an Indian language voice if available
- Strips markdown formatting before reading aloud

---

## Supported Languages

| Language | Script | Code |
|----------|--------|------|
| English | Latin | `en` |
| Hindi | Devanagari | `hi` |
| Hinglish | Latin (Roman Hindi) | `hi-Latn` |
| Punjabi | Gurmukhi | `pa` |
| Bengali | Bengali | `bn` |
| Marathi | Devanagari | `mr` |
| Gujarati | Gujarati | `gu` |
| Tamil | Tamil | `ta` |
| Telugu | Telugu | `te` |
| Kannada | Kannada | `kn` |
| Malayalam | Malayalam | `ml` |
| Odia | Odia | `or` |
| Assamese | Bengali | `as` |
| Urdu | Perso-Arabic | `ur` |

---

## Architecture

```
User (Browser)
    ↓
React Frontend (Vite)
    ↓ HTTP POST /api/chat
Express Backend (Node.js)
    ↓
Language Detection
(Unicode ranges + Hinglish keyword check)
    ↓
CSV Knowledge Retrieval
(TF-IDF scoring → top 5 relevant rows)
    ↓
Gemini 1.5 Flash API
(system prompt + KB context + user message + history)
    ↓
Structured Response
(answer + sourceType + detectedLanguage)
    ↓
Frontend displays + optional TTS
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key |
| `PORT` | No (default: 3001) | Backend server port |
| `CLIENT_ORIGIN` | No (default: http://localhost:5173) | CORS allowed origin |

---

## API Reference

### `POST /api/chat`

**Request:**
```json
{
  "message": "PMFBY क्या है?",
  "history": [],
  "forceLanguage": null
}
```

**Response:**
```json
{
  "answer": "PMFBY यानी प्रधानमंत्री फसल बीमा योजना...",
  "sourceType": "knowledge_base_and_ai",
  "detectedLanguage": {
    "code": "hi",
    "displayName": "हिन्दी",
    "confidence": "high"
  },
  "hasKBContext": true
}
```

### `GET /api/stats`

Returns dashboard statistics including knowledge record count.

---

## Hackathon Demo Script

1. Open http://localhost:5173
2. Landing page shows knowledge count and features
3. Click "Start a Conversation"
4. Ask in **Hindi**: "PMFBY क्या है और इसमें किसान को क्या लाभ मिलता है?"
5. Note the language badge "हिन्दी detected"
6. Note the "Knowledge Base" source indicator
7. Click the speaker icon to hear the response
8. Ask in **Hinglish**: "PMFBY ka premium kitna hota hai kharif mein?"
9. Note Hinglish is correctly detected
10. Try **voice input**: Click mic, speak "PACS ke kya services hain"
11. Show **Punjabi**: "ਸਹਿਕਾਰੀ ਸਭਾ ਦੇ ਮੈਂਬਰਾਂ ਦੇ ਕੀ ਅਧਿਕਾਰ ਹਨ?"
12. Show sidebar with conversation history
13. Show mobile responsive layout

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite 8
- **Styling**: Tailwind CSS 3 + custom design system
- **Icons**: Lucide React
- **Markdown**: react-markdown + remark-gfm
- **Backend**: Node.js + Express + TypeScript
- **AI**: Google Gemini 1.5 Flash (`@google/generative-ai`)
- **CSV Parsing**: csv-parse
- **Speech**: Web Speech API (browser-native)
- **Storage**: localStorage (no auth required)

---

## Important Disclaimer

gram Sathi is an **informational assistance tool**. It is not a government authority, legal advisor, financial advisor, or insurance company. Always verify:
- Government scheme details with official portals
- Legal provisions with the relevant Registrar of Cooperatives
- Insurance eligibility and premium with the insurer
- Financial terms with your bank or PACS

---

*Built for the Ministry of Cooperation Hackathon · Powered by Google Gemini*
