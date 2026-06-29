from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import Flowable

W, H = A4

# ── Palette ──────────────────────────────────────────────────────────────────
BG        = colors.HexColor('#ffffff')
SURFACE   = colors.HexColor('#f5f5f7')
CARD      = colors.HexColor('#f0f0f5')
BORDER    = colors.HexColor('#d0d0d8')
WHITE     = colors.HexColor('#1a1a2e')   # "white" slots now carry dark text
MUTED     = colors.HexColor('#666677')
DIM       = colors.HexColor('#888899')
PURPLE    = colors.HexColor('#6b1fd9')
PURPLE_DIM= colors.HexColor('#3a1a80')
TEAL      = colors.HexColor('#0e7a5a')
CORAL     = colors.HexColor('#c0431a')
AMBER     = colors.HexColor('#9a5f00')
GREEN     = colors.HexColor('#17843a')

# ── Custom Flowables ──────────────────────────────────────────────────────────
class ColorRect(Flowable):
    def __init__(self, w, h, fill, radius=6):
        Flowable.__init__(self)
        self.w, self.h, self.fill, self.radius = w, h, fill, radius
    def draw(self):
        self.canv.setFillColor(self.fill)
        self.canv.roundRect(0, 0, self.w, self.h, self.radius, fill=1, stroke=0)

class AccentLine(Flowable):
    def __init__(self, width, color=PURPLE, thickness=2):
        Flowable.__init__(self)
        self.width, self.color, self.thickness = width, color, thickness
        self.height = thickness + 4
    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 2, self.width, self.thickness, fill=1, stroke=0)

class SectionDivider(Flowable):
    def __init__(self, label, color=PURPLE, page_width=W):
        Flowable.__init__(self)
        self.label = label
        self.color = color
        self.width = page_width - 40*mm
        self.height = 28
    def draw(self):
        c = self.canv
        c.setFillColor(self.color)
        c.roundRect(0, 0, self.width, 24, 6, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(12, 7, self.label.upper())

class Pill(Flowable):
    def __init__(self, text, bg=PURPLE, text_color=WHITE, width=None):
        Flowable.__init__(self)
        self.text = text
        self.bg = bg
        self.text_color = text_color
        self.width = width or (len(text) * 7 + 24)
        self.height = 20
    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.width, 18, 9, fill=1, stroke=0)
        c.setFillColor(self.text_color)
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(self.width / 2, 5, self.text)

# ── Styles ────────────────────────────────────────────────────────────────────
def styles():
    base = dict(fontName='Helvetica', textColor=WHITE, leading=18)
    bold = dict(fontName='Helvetica-Bold', textColor=WHITE)

    INK      = colors.HexColor('#1a1a2e')
    BODY_CLR = colors.HexColor('#333344')
    return {
        'h1': ParagraphStyle('h1', fontSize=32, leading=38, textColor=INK,
                              fontName='Helvetica-Bold', spaceAfter=4),
        'h2': ParagraphStyle('h2', fontSize=20, leading=26, textColor=INK,
                              fontName='Helvetica-Bold', spaceAfter=6, spaceBefore=12),
        'h3': ParagraphStyle('h3', fontSize=14, leading=20, textColor=PURPLE,
                              fontName='Helvetica-Bold', spaceAfter=4, spaceBefore=8),
        'h4': ParagraphStyle('h4', fontSize=12, leading=17, textColor=INK,
                              fontName='Helvetica-Bold', spaceAfter=3),
        'body': ParagraphStyle('body', fontSize=10, leading=16, textColor=BODY_CLR,
                                fontName='Helvetica', spaceAfter=6),
        'small': ParagraphStyle('small', fontSize=9, leading=14, textColor=MUTED,
                                 fontName='Helvetica'),
        'mono': ParagraphStyle('mono', fontSize=9, leading=14, textColor=colors.HexColor('#1a4d1a'),
                                fontName='Courier', backColor=colors.HexColor('#f0f4f0'),
                                leftIndent=8, spaceAfter=6, spaceBefore=4),
        'mono_label': ParagraphStyle('mono_label', fontSize=8, leading=12, textColor=MUTED,
                                      fontName='Courier'),
        'label': ParagraphStyle('label', fontSize=8, leading=12, textColor=MUTED,
                                 fontName='Helvetica-Bold', spaceAfter=2,
                                 letterSpacing=0.8),
        'tag': ParagraphStyle('tag', fontSize=9, leading=13, textColor=PURPLE,
                               fontName='Helvetica-Bold'),
        'white_bold': ParagraphStyle('wb', fontSize=10, leading=15, textColor=INK,
                                      fontName='Helvetica-Bold'),
        'muted': ParagraphStyle('muted', fontSize=9, leading=14, textColor=MUTED,
                                 fontName='Helvetica'),
        'subtitle': ParagraphStyle('subtitle', fontSize=14, leading=20,
                                    textColor=colors.HexColor('#6b1fd9'),
                                    fontName='Helvetica', spaceAfter=8),
        'cover_sub': ParagraphStyle('cs', fontSize=12, leading=18,
                                     textColor=colors.HexColor('#555566'),
                                     fontName='Helvetica'),
    }

S = styles()

# ── Page background ───────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # subtle purple tint top-right
    canvas.setFillColor(colors.HexColor('#ede8fa'))
    canvas.circle(W, H, 160, fill=1, stroke=0)
    # footer
    canvas.setFillColor(DIM)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(20*mm, 12*mm, 'SongSide — Build Plan')
    canvas.drawRightString(W - 20*mm, 12*mm, f'Page {doc.page}')
    # footer line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 16*mm, W - 20*mm, 16*mm)
    canvas.restoreState()

# ── Card helper ───────────────────────────────────────────────────────────────
def card(rows, col_widths, bg=CARD, border=BORDER):
    t = Table(rows, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('ROUNDEDCORNERS', [8]),
        ('BOX', (0,0), (-1,-1), 0.5, border),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [bg]),
        ('LEFTPADDING',  (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING',   (0,0), (-1,-1), 8),
        ('BOTTOMPADDING',(0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def two_col_card(left_content, right_content, lw=85*mm, rw=85*mm):
    return card([[left_content, right_content]], [lw, rw])

# ── Content builders ──────────────────────────────────────────────────────────
def cover_page(story):
    story.append(Spacer(1, 30*mm))
    # big purple bar
    story.append(AccentLine(W - 40*mm, PURPLE, 3))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph('SongSide', S['h1']))
    story.append(Paragraph('Build Plan — Scratch to Publishable Product', S['subtitle']))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        'A complete technical and product roadmap for building a macOS Spotify '
        'companion app with live lyrics, AI-powered features, and album color theming.',
        S['cover_sub']))
    story.append(Spacer(1, 10*mm))

    # meta pills row
    pills = Table([[
        Pill('macOS', PURPLE),
        Pill('Electron + React', colors.HexColor('#1a1a3a')),
        Pill('Spotify API', GREEN),
        Pill('Gemini AI', CORAL),
        Pill('$7–9 one-time', AMBER),
    ]], colWidths=[40*mm, 52*mm, 44*mm, 44*mm, 44*mm])
    pills.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(pills)
    story.append(Spacer(1, 12*mm))

    # key numbers
    nums = Table([
        [
            Paragraph('4 weeks', S['h2']),
            Paragraph('3', S['h2']),
            Paragraph('$0', S['h2']),
            Paragraph('$7–9', S['h2']),
        ],
        [
            Paragraph('to v1 launch', S['muted']),
            Paragraph('AI features', S['muted']),
            Paragraph('build cost', S['muted']),
            Paragraph('price point', S['muted']),
        ]
    ], colWidths=[45*mm]*4)
    nums.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [8]),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0,1), (-1,1), MUTED),
    ]))
    story.append(nums)
    story.append(Spacer(1, 12*mm))
    story.append(Paragraph('Prepared for Prateek · June 2026', S['small']))
    story.append(PageBreak())


def toc_page(story):
    story.append(SectionDivider('Table of Contents', PURPLE))
    story.append(Spacer(1, 6*mm))

    sections = [
        ('01', 'Product Vision & Core Features', '3'),
        ('02', 'Tech Stack Decision', '4'),
        ('03', 'Folder Structure', '5'),
        ('04', 'Week 1 — Foundation', '6'),
        ('05', 'Week 2 — Core Features', '7'),
        ('06', 'Week 3 — AI Integration', '9'),
        ('07', 'Week 4 — Polish & Ship', '11'),
        ('08', 'API Reference & Keys', '12'),
        ('09', 'Revenue & Distribution', '13'),
        ('10', 'Post-Launch Growth', '14'),
    ]

    for num, title, pg in sections:
        row = Table([[
            Paragraph(f'<font color="#7b2ff7">{num}</font>', S['white_bold']),
            Paragraph(title, S['body']),
            Paragraph(pg, S['muted']),
        ]], colWidths=[18*mm, 130*mm, 20*mm])
        row.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LINEBELOW', (0,0), (-1,-1), 0.3, BORDER),
            ('ALIGN', (2,0), (2,0), 'RIGHT'),
        ]))
        story.append(row)

    story.append(PageBreak())


def section_01(story):
    story.append(SectionDivider('01 — Product Vision & Core Features', PURPLE))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('What SongSide does', S['h2']))
    story.append(Paragraph(
        'SongSide is a macOS menubar app that reacts to your Spotify in real time — '
        'showing the current lyric as a floating overlay and shifting your desktop '
        'color to match the album art, all while you stay in whatever you\'re doing. '
        'No window switching. No clicking. Your desktop becomes aware of your music.',
        S['body']))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph('The two core features', S['h3']))

    feat = Table([
        [
            [
                Paragraph('LYRIC OVERLAY', S['label']),
                Paragraph('Live synced lyrics', S['h4']),
                Paragraph(
                    'A frosted glass pill floats at the screen edge showing the current '
                    'lyric line, synced word-by-word from LRCLIB. Previous and next lines '
                    'fade at reduced opacity. Compact mode shows only one line — '
                    'a subtitle for your life while you code.',
                    S['body']),
            ],
            [
                Paragraph('COLOR THEMING', S['label']),
                Paragraph('Desktop reacts to album art', S['h4']),
                Paragraph(
                    'When the song changes, ColorThief extracts the dominant color '
                    'from the album art. The menubar accent, overlay tint, and glow '
                    'all shift to match. Purple album → purple atmosphere. '
                    'Red album → red. Happens in under one second.',
                    S['body']),
            ],
        ]
    ], colWidths=[85*mm, 85*mm])
    feat.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD),
        ('BOX', (0,0), (0,-1), 0.5, BORDER),
        ('BOX', (1,0), (1,-1), 0.5, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LINEAFTER', (0,0), (0,-1), 0.5, BORDER),
    ]))
    story.append(feat)
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph('Why people pay for this', S['h3']))
    story.append(Paragraph(
        'Spotify has lyrics. Apple Music has lyrics. But neither makes your '
        'entire desktop environment react to the music — ambient, automatic, '
        'always running. The value is the feeling of a desktop that\'s alive. '
        'That\'s what gets screenshotted, posted, and shared.',
        S['body']))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('One-line pitch', S['h3']))
    pitch = Table([[
        Paragraph(
            '"Your desktop changes color and shows the current lyric every time '
            'your song changes — automatically, while you stay in whatever you\'re doing."',
            ParagraphStyle('pitch', fontSize=11, leading=18, textColor=colors.HexColor('#4a0fa8'),
                           fontName='Helvetica-Bold', leftIndent=8))
    ]], colWidths=[170*mm])
    pitch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0ebfe')),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LINEBEFORE', (0,0), (0,-1), 3, PURPLE),
    ]))
    story.append(pitch)
    story.append(PageBreak())


def section_02(story):
    story.append(SectionDivider('02 — Tech Stack Decision', TEAL))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Why Electron + React', S['h2']))
    story.append(Paragraph(
        'You need a transparent always-on-top overlay, native macOS vibrancy, '
        'and access to system APIs. Electron gives you all of this with a web stack '
        'you already know. Swift would be faster but takes 3x longer to build.',
        S['body']))
    story.append(Spacer(1, 4*mm))

    stack = [
        ('Layer', 'Technology', 'Why', 'Cost'),
        ('Desktop shell', 'Electron 30', 'Transparent windows, always-on-top, tray icon', 'Free'),
        ('UI', 'React 18 + Vite', 'Fast dev, hot reload, component model', 'Free'),
        ('Styling', 'Tailwind CSS', 'Utility classes, dark mode, no CSS bloat', 'Free'),
        ('Animation', 'Framer Motion', 'Smooth lyric transitions, song change effects', 'Free'),
        ('Spotify', 'Spotify Web API', 'Current track, album art, audio features', 'Free tier'),
        ('Lyrics', 'LRCLIB', 'Synced LRC format, no rate limits, no key needed', 'Free'),
        ('Color', 'ColorThief (node)', 'Extract dominant color from album art buffer', 'Free'),
        ('AI', 'Gemini Flash 2.0', 'Lyric meaning, mood detection, weekly digest', 'Free tier'),
        ('Packaging', 'electron-builder', 'DMG, auto-update, code signing', 'Free'),
        ('Payments', 'Gumroad', 'One-time purchase, instant payout, no setup', '10% fee'),
    ]

    col_w = [38*mm, 38*mm, 70*mm, 22*mm]
    rows = []
    for i, row in enumerate(stack):
        style = S['label'] if i == 0 else S['body']
        mstyle = S['label'] if i == 0 else S['muted']
        rows.append([
            Paragraph(row[0], style),
            Paragraph(row[1], S['tag'] if i > 0 else S['label']),
            Paragraph(row[2], style),
            Paragraph(row[3], mstyle),
        ])

    t = Table(rows, colWidths=col_w)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PURPLE),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('BACKGROUND', (0,1), (-1,-1), CARD),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [CARD, colors.HexColor('#e8e8f0')]),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t)
    story.append(PageBreak())


def section_03(story):
    story.append(SectionDivider('03 — Folder Structure', CORAL))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Project layout', S['h2']))
    story.append(Paragraph(
        'This structure separates the Electron main process (Node.js, system access) '
        'from the React renderer process (UI). Never call Spotify API from the renderer — '
        'always go through the main process via IPC.',
        S['body']))
    story.append(Spacer(1, 3*mm))

    tree = """songside/
├── package.json
├── electron.vite.config.js
├── src/
│   ├── main/                    ← Electron main process (Node.js)
│   │   ├── index.js             ← App entry, window creation
│   │   ├── tray.js              ← Menubar tray icon
│   │   ├── overlay.js           ← Transparent always-on-top window
│   │   ├── spotify.js           ← Spotify API polling + auth
│   │   ├── lyrics.js            ← LRCLIB fetch + sync engine
│   │   ├── color.js             ← ColorThief extraction
│   │   ├── gemini.js            ← All Gemini API calls
│   │   └── store.js             ← electron-store (settings persistence)
│   ├── renderer/                ← React UI
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Overlay.jsx      ← The floating lyric pill
│   │   │   ├── Sidebar.jsx      ← Full sidebar panel
│   │   │   ├── LyricLine.jsx    ← Single lyric line + hover
│   │   │   ├── MoodPill.jsx     ← AI mood badge
│   │   │   └── Settings.jsx     ← User preferences
│   │   └── hooks/
│   │       ├── useTrack.js      ← Current track state
│   │       ├── useLyrics.js     ← Synced lyrics state
│   │       └── useColor.js      ← Album color state
│   └── preload/
│       └── index.js             ← IPC bridge (main ↔ renderer)
├── assets/
│   └── icon.png
└── build/                       ← electron-builder output"""

    story.append(Paragraph(tree.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph('The IPC rule', S['h3']))
    story.append(Paragraph(
        'The renderer (React) cannot directly call Spotify or Gemini APIs — '
        'it communicates through the preload bridge using ipcRenderer.invoke(). '
        'The main process handles all external calls and pushes updates back via ipcMain.emit(). '
        'This keeps API keys out of the renderer and the UI responsive.',
        S['body']))
    story.append(PageBreak())


def section_04(story):
    story.append(SectionDivider('04 — Week 1: Foundation', PURPLE))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Goal: Spotify auth + floating overlay on screen', S['h2']))

    days = [
        ('Day 1', 'Project scaffolding', PURPLE,
         'electron-vite', [
             'npm create @quick-start/electron songside',
             'Add React, Tailwind, Framer Motion',
             'Set up electron-builder config',
             'Create the transparent overlay window',
         ]),
        ('Day 2', 'Spotify OAuth', TEAL,
         'spotify.js', [
             'Register app at developer.spotify.com',
             'Implement PKCE auth flow (no backend needed)',
             'Store token in electron-store',
             'Poll /me/player/currently-playing every 1s',
         ]),
        ('Day 3', 'Album color engine', CORAL,
         'color.js', [
             'Fetch album art as buffer (not URL)',
             'Run ColorThief.getColor() on buffer',
             'Convert RGB → HSL, boost saturation by 20%',
             'Emit color-change event to renderer via IPC',
         ]),
        ('Day 4', 'Overlay UI', AMBER,
         'Overlay.jsx', [
             'Transparent BrowserWindow, alwaysOnTop: true',
             'Frosted glass via CSS backdrop-filter',
             'Show song name, artist, album art thumbnail',
             'Animate in on song change with Framer Motion',
         ]),
        ('Day 5', 'Tray icon + settings', colors.HexColor('#555555'),
         'tray.js', [
             'Menubar tray icon (system tray)',
             'Right-click menu: show/hide, quit, preferences',
             'Settings window: position, opacity, compact mode',
             'Persist settings with electron-store',
         ]),
    ]

    for day, title, color, file_label, tasks in days:
        story.append(KeepTogether([
            Paragraph(f'<font color="#{color.hexval()[2:]}">{day}</font> — {title}', S['h3']),
        ]))

        task_rows = [[
            Paragraph(f'• {t}', S['body'])
        ] for t in tasks]
        task_rows.append([Paragraph(f'Key file: {file_label}', S['mono_label'])])

        t = Table(task_rows, colWidths=[168*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), CARD),
            ('LEFTPADDING', (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LINEBEFORE', (0,0), (0,-1), 3, color),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#111111')),
        ]))
        story.append(t)
        story.append(Spacer(1, 3*mm))

    story.append(Paragraph('End of Week 1 checkpoint', S['h3']))
    story.append(Paragraph(
        'You should be able to open Spotify, play a song, and see a floating glass pill '
        'appear on your screen with the song name and a color-matched accent. '
        'This is already more than most "Now Playing" widgets do.',
        S['body']))
    story.append(PageBreak())


def section_05(story):
    story.append(SectionDivider('05 — Week 2: Core Features', TEAL))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Goal: Live synced lyrics + polished UI', S['h2']))

    story.append(Paragraph('The lyrics engine', S['h3']))
    story.append(Paragraph(
        'LRCLIB returns lyrics in LRC format — timestamps with lyric lines. '
        'Your sync engine polls the current playback position and finds the '
        'matching line. This is the heart of the app.',
        S['body']))

    story.append(Paragraph('LRC format example', S['label']))
    lrc = """[00:14.20] I thought I'd feel better
[00:17.80] But I just feel worse
[00:21.40] I gave you all of me
[00:24.90] My blood, my sweat, my heart"""
    story.append(Paragraph(lrc.replace('\n', '<br/>'), S['mono']))

    story.append(Paragraph('Sync engine logic (lyrics.js)', S['h3']))
    code = """// Parse LRC into array of { time: ms, text: string }
function parseLRC(lrc) {
  return lrc.split('\\n')
    .map(line => {
      const match = line.match(/\\[(\\d+):(\\d+\\.\\d+)\\](.*)/);
      if (!match) return null;
      const [, min, sec, text] = match;
      return { time: (parseInt(min)*60 + parseFloat(sec)) * 1000,
               text: text.trim() };
    })
    .filter(Boolean);
}

// Find active line from playback position
function getActiveLine(lines, positionMs) {
  let active = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= positionMs) active = i;
  }
  return active; // return index, show [i-1, i, i+1]
}

// Poll every 500ms (not 1s — feels snappier)
setInterval(async () => {
  const pos = await spotify.getPosition();
  const idx = getActiveLine(parsedLines, pos);
  mainWindow.webContents.send('lyric-update', {
    prev: lines[idx-1], active: lines[idx], next: lines[idx+1]
  });
}, 500);"""
    story.append(Paragraph(code.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))

    story.append(Paragraph('UI polish checklist', S['h3']))
    checks = [
        'Lyric line transition: opacity + translateY, 300ms ease',
        'Song change: overlay slides in from right, 400ms spring',
        'Color change: CSS transition on background-color, 800ms',
        'Compact mode: single line, smaller pill, lower opacity',
        'Auto-hide: fade out after 5s of inactivity (hover to persist)',
        'Position: user-configurable (top/bottom, left/right edge)',
        'Font: SF Pro via -apple-system (native macOS font, free)',
        'Glass: backdrop-filter: blur(20px) + rgba background',
    ]
    for c in checks:
        story.append(Paragraph(f'  ✓  {c}', S['body']))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('The color engine in detail', S['h3']))
    story.append(Paragraph(
        'Raw ColorThief output is often muddy. Run these transforms before applying:', S['body']))

    transforms = [
        ('Boost saturation', 'Multiply S in HSL by 1.3, clamp at 90%'),
        ('Floor brightness', 'If L < 25%, set L = 35% (dark colors wash out)'),
        ('Ceiling brightness', 'If L > 75%, set L = 65% (pale colors look washed)'),
        ('Store in state', 'Emit via IPC, apply to CSS variable --album-color'),
    ]
    t = Table([[Paragraph(k, S['white_bold']), Paragraph(v, S['body'])]
               for k, v in transforms],
              colWidths=[50*mm, 120*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(PageBreak())


def section_06(story):
    story.append(SectionDivider('06 — Week 3: AI Integration', colors.HexColor('#D85A30')))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Goal: Three Gemini features that justify the price', S['h2']))
    story.append(Paragraph(
        'All three AI features use Gemini Flash 2.0 via the Google AI Studio free tier. '
        'Total API cost at 1000 daily users: approximately $0 — well within free limits. '
        'Keep your key in the main process only, never the renderer.',
        S['body']))
    story.append(Spacer(1, 4*mm))

    # Feature 1
    story.append(Paragraph('Feature 1 — Lyric meaning on hover', S['h3']))
    story.append(Paragraph(
        'User hovers over any lyric line. After 600ms (debounced), a tooltip appears '
        'below the line with a 2-sentence explanation. Cache results in a Map keyed '
        'by lyric text so repeated hovers don\'t re-call the API.',
        S['body']))

    story.append(Paragraph('Prompt (gemini.js)', S['label']))
    prompt1 = """const lyricMeaningPrompt = (song, artist, lyric) => `
Song: "${song}" by ${artist}
Lyric: "${lyric}"

In exactly 2 sentences, explain what this lyric means emotionally.
Be specific to this song and artist. No fluff. No "this lyric...".
Start directly with the explanation.
`;"""
    story.append(Paragraph(prompt1.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))

    story.append(Paragraph('API call pattern', S['label']))
    code1 = """const cache = new Map();

async function getLyricMeaning(song, artist, lyric) {
  const key = `${song}::${lyric}`;
  if (cache.has(key)) return cache.get(key);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: lyricMeaningPrompt(song, artist, lyric) }] }],
        generationConfig: { maxOutputTokens: 80 }
      })
    }
  );
  const data = await response.json();
  const meaning = data.candidates[0].content.parts[0].text;
  cache.set(key, meaning);
  return meaning;
}"""
    story.append(Paragraph(code1.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))
    story.append(Spacer(1, 4*mm))

    # Feature 2
    story.append(Paragraph('Feature 2 — Mood detection on song change', S['h3']))
    story.append(Paragraph(
        'On every track change, send the song metadata to Gemini. Get back a structured '
        'JSON with mood, color hex, and intensity. Use this to drive the color engine '
        'when album art extraction produces a muddy result.',
        S['body']))

    prompt2 = """const moodPrompt = (song, artist, tempo, energy, valence) => `
Song: "${song}" by ${artist}
Spotify audio features: tempo=${tempo}BPM, energy=${energy}, valence=${valence}

Return ONLY a JSON object, no other text:
{
  "mood": "one word (e.g. melancholic, euphoric, tense, dreamy, raw)",
  "color_hex": "#xxxxxx",
  "intensity": 1-10
}
`;"""
    story.append(Paragraph(prompt2.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))
    story.append(Spacer(1, 4*mm))

    # Feature 3
    story.append(Paragraph('Feature 3 — Weekly listening digest', S['h3']))
    story.append(Paragraph(
        'Run a cron job every Sunday at 8pm. Read the listening log from electron-store '
        '(songs played, timestamps, durations). Send a summary to Gemini. Display the '
        'returned narrative paragraph in a notification and in the settings panel.',
        S['body']))

    prompt3 = """const digestPrompt = (log) => `
Here is a user's Spotify listening log for the past 7 days:
${JSON.stringify(log, null, 2)}

Write a single paragraph (4-5 sentences) describing their week in music.
Be personal, specific, and a little poetic. Mention patterns you notice
(time of day, mood shifts, repeated artists). No lists. Just prose.
`;"""
    story.append(Paragraph(prompt3.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('Listening log schema (electron-store)', S['label']))
    schema = """{
  "log": [
    { "song": "vampire", "artist": "Olivia Rodrigo",
      "playedAt": 1719123456789, "durationMs": 219000 },
    ...
  ]
}"""
    story.append(Paragraph(schema.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph('Gemini API limits (free tier as of 2026)', S['h3']))
    limits = [
        ('Model', 'Gemini Flash 2.0'),
        ('Requests per minute', '15 RPM'),
        ('Tokens per day', '1,000,000 TPD'),
        ('Cost', '$0 (free tier)'),
        ('Sufficient for', '~10,000 daily lyric hovers + mood calls'),
    ]
    t = Table([[Paragraph(k, S['white_bold']), Paragraph(v, S['body'])]
               for k, v in limits], colWidths=[70*mm, 100*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(PageBreak())


def section_07(story):
    story.append(SectionDivider('07 — Week 4: Polish & Ship', AMBER))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Goal: DMG ready to sell on Gumroad', S['h2']))

    story.append(Paragraph('Polish checklist', S['h3']))
    polish = [
        ('Onboarding', 'First launch: Spotify auth flow, position picker, compact mode toggle'),
        ('Empty states', 'No song playing → subtle animation, "Play something on Spotify"'),
        ('Error handling', 'LRCLIB miss → show song name only. API fail → silent, no crash'),
        ('Performance', 'Overlay renders at 60fps. Main process polling is off-thread'),
        ('Memory', 'Clear lyric cache after 50 entries. Limit log to 1000 entries'),
        ('Accessibility', 'Respect macOS Reduce Motion. VoiceOver label on overlay'),
    ]
    for title, desc in polish:
        story.append(Paragraph(f'<b><font color="#ffffff">{title}</font></b> — {desc}', S['body']))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('Building the DMG (electron-builder)', S['h3']))
    build_config = """// package.json build config
"build": {
  "appId": "com.yourname.songside",
  "productName": "SongSide",
  "mac": {
    "category": "public.app-category.music",
    "target": ["dmg", "zip"],
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "entitlements.mac.plist"
  },
  "dmg": {
    "background": "assets/dmg-bg.png",
    "icon": "assets/icon.icns",
    "iconSize": 80
  }
}"""
    story.append(Paragraph(build_config.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))

    story.append(Paragraph('Code signing (required for macOS distribution)', S['h3']))
    story.append(Paragraph(
        'Without signing, users get "unidentified developer" warning. '
        'You need an Apple Developer account ($99/yr) and a Developer ID certificate. '
        'Alternatively, distribute via Gumroad and tell users to right-click → Open. '
        'For v1, skip signing — add it before Product Hunt launch.',
        S['body']))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('Pre-launch checklist', S['h3']))
    launch = [
        'Build DMG with npm run build',
        'Test on a clean Mac (not your dev machine)',
        'Test with 10 different genres/albums (color extraction edge cases)',
        'Test with no internet (graceful offline mode)',
        'Test Spotify free vs premium (different API behaviour)',
        'Create Gumroad product page with screenshots + demo GIF',
        'Write README for GitHub repo',
        'Record a 30-second screen recording for Twitter post',
        'Set up a simple landing page (even a Notion page works for v1)',
    ]
    for item in launch:
        story.append(Paragraph(f'  ☐  {item}', S['body']))

    story.append(PageBreak())


def section_08(story):
    story.append(SectionDivider('08 — API Reference & Keys', colors.HexColor('#1D9E75')))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Everything you need to register and configure', S['h2']))

    apis = [
        {
            'name': 'Spotify Web API',
            'url': 'developer.spotify.com/dashboard',
            'steps': [
                '1. Create an app at developer.spotify.com',
                '2. Set redirect URI to: http://localhost:8888/callback',
                '3. Copy Client ID (you do NOT need Client Secret for PKCE)',
                '4. Request scopes: user-read-playback-state, user-read-currently-playing',
            ],
            'env': 'SPOTIFY_CLIENT_ID=your_client_id',
            'cost': 'Free. No limits on current track polling.',
            'color': GREEN,
        },
        {
            'name': 'LRCLIB (Lyrics)',
            'url': 'lrclib.net',
            'steps': [
                '1. No registration needed',
                '2. GET https://lrclib.net/api/get?artist_name=X&track_name=Y',
                '3. Returns syncedLyrics field in LRC format',
                '4. Falls back to plainLyrics if no sync available',
            ],
            'env': '# No key needed',
            'cost': 'Free. No rate limits documented.',
            'color': TEAL,
        },
        {
            'name': 'Gemini AI (Google)',
            'url': 'aistudio.google.com',
            'steps': [
                '1. Go to aistudio.google.com → Get API Key',
                '2. Create key in a new project',
                '3. Use model: gemini-2.0-flash',
                '4. Store key in .env, never commit to git',
            ],
            'env': 'GEMINI_KEY=your_api_key',
            'cost': 'Free tier: 15 RPM, 1M tokens/day. Paid: $0.075/1M tokens.',
            'color': CORAL,
        },
    ]

    for api in apis:
        story.append(Paragraph(api['name'], ParagraphStyle(
            'apiname', fontSize=13, leading=18, textColor=api['color'],
            fontName='Helvetica-Bold', spaceBefore=8, spaceAfter=4)))
        story.append(Paragraph(f"Register at: {api['url']}", S['muted']))
        for step in api['steps']:
            story.append(Paragraph(step, S['body']))
        story.append(Paragraph(api['env'], S['mono']))
        story.append(Paragraph(f"Cost: {api['cost']}", S['small']))
        story.append(Spacer(1, 3*mm))

    story.append(Paragraph('.env file template', S['h3']))
    env = """# .env (never commit this file — add to .gitignore)
SPOTIFY_CLIENT_ID=your_spotify_client_id
GEMINI_KEY=your_gemini_api_key

# Load in main process with:
# import 'dotenv/config' at top of main/index.js"""
    story.append(Paragraph(env.replace('\n', '<br/>').replace(' ', '&nbsp;'), S['mono']))
    story.append(PageBreak())


def section_09(story):
    story.append(SectionDivider('09 — Revenue & Distribution', AMBER))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('How to make money from this', S['h2']))

    story.append(Paragraph('Pricing model', S['h3']))
    story.append(Paragraph(
        'One-time purchase. No subscription. People do not subscribe to menubar widgets. '
        'Look at every successful Mac utility — Lungo, Hand Mirror, Pockity, Silenz. '
        'All one-time. Your price: $8.',
        S['body']))

    pricing = [
        ('Free tier', 'Lyric overlay + basic color theme', 'No limit', 'Acquisition'),
        ('SongSide Pro — $8', 'AI lyric meaning + mood detection + weekly digest', 'One-time', 'Revenue'),
    ]
    t = Table(
        [[Paragraph('Tier', S['label']), Paragraph('Features', S['label']),
          Paragraph('Payment', S['label']), Paragraph('Purpose', S['label'])]] +
        [[Paragraph(r[0], S['white_bold']), Paragraph(r[1], S['body']),
          Paragraph(r[2], S['body']), Paragraph(r[3], S['muted'])] for r in pricing],
        colWidths=[45*mm, 80*mm, 30*mm, 30*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PURPLE),
        ('BACKGROUND', (0,1), (-1,-1), CARD),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#111111'), CARD]),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(t)
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph('Gumroad setup', S['h3']))
    gumroad_steps = [
        'Create account at gumroad.com',
        'New Product → Digital → upload DMG',
        'Set price to $8, enable "Pay what you want" with $8 minimum',
        'Add screenshots: the desktop color shift is your hero image',
        'Add a 30-second GIF showing the lyric + color changing',
        'Connect Stripe or PayPal for Indian payouts',
        'Gumroad takes 10% — you keep $7.20 per sale',
    ]
    for step in gumroad_steps:
        story.append(Paragraph(f'  →  {step}', S['body']))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('Revenue projections (realistic)', S['h3']))

    proj = [
        ('GitHub trending (1 day)', '500 visitors', '2% conversion', '10 sales', '~$72'),
        ('Product Hunt launch', '2,000 visitors', '1.5% conversion', '30 sales', '~$216'),
        ('Twitter/X viral post', '5,000 visitors', '1% conversion', '50 sales', '~$360'),
        ('Steady state (monthly)', '200 visitors', '2% conversion', '4 sales', '~$29/mo'),
    ]
    t2 = Table(
        [[Paragraph(h, S['label']) for h in ['Event', 'Traffic', 'Rate', 'Sales', 'Revenue']]] +
        [[Paragraph(r[i], S['body'] if i > 0 else S['white_bold']) for i in range(5)] for r in proj],
        colWidths=[45*mm, 33*mm, 33*mm, 25*mm, 30*mm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SURFACE),
        ('BACKGROUND', (0,1), (-1,-1), CARD),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.3, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TEXTCOLOR', (-1,1), (-1,-1), GREEN),
    ]))
    story.append(t2)
    story.append(PageBreak())


def section_10(story):
    story.append(SectionDivider('10 — Post-Launch Growth', colors.HexColor('#1D9E75')))
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('How to get your first 100 users', S['h2']))

    story.append(Paragraph('Launch sequence', S['h3']))
    sequence = [
        ('Day 0', 'Post on GitHub', 'Public repo with a beautiful README. '
         'GIF showing the color shift. Clear install instructions. '
         'This is your permanent link for all future shares.'),
        ('Day 1', 'Twitter/X post', 'Screen record your desktop — song changes, '
         'color shifts, lyric appears. No text overlay, just the raw effect. '
         'Caption: "built a thing that makes your mac react to spotify". '
         'Tag #buildinpublic #MacApp.'),
        ('Day 3', 'Reddit', 'Post to r/macapps, r/apple, r/spotify. '
         'Show the GIF. Be genuine — "I built this for myself and thought others might like it."'),
        ('Week 2', 'Product Hunt', 'Schedule for a Tuesday 12:01am PST launch. '
         'Ask 10 friends to upvote at launch. Write a real maker story.'),
        ('Month 2', 'Dev Twitter DMs', 'Find developers who post their coding setups. '
         'Send genuine DMs: "Made something for your setup." No spam.'),
    ]

    for day, platform, desc in sequence:
        story.append(KeepTogether([
            Table([[
                Paragraph(day, S['tag']),
                Paragraph(platform, S['white_bold']),
                Paragraph(desc, S['body']),
            ]], colWidths=[20*mm, 32*mm, 116*mm]),
        ]))
        story.append(Spacer(1, 2*mm))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('The viral moment to engineer', S['h3']))

    viral = Table([[
        Paragraph(
            'Record a 15-second screen video of your desktop. A song is playing. '
            'It changes — and the entire desktop shifts color. The lyric fades in. '
            'No explanation. No voiceover. Just the effect.\n\n'
            'Post with caption: "made my mac react to spotify 🎵"\n\n'
            'This is what gets 10,000 impressions. Not the feature list.',
            ParagraphStyle('viral_body', fontSize=10, leading=16,
                           textColor=colors.HexColor('#333344'), fontName='Helvetica'))
    ]], colWidths=[168*mm])
    viral.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0ebfe')),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LINEBEFORE', (0,0), (0,-1), 3, PURPLE),
    ]))
    story.append(viral)

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('V2 features (only after 50 users say they want it)', S['h3']))
    v2 = [
        'Karaoke mode — word-by-word highlight within the line',
        'Translation — show original + English below for K-pop, J-pop',
        'Listening stats dashboard — weekly heatmap, top artists',
        'Discord rich presence — show current song in Discord status',
        'Custom themes — save and share your own color palettes',
    ]
    for f in v2:
        story.append(Paragraph(f'  ○  {f}', S['body']))

    story.append(Spacer(1, 8*mm))
    story.append(AccentLine(W - 40*mm, PURPLE, 2))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        'Build the lyric overlay first. Make the color shift feel magical. '
        'Ship it in 4 weeks. Add AI. Post the GIF. The rest follows.',
        ParagraphStyle('final', fontSize=12, leading=20, textColor=colors.HexColor('#4a0fa8'),
                       fontName='Helvetica-Bold', alignment=TA_CENTER)))


# ── Main ──────────────────────────────────────────────────────────────────────
def build():
    path = 'SongSide_Build_Plan.pdf'
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=22*mm,
    )

    story = []
    cover_page(story)
    toc_page(story)
    section_01(story)
    section_02(story)
    section_03(story)
    section_04(story)
    section_05(story)
    section_06(story)
    section_07(story)
    section_08(story)
    section_09(story)
    section_10(story)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'PDF written to {path}')

build()