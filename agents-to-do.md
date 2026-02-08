# Agents To Do

Agent ideas inspired by [OpenClaw](../openclaw) capabilities. Each agent handles a single common workflow end-to-end.

---

## 1. Email Triage Agent

Reads, classifies, and drafts replies for incoming email. Can archive, label, flag, and summarize threads so the user starts the day with an inbox at zero.

**Tools:**
- `emailList` — list messages by folder/label with filters
- `emailRead` — fetch full message body + attachments
- `emailSend` — send or reply to a message (draft mode or immediate)
- `emailMove` — archive, trash, or move to folder
- `emailLabel` — add/remove labels or flags
- `summarize` — condense long threads into a brief
- `todoWrite` — surface action items from emails

---

## 2. Calendar & Scheduling Agent

Manages calendar events, finds free slots, proposes meeting times across participants, and sends invites. Handles rescheduling and conflict resolution.

**Tools:**
- `calendarList` — list events in a date range
- `calendarCreate` — create a new event with attendees
- `calendarUpdate` — reschedule or edit an event
- `calendarDelete` — cancel an event
- `calendarFreeSlots` — find mutual availability across calendars
- `contactLookup` — resolve names to email addresses
- `message` — notify attendees via chat (Slack, Teams, etc.)
- `timezoneConvert` — convert times across zones

---

## 3. Browser Automation Agent

Controls a headless or managed browser to perform web tasks: filling forms, scraping structured data, taking screenshots, generating PDFs, and end-to-end testing flows.

**Tools:**
- `browserNavigate` — go to a URL
- `browserClick` — click an element by selector or AI ref
- `browserType` — type into input fields
- `browserSelect` — select dropdowns, checkboxes, radios
- `browserScreenshot` — capture the visible viewport
- `browserPdf` — save page as PDF
- `browserSnapshot` — get an accessibility/AI snapshot of the page
- `browserEval` — run arbitrary JS in the page context
- `browserWait` — wait for selector, network idle, or timeout
- `read` / `write` — save scraped data to local files

---

## 4. Multi-Channel Messaging Agent

Composes and dispatches messages across platforms (Slack, Discord, Telegram, WhatsApp, Teams, etc.) from a single instruction. Handles threads, reactions, pins, and polls.

**Tools:**
- `message` — send a message to a channel + platform
- `messageEdit` — edit a previously sent message
- `messageDelete` — delete a message
- `messageReact` — add emoji reactions
- `messagePin` — pin/unpin a message
- `messagePoll` — create a poll with options
- `messageThread` — reply within a thread
- `channelList` — list available channels and contacts
- `templateRender` — fill a message template with variables

---

## 5. GitHub Ops Agent

Manages the full GitHub workflow: triaging issues, creating/reviewing PRs, checking CI status, merging, and releasing. Works across multiple repos.

**Tools:**
- `ghIssueList` — list and filter issues
- `ghIssueCreate` — open a new issue
- `ghIssueComment` — comment on an issue
- `ghPrCreate` — create a pull request
- `ghPrReview` — submit a review (approve, request changes, comment)
- `ghPrMerge` — merge a pull request
- `ghCiStatus` — check CI/CD run status
- `ghRelease` — create a release with notes
- `read` / `grep` / `glob` — explore local repo files
- `bash` — run git commands locally

---

## 6. Content Summarization Agent

Summarizes URLs (articles, docs), local files, PDFs, podcasts, and YouTube videos into structured briefs with key takeaways and action items.

**Tools:**
- `webFetch` — retrieve and extract readable content from a URL
- `read` — read local files and documents
- `pdfRead` — extract text from PDF files
- `audioTranscribe` — transcribe audio/podcast files (Whisper)
- `videoTranscribe` — extract transcript from video
- `summarize` — produce a structured summary from text
- `write` — save the summary to a file
- `todoWrite` — extract action items

---

## 7. Task & Project Management Agent

Syncs and manages tasks across platforms (Notion, Trello, Linear, Things, Apple Reminders). Creates, updates, prioritizes, and reports on project progress.

**Tools:**
- `notionPageCreate` — create a Notion page or database entry
- `notionPageUpdate` — update properties/content on a Notion page
- `notionQuery` — query a Notion database with filters
- `trelloCardCreate` — create a Trello card
- `trelloCardMove` — move card between lists
- `trelloCardUpdate` — update card details
- `linearIssueCreate` — create a Linear issue
- `linearIssueUpdate` — update issue status/assignee
- `reminderCreate` — create a system reminder
- `reminderComplete` — mark a reminder as done
- `todoRead` / `todoWrite` — local todo management

---

## 8. Deep Research Agent

Performs multi-step web research: searches multiple sources, cross-references claims, compiles findings into a cited report with confidence levels.

**Tools:**
- `webSearch` — search the web (Brave, Perplexity, etc.)
- `webFetch` — fetch and extract content from result URLs
- `read` / `write` — manage local research notes
- `grep` / `glob` — search existing local knowledge base
- `cite` — attach source URL + quote to a claim
- `reportGenerate` — compile findings into a structured document
- `todoWrite` — track research sub-questions

---

## 9. Media Processing Agent

Handles image, audio, and video processing tasks: resizing, format conversion, thumbnail generation, transcription, spectrogram analysis, and AI-powered editing.

**Tools:**
- `imageResize` — resize/crop images
- `imageConvert` — convert between image formats
- `imageGenerate` — generate images via AI (DALL-E, Gemini)
- `audioTranscribe` — speech-to-text (Whisper)
- `audioTts` — text-to-speech (ElevenLabs, OpenAI TTS)
- `videoExtractFrames` — extract frames or clips from video
- `videoTrim` — trim video to a time range
- `ffmpeg` — run arbitrary ffmpeg commands
- `read` / `write` — file I/O

---

## 10. Smart Home Agent

Controls smart home devices: lights, speakers, thermostats, cameras. Can set scenes, schedules, and respond to sensor events.

**Tools:**
- `hueLights` — control Philips Hue lights (on/off, color, brightness)
- `hueScenes` — activate predefined scenes
- `sonosPlayback` — control Sonos speakers (play, pause, volume, group)
- `thermostatSet` — set temperature (Eight Sleep, Nest, etc.)
- `cameraCapture` — snap a frame from a security camera
- `cronSchedule` — schedule recurring automations
- `notify` — send a notification to a device
- `locationGet` — get current device location for context

---

## 11. Monitoring & Alerting Agent

Watches RSS feeds, websites, APIs, and logs for changes. Sends alerts via the user's preferred channel when conditions are met.

**Tools:**
- `feedWatch` — subscribe to and poll RSS/Atom feeds
- `webFetch` — fetch a URL and detect content changes
- `cronSchedule` — schedule polling intervals
- `diffCompare` — compare current vs. previous content
- `message` — send alert to Slack, Discord, Telegram, etc.
- `notify` — push a system notification to device
- `webhookRegister` — register a webhook listener for push events
- `logTail` — watch a log file for patterns
- `read` / `write` — persist state between checks

---

## 12. Documentation Agent

Reads a codebase and generates or updates documentation: READMEs, API references, architecture diagrams (Mermaid), changelogs, and inline JSDoc/docstrings.

**Tools:**
- `read` — read source files
- `write` / `edit` — write/update documentation files
- `grep` / `glob` / `list` — explore codebase structure
- `bash` — run doc generation tools (TypeDoc, Sphinx, etc.)
- `mermaidRender` — generate architecture/flow diagrams
- `changelogGenerate` — produce changelogs from git history
- `todoWrite` — track undocumented areas

---

## 13. Testing Agent

Generates test cases, runs test suites, analyzes failures, and suggests fixes. Supports unit, integration, and end-to-end testing.

**Tools:**
- `read` — read source code to understand what to test
- `write` / `edit` — create/update test files
- `bash` — run test suites (Jest, pytest, Vitest, etc.)
- `coverageReport` — parse and summarize code coverage
- `testGenerate` — AI-generate test cases from function signatures
- `grep` / `glob` — find existing tests and untested code
- `todoWrite` — track failing tests and coverage gaps

---

## 14. Deployment Agent

Handles deployment workflows: building, tagging, pushing containers, deploying to cloud providers, running migrations, and verifying health.

**Tools:**
- `bash` — run build commands, docker, kubectl, etc.
- `dockerBuild` — build a container image
- `dockerPush` — push image to a registry
- `cloudDeploy` — trigger deployment (Vercel, AWS, GCP, Fly.io)
- `dbMigrate` — run database migrations
- `healthCheck` — verify deployment health endpoints
- `envSet` — manage environment variables
- `ghRelease` — create a GitHub release
- `message` — notify team of deployment status
- `rollback` — revert to a previous deployment

---

## 15. Security Audit Agent

Scans codebases and infrastructure for vulnerabilities, outdated dependencies, secrets exposure, and misconfigurations. Produces a prioritized report.

**Tools:**
- `read` / `grep` / `glob` — scan source files for patterns
- `bash` — run security scanners (npm audit, Snyk, Trivy, etc.)
- `secretScan` — detect hardcoded secrets, API keys, tokens
- `depAudit` — check dependencies for known CVEs
- `configAudit` — validate config files against best practices
- `reportGenerate` — compile findings into a severity-ranked report
- `todoWrite` — track remediation items

---

## 16. Note-Taking & Knowledge Agent

Manages personal notes across systems (Obsidian, Apple Notes, Bear). Creates, searches, links, and organizes notes. Can capture from conversations and web.

**Tools:**
- `noteCreate` — create a note in the target system
- `noteEdit` — edit an existing note
- `noteSearch` — full-text search across notes
- `noteLink` — create bi-directional links between notes
- `noteTag` — add/remove tags
- `webFetch` — clip web content into a note
- `summarize` — condense captured content
- `memorySearch` — search vector memory for related notes

---

## 17. Voice & Audio Agent

Handles voice-related tasks: transcription, text-to-speech, voice memos, audio editing, and initiating voice calls.

**Tools:**
- `audioTranscribe` — speech-to-text (Whisper, Deepgram)
- `audioTts` — text-to-speech (ElevenLabs, OpenAI, Edge)
- `voiceCallStart` — initiate a voice call (Twilio, Telnyx)
- `voiceCallEnd` — hang up a call
- `audioTrim` — trim audio clips
- `audioConvert` — convert audio formats
- `read` / `write` — file I/O for audio files
- `message` — send voice notes to chat platforms

---

## 18. Cron & Automation Agent

Creates and manages scheduled tasks, recurring jobs, and event-driven automations. The orchestrator for "do X every Y" or "when Z happens, do W."

**Tools:**
- `cronCreate` — create a one-shot or recurring job
- `cronList` — list all scheduled jobs
- `cronDelete` — remove a scheduled job
- `cronHistory` — view past job runs and results
- `webhookRegister` — register event-driven triggers
- `sessionSpawn` — spawn an isolated agent session for a job
- `message` — deliver job output to a channel
- `bash` — execute arbitrary commands as part of a job

---

## 19. Data Pipeline Agent

Builds and runs lightweight ETL pipelines: extracting data from APIs/files, transforming it, and loading it into databases, spreadsheets, or files.

**Tools:**
- `webFetch` — pull data from REST APIs
- `read` / `write` — read/write CSV, JSON, YAML files
- `dbQuery` — run SQL queries against a database
- `dbInsert` — insert/upsert rows into a database
- `sheetRead` — read data from Google Sheets
- `sheetWrite` — write data to Google Sheets
- `jsonTransform` — map, filter, reshape JSON data
- `bash` — run data processing scripts
- `cronSchedule` — schedule recurring pipeline runs

---

## 20. Onboarding Agent

Guides new team members through codebase onboarding: explains architecture, points to key files, sets up local dev environment, and answers questions contextually.

**Tools:**
- `read` / `grep` / `glob` / `list` — explore codebase
- `bash` — run setup scripts, install dependencies
- `mermaidRender` — generate architecture diagrams on the fly
- `memorySearch` — search team knowledge base
- `todoWrite` — create a personalized onboarding checklist
- `message` — send welcome messages or ask team questions
- `webFetch` — fetch internal wiki/docs pages

---

## 21. Desktop UI Automation Agent

Controls the macOS desktop like a human: clicks buttons, fills dialogs, navigates menus, manages windows, launches apps, and automates repetitive GUI workflows that have no API.

**Tools:**
- `uiScreenshot` — capture an annotated screenshot with element IDs
- `uiClick` — click an element by ID, query, or coordinates
- `uiType` — type text into focused fields (with clear option)
- `uiHotkey` — press keyboard shortcuts (e.g. cmd+shift+t)
- `uiDrag` — drag and drop between elements or coordinates
- `uiScroll` — scroll in a direction (targeted or smooth)
- `uiMenu` — click application menu items by path
- `uiDialog` — interact with system dialogs (click buttons, fill inputs, file pickers)
- `uiAppLaunch` — launch, quit, relaunch, hide, or switch apps
- `uiWindowManage` — move, resize, minimize, maximize, focus windows
- `uiClipboard` — read/write clipboard (text, images, files)
- `uiDock` — interact with Dock items

---

## 22. Workflow Orchestration Agent

Designs and executes multi-step workflows with branching, parallelism, loops, approval gates, and error handling. The "meta-agent" that coordinates other agents.

**Tools:**
- `workflowCreate` — define a new workflow from steps
- `workflowRun` — execute a workflow with input arguments
- `workflowResume` — resume a paused workflow after approval
- `sessionSpawn` — spawn a subagent session for a workflow step
- `sessionSend` — send a message to a running session
- `sessionStatus` — check status of spawned sessions
- `parallelExecute` — run multiple steps concurrently with join strategies (all, first, any)
- `approvalRequest` — pause and request human approval
- `stateRead` / `stateWrite` — read/write workflow state between steps
- `llmTask` — run a structured JSON-only LLM call (classify, draft, summarize)

---

## 23. Long-Term Memory Agent

Manages persistent memory across conversations: stores facts, preferences, decisions, and entities. Recalls relevant context automatically and forgets on request (GDPR-safe).

**Tools:**
- `memoryStore` — save information with category (fact, preference, decision, entity)
- `memoryRecall` — semantic search over stored memories
- `memoryForget` — delete specific memories by ID or query
- `memoryList` — list all memories with filters
- `memoryImport` — bulk import from markdown files or notes
- `memoryExport` — export memories to structured files
- `embeddingGenerate` — generate vector embeddings for indexing
- `read` / `write` — access markdown knowledge base files

---

## 24. Visual Dashboard Agent

Builds and renders interactive HTML/CSS/JS dashboards on connected devices (desktop, mobile). Visualizes data, status boards, and live feeds using a canvas system.

**Tools:**
- `canvasCreate` — create a new canvas with HTML content
- `canvasUpdate` — update canvas content dynamically
- `canvasNavigate` — navigate canvas to a URL or local file
- `canvasEval` — execute JavaScript on the canvas
- `canvasSnapshot` — capture the canvas as an image
- `canvasShow` / `canvasHide` — show or hide the canvas panel
- `chartRender` — render chart data as HTML (bar, line, pie, etc.)
- `read` / `write` — manage local HTML/CSS/JS files
- `webFetch` — pull live data for dashboards

---

## 25. MCP Bridge Agent

Discovers, connects to, and orchestrates tools from any MCP (Model Context Protocol) server. Acts as a universal adapter to external tool ecosystems.

**Tools:**
- `mcpServerList` — list configured MCP servers and their tools
- `mcpToolCall` — call any tool on any MCP server by name
- `mcpAuth` — authenticate with an MCP server (OAuth, tokens)
- `mcpSchemaInspect` — get the JSON schema for an MCP tool
- `mcpServerAdd` — add a new MCP server configuration
- `mcpServerRemove` — remove an MCP server
- `mcpCodegen` — generate typed client code from MCP server schemas

---

## 26. Music & Playlist Agent

Controls music playback, searches tracks, manages playlists, and discovers music. Works with Spotify and local players.

**Tools:**
- `musicPlay` — play a track, album, or playlist
- `musicPause` — pause playback
- `musicNext` / `musicPrev` — skip tracks
- `musicSearch` — search for tracks, artists, albums
- `musicQueue` — add tracks to the queue
- `musicStatus` — get current playback status
- `musicDeviceList` — list available playback devices
- `musicDeviceSet` — switch active playback device
- `musicPlaylistCreate` — create a new playlist
- `musicPlaylistAdd` — add tracks to a playlist
- `musicLike` — like/save a track

---

## 27. PDF Agent

Edits, annotates, merges, splits, and extracts data from PDFs using natural language instructions.

**Tools:**
- `pdfEdit` — edit a PDF page with natural language instructions
- `pdfRead` — extract text from PDF pages
- `pdfMerge` — merge multiple PDFs into one
- `pdfSplit` — split a PDF by page ranges
- `pdfAnnotate` — add highlights, comments, or stamps
- `pdfToImages` — convert PDF pages to images
- `pdfFromImages` — create a PDF from images
- `pdfFormFill` — fill in PDF form fields
- `pdfSign` — apply a digital signature
- `write` — save output PDFs

---

## 28. Local Discovery & Recommendations Agent

Searches for nearby places (restaurants, services, shops), reads reviews, compares options, and makes recommendations based on user preferences and location.

**Tools:**
- `placesSearch` — search for places by query and location
- `placeDetails` — get detailed info (hours, phone, rating, photos)
- `placeReviews` — fetch user reviews for a place
- `locationGet` — get current device location
- `mapDirections` — get directions and travel time between places
- `memoryRecall` — recall user food/place preferences
- `message` — share recommendations via chat
- `webFetch` — fetch additional info from place websites

---

## 29. Secrets & Credentials Agent

Manages secrets, API keys, and credentials securely. Retrieves secrets from vaults, injects them into environments, and rotates credentials — never exposing them in logs or chat.

**Tools:**
- `vaultList` — list available vaults/items
- `vaultGet` — retrieve a secret by reference (never returns raw value to chat)
- `vaultRun` — run a command with secrets injected as env vars
- `vaultInject` — inject secrets into a template file
- `vaultCreate` — store a new secret
- `vaultRotate` — rotate a credential (generate new, update vault, update services)
- `envSet` — set environment variables for the current session
- `bash` — run commands that need credentials (via vault injection)

---

## 30. Device Control Agent

Leverages connected companion devices (phones, tablets, desktops) for camera capture, screen recording, location, notifications, and running remote commands.

**Tools:**
- `cameraSnap` — take a photo from a device camera (front/back)
- `cameraClip` — record a short video clip
- `cameraList` — list available cameras across devices
- `screenRecord` — record the screen of a device
- `locationGet` — get GPS coordinates from a mobile device
- `notifySend` — send a system notification to a device
- `remoteExec` — run a command on a remote node
- `remoteWhich` — check if a binary exists on a remote node
- `deviceList` — list all paired/connected devices

---

## 31. Cost & Usage Analytics Agent

Tracks and analyzes AI model usage, token consumption, and costs across providers. Produces reports, alerts on budget thresholds, and recommends cheaper model alternatives.

**Tools:**
- `usageFetch` — pull usage data from provider dashboards
- `usageSummarize` — summarize costs by model, provider, time period
- `usageCompare` — compare cost/quality across models
- `budgetSet` — set spending alerts and limits
- `budgetCheck` — check current spend against budget
- `reportGenerate` — produce a usage report (table, chart)
- `cronSchedule` — schedule recurring cost reports
- `message` — alert on budget overruns

---

## 32. Food & Delivery Agent

Handles food ordering workflows: browses past orders, reorders favorites, tracks active deliveries, and notifies when food arrives.

**Tools:**
- `orderHistory` — list recent orders from delivery platforms
- `orderDetails` — show items, total, and restaurant for a past order
- `orderReorder` — reorder a previous order (with preview and confirmation)
- `orderTrack` — track active delivery status and ETA
- `orderWatch` — live-watch delivery progress with updates
- `placesSearch` — search for nearby restaurants
- `message` — notify when delivery status changes
- `memoryRecall` — recall dietary preferences and favorite orders
