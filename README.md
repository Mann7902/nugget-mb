# LinkedIn Post Generator

A production-ready AI-powered LinkedIn content creation tool with a sophisticated multi-step generation pipeline.

## Features

- **Beautiful Dark UI**: Minimalistic interface with gradient highlights and smooth animations
- **Multi-Step AI Pipeline**: Explicit 6-step process (Planning → Drafting → Hashtags → Personas → Safety → Packaging)
- **Dual AI Support**: Choose between Gemini (free) or OpenAI (paid) providers
- **LinkedIn Profile Analysis**: Extract tone and style from existing LinkedIn profiles
- **Real-time Progress**: Live updates showing generation stages and timing
- **Content Safety**: Built-in guardrails for profanity, PII, and claim validation
- **Rate Limiting**: Prevents API abuse and runaway costs
- **Responsive Design**: Optimized for desktop and mobile use

## Architecture

```
Frontend (Next.js/React)
├── Dark themed form with real-time validation
├── Progress tracking with stage visualization
├── Result cards with copy/edit/regenerate controls
└── Responsive design with micro-interactions

Backend (Node.js API Routes)
├── /api/generate - Multi-step post generation
├── /api/health - Service health check
├── Rate limiting middleware
├── Content safety validation
└── AI provider abstraction layer
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in `.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

### Health Check
- **URL**: `/api/health`
- **Method**: GET
- **Response**: `200 OK` with service status

### Generate Posts
- **URL**: `/api/generate`
- **Method**: POST
- **Content-Type**: `application/json`
- **Response**: Server-sent events stream with progress updates and results

#### Request Body
```json
{
  "topic": "Remote work productivity",
  "tone": "Professional",
  "audience": "Software developers",
  "length": "medium",
  "postCount": 3,
  "hashtags": "#productivity #remotework",
  "examples": "Example posts to mimic...",
  "language": "English",
  "llmProvider": "gemini"
}
```

## Generation Pipeline

The AI agent follows this explicit 6-step process:

1. **Planning**: Creates structured outlines (hook, bullets, CTA)
2. **Drafting**: Expands outlines into full posts respecting tone/audience/length
3. **Hashtag Generation**: Extracts 3-8 relevant hashtags
4. **Persona Refinement**: Generates voice variants (Founder, Mentor, etc.)
5. **Content Safety**: Runs guardrails (profanity, PII, claims validation)
6. **Packaging**: Returns final JSON with metrics (tokens, latency, cost estimates)


## Testing

Run the test suite:
```bash
npm test
```

Tests cover:
- Health endpoint availability
- Generate endpoint validation
- Rate limiting behavior
- Content safety checks

## Production Deployment

This app is optimized for deployment on Render or similar Node.js hosting platforms:

1. Set environment variables in your hosting platform
2. Build the application: `npm run build`
3. Start the production server: `npm start`

## Security

- API keys are stored securely in environment variables
- Rate limiting prevents abuse
- Content safety checks remove inappropriate content
- PII detection and sanitization
- No sensitive data in client bundle

## Logging

All pipeline steps are logged server-side for debugging:
- Step timing and performance
- AI provider responses
- Safety check results
- Error handling and recovery


