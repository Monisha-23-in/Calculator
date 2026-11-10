# SmartCalc Pro — Modern Smart Calculator Web Application

A modern, responsive, high-performance calculator web application built with **HTML5, CSS3, and Vanilla JavaScript**. Featuring a dark/light glassmorphic UI, real-time calculation preview, complete keyboard navigation, tactile synthesized audio feedback, calculation history tracking, and a safe mathematical parser that adheres to standard operator precedence without using JavaScript's `eval()`.

---

## ✨ Key Features

### 1. 🎨 Visual Design & UI/UX
- **Glassmorphic Aesthetic**: Translucent glass layers with `backdrop-filter: blur(20px)`, subtle specular borders, and multi-layer depth shadows.
- **Ambient Lighting**: Radial glowing gradients that smoothly react and transition between light and dark themes.
- **Dark & Light Mode**: Seamless theme switching with persistent memory in `localStorage`.
- **Modern Typography**: Clear digital readout using Google Fonts (`JetBrains Mono` for numbers and `Outfit` for controls).
- **Responsive Layout**: Designed for mobile screens (down to 320px), tablets, and desktop displays.

### 2. 🧮 Mathematical Engine (Zero `eval()`)
- **Safe Evaluation**: Custom tokenizer and Shunting-Yard algorithm to parse infix expressions into Reverse Polish Notation (RPN).
- **Operator Precedence**: Correct BODMAS/PEMDAS execution order (`×` and `÷` evaluated before `+` and `−`).
- **Real-Time Live Preview**: Computes and displays intermediate results dynamically as expressions are typed.
- **Continuous Calculations**: Chain previous answers seamlessly into next operations without retyping.
- **Standard Percentage Logic**:
  - `100 + 10%` = `110`
  - `200 × 15%` = `30`
  - `50%` = `0.5`
- **Sign Toggle (+/-)**: Context-aware negation wrapping expressions cleanly as `(-N)`.
- **Floating-Point Precision Fix**: Automatically eliminates binary IEEE 754 float inaccuracies (e.g. `0.1 + 0.2` = `0.3`).
- **Comprehensive Error Handling**: Detects division by zero and malformed syntax with a shake animation and non-breaking friendly messages.

### 3. ⌨️ Complete Keyboard Support
Every calculator operation has a corresponding physical keyboard shortcut:

| Key | Operation |
| :--- | :--- |
| `0` – `9` | Number input |
| `.` | Decimal point |
| `+` | Addition |
| `-` | Subtraction |
| `*` | Multiplication (`×`) |
| `/` | Division (`÷`) |
| `%` | Percentage |
| `Enter` or `=` | Calculate result |
| `Backspace` | Delete last entered character (`DEL`) |
| `Escape` or `Delete` | All Clear (`AC`) |

*Note: Pressing physical keyboard keys triggers the exact same active press animation on the virtual calculator keypad for visual feedback.*

### 4. 📜 Calculation History
- Tracks recent calculations with equations, results, and timestamps.
- **Click-to-Recall**: Click or press `Enter` on any history item to reload it directly into the calculator display.
- **History Clear**: Easily wipe history with a single click.
- Persisted locally across browser sessions using `localStorage`.

### 5. 🔊 Synthesized Audio Tactile Feedback
- Uses the **Web Audio API** to generate crisp, haptic-like clicks (different resonant frequencies for numbers, operators, clear, and equals chimes).
- Zero external audio files or downloads required.
- Easily muted/unmuted via the sound toggle in the header.

### 6. 📋 One-Click Result Copy
- Dedicated copy button with tooltip and toast notifications to copy results directly to the system clipboard.

---

## 📁 Project Structure

```
├── index.html        # Semantic HTML5 markup, SVG icons, and accessible layout
├── style.css         # Modern CSS3 with custom properties, glassmorphism, animations
├── script.js         # Modular Vanilla JavaScript with safe math engine & state manager
└── README.md         # Comprehensive project documentation
```

---

## 🚀 How to Run

1. Clone or download this project folder.
2. Double-click or open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari, Brave, Opera).
3. No build tools, package managers, or server setup required!
