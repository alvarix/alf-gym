/**
 * alfMdParser — parses legacy markdown workout files into a Dexie-ready AST.
 *
 * Notation rules locked in docs/27--llm--md-import.md:
 *   - `!` is a mandatory load terminator, not a "notable" flag
 *   - `:` before `!`  → pair of implements (e.g. `:20!` = two 20lb DBs)
 *   - `:` after `!`   → per-side reps (e.g. `40!:5-3`)
 *   - `;` is unused
 *   - "notable" is not a typed token; it's a UI-derived signal from history
 *
 * Attaches to window.alfMdParser = { parse }.
 */
(function () {
  'use strict';

  // Matches a load token: optional pair prefix `:`, then integer|plate|(cable)|hold,
  // terminated by mandatory `!`.
  // Groups: [1] = raw load string (with `:` prefix if pair), no `!`
  const LOAD_RE = /^((?::\d+|\(\d+\)|\^\d+|\d+s?|\d+)!)(.*)$/;

  // Detects a pure notation token: only notation chars, no letters except s (seconds)
  // and optional x (old-style 3x30s). Must start with a digit, colon, ^, (, or -
  const NOTATION_RE = /^[:\d()^!\-,sx]+$/;

  /**
   * Parse a trailing notation token into structured prescription fields.
   * @param {string} token - e.g. "40!:5-3", ":20!:5-3", "30s!-3", ":5-3", "8-3"
   * @returns {{ load: string, sets: number|null, reps: string|null, holdSec: number|null, sideScheme: string }}
   */
  function parseNotationToken(token) {
    const f = { load: '', sets: null, reps: null, holdSec: null, sideScheme: 'bilateral' };
    if (!token) return f;

    let rest = token.trim();

    // Try load token (everything up to and including !)
    const lm = rest.match(LOAD_RE);
    if (lm) {
      // lm[1] ends with `!` — strip it, keep leading `:` for pair notation
      f.load = lm[1].slice(0, -1); // e.g. ":20" or "40" or "^15"
      rest = lm[2];                // everything after `!`
    }

    // Rest: optional `:` (per-side), reps, optional `-N` (sets), or `Ns` (hold)
    if (rest) {
      if (rest.startsWith(':')) {
        f.sideScheme = 'unilateral-l-first';
        rest = rest.slice(1);
      }

      // Sets: trailing -N
      const sm = rest.match(/-(\d+)$/);
      if (sm) {
        f.sets = parseInt(sm[1], 10);
        rest = rest.slice(0, -sm[0].length);
      }

      // Hold time: Ns
      const hm = rest.match(/^(\d+)s$/);
      if (hm) {
        f.holdSec = parseInt(hm[1], 10);
        rest = '';
      }

      // Reps: digit-led
      if (rest && /^\d/.test(rest)) {
        f.reps = rest; // store as-is, e.g. "5" or "8,10,12" or "5-3" (range)
      }
    }

    // Bodyweight-only case (no load token, just :N-M or N-M)
    if (!lm && token && !f.sets && !f.reps && !f.holdSec) {
      let r = token.trim();
      if (r.startsWith(':')) { f.sideScheme = 'unilateral-l-first'; r = r.slice(1); }
      const sm = r.match(/-(\d+)$/);
      if (sm) { f.sets = parseInt(sm[1], 10); r = r.slice(0, -sm[0].length); }
      if (r && /^\d/.test(r)) f.reps = r;
    }

    return f;
  }

  /**
   * Strip markdown emphasis markers from an exercise name string.
   * Handles *Name*, **Name**, and unclosed variants.
   * @param {string} s
   * @returns {string}
   */
  function stripMarkdown(s) {
    return s.replace(/\*{1,2}([^*\n]+)\*{0,2}/g, '$1').trim();
  }

  /**
   * Extract [label](url) patterns from text, returning the cleaned text and
   * an array of { label, url } ref objects.
   * @param {string} s
   * @returns {{ text: string, refs: Array<{label: string, url: string}> }}
   */
  function extractRefs(s) {
    const refs = [];
    const text = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      refs.push({ label, url });
      return label;
    });
    return { text, refs };
  }

  /**
   * Detect and extract a trailing notation token from a string.
   * Returns { name, token } where token may be '' if none found.
   * @param {string} s
   * @returns {{ name: string, token: string }}
   */
  function extractTrailingToken(s) {
    const parts = s.split(/\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (NOTATION_RE.test(last) && /[\d!]/.test(last)) {
        return { name: parts.slice(0, -1).join(' '), token: last };
      }
    }
    return { name: s, token: '' };
  }

  /**
   * Parse a prescription bullet line (after stripping the `- [ ] ` prefix).
   * @param {string} rest - content after the bullet marker and optional checkbox
   * @returns {{ name: string, notationToken: string, sameLineNotes: string, refs: Array }}
   */
  function parsePrescriptionBullet(rest) {
    // Extract inline refs first
    const { text: withoutRefs, refs } = extractRefs(rest);

    // Split on ` - ` to pull trailing same-line notes
    const dashIdx = withoutRefs.search(/ - /);
    let titlePart = withoutRefs;
    let sameLineNotes = '';
    if (dashIdx !== -1) {
      titlePart = withoutRefs.slice(0, dashIdx);
      sameLineNotes = withoutRefs.slice(dashIdx + 3).trim();
    }

    // Strip markdown from title
    titlePart = stripMarkdown(titlePart);

    // Extract trailing notation token from title
    const { name, token: notationToken } = extractTrailingToken(titlePart);

    return { name: name.trim(), notationToken, sameLineNotes, refs };
  }

  /**
   * Parse markdown workout text into an AST.
   *
   * Output shape:
   * {
   *   name: string,
   *   blocks: [{
   *     order: number,
   *     name: string,
   *     description: string,
   *     subLabel?: string,
   *     prescriptions: [{
   *       order: number,
   *       name: string,
   *       sets: number|null,
   *       reps: string|null,
   *       load: string,
   *       holdSec: number|null,
   *       sideScheme: string,
   *       cues: string[],
   *       alt: string,
   *       refs: {label,url}[],
   *       notes: string,
   *       _unparsed: string[]
   *     }]
   *   }]
   * }
   *
   * @param {string} text - raw markdown content
   * @returns {object} AST
   */
  function parse(text) {
    const lines = text.split('\n');
    let workoutName = '';
    const blocks = [];
    let currentBlock = null;
    let currentPrescription = null;

    function appendNote(p, line) {
      p.notes = p.notes ? p.notes + '\n' + line : line;
    }

    function flushPrescription() {
      if (currentPrescription && currentBlock) {
        currentBlock.prescriptions.push(currentPrescription);
        currentPrescription = null;
      }
    }

    function flushBlock() {
      flushPrescription();
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    }

    function newBlock(order, name) {
      return { order, name, description: '', prescriptions: [] };
    }

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      const indent = raw.search(/\S/); // -1 if all whitespace

      // Blank line
      if (!trimmed) continue;

      // Workout heading: # Name
      if (indent === 0 && trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        workoutName = trimmed.slice(2).trim();
        continue;
      }

      // Block heading: ## N. Name
      if (indent === 0 && trimmed.startsWith('## ')) {
        flushBlock();
        const blockText = trimmed.slice(3).trim();
        const om = blockText.match(/^(\d+)\.\s+(.+)$/);
        if (om) {
          currentBlock = newBlock(parseInt(om[1], 10), om[2].trim());
        } else {
          currentBlock = newBlock(blocks.length, blockText);
        }
        continue;
      }

      // Sub-block label: ### Name
      if (indent === 0 && trimmed.startsWith('### ')) {
        if (currentBlock) currentBlock.subLabel = trimmed.slice(4).trim();
        continue;
      }

      // Prescription bullet at indent 0: - [ ] Name  or  - Name
      if (indent === 0 && /^[-*] /.test(trimmed)) {
        // Create implicit block for orphan bullets (before any ## heading)
        if (!currentBlock) {
          currentBlock = newBlock(0, workoutName || 'Workout');
        }
        flushPrescription();

        // Strip bullet marker and optional checkbox
        let rest = trimmed.replace(/^[-*] (?:\[[ x?]\] )?/, '');
        const { name, notationToken, sameLineNotes, refs } = parsePrescriptionBullet(rest);

        const nf = parseNotationToken(notationToken);

        currentPrescription = {
          order: currentBlock.prescriptions.length,
          name,
          sets: nf.sets,
          reps: nf.reps,
          load: nf.load,
          holdSec: nf.holdSec,
          sideScheme: nf.sideScheme,
          cues: [],
          alt: '',
          refs,
          notes: sameLineNotes,
          _unparsed: [],
        };
        continue;
      }

      // Indented content (indent > 0): attaches to current prescription or block
      if (indent > 0) {
        if (currentPrescription) {
          if (/^Alt:/i.test(trimmed)) {
            currentPrescription.alt = trimmed.replace(/^Alt:\s*/i, '').trim();
          } else if (/^Cues?:/i.test(trimmed)) {
            const cueText = trimmed.replace(/^Cues?:\s*/i, '').trim();
            if (cueText) currentPrescription.cues.push(cueText);
          } else if (/^[-*] [LR] /i.test(trimmed)) {
            // Per-side sub-bullet → verbatim note
            appendNote(currentPrescription, trimmed);
          } else if (/^[-*] /.test(trimmed)) {
            // Supplementary drill sub-bullet → note
            appendNote(currentPrescription, trimmed);
          } else {
            // Free indented text: check for standalone notation token first
            if (NOTATION_RE.test(trimmed) && /[\d!]/.test(trimmed) &&
                !currentPrescription.sets && !currentPrescription.reps && !currentPrescription.holdSec) {
              const nf = parseNotationToken(trimmed);
              currentPrescription.sets = nf.sets;
              currentPrescription.reps = nf.reps;
              currentPrescription.load = nf.load;
              currentPrescription.holdSec = nf.holdSec;
              currentPrescription.sideScheme = nf.sideScheme;
            } else {
              appendNote(currentPrescription, trimmed);
            }
          }
        } else if (currentBlock) {
          // Between block heading and first bullet → block description
          currentBlock.description = currentBlock.description
            ? currentBlock.description + '\n' + trimmed
            : trimmed;
        }
        continue;
      }

      // Free text at indent 0 after a block heading but before first bullet
      if (currentBlock && !currentPrescription) {
        currentBlock.description = currentBlock.description
          ? currentBlock.description + '\n' + trimmed
          : trimmed;
      }
    }

    flushBlock();

    return { name: workoutName, blocks };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parse, parseNotationToken };
  } else {
    window.alfMdParser = { parse, parseNotationToken };
  }
})();
