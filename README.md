# Flashpoint

> AI-powered wildfire command for the critical first 0–3 hours

🏆 **TreeHacks 2026 Winner, Stanford Ecopreneurship Track**

**Flashpoint** is an AI-native incident command decision support system for initial attack wildfire response. Built for California wildfires, it combines real-time satellite fire detection, physics-based spread modeling, and Claude AI insights to deliver actionable intelligence in seconds.

## Core Capabilities

- **🛰️ Live Fire Detection** — NASA FIRMS VIIRS satellite hotspots (California-only, border-filtered)
- **🗺️ GPU-Accelerated Mapping** — Mapbox + Deck.gl with real-time fire spread projections
- **🤖 AI Command Agent** — Multiturn Claude agent with tool-use and incident awareness
- **📊 Automated Action Cards** — Ranked recommendations (Evacuation, Resources, Tactics)
- **🌡️ Real-Time Weather** — Open-Meteo integration with NWS alert enrichment
- **⚡ Performance Optimized** — Cached AI insights, parallel tool execution, 10min FIRMS cache
- **📝 Exportable Briefings** — One-click incident briefs for IC handoffs

## Live Demo

🚀 **[View Live Deployment](https://wildfire-commander-dh1azmjd8-huberthuang0930s-projects.vercel.app/)**

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
# Create .env.local and add:
# - NEXT_PUBLIC_MAPBOX_TOKEN (get from https://account.mapbox.com/)
# - FIRMS_MAP_KEY (get from https://firms.modaps.eosdis.nasa.gov/api/)
# - ANTHROPIC_API_KEY (get from https://console.anthropic.com/)

# Build knowledge base (doctrine sources)
npm run rag:sync      # Download and convert RAG sources
npm run ingest-kb     # Build knowledge base index

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for local development.

## Typical Workflow

**First-time setup:**
1. `npm install` - Install dependencies
2. Configure `.env.local` with API keys
3. `npm run rag:sync` - Download doctrine sources
4. `npm run ingest-kb` - Build knowledge base
5. `npm run dev` - Start development server

**Development cycle:**
1. Make code changes
2. `npm test` - Run tests
3. `npm run dev` - Test locally

**Updating knowledge base:**
1. Edit `rag_sources.yaml` to add new sources
2. `npm run rag:sync` - Download new sources
3. `npm run ingest-kb` - Rebuild index

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox GL JS access token ([get one free](https://account.mapbox.com/)) |
| `FIRMS_MAP_KEY` | Yes | NASA FIRMS API key ([register here](https://firms.modaps.eosdis.nasa.gov/api/)) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key for AI agent |
| `AI_MODEL` | Optional | Claude model (default: `claude-sonnet-4-5`) |

## Key Features

### Live Fire Detection (California)
- Real-time NASA FIRMS VIIRS satellite hotspots
- CAL FIRE official incident data and perimeters
- Automatic clustering into fire incidents using DBSCAN
- Geographic filtering using California state boundary polygon
- FRP (Fire Radiative Power) intensity mapping
- NWS fire weather alert enrichment
- 10-minute cache with stale-while-revalidate pattern

### AI Command Agent (Specialized for Wildfire IC)
- **Built with Claude Agent SDK** — Production-grade agentic workflows
- **Always-on multiturn agent** — No toggle required, AI is production-ready
- **Preflight automation** — Auto-runs missing data pipeline before responding
- **Tool-grounded responses** — All facts cite actual tool outputs (no hallucinations)
- **RAG-backed doctrine** — Searches NWCG, FIRESCOPE protocols for guidance
- **Structured output** — Returns decision, evidence, actions, uncertainties
- **Historical learning** — Cites similar past incidents and IAPs
- **Deterministic fallback** — Works even if Claude API unavailable
- **Incident-aware context** — Automatically grounded in current fire data
- **Response caching** — Instant retrieval of previous analyses per fire
- **Parallel execution** — Optimized tool pipeline (2-5 second savings)

### Fire Spread Modeling
- Wind-driven cone projections (1h, 2h, 3h envelopes)
- Physics-based spread rate calculation
- Fuel type, humidity, and wind speed factors
- Directional spread with backing fire component

## Architecture

- **Frontend:** Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Map:** Mapbox GL JS (basemap) + Deck.gl (GPU-accelerated data layers)
- **Backend:** Next.js API route handlers (no database needed)
- **AI:** Anthropic Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **Weather:** Open-Meteo API (free, no key required) + NWS alerts
- **Live incidents:** NASA FIRMS (satellite hotspots) + CAL FIRE (official data) + DBSCAN clustering
- **Knowledge Base:** Local RAG with lexical search (NWCG doctrine, FIRESCOPE, safety protocols)
- **Tests:** Vitest

## AI Agent Architecture

Built with **Anthropic Claude Agent SDK** for production-grade agentic capabilities.

### Multiturn Tool-Use Loop
The AI agent operates in an agentic tool-use loop (up to 6 iterations per response):

1. **User Query** → Claude analyzes request
2. **Preflight Automation** → Auto-runs missing data pipeline (weather/spread/recs)
3. **Tool Selection** → Agent calls relevant tools:
   - `get_weather(lat, lon)` - Real-time weather data
   - `compute_spread(...)` - Fire spread projections
   - `get_action_cards(...)` - Tactical recommendations
   - `kb_search(query)` - Doctrine retrieval (RAG)
   - `get_historical_analogs(...)` - Similar past incidents
   - `generate_brief(...)` - Incident briefing
4. **Tool Execution** → Parallel execution where possible
5. **Grounding Validation** → Server-side validation ensures all citations are backed by actual tool calls
6. **Final Response** → Structured JSON with decision, evidence, actions, uncertainties

### Context Management
- Full conversation history maintained across messages
- Active incident context automatically injected
- Tool results passed as structured data
- System prompt includes wildfire doctrine and ICS protocols
- Deterministic fallback if AI unavailable

### Knowledge Base (RAG)
The agent searches local doctrine sources from NWCG, FIRESCOPE, and wildfire safety protocols:
- Computed facts cite: `[tool:TOOL_NAME]`
- Doctrine snippets cite: `[KB:doc#chunk]`
- Lexical search with relevance scoring

**RAG Workflow:**
1. Configure sources in `rag_sources.yaml`
2. Run `npm run rag:sync` to download and convert PDFs/HTML to markdown
3. Run `npm run ingest-kb` to build searchable chunk index at `data/kb_index.json`
4. Agent automatically searches KB during responses

## Performance Optimizations

**Recent performance improvements provide 40-50% faster response times:**

### High-Impact Optimizations
- **Singleton Anthropic Client** — Reuses client across requests (saves 100-300ms per call)
- **Parallel Tool Execution** — Weather/spread/recs run concurrently (saves 2-5 seconds)

### Medium-Impact Optimizations
- **Extended FIRMS Cache** — 10-minute TTL with stale-while-revalidate (reduces API load)
- **Request Deduplication** — Prevents concurrent duplicate FIRMS fetches
- **AI Insights Caching** — Per-incident caching with manual refresh capability

## Live Fire Detection

California fires are detected and enriched using multiple sources:

1. **Satellite Detection** — Fetch VIIRS hotspots from NASA FIRMS API
2. **Geographic Filtering** — Filter to California using precise state boundary polygon
3. **Clustering** — Group hotspots into fire incidents using DBSCAN algorithm
4. **Official Data Enrichment** — Match with CAL FIRE incidents for name, containment, perimeter
5. **Weather Alerts** — Enrich top incidents with NWS fire weather alerts
6. **Real-time Updates** — Poll every 30 seconds (cache-backed for performance)

**API Endpoint:**
- `GET /api/fires/live?days=2&sources=VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT&limit=20&nwsEnrich=3&bbox=...`

**Data Sources:**
- NASA FIRMS VIIRS (satellite hotspots)
- CAL FIRE API (official incident data & GeoJSON perimeters)
- NWS API (fire weather alerts)

## Project Structure

```
app/
  page.tsx                      # Main UI orchestration (live mode)
  layout.tsx                    # Dark theme layout
  api/
    fires/live/route.ts         # GET live California fires (FIRMS + CAL FIRE + clustering)
    chat/route.ts               # POST multiturn AI agent chat (Claude Agent SDK)
    weather/route.ts            # GET weather from Open-Meteo
    spread/route.ts             # POST compute spread envelopes
    recommendations/route.ts    # POST generate action cards
    brief/route.ts              # POST generate incident brief
    ai-insights/route.ts        # POST Claude AI tactical insights
    kb/search/route.ts          # POST RAG knowledge base search
    calfire/                    # CAL FIRE API proxy endpoints
    firms/hotspots/route.ts     # GET raw FIRMS hotspot data
    incidents/enriched/route.ts # GET enriched incident data

components/
  MapView.tsx                   # Mapbox + Deck.gl GPU-accelerated map
  IncidentList.tsx              # Live fire detection list (top 3 visible)
  IncidentPanel.tsx             # Fire details + weather
  ExplainPanel.tsx              # Risk score visualization
  AIInsightsPanel.tsx           # AI tactical insights with caching
  ChatPanel.tsx                 # Multiturn AI chat with structured responses
  ControlsBar.tsx               # Top bar with Flashpoint branding
  BriefModal.tsx                # Exportable incident brief
  ActionCards.tsx               # Ranked action card display

lib/
  types.ts                      # TypeScript interfaces
  geo.ts                        # Geospatial utilities (Haversine, cones)
  ca-boundary.ts                # California polygon + point-in-polygon check
  firms.ts                      # NASA FIRMS API client (with caching)
  calfire.ts                    # CAL FIRE API integration
  cluster.ts                    # DBSCAN hotspot clustering
  spread.ts                     # Fire spread physics model
  risk.ts                       # Risk scoring algorithm
  recommendations.ts            # Action card generation
  nws.ts                        # NWS weather alert enrichment
  kb.ts                         # RAG lexical search engine
  historical-data.ts            # Historical incident matching
  iap-matching.ts               # IAP (Incident Action Plan) similarity
  terrain.ts                    # Terrain analysis
  chat/
    types.ts                    # Chat message & context types
    tools.ts                    # Tool definitions & execution
  ai/
    claude-client.ts            # Singleton Anthropic client
    prompt-builder.ts           # AI context building

scripts/
  rag_sync.ts                   # Download & convert RAG sources (PDF→MD)
  ingest_kb.ts                  # Build knowledge base chunk index
  process-perimeters.ts         # Process fire perimeter data
  process-iaps.ts               # Process historical IAPs

data/
  kb_index.json                 # RAG chunk index (generated)
  iap/                          # Historical IAP data

rag_sources.yaml                # RAG source configuration

tests/
  spread.test.ts                # Spread model tests
  risk.test.ts                  # Risk scoring tests
  recommendations.test.ts       # Action card tests
  kb_search.test.ts             # RAG search tests
  chat_tools.test.ts            # Chat tool execution tests
```

## Fire Spread Model (Explainable)

```
baseRate      = 0.6 km/h
windFactor    = 1 + windSpeed(m/s) / 10
humidityFactor = humidity < 20% → 1.4 | < 30% → 1.2 | else → 1.0
fuelFactor    = grass → 1.3 | chaparral → 1.2 | brush → 1.1 | mixed → 1.0

spreadRate = baseRate × windFactor × humidityFactor × fuelFactor
```

## Risk Score (0–100)

```
35% × windSeverity      (0 at 0 m/s, 100 at 20+ m/s)
35% × humiditySeverity   (100 at 0%, 0 at 60%+)
30% × timeToImpact       (100 if < 30 min, 10 if > 180 min)
```

## Development Workflow

### Running Tests
```bash
npm test                    # Run all tests with Vitest
```

### Knowledge Base Management
```bash
npm run rag:sync           # Download & convert doctrine sources (PDF→MD, HTML→MD)
npm run ingest-kb          # Build searchable chunk index at data/kb_index.json
```

### Data Processing Scripts
```bash
npm run process-perimeters # Process fire perimeter GeoJSON data
npm run process-iaps       # Process historical IAP documents
```

### Build & Deploy
```bash
npm run build              # Production build
npm run start              # Start production server
```

## 60-Second Demo Flow

1. **Live Fire Detection** → Opens to real-time California fires from NASA satellites + CAL FIRE
2. **Click a Fire** → Automatic weather fetch, spread modeling, risk assessment, action cards
3. **AI Insights Tab** → Click "Analyze Fire" → Claude agent generates tactical insights with citations
4. **AI Chat Tab** → Ask questions like:
   - "Do we need evacuation warnings?"
   - "What resources should we request?"
   - "Give me a 0-3h briefing"
   - Agent auto-runs missing data, cites tools and doctrine
5. **Map Visualization** → Fire markers, spread envelopes (1h/2h/3h), intensity colors, CAL FIRE perimeters
6. **Action Cards** → Ranked priorities (Tactics/Resources/Evacuation) with reasoning and IAP citations
7. **Export Brief** → One-click incident briefing for IC handoffs

**Key Messages:**
- Real data sources: FIRMS satellites, CAL FIRE incidents, NWS alerts
- Tool-grounded AI: All facts cite actual tool outputs, no hallucinations
- Doctrine-backed: RAG search of NWCG/FIRESCOPE protocols
- AI agent always active, zero configuration
- Sub-3-second response times with aggressive caching
- California-only filtering for operational focus

## Tech Stack

### Frontend
- **Next.js 15** — React App Router with TypeScript
- **Tailwind CSS v4** — Utility-first styling
- **shadcn/ui** — Accessible component library
- **Mapbox GL JS** — WebGL-powered base map
- **Deck.gl** — GPU-accelerated data visualization

### Backend & APIs
- **Next.js API Routes** — Serverless functions (no database required)
- **Claude Agent SDK** — `@anthropic-ai/claude-agent-sdk` for agentic workflows
- **Claude Sonnet 4.5** — Anthropic AI with tool-use and grounding validation
- **NASA FIRMS** — VIIRS satellite fire detections
- **CAL FIRE API** — Official incident data and perimeters
- **Open-Meteo** — Free weather API (no key required)
- **NWS API** — National Weather Service fire weather alerts

### Performance
- **Singleton Anthropic Client** — Connection pooling
- **Request Deduplication** — Prevents redundant fetches
- **Stale-While-Revalidate** — Cache pattern for FIRMS data
- **AI Response Caching** — Per-incident result memoization

### Testing
- **Vitest** — Unit and integration tests
- **Test Coverage** — Spread model, risk scoring, recommendations, RAG search, chat tools
- **Physics Validation** — Spread rate calculations tested against known scenarios
- **Grounding Validation** — Server-side checks ensure all AI citations are backed by tool calls

## Deployment

**Recommended platforms:**
- **Vercel** (optimized for Next.js, zero-config)
- **AWS Amplify** (enterprise-grade with CDN)
- **Cloudflare Pages** (edge computing)

**Build command:**
```bash
npm run build
```

**Pre-deployment checklist:**
1. Run `npm run rag:sync` and `npm run ingest-kb` locally
2. Commit the generated `data/kb_index.json` to git
3. Configure all required environment variables in your deployment platform:
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `FIRMS_MAP_KEY`
   - `ANTHROPIC_API_KEY`
   - `AI_INSIGHTS_ENABLED` (optional, defaults to true)
   - `AI_MODEL` (optional, defaults to `claude-sonnet-4-5`)
4. Ensure `data/kb_index.json` is included in deployment (not in `.gitignore`)

**Note:** The RAG knowledge base (`data/kb_index.json`) must be built locally and committed to the repository before deployment, as build environments may not have network access to download source documents.

## What Makes This Specialized (Not a Generic Chatbot)

Unlike generic AI chatbots, Flashpoint is a **purpose-built IC decision support system**:

1. **Incident Context** — Every chat request includes full incident context (weather, spread, assets, resources)
2. **Tool Grounding** — All facts must cite tool outputs (`[tool:get_weather]`) or doctrine (`[KB:irpg#12]`)
3. **Preflight Automation** — Auto-runs data pipeline when context is missing
4. **Structured Output** — IC-ready format: decision, evidence, actions (0-3h), uncertainties
5. **Deterministic Fallback** — Works even if AI fails (rule-based recommendations)
6. **Doctrine RAG** — Answers questions using NWCG/FIRESCOPE doctrine, not generic knowledge
7. **Historical Learning** — Cites similar past incidents and relevant IAP sections
8. **Safety Guardrails** — Never pretends to be dispatch; frames as decision support
9. **Grounding Validation** — Server-side validation filters out ungrounded claims

**Example Response Structure:**
```json
{
  "decision": "Recommend evacuation warnings for Malibu Canyon within 90 minutes",
  "evidence": [
    "Wind speed 18 mph gusting to 25 mph [tool:get_weather]",
    "Predicted spread rate 2.1 km/h with 3h envelope reaching Highway 1 [tool:compute_spread]",
    "Structures at risk: 45 homes within 3h envelope [tool:get_action_cards]",
    "Red Flag Warning active until 8 PM [tool:get_weather]"
  ],
  "actions_0_3h": [
    "Issue evacuation warnings for zones A-C (priority: HIGH)",
    "Position Type 1 engines at Highway 1 intersections",
    "Request air attack for spot fire suppression"
  ],
  "uncertainties": [
    "Wind shift forecast at 1800 hrs may alter spread direction",
    "Fuel moisture not measured in past 48 hours"
  ]
}
```

## Design Philosophy

**Flashpoint is built for the 0-3 hour initial attack window where seconds matter:**

1. **Speed First** — Sub-3-second AI responses through aggressive caching and parallelization
2. **Tool-Grounded AI** — Every fact cites actual tool outputs; no hallucinations
3. **Incident-Aware** — AI automatically receives full incident context (weather, spread, assets)
4. **Doctrine-Backed** — RAG retrieval from NWCG, FIRESCOPE, and wildfire safety protocols
5. **Explainable AI** — Every recommendation includes reasoning and confidence levels
6. **Real Data Only** — No simulations; live satellites (FIRMS), official data (CAL FIRE), real weather
7. **Zero Configuration** — AI always-on, automatic context injection, one-click deployment
8. **Deterministic Fallback** — Works even if AI unavailable
9. **Firefighter-Friendly** — Dark UI, large fonts, mobile-ready, exportable briefings

## Limitations & Future Work

**Current scope:**
- California-only fire detection (easily extended to other states)
- 0-3 hour initial attack focus (not for extended campaign fires)
- Lexical RAG search (not semantic vector search)
- English language only
- Requires internet connectivity

**Future enhancements:**
- Multi-state support with state selector
- Upgrade RAG to vector embeddings (semantic search)
- Add more doctrine sources (LLC incident reviews, SAFENET protocols)
- Real-time incident updates via WebSocket
- Multi-user collaboration (shared incident views)
- Resource tracking and allocation optimization
- Export briefs to PDF
- Offline mode with service workers
- Mobile app (iOS/Android)
- Integration with real dispatch systems

## Contributing

Contributions welcome! Key areas:
- **Accuracy improvements** for spread model and risk scoring
- **RAG enhancements** (vector embeddings, additional doctrine sources)
- **Additional data sources** (LLC incident reviews, SAFENET protocols)
- **UI/UX enhancements** for field use
- **Test coverage** expansion
- **Tool additions** for the AI agent (terrain analysis, resource optimization)
- **Historical incident data** curation

## License

MIT License - see LICENSE file for details

---

**Built for wildland firefighters who need answers in seconds, not minutes.**
