// alf-gym Workout Builder Alpine component (v3.4)
// - En vs syn mode: en mode has discrete fields (no syntax tokens visible);
//   syn mode collapses to single token input.
// - Notable rendered as a visual pill in en mode; as `!` in syn mode.
// - Click on exercise row toggles inline edit (open or close).
// - Optional block flag rendered as a tag.

function alfApp() {
  return {
    view: 'workouts',
    activeWorkoutId: null,
    activeDayId: null,
    activeBlockId: null,

    workouts: [],
    days: [],
    blocks: [],
    prescriptions: [],
    exercises: [],

    syntax: localStorage.getItem('alfgym.syntax') === '1',
    showArchived: false,
    showJson: false,
    flash: '',

    editing: null,
    draftBlock: null,
    draftDay: null,
    wizard: null,

    async init() {
      await window.alfdbSeed();
      window.addEventListener('hashchange', () => this.routeFromHash());
      await this.routeFromHash();
    },

    setSyntax(v) {
      this.syntax = v;
      localStorage.setItem('alfgym.syntax', v ? '1' : '0');
      // If editing, sync the visible fields to the new mode.
      if (this.editing) {
        if (v) this.editing.token = this.tokenFromFields(this.editing.fields);
        else this.fieldsFromToken(this.editing.token, this.editing.fields);
      }
    },

    showFlash(msg) {
      this.flash = msg;
      setTimeout(() => { if (this.flash === msg) this.flash = ''; }, 2200);
    },

    // ----- Hash router -----
    async routeFromHash() {
      const h = window.location.hash || '#/';
      this.editing = null; this.draftBlock = null; this.draftDay = null;
      const m = h.match(/^#\/(?:wizard|w\/(\d+)(?:\/d\/(\d+)(?:\/b\/(\d+))?)?)?$/);
      if (h === '#/' || h === '' || h === '#') { this.view = 'workouts'; await this.loadWorkouts(); return; }
      if (h === '#/wizard') { this.openWizard(); return; }
      if (m && m[1]) {
        const workoutId = parseInt(m[1], 10);
        const w = await window.alfdb.workouts.get(workoutId);
        if (!w) return this.gotoHash('#/');
        this.activeWorkoutId = workoutId;
        await this.loadWorkouts();
        await this.loadDays(workoutId);
        if (m[2]) {
          const dayId = parseInt(m[2], 10);
          this.activeDayId = dayId;
          await this.loadBlocks(dayId);
          await this.loadExercises();
          if (m[3]) {
            const blockId = parseInt(m[3], 10);
            this.activeBlockId = blockId;
            await this.loadPrescriptions(blockId);
            this.view = 'block';
          } else { this.view = 'day'; }
        } else { this.view = 'workout'; }
        return;
      }
      this.gotoHash('#/');
    },
    gotoHash(h) {
      if (window.location.hash === h) this.routeFromHash();
      else window.location.hash = h;
    },

    // ----- Loaders -----
    async loadWorkouts() { this.workouts = await window.alfdb.workouts.toArray(); },
    async loadDays(workoutId) {
      const arr = await window.alfdb.days.where({ workoutId }).toArray();
      arr.sort((a, b) => a.order - b.order);
      this.days = arr;
      const dayIds = arr.map(d => d.id);
      const allBlocks = dayIds.length ? await window.alfdb.blocks.where('dayId').anyOf(dayIds).toArray() : [];
      const byDay = {};
      for (const b of allBlocks) (byDay[b.dayId] = byDay[b.dayId] || []).push(b);
      for (const d of this.days) {
        const list = (byDay[d.id] || []).sort((a, b) => a.order - b.order);
        d._blockCount = list.length;
        d._blockPreview = list.slice(0, 4).map(b => b.name).join(' · ');
      }
    },
    async loadBlocks(dayId) {
      const arr = await window.alfdb.blocks.where({ dayId }).toArray();
      arr.sort((a, b) => a.order - b.order);
      this.blocks = arr;
      const blockIds = arr.map(b => b.id);
      const allP = blockIds.length ? await window.alfdb.prescriptions.where('blockId').anyOf(blockIds).toArray() : [];
      const counts = {};
      for (const p of allP) counts[p.blockId] = (counts[p.blockId] || 0) + 1;
      for (const b of this.blocks) b._exCount = counts[b.id] || 0;
    },
    async loadPrescriptions(blockId) {
      const arr = await window.alfdb.prescriptions.where({ blockId }).toArray();
      arr.sort((a, b) => a.order - b.order);
      this.prescriptions = arr;
    },
    async loadExercises() { this.exercises = await window.alfdb.exercises.toArray(); },

    exerciseName(id) { const ex = this.exercises.find(e => e.id === id); return ex ? ex.name : '?'; },
    workoutName(id) { const w = this.workouts.find(x => x.id === id); return w ? w.name : '?'; },

    // ----- Visible workouts -----
    visibleWorkouts() {
      if (this.showArchived) return this.workouts;
      return this.workouts.filter(w => w.status !== 'archived');
    },
    archivedCount() { return this.workouts.filter(w => w.status === 'archived').length; },
    async archiveWorkout(w) {
      if (!confirm('Archive ' + w.name + '?')) return;
      await window.alfdb.workouts.update(w.id, { status: 'archived', isCurrent: 0 });
      await this.loadWorkouts();
      this.showFlash('Archived');
    },
    async unarchiveWorkout(w) {
      await window.alfdb.workouts.update(w.id, { status: 'active' });
      await this.loadWorkouts();
      this.showFlash('Restored');
    },

    // ----- Wizard -----
    openWizard() {
      this.wizard = { step: 1, name: 'Workout 10', parentId: null, dayKeys: ['A', 'B', 'C'], useSkeleton: true };
      this.view = 'wizard';
    },
    cancelWizard() { this.wizard = null; this.gotoHash('#/'); },
    async submitWizard() {
      const w = this.wizard;
      if (!w.name.trim()) { alert('Name is required.'); return; }
      let newId = null;
      await window.alfdb.transaction('rw',
        [window.alfdb.workouts, window.alfdb.days, window.alfdb.blocks],
        async () => {
          const id = await window.alfdb.workouts.add({
            name: w.name.trim(), parentId: w.parentId || null, status: 'active', isCurrent: 1, createdAt: new Date().toISOString()
          });
          newId = id;
          for (let i = 0; i < w.dayKeys.length; i++) {
            const key = w.dayKeys[i];
            const dayId = await window.alfdb.days.add({ workoutId: id, groupKey: key, name: 'Day ' + key, isAlt: 0, order: i + 1 });
            if (w.useSkeleton) {
              const blocks = window.DAY_SKELETONS[key] || ['Warmup'];
              for (let j = 0; j < blocks.length; j++) {
                await window.alfdb.blocks.add({ dayId, name: blocks[j], type: 'linear', optional: false, order: j + 1 });
              }
            }
          }
        });
      this.wizard = null;
      this.showFlash('Created ' + w.name);
      this.gotoHash('#/w/' + newId);
    },

    // ----- Fork -----
    async forkCurrent() {
      const cur = this.activeWorkout();
      if (!cur) return;
      const name = prompt('Name for the new workout:', this.suggestForkName(cur.name));
      if (!name) return;
      let newId = null;
      await window.alfdb.transaction('rw',
        [window.alfdb.workouts, window.alfdb.days, window.alfdb.blocks, window.alfdb.prescriptions],
        async () => {
          const id = await window.alfdb.workouts.add({
            name: name.trim(), parentId: cur.id, status: 'active', isCurrent: 1, createdAt: new Date().toISOString()
          });
          newId = id;
          const oldDays = await window.alfdb.days.where({ workoutId: cur.id }).toArray();
          for (const d of oldDays) {
            const newDayId = await window.alfdb.days.add({ workoutId: id, groupKey: d.groupKey, name: d.name, isAlt: d.isAlt, order: d.order });
            const oldBlocks = await window.alfdb.blocks.where({ dayId: d.id }).toArray();
            for (const b of oldBlocks) {
              const newBlockId = await window.alfdb.blocks.add({
                dayId: newDayId, name: b.name, type: b.type, optional: !!b.optional,
                rounds: b.rounds, restBetweenRoundsSec: b.restBetweenRoundsSec, order: b.order
              });
              const oldP = await window.alfdb.prescriptions.where({ blockId: b.id }).toArray();
              for (const p of oldP) {
                await window.alfdb.prescriptions.add({
                  blockId: newBlockId, exerciseId: p.exerciseId, sets: p.sets, reps: p.reps, holdSec: p.holdSec,
                  sideScheme: p.sideScheme, load: p.load, notable: !!p.notable,
                  notes: p.notes || '', order: p.order
                });
              }
            }
          }
          await window.alfdb.workouts.update(cur.id, { isCurrent: 0 });
        });
      this.showFlash('Forked');
      this.gotoHash('#/w/' + newId);
    },
    suggestForkName(name) {
      const m = name.match(/^(.*?)(\d+)(\.(\d+))?$/);
      if (!m) return name + ' v2';
      if (m[3]) return m[1] + m[2] + '.' + (parseInt(m[4], 10) + 1);
      return m[1] + m[2] + '.1';
    },

    // ----- Days CRUD -----
    openDraftDay() { this.draftDay = { name: '', groupKey: 'A', isAlt: false, useSkeleton: true }; },
    cancelDraftDay() { this.draftDay = null; },
    async saveDraftDay() {
      const d = this.draftDay;
      const name = (d.name || '').trim() || ('Day ' + d.groupKey + (d.isAlt ? ' alt' : ''));
      const order = this.days.length + 1;
      await window.alfdb.transaction('rw', [window.alfdb.days, window.alfdb.blocks], async () => {
        const dayId = await window.alfdb.days.add({ workoutId: this.activeWorkoutId, name, groupKey: d.groupKey, isAlt: d.isAlt ? 1 : 0, order });
        if (d.useSkeleton && !d.isAlt && window.DAY_SKELETONS[d.groupKey]) {
          const skel = window.DAY_SKELETONS[d.groupKey];
          for (let i = 0; i < skel.length; i++) {
            await window.alfdb.blocks.add({ dayId, name: skel[i], type: 'linear', optional: false, order: i + 1 });
          }
        }
      });
      this.draftDay = null;
      await this.loadDays(this.activeWorkoutId);
      this.showFlash('Day added');
    },
    async deleteDay(d) {
      if (!confirm('Delete ' + d.name + '?')) return;
      const blocks = await window.alfdb.blocks.where({ dayId: d.id }).toArray();
      for (const b of blocks) await window.alfdb.prescriptions.where({ blockId: b.id }).delete();
      await window.alfdb.blocks.where({ dayId: d.id }).delete();
      await window.alfdb.days.delete(d.id);
      await this.loadDays(this.activeWorkoutId);
      this.showFlash('Day deleted');
    },
    async moveDay(d, dir) {
      const sameGroup = this.days.filter(x => x.groupKey === d.groupKey);
      const idx = sameGroup.findIndex(x => x.id === d.id);
      const swap = sameGroup[idx + dir];
      if (!swap) return;
      await window.alfdb.days.update(d.id, { order: swap.order });
      await window.alfdb.days.update(swap.id, { order: d.order });
      await this.loadDays(this.activeWorkoutId);
    },
    daysGrouped() {
      const groups = {};
      for (const d of this.days) (groups[d.groupKey || '_'] = groups[d.groupKey || '_'] || []).push(d);
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    },

    // ----- Blocks CRUD -----
    openDraftBlock() { this.draftBlock = { name: '', type: 'linear', optional: false, rounds: 3, restBetweenRoundsSec: 90 }; },
    cancelDraftBlock() { this.draftBlock = null; },
    async saveDraftBlock() {
      const b = this.draftBlock;
      if (!b.name.trim()) { alert('Block name is required.'); return; }
      const order = this.blocks.length + 1;
      const fields = { dayId: this.activeDayId, name: b.name.trim(), type: b.type, optional: !!b.optional, order };
      if (b.type === 'circuit') {
        fields.rounds = b.rounds || 3;
        fields.restBetweenRoundsSec = b.restBetweenRoundsSec || 90;
      }
      await window.alfdb.blocks.add(fields);
      this.draftBlock = null;
      await this.loadBlocks(this.activeDayId);
      this.showFlash('Block added');
    },
    async deleteBlock(b) {
      if (!confirm('Delete block ' + b.name + '?')) return;
      await window.alfdb.prescriptions.where({ blockId: b.id }).delete();
      await window.alfdb.blocks.delete(b.id);
      await this.loadBlocks(this.activeDayId);
      this.showFlash('Block deleted');
    },
    async moveBlock(b, dir) {
      const idx = this.blocks.findIndex(x => x.id === b.id);
      const swap = this.blocks[idx + dir];
      if (!swap) return;
      await window.alfdb.blocks.update(b.id, { order: swap.order });
      await window.alfdb.blocks.update(swap.id, { order: b.order });
      await this.loadBlocks(this.activeDayId);
    },
    async toggleBlockType(b) {
      const next = b.type === 'linear' ? 'circuit' : 'linear';
      const patch = { type: next };
      if (next === 'circuit') {
        patch.rounds = b.rounds || 3;
        patch.restBetweenRoundsSec = b.restBetweenRoundsSec || 90;
      }
      await window.alfdb.blocks.update(b.id, patch);
      await this.loadBlocks(this.activeDayId);
    },
    async toggleBlockOptional(b) {
      await window.alfdb.blocks.update(b.id, { optional: !b.optional });
      await this.loadBlocks(this.activeDayId);
      this.showFlash(b.optional ? 'Marked required' : 'Marked optional');
    },

    // ----- Exercises CRUD (inline) -----
    async openAddExercise() {
      await this.loadExercises();
      const order = this.prescriptions.length + 1;
      const fields = {
        blockId: this.activeBlockId, exerciseId: null,
        sets: 3, reps: 8, holdSec: null,
        sideScheme: 'bilateral',
        load: '', loadKind: 'lb', loadValue: '',
        notable: false, notes: '', order
      };
      this.editing = {
        id: null,
        exerciseQuery: '',
        fields,
        token: ''
      };
    },
    toggleEditExercise(p) {
      if (this.editing && this.editing.id === p.id) {
        this.editing = null;
      } else {
        this.editExercise(p);
      }
    },
    editExercise(p) {
      const parsed = this.parseLoadString(p.load || '');
      const fields = { ...p, notable: !!p.notable, notes: p.notes || '', loadKind: parsed.kind, loadValue: parsed.value };
      this.editing = {
        id: p.id,
        exerciseQuery: this.exerciseName(p.exerciseId),
        fields,
        token: this.tokenFromFields(fields)
      };
    },
    cancelEdit() { this.editing = null; },

    // Load kind helpers (en mode).
    parseLoadString(load) {
      if (!load) return { kind: 'lb', value: '' };
      const s = String(load).trim();
      if (s === 'band') return { kind: 'band', value: '' };
      if (s === 'bw' || s === 'bodyweight' || s === '0') return { kind: 'bodyweight', value: '' };
      if (s.startsWith('^')) return { kind: 'cable', value: s.slice(1) };
      if (s.startsWith('(') && s.endsWith(')')) return { kind: 'plate', value: s.slice(1, -1) };
      return { kind: 'lb', value: s };
    },
    composeLoadString(kind, value) {
      switch (kind) {
        case 'cable':      return '^' + (value || '0');
        case 'plate':      return '(' + (value || '0') + ')';
        case 'band':       return 'band';
        case 'bodyweight': return '0';
        default:           return value || '';
      }
    },
    loadKindNeedsValue(kind) { return kind === 'lb' || kind === 'cable' || kind === 'plate'; },

    // Syntax-mode parser. Best-effort. Falls back to load-only if ambiguous.
    fieldsFromToken(token, fields) {
      const t = (token || '').trim();
      // Defaults preserved unless overridden.
      fields.sets = 1; fields.reps = null; fields.holdSec = null;
      fields.sideScheme = 'bilateral'; fields.notable = false; fields.load = '';
      fields.loadKind = 'lb'; fields.loadValue = '';
      if (!t) return;
      let s = t;

      const setsM = s.match(/-(\d+)\s*$/);
      if (setsM) { fields.sets = parseInt(setsM[1], 10) || 1; s = s.slice(0, setsM.index).trim(); }

      let loadPart = s, repsPart = '';
      if (s.includes(';')) {
        fields.sideScheme = 'unilateral-L-first';
        const idx = s.indexOf(';');
        loadPart = s.slice(0, idx).trim();
        repsPart = s.slice(idx + 1).trim();
      } else if (/^[\d,.]+$/.test(s) && !/^[\d.]+s/i.test(s)) {
        repsPart = s; loadPart = '';
      }

      const tryHold = (str) => { const m = String(str).match(/^([\d.]+)s$/i); return m ? parseInt(m[1], 10) : null; };
      const h1 = tryHold(loadPart);
      if (h1 != null) {
        fields.holdSec = h1;
        loadPart = '';
      } else if (loadPart) {
        if (loadPart.endsWith('!')) { fields.notable = true; loadPart = loadPart.slice(0, -1); }
        fields.load = loadPart;
        const parsed = this.parseLoadString(loadPart);
        fields.loadKind = parsed.kind;
        fields.loadValue = parsed.value;
      }

      if (repsPart) {
        const h2 = tryHold(repsPart);
        if (h2 != null) fields.holdSec = h2;
        else fields.reps = repsPart;
      }
    },

    tokenFromFields(f) {
      // Build the canonical token from structured fields.
      const perSide = (f.sideScheme || '').startsWith('unilateral') ? ';' : '';
      const bang = f.notable ? '!' : '';
      const load = f.load ? (f.load + bang) : '';
      const reps = f.reps == null || f.reps === ''
        ? ''
        : String(f.reps).split(',').map(r => perSide + r).join(',');
      const sets = (f.sets || 0) > 1 ? '-' + f.sets : '';
      let out = '';
      if (load) out += load;
      if (reps) out += (load ? ',' : '') + reps;
      if (f.holdSec) out += (out ? ',' : '') + f.holdSec + 's' + (perSide ? ';' : '');
      out += sets;
      return out;
    },

    async resolveExerciseFromQuery() {
      const q = (this.editing.exerciseQuery || '').trim();
      if (!q) return null;
      let ex = this.exercises.find(e => e.name.toLowerCase() === q.toLowerCase());
      if (!ex) {
        const id = await window.alfdb.exercises.add({ name: q, parentId: null, category: '', equipment: '' });
        await this.loadExercises();
        ex = this.exercises.find(e => e.id === id);
      }
      return ex;
    },

    async saveEdit() {
      if (!this.editing) return;
      const ex = await this.resolveExerciseFromQuery();
      if (!ex) { alert('Type or pick an exercise name.'); return; }
      // If syntax mode, parse token first.
      if (this.syntax) this.fieldsFromToken(this.editing.token, this.editing.fields);
      // Compose load from kind+value.
      this.editing.fields.load = this.composeLoadString(this.editing.fields.loadKind, this.editing.fields.loadValue);

      this.editing.fields.exerciseId = ex.id;
      const f = { ...this.editing.fields };
      // strip ui-only fields before save
      delete f.loadKind; delete f.loadValue;
      if (typeof f.sets === 'string') f.sets = parseInt(f.sets, 10) || 1;
      if (typeof f.holdSec === 'string') f.holdSec = f.holdSec ? parseInt(f.holdSec, 10) : null;

      const isNew = !this.editing.id;
      if (isNew) await window.alfdb.prescriptions.add(f);
      else await window.alfdb.prescriptions.update(this.editing.id, f);
      this.editing = null;
      await this.loadPrescriptions(this.activeBlockId);
      this.showFlash(isNew ? 'Exercise added' : 'Exercise saved');
    },

    async deleteExercise(p) {
      if (!confirm('Remove this exercise from the block?')) return;
      await window.alfdb.prescriptions.delete(p.id);
      await this.loadPrescriptions(this.activeBlockId);
      this.showFlash('Exercise removed');
    },

    async moveExercise(p, dir) {
      const idx = this.prescriptions.findIndex(x => x.id === p.id);
      const swap = this.prescriptions[idx + dir];
      if (!swap) return;
      await window.alfdb.prescriptions.update(p.id, { order: swap.order });
      await window.alfdb.prescriptions.update(swap.id, { order: p.order });
      await this.loadPrescriptions(this.activeBlockId);
    },

    // ----- Render helpers -----
    activeWorkout() { return this.workouts.find(w => w.id === this.activeWorkoutId); },
    activeDay()     { return this.days.find(d => d.id === this.activeDayId); },
    activeBlock()   { return this.blocks.find(b => b.id === this.activeBlockId); },

    // En-mode display: never expose syntax tokens.
    formatLoadEnglish(p) {
      const k = this.parseLoadString(p.load || '');
      switch (k.kind) {
        case 'cable':      return 'cable ' + k.value;
        case 'plate':      return k.value + ' lb plate per side';
        case 'band':       return 'band';
        case 'bodyweight': return 'bodyweight';
        case 'lb':
        default:           return k.value ? (k.value + ' lb') : '';
      }
    },
    formatPrescription(p) {
      if (this.syntax) return this.toSyntax(p);
      // En mode: no syntax tokens, no `!`.
      const parts = [];
      const load = this.formatLoadEnglish(p);
      if (load) parts.push(load);
      if (p.reps != null && p.reps !== '') parts.push(p.reps + ' reps');
      if (p.holdSec) parts.push(p.holdSec + 's hold');
      if (p.sets > 1) parts.push(p.sets + ' sets');
      const side = (p.sideScheme || '').replace(/-/g, ' ');
      if (side && side !== 'bilateral') parts.push(side);
      return parts.join(' · ') || '—';
    },
    toSyntax(p) {
      return this.tokenFromFields({
        load: p.load || '',
        notable: !!p.notable,
        reps: p.reps,
        sets: p.sets,
        holdSec: p.holdSec,
        sideScheme: p.sideScheme
      }) || '—';
    },

    nextStepHint() {
      if (this.view === 'workouts') {
        if (this.visibleWorkouts().length === 0) return { text: 'No active workout. Tap "+ new workout" to start the wizard.' };
        if (this.visibleWorkouts().length === 1) return { text: 'Tap your workout to open its days.' };
        return { text: 'Tap a workout to open its days, or fork one to a new revision.' };
      }
      if (this.view === 'workout') {
        const empty = this.days.filter(d => (d._blockCount || 0) === 0);
        if (empty.length) return { text: 'Empty days waiting: ' + empty.map(d => d.name).join(', ') };
        return { text: 'Tap a day to edit its blocks.' };
      }
      if (this.view === 'day') {
        if (this.blocks.length === 0) return { text: 'Add the first block.' };
        const empty = this.blocks.filter(b => (b._exCount || 0) === 0);
        if (empty.length) return { text: 'Empty blocks: ' + empty.map(b => b.name).join(', ') };
        return { text: 'All blocks have exercises. Review or reorder.' };
      }
      if (this.view === 'block') {
        if (this.prescriptions.length === 0) return { text: 'Add the first exercise.' };
        return { text: 'Tap an exercise title to edit. Tap again to close.' };
      }
      return null;
    },

    async resetEverything() {
      if (!confirm('Wipe local IndexedDB and re-seed?')) return;
      await window.alfdbReset();
      this.gotoHash('#/');
      this.showFlash('DB reset');
    }
  };
}

window.alfApp = alfApp;
