// alf-gym Workout Builder Alpine component (v3.3)
// Flat model: Workout (no Program/Variant). Lineage via parentId.

function alfApp() {
  return {
    // Route + view
    view: 'workouts',                 // workouts | wizard | workout | day | block
    activeWorkoutId: null,
    activeDayId: null,
    activeBlockId: null,

    // Lists
    workouts: [],
    days: [],
    blocks: [],
    prescriptions: [],
    exercises: [],

    // UI state
    syntax: localStorage.getItem('alfgym.syntax') === '1',
    showArchived: false,
    showJson: false,
    flash: '',

    // Drafts
    editing: null,
    draftBlock: null,
    draftDay: null,

    // Wizard state
    wizard: null,

    async init() {
      await window.alfdbSeed();
      window.addEventListener('hashchange', () => this.routeFromHash());
      await this.routeFromHash();
    },

    setSyntax(v) {
      this.syntax = v;
      localStorage.setItem('alfgym.syntax', v ? '1' : '0');
    },

    showFlash(msg) {
      this.flash = msg;
      setTimeout(() => { if (this.flash === msg) this.flash = ''; }, 2200);
    },

    // ----- Hash router -----
    // #/, #/wizard, #/w/{id}, #/w/{id}/d/{dayId}, #/w/{id}/d/{dayId}/b/{blockId}
    async routeFromHash() {
      const h = window.location.hash || '#/';
      this.editing = null; this.draftBlock = null; this.draftDay = null;
      const m = h.match(/^#\/(?:wizard|w\/(\d+)(?:\/d\/(\d+)(?:\/b\/(\d+))?)?)?$/);
      if (h === '#/' || h === '' || h === '#') {
        this.view = 'workouts';
        await this.loadWorkouts();
        return;
      }
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
          } else {
            this.view = 'day';
          }
        } else {
          this.view = 'workout';
        }
        return;
      }
      this.gotoHash('#/');
    },

    gotoHash(h) {
      if (window.location.hash === h) this.routeFromHash();
      else window.location.hash = h;
    },

    // ----- Loaders -----
    async loadWorkouts() {
      this.workouts = await window.alfdb.workouts.toArray();
    },
    async loadDays(workoutId) {
      const arr = await window.alfdb.days.where({ workoutId }).toArray();
      arr.sort((a, b) => a.order - b.order);
      this.days = arr;
      const dayIds = arr.map(d => d.id);
      const allBlocks = dayIds.length
        ? await window.alfdb.blocks.where('dayId').anyOf(dayIds).toArray() : [];
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
      const allP = blockIds.length
        ? await window.alfdb.prescriptions.where('blockId').anyOf(blockIds).toArray() : [];
      const counts = {};
      for (const p of allP) counts[p.blockId] = (counts[p.blockId] || 0) + 1;
      for (const b of this.blocks) b._exCount = counts[b.id] || 0;
    },
    async loadPrescriptions(blockId) {
      const arr = await window.alfdb.prescriptions.where({ blockId }).toArray();
      arr.sort((a, b) => a.order - b.order);
      this.prescriptions = arr;
    },
    async loadExercises() {
      this.exercises = await window.alfdb.exercises.toArray();
    },

    exerciseName(id) {
      const ex = this.exercises.find(e => e.id === id);
      return ex ? ex.name : '?';
    },
    workoutName(id) {
      const w = this.workouts.find(x => x.id === id);
      return w ? w.name : '?';
    },

    // ----- Visible workouts -----
    visibleWorkouts() {
      if (this.showArchived) return this.workouts;
      return this.workouts.filter(w => w.status !== 'archived');
    },
    archivedCount() {
      return this.workouts.filter(w => w.status === 'archived').length;
    },
    async archiveWorkout(w) {
      if (!confirm('Archive ' + w.name + '? It stays in the database; toggle "show archived" to see it.')) return;
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
      this.wizard = {
        step: 1,
        name: 'Workout 10',
        parentId: null,
        dayKeys: ['A', 'B', 'C'],
        useSkeleton: true
      };
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
            name: w.name.trim(),
            parentId: w.parentId || null,
            status: 'active',
            isCurrent: 1,
            createdAt: new Date().toISOString()
          });
          newId = id;
          for (let i = 0; i < w.dayKeys.length; i++) {
            const key = w.dayKeys[i];
            const dayId = await window.alfdb.days.add({
              workoutId: id, groupKey: key, name: 'Day ' + key, isAlt: 0, order: i + 1
            });
            if (w.useSkeleton) {
              const blocks = window.DAY_SKELETONS[key] || ['Warmup'];
              for (let j = 0; j < blocks.length; j++) {
                await window.alfdb.blocks.add({ dayId, name: blocks[j], type: 'linear', order: j + 1 });
              }
            }
          }
        });
      this.wizard = null;
      this.showFlash('Created ' + w.name);
      this.gotoHash('#/w/' + newId);
    },

    // ----- Fork (from a workout view) -----
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
            name: name.trim(),
            parentId: cur.id,
            status: 'active',
            isCurrent: 1,
            createdAt: new Date().toISOString()
          });
          newId = id;
          // Copy days, blocks, prescriptions.
          const oldDays = await window.alfdb.days.where({ workoutId: cur.id }).toArray();
          for (const d of oldDays) {
            const newDayId = await window.alfdb.days.add({
              workoutId: id, groupKey: d.groupKey, name: d.name, isAlt: d.isAlt, order: d.order
            });
            const oldBlocks = await window.alfdb.blocks.where({ dayId: d.id }).toArray();
            for (const b of oldBlocks) {
              const newBlockId = await window.alfdb.blocks.add({
                dayId: newDayId, name: b.name, type: b.type,
                rounds: b.rounds, restBetweenRoundsSec: b.restBetweenRoundsSec, order: b.order
              });
              const oldP = await window.alfdb.prescriptions.where({ blockId: b.id }).toArray();
              for (const p of oldP) {
                await window.alfdb.prescriptions.add({
                  blockId: newBlockId,
                  exerciseId: p.exerciseId, sets: p.sets, reps: p.reps, holdSec: p.holdSec,
                  sideScheme: p.sideScheme, load: p.load, notable: !!p.notable,
                  notes: p.notes || '', order: p.order
                });
              }
            }
          }
          // Mark current as not the live one anymore.
          await window.alfdb.workouts.update(cur.id, { isCurrent: 0 });
        });
      this.showFlash('Forked');
      this.gotoHash('#/w/' + newId);
    },
    suggestForkName(name) {
      // Workout 9.2 -> Workout 9.3 ; Workout 9 -> Workout 9.1 ; otherwise append " v2".
      const m = name.match(/^(.*?)(\d+)(\.(\d+))?$/);
      if (!m) return name + ' v2';
      const base = m[1];
      if (m[3]) return base + m[2] + '.' + (parseInt(m[4], 10) + 1);
      return base + m[2] + '.1';
    },

    // ----- Workout view (Days CRUD) -----
    openDraftDay() {
      this.draftDay = { name: '', groupKey: 'A', isAlt: false, useSkeleton: true };
    },
    cancelDraftDay() { this.draftDay = null; },
    async saveDraftDay() {
      const d = this.draftDay;
      const name = (d.name || '').trim() || ('Day ' + d.groupKey + (d.isAlt ? ' alt' : ''));
      const order = this.days.length + 1;
      await window.alfdb.transaction('rw', [window.alfdb.days, window.alfdb.blocks], async () => {
        const dayId = await window.alfdb.days.add({
          workoutId: this.activeWorkoutId, name, groupKey: d.groupKey,
          isAlt: d.isAlt ? 1 : 0, order
        });
        if (d.useSkeleton && !d.isAlt && window.DAY_SKELETONS[d.groupKey]) {
          const skel = window.DAY_SKELETONS[d.groupKey];
          for (let i = 0; i < skel.length; i++) {
            await window.alfdb.blocks.add({ dayId, name: skel[i], type: 'linear', order: i + 1 });
          }
        }
      });
      this.draftDay = null;
      await this.loadDays(this.activeWorkoutId);
      this.showFlash('Day added');
    },
    async deleteDay(d) {
      if (!confirm('Delete ' + d.name + ' and its blocks/exercises?')) return;
      const blocks = await window.alfdb.blocks.where({ dayId: d.id }).toArray();
      for (const b of blocks) await window.alfdb.prescriptions.where({ blockId: b.id }).delete();
      await window.alfdb.blocks.where({ dayId: d.id }).delete();
      await window.alfdb.days.delete(d.id);
      await this.loadDays(this.activeWorkoutId);
      this.showFlash('Day deleted');
    },
    async moveDay(d, dir) {
      // Reorder within group only.
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
      for (const d of this.days) {
        const k = d.groupKey || '_';
        (groups[k] = groups[k] || []).push(d);
      }
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    },

    // ----- Day view (Blocks CRUD) -----
    openDraftBlock() {
      this.draftBlock = { name: '', type: 'linear', rounds: 3, restBetweenRoundsSec: 90 };
    },
    cancelDraftBlock() { this.draftBlock = null; },
    async saveDraftBlock() {
      const b = this.draftBlock;
      if (!b.name.trim()) { alert('Block name is required.'); return; }
      const order = this.blocks.length + 1;
      const fields = { dayId: this.activeDayId, name: b.name.trim(), type: b.type, order };
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
      if (!confirm('Delete block ' + b.name + ' and its exercises?')) return;
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

    // ----- Block view (Exercises CRUD, inline) -----
    async openAddExercise() {
      await this.loadExercises();
      const order = this.prescriptions.length + 1;
      this.editing = {
        id: null,
        exerciseQuery: '',
        fields: {
          blockId: this.activeBlockId, exerciseId: null,
          sets: 3, reps: 8, holdSec: null,
          sideScheme: 'bilateral', load: '',
          notable: false, notes: '', order
        }
      };
    },
    editExercise(p) {
      this.editing = {
        id: p.id,
        exerciseQuery: this.exerciseName(p.exerciseId),
        fields: { ...p, notable: !!p.notable, notes: p.notes || '' }
      };
    },
    cancelEdit() { this.editing = null; },

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
      this.editing.fields.exerciseId = ex.id;
      const f = this.editing.fields;
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

    formatPrescription(p) {
      return this.syntax ? this.toSyntax(p) : this.toEnglish(p);
    },
    toSyntax(p) {
      const perSide = (p.sideScheme || '').startsWith('unilateral') ? ';' : '';
      const bang = p.notable ? '!' : '';
      const reps = p.reps == null ? '' : String(p.reps).split(',').map(r => perSide + r).join(',');
      const load = p.load ? p.load + bang : '';
      const sets = p.sets > 1 ? '-' + p.sets : '';
      let out = '';
      if (load) out += load;
      if (reps) out += (load ? ',' : '') + reps;
      if (p.holdSec) out += (out ? ',' : '') + p.holdSec + 's' + (perSide ? ';' : '');
      if (sets) out += sets;
      return out || '—';
    },
    toEnglish(p) {
      const parts = [];
      if (p.load) parts.push(p.load + ' lb' + (p.notable ? ' (notable)' : ''));
      if (p.reps != null) parts.push(p.reps + ' reps');
      if (p.holdSec) parts.push(p.holdSec + 's hold');
      if (p.sets > 1) parts.push(p.sets + ' sets');
      const side = (p.sideScheme || '').replace(/-/g, ' ');
      if (side && side !== 'bilateral') parts.push(side);
      return parts.join(' · ') || '—';
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
        return { text: 'Add another exercise, or reorder the existing ones.' };
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
