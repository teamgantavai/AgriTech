import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and display total page count.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8.5)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Top Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Sahkar Sathi (Gram Sathi) — Tech Stack & System Architecture")
            self.drawRightString(558, 750, "Architecture Specification")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Running Bottom Footer (all pages)
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 34, footer_text)
        self.drawString(54, 34, "CONFIDENTIAL & PROPRIETARY — AGRI-TECH & CITIZEN WELFARE AI PLATFORM")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 46, 558, 46)
        self.restoreState()

def build_pdf(filename="Sahkar_Sathi_Tech_Stack_and_Architecture.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=58,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Refined professional color palette
    primary_color = colors.HexColor("#0d5c56")   # Rich Forest Teal
    secondary_color = colors.HexColor("#0f172a") # Deep Slate Navy
    accent_emerald = colors.HexColor("#15803d")  # Verdant Green
    slate_subtext = colors.HexColor("#475569")   # Muted Slate
    body_text = colors.HexColor("#1e293b")       # Dark Charcoal
    line_border = colors.HexColor("#cbd5e1")     # Clean Divider

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=slate_subtext,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=secondary_color,
        spaceBefore=12,
        spaceAfter=4,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=primary_color,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=body_text,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=body_text,
        leftIndent=12,
        firstLineIndent=-7,
        spaceAfter=2.5
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=body_text
    )

    table_bold_style = ParagraphStyle(
        'TableBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=secondary_color
    )

    story = []

    # ─────────────────────────────────────────────────────────────
    # TITLE & HEADER
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("Sahkar Sathi · सहकार साथी", title_style))
    story.append(Paragraph("<b>Gram Sathi</b>: System Architecture & Technical Stack Specification", subtitle_style))

    # Meta banner table
    meta_data = [
        [
            Paragraph("<b>Domain:</b> AgriTech & Citizen Welfare AI", table_body_style),
            Paragraph("<b>Interface:</b> Multilingual Web & Native Voice", table_body_style),
            Paragraph("<b>Status:</b> Production-Ready Prototype", table_body_style),
        ],
        [
            Paragraph("<b>Target Audience:</b> Indian Farmers & Rural Citizens", table_body_style),
            Paragraph("<b>AI Engines:</b> Gemini Live + Gemini Flash", table_body_style),
            Paragraph("<b>Language Coverage:</b> 14+ Indian Languages", table_body_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[170, 170, 164])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#86efac")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#bbf7d0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────
    # 1. EXECUTIVE SUMMARY
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("1. Executive Summary & Problem Space", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=6, spaceBefore=0))
    story.append(Paragraph(
        "<b>Sahkar Sathi (Gram Sathi)</b> is an intelligent agricultural and citizen welfare platform designed to eliminate literacy, language, and institutional barriers for Indian citizens. The platform acts as a unified digital companion providing verified, actionable guidance across <b>cooperative laws (PACS)</b>, <b>credit facilities (Kisan Credit Card - KCC)</b>, <b>crop insurance claims (PMFBY)</b>, <b>solar irrigation grants (PM-KUSUM)</b>, and <b>real-time agricultural crop calendars</b>.",
        body_style
    ))
    story.append(Paragraph(
        "The system features a hybrid dual-interface architecture: (1) a lightweight, responsive <b>Server-Sent Events (SSE) streaming text chat</b> grounded by an embedded in-memory CSV-based RAG engine with TF-IDF indexing; and (2) an ultra-low-latency <b>real-time bidirectional voice assistant</b> built directly on Google's <code>gemini-2.5-flash-native-audio-latest</code> model via WebSockets with seamless client-side tool calling and barge-in audio interruption.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # ─────────────────────────────────────────────────────────────
    # 2. FULL TECH STACK MATRIX
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("2. Technical Stack Specification", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=6, spaceBefore=0))

    stack_rows = [
        [
            Paragraph("<b>Layer / Area</b>", table_header_style),
            Paragraph("<b>Technology</b>", table_header_style),
            Paragraph("<b>Version</b>", table_header_style),
            Paragraph("<b>Role & Architectural Purpose</b>", table_header_style)
        ],
        [
            Paragraph("<b>Frontend Framework</b>", table_bold_style),
            Paragraph("React", table_body_style),
            Paragraph("^19.2.8", table_body_style),
            Paragraph("Component-based reactive UI, modern Hooks, concurrent rendering pipeline.", table_body_style)
        ],
        [
            Paragraph("<b>Bundler & Tooling</b>", table_bold_style),
            Paragraph("Vite", table_body_style),
            Paragraph("^8.2.2", table_body_style),
            Paragraph("Lightning-fast ESM development server and optimized Rollup production builds.", table_body_style)
        ],
        [
            Paragraph("<b>Programming Language</b>", table_bold_style),
            Paragraph("TypeScript", table_body_style),
            Paragraph("~6.0 / ^5.6", table_body_style),
            Paragraph("End-to-end static type enforcement across audio streams, tool payloads, and APIs.", table_body_style)
        ],
        [
            Paragraph("<b>Client Routing</b>", table_bold_style),
            Paragraph("react-router-dom", table_body_style),
            Paragraph("6.30.6", table_body_style),
            Paragraph("SPA navigation for /, /chat, /voice, /calendar, and dedicated /services/:slug.", table_body_style)
        ],
        [
            Paragraph("<b>CSS & Design System</b>", table_bold_style),
            Paragraph("TailwindCSS + PostCSS", table_body_style),
            Paragraph("3.4.19", table_body_style),
            Paragraph("Mobile-first utility CSS, high-contrast accessible color tokens, responsive cards.", table_body_style)
        ],
        [
            Paragraph("<b>Iconography</b>", table_bold_style),
            Paragraph("lucide-react", table_body_style),
            Paragraph("1.43.0", table_body_style),
            Paragraph("Clean iconography for accessible rural citizen navigation.", table_body_style)
        ],
        [
            Paragraph("<b>Markdown Engine</b>", table_bold_style),
            Paragraph("react-markdown + remark-gfm", table_body_style),
            Paragraph("10.1.0 / 4.0.1", table_body_style),
            Paragraph("Renders tabular eligibility matrices, numbered steps, and government links.", table_body_style)
        ],
        [
            Paragraph("<b>Backend Server</b>", table_bold_style),
            Paragraph("Express.js", table_body_style),
            Paragraph("^4.21.1", table_body_style),
            Paragraph("RESTful endpoints, SSE streaming responses, CORS security, and body parsing.", table_body_style)
        ],
        [
            Paragraph("<b>Server Dev Runner</b>", table_bold_style),
            Paragraph("ts-node-dev", table_body_style),
            Paragraph("^2.0.0", table_body_style),
            Paragraph("Hot-reloading TypeScript node runtime environment without manual transpilation.", table_body_style)
        ],
        [
            Paragraph("<b>GenAI SDK</b>", table_bold_style),
            Paragraph("@google/genai", table_body_style),
            Paragraph("^2.22.0", table_body_style),
            Paragraph("Unified SDK: server token minting (authTokens.create) & client Live WebSocket sessions.", table_body_style)
        ],
        [
            Paragraph("<b>CSV Knowledge Ingestion</b>", table_bold_style),
            Paragraph("csv-parse", table_body_style),
            Paragraph("^5.6.0", table_body_style),
            Paragraph("High-performance synchronous CSV stream parsing of knowledge base on startup.", table_body_style)
        ],
        [
            Paragraph("<b>Audio & Visualization</b>", table_bold_style),
            Paragraph("Web Audio API + Canvas", table_body_style),
            Paragraph("Native Web APIs", table_body_style),
            Paragraph("16kHz mic ingestion, 24kHz PCM playback, RMS calculation, and 3D fluid orb canvas.", table_body_style)
        ],
        [
            Paragraph("<b>Agri Statistics API</b>", table_bold_style),
            Paragraph("Govt UPAg Portal", table_body_style),
            Paragraph("upag.gov.in", table_body_style),
            Paragraph("Ministry of Agriculture Unified Portal for Agricultural Statistics integration.", table_body_style)
        ]
    ]

    stack_table = Table(stack_rows, colWidths=[110, 115, 60, 219])
    stack_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(stack_table)
    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────
    # 3. FRONTEND SUBSYSTEMS & VOICE PIPELINE
    # ─────────────────────────────────────────────────────────────
    story.append(KeepTogether([
        Paragraph("3. Frontend Architecture & Voice Pipeline", h1_style),
        HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=6, spaceBefore=0),
        Paragraph("A. Modular UI Component Hierarchy", h2_style),
        Paragraph(
            "The client architecture adheres to a clean separation of concerns, orchestrated through <code>VoiceAssistantApp.tsx</code>:",
            body_style
        ),
        Paragraph("• <b>Chat Assistant (<code>ChatAssistant.tsx</code>):</b> Real-time streaming conversation container receiving SSE events via <code>chatService.ts</code>. Includes multi-session history, quick-prompt suggestions, inline scheme previews, and Markdown rendering.", bullet_style),
        Paragraph("• <b>Voice Talking Screen (<code>VoicePanel.tsx</code>):</b> High-contrast interface featuring live state transitions ('Your turn — speak now', 'Gram Sathi is speaking...'), localized across 14 languages, turn indicators, and barge-in controls.", bullet_style),
        Paragraph("• <b>Crop Calendar (<code>CropCalendar.tsx</code>):</b> Interactive agricultural timeline with StateSelector, CropSelector, and MonthCalendarGrid. Features multi-season scheduling (Kharif, Rabi, Zaid) and sowing/growing/harvesting windows.", bullet_style),
        Paragraph("• <b>Service Detail Page (<code>ServiceDetailPage.tsx</code>):</b> Dedicated, bookmarkable, and shareable routes (<code>/services/:slug</code>) detailing marquee schemes with a bilingual English/Hindi toggle.", bullet_style)
    ]))

    story.append(Spacer(1, 6))

    story.append(KeepTogether([
        Paragraph("B. Real-Time Gemini Live Audio Engine", h2_style),
        Paragraph(
            "Rather than relying on basic browser speech recognition, the voice mode utilizes Google's Gemini Live native audio streaming pipeline:",
            body_style
        ),
        Paragraph("• <b>Microphone Capture (<code>useMicrophone.ts</code>):</b> Ingests user voice at 16kHz via Web Audio API, calculates RMS energy for local voice activity detection (VAD), and converts samples to linear 16-bit PCM.", bullet_style),
        Paragraph("• <b>Audio Transcoding (<code>audioProcessor.ts</code>):</b> Zero-copy conversion between Float32Array and Int16Array, linear interpolation downsampler, and Base64 wire encoder.", bullet_style),
        Paragraph("• <b>Audio Playback & Barge-In (<code>useAudioPlayback.ts</code>):</b> Streams 24kHz PCM chunks through an AudioContext queue. If user speech is detected during AI speech, it immediately cancels playback and resets audio buffers (barge-in interruption).", bullet_style),
        Paragraph("• <b>Token Pre-Warming (<code>tokenService.ts</code>):</b> Caches and pre-fetches ephemeral tokens on page hover/load so the WebSocket session connects in under 300ms.", bullet_style),
        Paragraph("• <b>Fluid Canvas Visualization (<code>AnimatedGlobe.tsx</code>):</b> High-DPI HTML5 Canvas rendering a fluid, 3D-like orb responding to live frequency data and mic RMS energy.", bullet_style)
    ]))

    story.append(Spacer(1, 6))

    # Client Tools Table
    tools_data = [
        [
            Paragraph("<b>Voice Tool Function</b>", table_header_style),
            Paragraph("<b>Trigger Condition</b>", table_header_style),
            Paragraph("<b>Action Executed on Client/Server</b>", table_header_style)
        ],
        [
            Paragraph("<code>getCropCalendar</code>", table_bold_style),
            Paragraph("Farmer asks about sowing or harvesting", table_body_style),
            Paragraph("Queries /api/crop-calendar and returns concise spoken summary.", table_body_style)
        ],
        [
            Paragraph("<code>setCropCalendarState</code>", table_bold_style),
            Paragraph("User mentions their state or location", table_body_style),
            Paragraph("Synchronously updates the calendar UI state and context.", table_body_style)
        ],
        [
            Paragraph("<code>navigateToScheme</code>", table_bold_style),
            Paragraph("User asks to open or apply for a scheme", table_body_style),
            Paragraph("Dispatches route navigation to /services/:slug.", table_body_style)
        ],
        [
            Paragraph("<code>searchScheme</code>", table_bold_style),
            Paragraph("User asks about loans, subsidy, or bima", table_body_style),
            Paragraph("Invokes scheme search API and returns top matches.", table_body_style)
        ],
        [
            Paragraph("<code>showDocuments</code>", table_bold_style),
            Paragraph("User asks what documents are required", table_body_style),
            Paragraph("Pops up document checklist modal for the active scheme.", table_body_style)
        ]
    ]
    tools_table = Table(tools_data, colWidths=[110, 160, 234])
    tools_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(KeepTogether([
        Paragraph("C. Client-Side Function Calling Matrix (<code>toolManager.ts</code>)", h2_style),
        tools_table
    ]))
    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────
    # 4. BACKEND API & RAG ENGINE
    # ─────────────────────────────────────────────────────────────
    story.append(KeepTogether([
        Paragraph("4. Backend API & In-Memory RAG Engine", h1_style),
        HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=6, spaceBefore=0),
        Paragraph("A. Secure Ephemeral Token Minting (<code>liveToken.ts</code>)", h2_style),
        Paragraph(
            "To permit browser clients to establish WebSocket connections directly with Google's Gemini Live infrastructure without revealing credentials, the backend generates short-lived authentication tokens:",
            body_style
        ),
        Paragraph("1. Client requests a token via <code>GET /api/live/token</code> on startup or button hover.", bullet_style),
        Paragraph("2. Server invokes <code>ai.authTokens.create({ config: { expireTime: +30min } })</code> using the secret <code>GEMINI_API_KEY</code>.", bullet_style),
        Paragraph("3. A restricted, single-use token identifier (e.g., <code>auth_tokens/...</code>) is returned. The master key never leaves the server.", bullet_style)
    ]))

    story.append(Spacer(1, 6))

    story.append(KeepTogether([
        Paragraph("B. In-Memory RAG Engine & Multilingual Synonyms (<code>knowledgeBase.ts</code>)", h2_style),
        Paragraph(
            "The backend implements an embedded, zero-latency RAG pipeline that avoids the cost and latency of external vector databases:",
            body_style
        ),
        Paragraph("• <b>CSV Ingestion:</b> Loads <code>data/knowledge.csv</code> (870+ scheme and cooperative records) at startup using <code>csv-parse/sync</code>.", bullet_style),
        Paragraph("• <b>Synonym Expansion Matrix:</b> Maps vernacular terminology to standard government terms across Hindi, Hinglish, and English. For instance, <i>'karj'</i>, <i>'rin'</i>, and <i>'credit'</i> expand to <i>'KCC'</i> and <i>'loan'</i>; <i>'bima'</i> expands to <i>'PMFBY'</i> and <i>'fasal insurance'</i>.", bullet_style),
        Paragraph("• <b>TF-IDF Scorer:</b> Calculates token frequency / inverse document frequency across categories, titles, keywords, questions, and answers to retrieve the top 2 to 5 matching records.", bullet_style)
    ]))

    story.append(Spacer(1, 6))

    story.append(KeepTogether([
        Paragraph("C. Resilient AI Orchestration & Fallbacks (<code>gemini.ts</code>)", h2_style),
        Paragraph(
            "All model inferences pass through an automated fallback waterfall to guarantee 100% uptime: <code>gemini-3.6-flash</code> ➔ <code>gemini-3.7-flash</code> ➔ <code>gemini-3.5-flash-lite</code> ➔ <code>gemini-flash-latest</code>. If a model encounters a transient 503 high-demand error, it executes exponential backoff retry before falling back to the next candidate.",
            body_style
        ),
        Paragraph(
            "Additionally, <code>normalizeSchemeUrls</code> scans responses and replaces deprecated portal links (such as legacy kviconline or pmkusum URLs) with verified, active <code>myscheme.gov.in</code> deep-links.",
            body_style
        )
    ]))

    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────
    # 5. SECURITY & DATA GOVERNANCE
    # ─────────────────────────────────────────────────────────────
    sec_data = [
        [
            Paragraph("<b>Security & Governance Domain</b>", table_header_style),
            Paragraph("<b>Implementation Details & Safeguards</b>", table_header_style)
        ],
        [
            Paragraph("<b>API Key Security</b>", table_bold_style),
            Paragraph("The permanent GEMINI_API_KEY is stored strictly in server environment variables. Browser clients receive only short-lived ephemeral tokens with restricted session scopes.", table_body_style)
        ],
        [
            Paragraph("<b>Citizen Data Privacy</b>", table_bold_style),
            Paragraph("User session profiles and conversation histories are persisted strictly on client devices (sessionStorage / localStorage). The system explicitly forbids asking for or storing Aadhaar, OTP, Bank PIN, or passwords.", table_body_style)
        ],
        [
            Paragraph("<b>Zero Hallucination Policy</b>", table_bold_style),
            Paragraph("Strict system prompts instruct the model never to invent eligibility criteria, subsidy amounts, or application deadlines. Missing details trigger fallback to official verification advice.", table_body_style)
        ],
        [
            Paragraph("<b>14+ Language Detection</b>", table_bold_style),
            Paragraph("Regex-based Unicode script identification (Devanagari, Gurmukhi, Bengali, Telugu, Tamil, Kannada, Gujarati, Malayalam, Odia, Urdu) + Hinglish keyword matching guarantees immediate vernacular responses.", table_body_style)
        ]
    ]
    sec_table = Table(sec_data, colWidths=[130, 374])
    sec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))

    story.append(KeepTogether([
        Paragraph("5. Security, Privacy & Data Governance", h1_style),
        HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=6, spaceBefore=0),
        sec_table
    ]))

    story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────
    # 6. SUMMARY & SYSTEM HEALTH
    # ─────────────────────────────────────────────────────────────
    story.append(KeepTogether([
        Paragraph("6. Architectural Summary & Conclusion", h1_style),
        HRFlowable(width="100%", thickness=1, color=primary_color, spaceAfter=6, spaceBefore=0),
        Paragraph(
            "The <b>Sahkar Sathi (Gram Sathi)</b> codebase exemplifies modern, resilient AI architecture designed for the underserved rural demographic. By combining a zero-credential browser voice pipeline (Gemini Live Native Audio), an embedded in-memory RAG system with deep multilingual synonym awareness, and comprehensive crop data from the Government of India's UPAg portal, the platform delivers instant, trustworthy, and empathetic assistance to millions of Indian farmers and citizens.",
            body_style
        )
    ]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated {filename} successfully.")

if __name__ == '__main__':
    target = os.path.join(os.getcwd(), "Sahkar_Sathi_Tech_Stack_and_Architecture.pdf")
    build_pdf(target)
