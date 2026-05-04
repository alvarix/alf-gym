// alf-gym Template Builder Alpine component (v3.2)
// - Inline edit and add (no modals)
// - Hide archived programs by default
// - Obvious next-step CTAs

function alfApp() {
  return {
    // Route state
    view: 'programs',
    activeProgramId: null,
    activeVariantId: null,
    activeDayId: null,
    activeBlockId: null,

    // Lists
    programs: [],
    variants: [],
    days: [],
    blocks: [],
    prescriptions: [],
    exercises: [],

    // UI state
    syntax: localStorage.getItem('alfgym.syntax') === '1',
    showArchived: false,
    showJson: false,
    flash: '',

    // Inline edit drafts
    editing: null,        // exercise edit/add: { id|null, exerciseQuery, fields }
    draftBlock: null,     // { name, type, rounds, restBetweenRoundsSec }
    draftDay: null,       // { name, groupKey, isAlt }

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
    async routeFromHash() {
      const h = window.location.hash || '#/';
      this.editing = null; this.draftBlock = null; this.draftDay = null;
      const m = h.match(/^#\/(?:wizard|p\/(\d+)|v\/(\d+)(?:\/d\/(\d+)(?:\/b\/(\d+))?)?)?$/);
      if (h === '#/' || h === '' || h === '#') {
        this.view = 'programs';
        await this.loadPrograms();
        return;
      }
      if (h === '#/wizard') { this.openWizard(); return; }
      if (m && m[1]) {
        const p = await window.alfdb.programs.get(parseInt(m[1], 10));
        if (!p) return this.gotoHash('#/');
        const variants = await window.alfdb.variants.where({ programId: p.id }).toArray();
        const cur = variants.find(v => v.isCurrent) || variants[0];
        if (cur) return this.gotoHash('#/v/' + cur.id);
        return this.gotoHash('#/');
      }
      if (m && m[2]) {
        const variantId = parseInt(m[2], 10);
        const variant = await window.alfdb.variants.get(variantId);
        if (!variant) return this.gotoHash('#/');
        this.activeVariantId = variantId;
        this.activeProgramId = variant.programId;
        await this.loadPrograms();
        await this.loadVariants(variant.programId);
        await this.loadDays(variantId);
        if (m[3]) {
          const dayId = parseInt(m[3], 10);
          this.activeDayId = dayId;
          await this.loadBlocks(dayId);
          await this.loadExercises();
          if (m[4]) {
            const blockId = parseInt(m[4], 10);
            this.activeBlockId = blockId;
            await this.loadPrescriptions(blockId);
            this.view = 'block';
          } else {
            this.view = 'day';
          }
        } else {
          this.view = 'variant';
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
    async loadPrograms() {
      this.programs = await window.alfdb.programs.toArray();
    },
    async loadVariants(programId) {
      this.variants = await window.alfdb.variants.where({ programId }).toArray();
    },
    async loadDays(variantId) {
      const arr = await window.alfdb.days.where({ variantId }).toArray();
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

    // ----- Visible programs (hide archived) -----
    visiblePrograms() {
      if (this.showArchived) return this.programs;
      return this.programs.filter(p => p.status !== 'archived');
    },
    archivedCount() {
      return this.programs.filter(p => p.status === 'archived').length;
    },
    async archiveProgram(p) {
      if (!confirm('Archive ' + p.name + '? It stays in the database; toggle "show archived" to see it.')) return;
      await window.alfdb.programs.update(p.id, { status: 'archived' });
      await this.loadPrograms();
      this.showFlash('Archived');
    },
    async unarchiveProgram(p) {
      await window.alfdb.programs.update(p.id, { status: 'active' });
      await this.loadPrograms();
      this.showFlash('Restored');
    },

    // ----- Wizard -----
    openWizard() {
      this.wizard = { step: 1, programName: 'Workout 10', variantName: '10.1', dayKeys: ['A', 'B', 'C'], useSkeleton: true };
      this.view = 'wizard';
    },
    cancelWizard() { this.wizard = null; this.gotoHash('#/'); },
    async submitWizard() {
      const w = this.wizard;
      if (!w.programName.trim() || !w.variantName.trim()) { alert('Program and variant names are required.'); return; }
      let newVariantId = null;
      await window.alfdb.transaction('rw',
        [window.alfdb.programs, window.alfdb.variants, window.alfdb.days, window.alfdb.blocks],
        async () => {
          const programId = await window.alfdb.programs.add({
            name: w.programName.trim(), status: 'active', createdAt: new Date().toISOString()
          });
          const variantId = await window.alfdb.variants.add({
            programId, name: w.variantName.trim(), isCurrent: 1, createdAt: new Date().toISOString()
          });
          newVariantId = variantId;
          for (let i = 0; i < w.dayKeys.length; i++) {
            const key = w.dayKeys[i];
            const dayId = await window.alfdb.days.add({
              variantId, groupKey: key, name: 'Day ' + key, isAlt: 0, order: i + 1
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
      this.showFlash('Created ' + w.programName);
      this.gotoHash('#/v/' + newVariantId);
    },

    // ----- Variant view: Days CRUD -----
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
          variantId: this.activeVariantId, name, groupKey: d.groupKey,
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
      await this.loadDays(this.activeVariantId);
      this.showFlash('Day added');
    },
    async deleteDay(d) {
      if (!confirm('Delete ' + d.name + ' and its blocks/exercises?')) return;
      const blocks = await window.alfdb.blocks.where({ dayId: d.id }).toArray();
      for (const b of blocks) await window.alfdb.prescriptions.where({ blockId: b.id }).delete();
      await window.alfdb.blocks.where({ dayId: d.id }).delete();
      await window.alfdb.days.delete(d.id);
      await this.loadDays(this.activeVariantId);
      this.showFlash('Day deleted');
    },
    async moveDay(d, dir) {
      const idx = this.days.findIndex(x => x.id === d.id);
      const swap = this.days[idx + dir];
      if (!swap) return;
      await window.alfdb.days.update(d.id, { order: swap.order });
      await window.alfdb.days.update(swap.id, { order: d.order });
      await this.loadDays(this.activeVariantId);
    },
    daysGrouped() {
      const groups = {};
      for (const d of this.days) {
        const k = d.groupKey || '_';
        (groups[k] = groups[k] || []).push(d);
      }
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    },

    // ----- Day view: Blocks CRUD -----
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
    async renameBlock(b, name) {
      if (!name || name === b.name) return;
      await window.alfdb.blocks.update(b.id, { name });
      await this.loadBlocks(this.activeDayId);
    },

    // ----- Block view: Exercises CRUD (inline) -----
    async openAddExercise() {
      await this.loadExercises();
      const order = this.prescriptions.length + 1;
      this.editing = {
        id: null,
        exerciseQuery: '',
        fields: {
          blockId: this.activeBlockId,
          exerciseId: null,
          sets: 3, reps: 8, holdSec: null,
          sideScheme: 'bilateral',
          load: '',
          notable: false,
          notes: '',
          order
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
    activeBlock()    { return this.blocks.find(b => b.id === this.activeBlockId); },
    activeDay()      { return this.days.find(d => d.id === this.activeDayId); },
    activeVariant()  { return this.variants.find(v => v.id === this.activeVariantId); },
    activeProgram()  { return this.programs.find(p => p.id === this.activeProgramId); },

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
      // Derived per-view hint to surface what to do next.
      if (this.view === 'programs') {
        if (this.visiblePrograms().length === 0) return { kind: 'wizard', text: 'No active program. Start the new-program wizard.' };
        return { kind: 'open', text: 'Tap a program to open its current variant.' };
      }
      if (this.view === 'variant') {
        const empty = this.days.filter(d => (d._blockCount || 0) === 0);
        if (empty.length) return { kind: 'design', text: 'Empty days waiting: ' + empty.map(d => d.name).join(', ') };
        return { kind: 'edit', text: 'Tap a day to edit its blocks.' };
      }
      if (this.view === 'day') {
        if (this.blocks.length === 0) return { kind: 'add', text: 'Add the first block.' };
        const empty = this.blocks.filter(b => (b._exCount || 0) === 0);
        if (empty.length) return { kind: 'fill', text: 'Empty blocks: ' + empty.map(b => b.name).join(', ') };
        return { kind: 'review', text: 'All blocks have exercises. Review or reorder.' };
      }
      if (this.view === 'block') {
        if (this.prescriptions.length === 0) return { kind: 'add', text: 'Add the first exercise.' };
        return { kind: 'add', text: 'Add another exercise, or reorder the existing ones.' };
      }
      return null;
    },

    async resetEverything() {
      if (!confirm('Wipe local IndexedDB and re-seed Workout 9.2?')) return;
      await window.alfdbReset();
      this.gotoHash('#/');
      this.showFlash('DB reset');
    }
  };
}

window.alfApp = alfApp;
