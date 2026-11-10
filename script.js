/**
 * ============================================================================
 * SmartCalc Pro - Modern Smart Calculator Application
 * ============================================================================
 * Vanilla JavaScript implementation featuring:
 * - Custom Safe Mathematical Parser & Evaluator (Zero eval() usage)
 * - Shunting-Yard Infix to Reverse Polish Notation (RPN) Algorithm
 * - Standard Operator Precedence (BODMAS/PEMDAS)
 * - Real-Time Live Preview Calculation
 * - Continuous Chained Calculations & Sign Toggling
 * - Complete Physical Keyboard Support with Visual Keypress Feedback
 * - Calculation History with LocalStorage Persistence & Recall
 * - Dark & Light Glassmorphic Theme Toggle
 * - Synthesized Audio Tactile Feedback using Web Audio API
 * - Comprehensive Error Handling (Zero Division, Precision, Syntax)
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // DOM Elements
  // --------------------------------------------------------------------------
  const htmlElement = document.documentElement;
  const currentDisplay = document.getElementById('currentExpression');
  const previousDisplay = document.getElementById('previousExpression');
  const livePreview = document.getElementById('livePreview');
  const calculatorDisplay = document.getElementById('calculatorDisplay');
  const keypad = document.querySelector('.calculator-keypad');
  
  // Header / Control buttons
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const sunIcon = document.getElementById('sunIcon');
  const moonIcon = document.getElementById('moonIcon');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIconOn = document.getElementById('soundIconOn');
  const soundIconOff = document.getElementById('soundIconOff');
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const historyPanel = document.getElementById('historyPanel');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const historyCountBadge = document.getElementById('historyCount');
  const copyBtn = document.getElementById('copyBtn');
  const copyTooltip = document.getElementById('copyTooltip');
  const toast = document.getElementById('toast');

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    expression: '0',        // Raw current display expression
    previousExpression: '', // Evaluated previous line
    lastResult: null,       // Last calculated numeric value
    isCalculated: false,    // True right after pressing '='
    isError: false,         // True if in error state
    soundEnabled: true,     // Web Audio sound toggle
    theme: 'dark',          // 'dark' | 'light'
    history: []             // Array of calculation records
  };

  // --------------------------------------------------------------------------
  // Web Audio Tactile Feedback Synthesizer
  // --------------------------------------------------------------------------
  class AudioHaptic {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(type = 'number') {
      if (!state.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        switch (type) {
          case 'number':
            // Crisp soft click (650Hz down to 250Hz in 35ms)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(650, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.035);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
            osc.start(now);
            osc.stop(now + 0.04);
            break;

          case 'operator':
            // Higher bright chime (880Hz down to 440Hz in 45ms)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.045);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            osc.start(now);
            osc.stop(now + 0.05);
            break;

          case 'equals':
            // Rewarding dual harmonic chime
            this.playChord([523.25, 659.25, 783.99], now, 0.12);
            return;

          case 'clear':
          case 'delete':
            // Soft lower pop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.045);
            break;

          case 'error':
            // Minor buzz
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(120, now + 0.15);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.16);
            break;
        }
      } catch (err) {
        // Silently ignore audio context blockages
      }
    }

    playChord(freqs, start, duration) {
      if (!this.ctx) return;
      freqs.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.01);
      });
    }
  }

  const audioHaptic = new AudioHaptic();

  // --------------------------------------------------------------------------
  // Mathematical Expression Parser & Evaluator (No eval())
  // --------------------------------------------------------------------------
  const MathEngine = {
    // Standard Operator Precedence Table
    operators: {
      '+': { precedence: 1, associativity: 'L' },
      '−': { precedence: 1, associativity: 'L' },
      '-': { precedence: 1, associativity: 'L' },
      '×': { precedence: 2, associativity: 'L' },
      '*': { precedence: 2, associativity: 'L' },
      '÷': { precedence: 2, associativity: 'L' },
      '/': { precedence: 2, associativity: 'L' },
      'neg': { precedence: 3, associativity: 'R' } // Unary negation
    },

    /**
     * Clean and normalize raw expression string into standardized tokens
     */
    tokenize(rawStr) {
      if (!rawStr || typeof rawStr !== 'string') return [];

      // Normalize operators: replace visual glyphs with standard arithmetic symbols
      let str = rawStr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .trim();

      const tokens = [];
      let i = 0;

      while (i < str.length) {
        const char = str[i];

        // Skip whitespace
        if (char === ' ') {
          i++;
          continue;
        }

        // Numbers (integers and decimals)
        if (/\d/.test(char) || (char === '.' && (i + 1 < str.length && /\d/.test(str[i + 1])))) {
          let numStr = '';
          while (i < str.length && (/[\d.]/.test(str[i]))) {
            numStr += str[i];
            i++;
          }
          tokens.push({ type: 'number', value: parseFloat(numStr) });
          continue;
        }

        // Parentheses
        if (char === '(' || char === ')') {
          tokens.push({ type: 'paren', value: char });
          i++;
          continue;
        }

        // Percentage symbol
        if (char === '%') {
          tokens.push({ type: 'percent', value: '%' });
          i++;
          continue;
        }

        // Minus sign: could be binary subtraction or unary negation
        if (char === '-') {
          const prev = tokens[tokens.length - 1];
          const isUnary = !prev || prev.type === 'operator' || (prev.type === 'paren' && prev.value === '(');

          if (isUnary) {
            tokens.push({ type: 'operator', value: 'neg' });
          } else {
            tokens.push({ type: 'operator', value: '-' });
          }
          i++;
          continue;
        }

        // Binary Operators (+, *, /)
        if (['+', '*', '/'].includes(char)) {
          tokens.push({ type: 'operator', value: char });
          i++;
          continue;
        }

        // Unknown character - skip safely
        i++;
      }

      return this.resolvePercentages(tokens);
    },

    /**
     * Standard human calculator percentage resolution:
     * - In 'A + B%': B% becomes A * (B / 100)
     * - In 'A - B%': B% becomes A * (B / 100)
     * - In 'A * B%' or 'A / B%': B% becomes (B / 100)
     * - Standalone 'B%': becomes (B / 100)
     */
    resolvePercentages(tokens) {
      const resolved = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === 'percent') {
          const prev = resolved[resolved.length - 1];
          if (prev && prev.type === 'number') {
            const beforeOp = resolved[resolved.length - 2];
            const baseNum = resolved[resolved.length - 3];

            if (beforeOp && beforeOp.type === 'operator' && ['+', '-'].includes(beforeOp.value) && baseNum && baseNum.type === 'number') {
              // A +/- B% -> B% = A * (B / 100)
              prev.value = baseNum.value * (prev.value / 100);
            } else {
              // Unary or multiplicative percentage -> B / 100
              prev.value = prev.value / 100;
            }
          }
          // Consume percent symbol
          continue;
        }

        resolved.push(token);
      }

      return resolved;
    },

    /**
     * Shunting-Yard Algorithm: Convert Infix tokens to Reverse Polish Notation (RPN)
     */
    infixToRPN(tokens) {
      const outputQueue = [];
      const operatorStack = [];

      for (const token of tokens) {
        if (token.type === 'number') {
          outputQueue.push(token);
        } else if (token.type === 'operator') {
          const o1 = token.value;
          const o1Meta = this.operators[o1];

          while (operatorStack.length > 0) {
            const top = operatorStack[operatorStack.length - 1];
            if (top.type === 'paren' && top.value === '(') break;

            const o2 = top.value;
            const o2Meta = this.operators[o2];

            if (
              (o1Meta.associativity === 'L' && o1Meta.precedence <= o2Meta.precedence) ||
              (o1Meta.associativity === 'R' && o1Meta.precedence < o2Meta.precedence)
            ) {
              outputQueue.push(operatorStack.pop());
            } else {
              break;
            }
          }
          operatorStack.push(token);
        } else if (token.type === 'paren' && token.value === '(') {
          operatorStack.push(token);
        } else if (token.type === 'paren' && token.value === ')') {
          let foundOpen = false;
          while (operatorStack.length > 0) {
            const top = operatorStack.pop();
            if (top.type === 'paren' && top.value === '(') {
              foundOpen = true;
              break;
            }
            outputQueue.push(top);
          }
          if (!foundOpen) {
            throw new Error('Mismatched parentheses');
          }
        }
      }

      while (operatorStack.length > 0) {
        const top = operatorStack.pop();
        if (top.type === 'paren') {
          throw new Error('Mismatched parentheses');
        }
        outputQueue.push(top);
      }

      return outputQueue;
    },

    /**
     * Evaluates an RPN token list and returns the calculated number
     */
    evaluateRPN(rpn) {
      const stack = [];

      for (const token of rpn) {
        if (token.type === 'number') {
          stack.push(token.value);
        } else if (token.type === 'operator') {
          if (token.value === 'neg') {
            if (stack.length < 1) throw new Error('Invalid expression format');
            const val = stack.pop();
            stack.push(-val);
          } else {
            if (stack.length < 2) throw new Error('Invalid expression format');
            const b = stack.pop();
            const a = stack.pop();

            switch (token.value) {
              case '+':
                stack.push(a + b);
                break;
              case '-':
                stack.push(a - b);
                break;
              case '*':
                stack.push(a * b);
                break;
              case '/':
                if (Math.abs(b) < 1e-15) {
                  throw new Error('Cannot divide by 0');
                }
                stack.push(a / b);
                break;
              default:
                throw new Error('Unsupported operator: ' + token.value);
            }
          }
        }
      }

      if (stack.length !== 1) {
        throw new Error('Invalid expression syntax');
      }

      const result = stack[0];
      if (isNaN(result) || !isFinite(result)) {
        throw new Error('Calculation error');
      }

      return this.sanitizePrecision(result);
    },

    /**
     * Fixes IEEE 754 binary floating-point rounding quirks (e.g., 0.1 + 0.2 = 0.3)
     */
    sanitizePrecision(val) {
      if (typeof val !== 'number' || !isFinite(val)) return val;
      // Round to 10 decimal digits to eliminate floating noise
      const factor = 1e10;
      const rounded = Math.round((val + Number.EPSILON) * factor) / factor;
      // Normalize negative zero
      return Object.is(rounded, -0) ? 0 : rounded;
    },

    /**
     * Complete evaluation pipeline
     */
    evaluate(expressionStr) {
      if (!expressionStr || expressionStr.trim() === '') return 0;
      const tokens = this.tokenize(expressionStr);
      if (tokens.length === 0) return 0;
      const rpn = this.infixToRPN(tokens);
      return this.evaluateRPN(rpn);
    },

    /**
     * Formats number for display with commas or scientific notation for extremes
     */
    formatNumber(num) {
      if (typeof num !== 'number' || isNaN(num)) return 'Error';
      if (!isFinite(num)) return 'Cannot divide by 0';

      const abs = Math.abs(num);

      // Very large or very small non-zero numbers use scientific notation
      if (abs >= 1e14 || (abs > 0 && abs < 1e-7)) {
        return num.toExponential(6).replace(/e\+?/, 'e');
      }

      // Format with standard localization separators while keeping decimal portion intact
      const parts = num.toString().split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }
  };

  // --------------------------------------------------------------------------
  // UI Display & Controller
  // --------------------------------------------------------------------------
  const Controller = {
    init() {
      this.loadPreferences();
      this.bindEvents();
      this.render();
      this.updateHistoryUI();
    },

    loadPreferences() {
      // Theme
      const savedTheme = localStorage.getItem('smartcalc_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        state.theme = savedTheme;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        state.theme = 'light';
      }
      this.applyTheme(state.theme);

      // Sound
      const savedSound = localStorage.getItem('smartcalc_sound');
      if (savedSound !== null) {
        state.soundEnabled = savedSound === 'true';
      }
      this.updateSoundIcon();

      // Calculation History
      try {
        const savedHistory = localStorage.getItem('smartcalc_history');
        if (savedHistory) {
          state.history = JSON.parse(savedHistory);
        }
      } catch (e) {
        state.history = [];
      }
    },

    applyTheme(theme) {
      state.theme = theme;
      htmlElement.setAttribute('data-theme', theme);
      if (theme === 'light') {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }
      localStorage.setItem('smartcalc_theme', theme);
    },

    toggleTheme() {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
      this.showToast(`Switched to ${nextTheme} theme`);
    },

    toggleSound() {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('smartcalc_sound', state.soundEnabled);
      this.updateSoundIcon();
      if (state.soundEnabled) {
        audioHaptic.play('number');
        this.showToast('Sound enabled');
      } else {
        this.showToast('Sound muted');
      }
    },

    updateSoundIcon() {
      if (state.soundEnabled) {
        soundIconOn.classList.remove('hidden');
        soundIconOff.classList.add('hidden');
      } else {
        soundIconOn.classList.add('hidden');
        soundIconOff.classList.remove('hidden');
      }
    },

    toggleHistoryPanel() {
      const isCollapsed = historyPanel.classList.toggle('collapsed');
      if (!isCollapsed) {
        historyPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },

    // ------------------------------------------------------------------------
    // Calculator Operations
    // ------------------------------------------------------------------------
    inputNumber(digit) {
      audioHaptic.play('number');

      if (state.isError) {
        this.clearAll();
      }

      // If user just pressed '=', start fresh with the new number
      if (state.isCalculated) {
        state.expression = digit;
        state.isCalculated = false;
        this.render();
        return;
      }

      // If expression is currently '0', replace with digit
      if (state.expression === '0') {
        state.expression = digit;
        this.render();
        return;
      }

      if (state.expression === '-0') {
        state.expression = '-' + digit;
        this.render();
        return;
      }

      // Check the current active token to prevent multiple leading zeros like '05'
      const tokens = state.expression.split(/[\s+−×÷/*\-]+/);
      const lastToken = tokens[tokens.length - 1];

      if (lastToken === '0') {
        if (digit === '0') return; // Ignore repeated leading zero
        // Replace lone zero with the new digit
        state.expression = state.expression.slice(0, -1) + digit;
        this.render();
        return;
      }

      state.expression += digit;
      this.render();
    },

    inputDecimal() {
      audioHaptic.play('number');

      if (state.isError) {
        this.clearAll();
      }

      if (state.isCalculated) {
        state.expression = '0.';
        state.isCalculated = false;
        this.render();
        return;
      }

      // Find the last number token in expression to prevent multiple decimal points
      const tokens = state.expression.split(/[\s+−×÷/*-]+/);
      const lastToken = tokens[tokens.length - 1];

      if (lastToken.includes('.')) {
        // Already contains decimal point
        this.triggerDisplayError();
        return;
      }

      if (state.expression === '' || /[\s+−×÷/*-]$/.test(state.expression)) {
        state.expression += '0.';
      } else {
        state.expression += '.';
      }

      this.render();
    },

    inputOperator(op) {
      audioHaptic.play('operator');

      if (state.isError) {
        this.clearAll();
      }

      // If just calculated, chain calculation using last result
      if (state.isCalculated) {
        state.isCalculated = false;
        // Keep current expression (which is the result) and append operator
      }

      const trimmed = state.expression.trim();

      // Check if expression currently ends with an arithmetic operator
      const operatorMatch = trimmed.match(/[+−×÷/*]$/);

      if (operatorMatch) {
        // Replace previous operator with the newly chosen operator
        state.expression = trimmed.slice(0, -1).trim() + ' ' + op + ' ';
      } else {
        state.expression = trimmed + ' ' + op + ' ';
      }

      this.render();
    },

    inputPercent() {
      audioHaptic.play('operator');

      if (state.isError) return;

      const trimmed = state.expression.trim();
      // Can only append percent after a number or closing parenthesis
      if (/[\d)]$/.test(trimmed)) {
        state.expression = trimmed + '%';
        state.isCalculated = false;
        this.render();
      } else {
        this.triggerDisplayError();
      }
    },

    toggleSign() {
      audioHaptic.play('operator');

      if (state.isError) {
        this.clearAll();
        return;
      }

      if (state.isCalculated) {
        state.isCalculated = false;
      }

      let expr = state.expression.trim();

      // Case 1: Standalone number: e.g. "5" -> "-5", or "-5" -> "5"
      if (/^-?\d+(\.\d+)?%?$/.test(expr)) {
        if (expr.startsWith('-')) {
          state.expression = expr.slice(1);
        } else if (expr !== '0') {
          state.expression = '-' + expr;
        }
        this.render();
        return;
      }

      // Case 2: Expression ending with (-N) -> revert to N
      const negativeParenRegex = /\(-(\d+(\.\d+)?%?)\)$/;
      if (negativeParenRegex.test(expr)) {
        state.expression = expr.replace(negativeParenRegex, '$1');
        this.render();
        return;
      }

      // Case 3: Expression ending with positive number -> wrap in (-N)
      const positiveNumberRegex = /(\d+(\.\d+)?%?)$/;
      if (positiveNumberRegex.test(expr)) {
        state.expression = expr.replace(positiveNumberRegex, '(-$1)');
        this.render();
        return;
      }

      this.triggerDisplayError();
    },

    deleteLast() {
      audioHaptic.play('delete');

      if (state.isError || state.isCalculated) {
        this.clearAll();
        return;
      }

      let expr = state.expression;

      // Handle removing wrapped negative like (-5)
      if (expr.endsWith(')')) {
        const parenIdx = expr.lastIndexOf('(-');
        if (parenIdx !== -1) {
          expr = expr.slice(0, parenIdx);
        } else {
          expr = expr.slice(0, -1);
        }
      } else {
        // Strip trailing spaces and single character
        expr = expr.trimEnd();
        expr = expr.slice(0, -1).trimEnd();
      }

      if (expr === '' || expr === '-') {
        state.expression = '0';
      } else {
        state.expression = expr;
      }

      this.render();
    },

    clearAll() {
      audioHaptic.play('clear');
      state.expression = '0';
      state.previousExpression = '';
      state.lastResult = null;
      state.isCalculated = false;
      state.isError = false;
      calculatorDisplay.classList.remove('error-shake');
      this.render();
    },

    calculate() {
      if (state.isError) return;

      const rawExpr = state.expression.trim();

      // Don't recalculate if already fresh result
      if (state.isCalculated) {
        audioHaptic.play('equals');
        return;
      }

      try {
        const result = MathEngine.evaluate(rawExpr);
        audioHaptic.play('equals');

        state.previousExpression = rawExpr + ' =';
        state.lastResult = result;
        state.expression = result.toString();
        state.isCalculated = true;
        state.isError = false;

        // Save to History
        this.addHistory(rawExpr, result);
        this.render();
      } catch (err) {
        audioHaptic.play('error');
        this.triggerDisplayError(err.message || 'Error');
      }
    },

    triggerDisplayError(msg = 'Error') {
      audioHaptic.play('error');
      state.isError = true;
      currentDisplay.textContent = msg;
      livePreview.textContent = '= Error';
      livePreview.classList.add('is-error');

      calculatorDisplay.classList.remove('error-shake');
      // Trigger CSS reflow to restart animation
      void calculatorDisplay.offsetWidth;
      calculatorDisplay.classList.add('error-shake');
    },

    // ------------------------------------------------------------------------
    // Real-Time Live Preview Evaluation
    // ------------------------------------------------------------------------
    updateLivePreview() {
      if (state.isError) return;

      const raw = state.expression.trim();

      // If display is just 0 or empty
      if (raw === '0' || raw === '') {
        livePreview.textContent = '= 0';
        livePreview.classList.remove('is-error');
        return;
      }

      // If user just calculated, preview mirrors result
      if (state.isCalculated) {
        livePreview.textContent = '= ' + MathEngine.formatNumber(parseFloat(state.expression) || 0);
        livePreview.classList.remove('is-error');
        return;
      }

      // Sanitize expression for partial evaluation
      // If ends with an operator (+, −, ×, ÷, etc.), evaluate prefix
      let evaluableStr = raw.replace(/[+−×÷/*\s]+$/, '');
      // Close any open parentheses
      const openParens = (evaluableStr.match(/\(/g) || []).length;
      const closeParens = (evaluableStr.match(/\)/g) || []).length;
      if (openParens > closeParens) {
        evaluableStr += ')'.repeat(openParens - closeParens);
      }

      try {
        if (!evaluableStr) {
          livePreview.textContent = '= ' + state.expression;
          livePreview.classList.remove('is-error');
          return;
        }

        const previewResult = MathEngine.evaluate(evaluableStr);
        livePreview.textContent = '= ' + MathEngine.formatNumber(previewResult);
        livePreview.classList.remove('is-error');
      } catch (err) {
        if (err.message === 'Cannot divide by 0') {
          livePreview.textContent = '= Cannot divide by 0';
          livePreview.classList.add('is-error');
        } else {
          // Incomplete expression while typing is normal: keep clean
          livePreview.textContent = '= ...';
          livePreview.classList.remove('is-error');
        }
      }
    },

    // ------------------------------------------------------------------------
    // Rendering & Dynamic Font Auto-Sizing
    // ------------------------------------------------------------------------
    render() {
      if (state.isError) return;

      previousDisplay.textContent = state.previousExpression;

      if (state.isCalculated && state.lastResult !== null) {
        currentDisplay.textContent = MathEngine.formatNumber(state.lastResult);
      } else {
        currentDisplay.textContent = state.expression;
      }

      this.adjustDisplayFontSize();
      this.updateLivePreview();
    },

    adjustDisplayFontSize() {
      const len = state.expression.length;
      if (len > 18) {
        currentDisplay.style.fontSize = '1.35rem';
      } else if (len > 13) {
        currentDisplay.style.fontSize = '1.75rem';
      } else if (len > 9) {
        currentDisplay.style.fontSize = '2.1rem';
      } else {
        currentDisplay.style.fontSize = '';
      }
    },

    // ------------------------------------------------------------------------
    // Calculation History Manager
    // ------------------------------------------------------------------------
    addHistory(expression, result) {
      const record = {
        id: Date.now(),
        expression: expression,
        result: MathEngine.formatNumber(result),
        rawResult: result,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      state.history.unshift(record);
      // Keep up to 30 recent calculations
      if (state.history.length > 30) {
        state.history.pop();
      }

      try {
        localStorage.setItem('smartcalc_history', JSON.stringify(state.history));
      } catch (e) {
        // LocalStorage quota fallback
      }

      this.updateHistoryUI();
    },

    updateHistoryUI() {
      // Update badge count
      if (state.history.length > 0) {
        historyCountBadge.textContent = state.history.length;
        historyCountBadge.classList.remove('hidden');
        historyEmpty.classList.add('hidden');
        historyList.innerHTML = '';

        state.history.forEach(item => {
          const li = document.createElement('li');
          li.className = 'history-item';
          li.setAttribute('role', 'button');
          li.setAttribute('tabindex', '0');
          li.setAttribute('title', 'Click to recall this calculation');
          li.innerHTML = `
            <div class="history-meta">
              <span>Calculation</span>
              <span>${item.time}</span>
            </div>
            <div class="history-equation">${this.escapeHTML(item.expression)} =</div>
            <div class="history-result">${this.escapeHTML(item.result)}</div>
          `;

          li.addEventListener('click', () => {
            this.recallHistoryItem(item);
          });

          li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this.recallHistoryItem(item);
            }
          });

          historyList.appendChild(li);
        });
      } else {
        historyCountBadge.classList.add('hidden');
        historyList.innerHTML = '';
        historyEmpty.classList.remove('hidden');
      }
    },

    recallHistoryItem(item) {
      audioHaptic.play('number');
      state.previousExpression = item.expression + ' =';
      state.expression = item.rawResult.toString();
      state.lastResult = item.rawResult;
      state.isCalculated = true;
      state.isError = false;
      this.render();
      this.showToast('Recalled: ' + item.result);
    },

    clearHistory() {
      if (state.history.length === 0) return;
      audioHaptic.play('delete');
      state.history = [];
      localStorage.removeItem('smartcalc_history');
      this.updateHistoryUI();
      this.showToast('History cleared');
    },

    // ------------------------------------------------------------------------
    // Clipboard & Notifications
    // ------------------------------------------------------------------------
    copyResult() {
      audioHaptic.play('number');
      let textToCopy = state.expression;
      if (state.isCalculated && state.lastResult !== null) {
        textToCopy = state.lastResult.toString();
      }
      if (!textToCopy || state.isError) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          this.showCopyFeedback(textToCopy);
        }).catch(() => {
          this.fallbackCopy(textToCopy);
        });
      } else {
        this.fallbackCopy(textToCopy);
      }
    },

    fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        this.showCopyFeedback(text);
      } catch (err) {
        this.showToast('Could not copy to clipboard');
      }
      document.body.removeChild(textarea);
    },

    showCopyFeedback(copiedText) {
      copyTooltip.textContent = 'Copied!';
      copyBtn.style.color = '#34d399';
      this.showToast('Copied to clipboard: ' + copiedText);
      setTimeout(() => {
        copyTooltip.textContent = 'Copy';
        copyBtn.style.color = '';
      }, 1800);
    },

    showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 2200);
    },

    escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    // ------------------------------------------------------------------------
    // Physical Keyboard Listener with Tactile Visual Feedback
    // ------------------------------------------------------------------------
    handleKeyboard(e) {
      // Ignore if user is inside a form input if any exists
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key;
      let matchedBtn = null;

      if (/\d/.test(key)) {
        e.preventDefault();
        this.inputNumber(key);
        matchedBtn = document.querySelector(`.calc-btn[data-key="${key}"]`);
      } else if (key === '.') {
        e.preventDefault();
        this.inputDecimal();
        matchedBtn = document.querySelector('.calc-btn[data-key="."]');
      } else if (key === '+' || key === '-') {
        e.preventDefault();
        const opSymbol = key === '-' ? '−' : '+';
        this.inputOperator(opSymbol);
        matchedBtn = document.querySelector(`.calc-btn[data-key="${key}"]`);
      } else if (key === '*') {
        e.preventDefault();
        this.inputOperator('×');
        matchedBtn = document.querySelector('.calc-btn[data-key="*"]');
      } else if (key === '/') {
        e.preventDefault();
        this.inputOperator('÷');
        matchedBtn = document.querySelector('.calc-btn[data-key="/"]');
      } else if (key === '%') {
        e.preventDefault();
        this.inputPercent();
        matchedBtn = document.querySelector('.calc-btn[data-key="%"]');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        this.calculate();
        matchedBtn = document.querySelector('.calc-btn[data-key="Enter"]');
      } else if (key === 'Backspace') {
        e.preventDefault();
        this.deleteLast();
        matchedBtn = document.querySelector('.calc-btn[data-key="Backspace"]');
      } else if (key === 'Escape') {
        e.preventDefault();
        this.clearAll();
        matchedBtn = document.querySelector('.calc-btn[data-key="Escape"]');
      } else if (key === 'Delete') {
        e.preventDefault();
        this.clearAll();
        matchedBtn = document.querySelector('.calc-btn[data-key="Escape"]');
      }

      // Add visual active state on physical keypress
      if (matchedBtn) {
        matchedBtn.classList.add('keyboard-active');
        setTimeout(() => matchedBtn.classList.remove('keyboard-active'), 140);
      }
    },

    // ------------------------------------------------------------------------
    // Event Listeners Binding
    // ------------------------------------------------------------------------
    bindEvents() {
      // Keypad Click Delegation
      keypad.addEventListener('click', (e) => {
        const btn = e.target.closest('.calc-btn');
        if (!btn) return;

        const action = btn.dataset.action;

        switch (action) {
          case 'number':
            this.inputNumber(btn.dataset.number);
            break;
          case 'decimal':
            this.inputDecimal();
            break;
          case 'operator':
            this.inputOperator(btn.dataset.operator);
            break;
          case 'percent':
            this.inputPercent();
            break;
          case 'toggle-sign':
            this.toggleSign();
            break;
          case 'delete':
            this.deleteLast();
            break;
          case 'clear':
            this.clearAll();
            break;
          case 'calculate':
            this.calculate();
            break;
        }
      });

      // Keyboard support
      window.addEventListener('keydown', (e) => this.handleKeyboard(e));

      // Theme toggle
      themeToggleBtn.addEventListener('click', () => this.toggleTheme());

      // Sound toggle
      soundToggleBtn.addEventListener('click', () => this.toggleSound());

      // History drawer toggles
      historyToggleBtn.addEventListener('click', () => this.toggleHistoryPanel());
      closeHistoryBtn.addEventListener('click', () => this.toggleHistoryPanel());
      clearHistoryBtn.addEventListener('click', () => this.clearHistory());

      // Copy result button
      copyBtn.addEventListener('click', () => this.copyResult());

      // Initialize audio context on first user click anywhere
      window.addEventListener('pointerdown', () => audioHaptic.init(), { once: true });
    }
  };

  // Start Application
  document.addEventListener('DOMContentLoaded', () => {
    Controller.init();
  });
})();
