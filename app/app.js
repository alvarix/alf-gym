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
    wishlist: [],
    showWishlistPanel: false,

    // Plan F: floating toolbar
    showToolbar: false,
    wishlistSheet: null,  // null | { query: '' }

    // Sessions
    sessions: [],
    activeSessionId: null,
    activeSession: null,
    activeSessionPerformances: [],   // [{ ...performance, _block, _sets[] }]
    sessionLoadError: false,
    endingSession: false,            // shows mood/env panel
    endMood: null,
    endEnv: 'gym',
    sessionSummaryOpen: false,       // in-place summary panel on completed sessions

    syntax: localStorage.getItem('alfgym.syntax') === '1',
    showArchived: false,
    showJson: false,
    jsonDump: '',
    jsonDumpMode: 'idb',  // 'idb' = buildBackup(), 'alpine' = in-memory state
    flash: '',

    // Backup / Restore (Phase A) — stopgap before Supabase.
    BACKUP_SCHEMA_VERSION: 5,
    BACKUP_STORES: ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'],
    showBackup: false,
    importText: '',
    importPreview: null,
    importError: '',
    hasUndo: !!localStorage.getItem('alfgym.lastBackup'),

    // Partial sessions (Phase B): inline add/remove exercise drafts.
    sessionAdd: null,       // { blockId, exerciseQuery, sets, reps, load, sideScheme, holdSec, notable, notes, lockedScope? }
    sessionRemove: null,    // { perfId }
    sessionAddBlock: null,  // { name, type, optional, rounds, restBetweenRoundsSec }

    // Plan E 1.3: session date editing.
    sessionStartDraft: null,  // { dayId, startedAt: 'YYYY-MM-DDTHH:mm' }
    sessionEditDate: null,    // { id, date: 'YYYY-MM-DD', _session }

    // Phase C: inline edit drafts. Kept as always-object (never null) to avoid
    // Alpine x-model teardown errors; check perfId/blockId for open state.
    sessionEditPerf: { perfId: null, fields: {} },
    sessionEditBlock: { blockId: null, fields: {} },

    editing: null,
    draftBlock: null,
    draftDay: null,
    wizard: null,

    now: new Date(),

    async init() {
      await window.alfdbSeed();
      await this.loadWishlist();
      await this.loadExercises();
      window.addEventListener('hashchange', () => this.routeFromHash());
      await this.routeFromHash();
      setInterval(() => { this.now = new Date(); }, 30000);
    },

    setSyntax(v) {
      this.syntax = v;
      localStorage.setItem('alfgym.syntax', v ? '1' : '0');
      // If editing, sync the visible fields to the new mode.
      if (this.editing) {
        if (v) this.editing.token = this.tokenFromFields(this.editing.fields);
        else this.fieldsFromToken(this.editing.token, this.editing.fields);
      }
      if (this.sessionEditPerf.perfId !== null) {
        if (v) this.sessionEditPerf.fields.token = this.tokenFromFields(this.sessionEditPerf.fields);
        else this.fieldsFromToken(this.sessionEditPerf.fields.token, this.sessionEditPerf.fields);
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
      const m = h.match(/^#\/(?:wizard|wishlist|sessions|s\/(\d+)|w\/(\d+)(?:\/d\/(\d+)(?:\/b\/(\d+))?)?)?$/);
      if (h === '#/' || h === '' || h === '#') { this.view = 'workouts'; await this.loadWorkouts(); return; }
      if (h === '#/wizard') { this.openWizard(); return; }
      if (h === '#/wishlist') { await this.loadWishlist(); this.view = 'wishlist'; return; }
      if (h === '#/sessions') { await this.loadSessions(); await this.loadWorkouts(); this.view = 'sessions'; return; }
      if (m && m[1]) { await this.openSession(parseInt(m[1], 10)); return; }
      if (m && m[2]) {
        const workoutId = parseInt(m[2], 10);
        const w = await window.alfdb.workouts.get(workoutId);
        if (!w) return this.gotoHash('#/');
        this.activeWorkoutId = workoutId;
        await this.loadWorkouts();
        await this.loadDays(workoutId);
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
    async loadWishlist() {
      const arr = await window.alfdb.wishlist.toArray();
      arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      this.wishlist = arr;
    },

    // ----- Sessions -----
    async loadSessions() {
      const arr = await window.alfdb.sessions.toArray();
      arr.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
      const allDays = await window.alfdb.days.toArray();
      const dayMap = {};
      for (const d of allDays) dayMap[d.id] = d.name;
      for (const s of arr) s._dayName = s.dayName || dayMap[s.dayId] || '';
      this.sessions = arr;
    },

    /**
     * @param {number} dayId
     * @param {string} [startedAt] - ISO timestamp; defaults to now
     */
    async startSessionForDay(dayId, startedAt) {
      // Build a session by snapshotting day -> blocks -> prescriptions into performances.
      try {
      const day = await window.alfdb.days.get(dayId);
      if (!day) return;
      // Use full-scan + filter for tables that may contain imported records.
      // Dexie secondary indexes are unreliable for rows added via bulkPut during import,
      // returning empty results even when matching rows exist.
      const allBlocks = await window.alfdb.blocks.toArray();
      const blocks = allBlocks.filter(b => b.dayId === dayId);
      blocks.sort((a, b) => a.order - b.order);
      console.log(`[startSessionForDay] dayId=${dayId} blocks.matched=${blocks.length}/${allBlocks.length}`);

      // Find the most recent completed session for this same day to prefill actuals.
      const allDaySessions = await window.alfdb.sessions.toArray();
      const prevSession = allDaySessions
        .filter(s => s.dayId === dayId && s.status === 'completed')
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null;

      // Build exerciseId -> sorted sets[] from that session.
      const allPerfsForPrev = await window.alfdb.performances.toArray();
      const allSetsForPrev = await window.alfdb.sets.toArray();
      const prevSetsByExerciseId = {};
      if (prevSession) {
        const prevPerfs = allPerfsForPrev.filter(p => p.sessionId === prevSession.id);
        for (const pp of prevPerfs) {
          const ppSets = allSetsForPrev.filter(s => s.performanceId === pp.id);
          ppSets.sort((a, b) => a.setIndex - b.setIndex);
          prevSetsByExerciseId[pp.exerciseId] = ppSets;
        }
      }

      // Load all prescriptions and exercises before the transaction (IDB transactions
      // can only access the stores they were opened with).
      const allPrescriptions = await window.alfdb.prescriptions.toArray();
      const blockPrescriptions = [];
      for (const b of blocks) {
        const prescriptions = allPrescriptions.filter(p => p.blockId === b.id);
        prescriptions.sort((a, b) => a.order - b.order);
        console.log(`[startSessionForDay] block=${b.id} (${b.name}) prescriptions=${prescriptions.length}`);
        for (const p of prescriptions) {
          const ex = await window.alfdb.exercises.get(p.exerciseId);
          blockPrescriptions.push({ block: b, prescription: p, exerciseName: ex ? ex.name : '?' });
        }
      }

      let newSessionId = null;
      await window.alfdb.transaction('rw',
        [window.alfdb.sessions, window.alfdb.performances, window.alfdb.sets],
        async () => {
          newSessionId = await window.alfdb.sessions.add({
            dayId,
            dayName: day.name,
            workoutId: day.workoutId,
            startedAt: startedAt || new Date().toISOString(),
            endedAt: null,
            status: 'in_progress',
            mood: null,
            env: null,
            note: ''
          });
          let order = 0;
          for (const { block: b, prescription: p, exerciseName } of blockPrescriptions) {
            order += 1;
            const perfId = await window.alfdb.performances.add({
              sessionId: newSessionId,
              prescriptionId: p.id,
              exerciseId: p.exerciseId,
              exerciseName,
              blockId: b.id,
              blockName: b.name,
              blockType: b.type,
              blockOptional: !!b.optional,
              blockRounds: b.rounds || null,
              blockRestBetweenRoundsSec: b.restBetweenRoundsSec || null,
              order,
              prescribedSets: p.sets || 1,
              prescribedReps: p.reps == null ? '' : String(p.reps),
              prescribedLoad: p.load || '',
              prescribedSideScheme: p.sideScheme || 'bilateral',
              prescribedHoldSec: p.holdSec || null,
              prescribedNotable: !!p.notable,
              notes: ''
            });
            const numSets = p.sets || 1;
            const prevSets = prevSetsByExerciseId[p.exerciseId] || [];
            for (let i = 1; i <= numSets; i++) {
              const prev = prevSets[i - 1] || null;
              await window.alfdb.sets.add({
                performanceId: perfId,
                setIndex: i,
                reps: prev ? (prev.reps || '') : '',
                load: prev ? (prev.load || '') : '',
                side: prev ? (prev.side || '') : '',
                holdSec: prev ? (prev.holdSec || null) : null,
                notable: false,
                done: false,
                prefilled: !!prev,
                notes: ''
              });
            }
          }
        });
      this.gotoHash('#/s/' + newSessionId);
      } catch (e) { console.error('startSessionForDay:', e.name, e.message, e); this.showFlash('Error: ' + (e.message || e.name || String(e))); }
    },

    async openSession(id) {
      const callId = Math.random().toString(36).slice(2, 7);
      console.log(`[openSession ${callId}] start id=${id} type=${typeof id}`);
      // Guard: hashchange has been observed firing this twice in rapid succession.
      // Drop a duplicate call for the same id while one is already in flight.
      if (this._openSessionInFlight === id) {
        console.log(`[openSession ${callId}] skipped — already loading id=${id}`);
        return;
      }
      this._openSessionInFlight = id;
      this.sessionLoadError = false;
      try {
        const s = await window.alfdb.sessions.get(id);
        console.log(`[openSession ${callId}] session=`, s ? { id: s.id, dayId: s.dayId, status: s.status } : null);
        if (!s) return this.gotoHash('#/');
        await this.loadExercises();
        if (!s.dayName) {
          const day = await window.alfdb.days.get(s.dayId);
          s._dayName = day ? day.name : '';
        } else {
          s._dayName = s.dayName;
        }
        this.activeSessionId = id;
        this.activeSession = s;
        const allPerfs = await window.alfdb.performances.toArray();
        const sessionIds = [...new Set(allPerfs.map(p => p.sessionId))];
        const perfs = allPerfs.filter(p => p.sessionId === id);
        console.log(`[openSession ${callId}] allPerfs.length=${allPerfs.length} sessionIds=${JSON.stringify(sessionIds)} matched=${perfs.length}`);
        perfs.sort((a, b) => a.order - b.order);
        const allSets = await window.alfdb.sets.toArray();
        const allPains = await window.alfdb.painMarks.toArray();
        for (const p of perfs) {
          const sets = allSets.filter(s => s.performanceId === p.id);
          sets.sort((a, b) => a.setIndex - b.setIndex);
          p._sets = sets;
          p._pains = allPains.filter(pm => pm.performanceId === p.id);
          p._showCues = false;
          p._editingSets = false;
        }
        this.activeSessionPerformances = perfs;
        this.view = 'session';
        this.endingSession = false;
        this.sessionSummaryOpen = false;
        console.log(`[openSession ${callId}] done — activeSessionPerformances.length=${this.activeSessionPerformances.length}`);
      } catch (e) {
        console.error(`[openSession ${callId}] error:`, e.name, e.message, e);
        this.sessionLoadError = true;
        this.view = 'session';
      } finally {
        if (this._openSessionInFlight === id) this._openSessionInFlight = null;
      }
    },

    sessionGroupedBlocks() {
      // Group performances by blockId, preserving order. Each group gets a
      // unique `key` derived from position + blockId so Alpine x-for doesn't
      // collide when the same blockId appears more than once (which can happen
      // when performances within a block aren't contiguous in `.order`, e.g.
      // after mid-session edits).
      const groups = [];
      let last = null;
      for (const p of this.activeSessionPerformances) {
        if (!last || last.blockId !== p.blockId) {
          last = { key: groups.length + '_' + p.blockId, blockId: p.blockId, blockName: p.blockName, blockType: p.blockType, blockOptional: p.blockOptional, blockRounds: p.blockRounds, performances: [] };
          groups.push(last);
        }
        last.performances.push(p);
      }
      return groups;
    },

    async updateSetField(perf, s, field, value) {
      const patch = { [field]: value };
      if (s.prefilled) { patch.prefilled = false; s.prefilled = false; }
      if ((field === 'reps' || field === 'load') && value !== '') { patch.done = true; s.done = true; }
      await window.alfdb.sets.update(s.id, patch);
      s[field] = value;
      if ((field === 'reps' || field === 'load') && value !== '') {
        const idx = perf._sets.indexOf(s);
        for (let i = idx + 1; i < perf._sets.length; i++) {
          const next = perf._sets[i];
          if (next.prefilled) {
            await window.alfdb.sets.update(next.id, { [field]: value });
            next[field] = value;
          }
        }
      }
    },

    async toggleSetDone(s) {
      const patch = { done: !s.done };
      if (s.prefilled) { patch.prefilled = false; s.prefilled = false; }
      await window.alfdb.sets.update(s.id, patch);
      s.done = !s.done;
    },

    async addSet(perf) {
      const next = (perf._sets[perf._sets.length - 1] || {});
      const newSet = {
        performanceId: perf.id,
        setIndex: perf._sets.length + 1,
        reps: next.reps || '',
        load: next.load || '',
        side: next.side || '',
        holdSec: next.holdSec || null,
        notable: false,
        done: false,
        notes: ''
      };
      const id = await window.alfdb.sets.add(newSet);
      newSet.id = id;
      perf._sets.push(newSet);
    },

    async removeSet(perf, s) {
      if (perf._sets.length <= 1) { alert('A performance must have at least one set row.'); return; }
      await window.alfdb.sets.delete(s.id);
      perf._sets = perf._sets.filter(x => x.id !== s.id);
    },

    async repeatLastSet(perf) {
      if (!perf._sets.length) return this.addSet(perf);
      const last = perf._sets[perf._sets.length - 1];
      const newSet = {
        performanceId: perf.id,
        setIndex: perf._sets.length + 1,
        reps: last.reps,
        load: last.load,
        side: last.side,
        holdSec: last.holdSec,
        notable: false,
        done: true,
        notes: ''
      };
      const id = await window.alfdb.sets.add(newSet);
      newSet.id = id;
      perf._sets.push(newSet);
    },

    async addPainToPerformance(perf) {
      const sevStr = prompt('Pain severity 1-10:');
      if (!sevStr) return;
      const severity = parseInt(sevStr, 10);
      if (!severity) return;
      const side = prompt('Side (L / R / both):', 'L') || '';
      const region = prompt('Region (hip, low back, knee, ...):') || '';
      const id = await window.alfdb.painMarks.add({
        sessionId: this.activeSessionId,
        performanceId: perf.id,
        severity, side, region,
        ts: new Date().toISOString()
      });
      perf._pains = perf._pains || [];
      perf._pains.push({ id, sessionId: this.activeSessionId, performanceId: perf.id, severity, side, region });
      this.showFlash('Pain logged');
    },

    async updatePerformanceNotes(perf, notes) {
      await window.alfdb.performances.update(perf.id, { notes });
      perf.notes = notes;
    },

    // ----- Phase B: partial sessions (add/remove exercise mid-session) -----

    openSessionAdd(blockId) {
      this.sessionAdd = {
        blockId,
        exerciseQuery: '',
        sets: 3,
        reps: 8,
        load: '',
        sideScheme: 'bilateral',
        holdSec: null,
        notable: false,
        notes: ''
      };
    },

    cancelSessionAdd() { this.sessionAdd = null; },

    openSessionRemove(perf) { this.sessionRemove = { perfId: perf.id }; },
    cancelSessionRemove() { this.sessionRemove = null; },

    openSessionAddBlock() {
      this.sessionAddBlock = {
        name: '',
        type: 'linear',
        optional: false,
        rounds: 3,
        restBetweenRoundsSec: 90
      };
    },

    cancelSessionAddBlock() { this.sessionAddBlock = null; },

    /**
     * Commit a new block to the active session with the given scope, then
     * immediately open an add-exercise draft scoped to it. Session-only
     * blocks use a string sentinel id and write no Block row; template
     * and fork blocks write a real Block row (to either the current day
     * or the freshly-forked day). The follow-up sessionAdd carries a
     * lockedScope so the exercise inherits the block's scope.
     * @param {'session'|'template'|'fork'} scope
     */
    async commitSessionAddBlock(scope) {
      if (!this.sessionAddBlock) return;
      const draft = this.sessionAddBlock;
      const name = (draft.name || '').trim() || 'New block';
      const type = draft.type || 'linear';
      const optional = !!draft.optional;
      const rounds = type === 'circuit' ? (parseInt(draft.rounds, 10) || 3) : null;
      const rest = type === 'circuit' ? (parseInt(draft.restBetweenRoundsSec, 10) || 90) : null;

      if (scope === 'fork') {
        const r = await this.forkSessionWorkout();
        if (!r) return;
      }

      let blockId;
      let lockedExerciseScope;
      if (scope === 'template' || scope === 'fork') {
        const dayId = this.activeSession.dayId;
        const existing = await window.alfdb.blocks.where({ dayId }).toArray();
        const order = existing.reduce((m, b) => Math.max(m, b.order || 0), 0) + 1;
        const fields = { dayId, name, type, optional, order };
        if (type === 'circuit') { fields.rounds = rounds; fields.restBetweenRoundsSec = rest; }
        blockId = await window.alfdb.blocks.add(fields);
        // Already in the fork (if we forked); subsequent exercise add is 'template'.
        lockedExerciseScope = 'template';
      } else {
        // session only: sentinel string id, no Block row written.
        blockId = 'sess-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        lockedExerciseScope = 'session';
      }

      this.sessionAddBlock = null;
      this.sessionAdd = {
        blockId,
        blockName: name,
        blockType: type,
        blockOptional: optional,
        blockRounds: rounds,
        blockRestBetweenRoundsSec: rest,
        exerciseQuery: '',
        sets: 3,
        reps: 8,
        load: '',
        sideScheme: 'bilateral',
        holdSec: null,
        notable: false,
        notes: '',
        lockedScope: lockedExerciseScope
      };
      this.showFlash('Block ready — add an exercise');
    },

    /**
     * Fork the workout backing the active session. Deep-copies workout/days/
     * blocks/prescriptions; re-points session.workoutId, session.dayId, and
     * every performance row in the session to the corresponding entities in
     * the new fork. Returns the id maps so a follow-up template mutation
     * (add/remove/edit) targets the fork instead of the original.
     * @returns {Promise<{newWorkoutId, blockIdMap, prescriptionIdMap, dayIdMap}|null>}
     */
    async forkSessionWorkout() {
      const session = this.activeSession;
      if (!session) return null;
      const oldWorkout = await window.alfdb.workouts.get(session.workoutId);
      if (!oldWorkout) return null;

      const blockIdMap = {};
      const prescriptionIdMap = {};
      const dayIdMap = {};
      let newWorkoutId = null;
      const newName = this.suggestForkName(oldWorkout.name);

      await window.alfdb.transaction('rw',
        [window.alfdb.workouts, window.alfdb.days, window.alfdb.blocks, window.alfdb.prescriptions, window.alfdb.sessions, window.alfdb.performances],
        async () => {
          newWorkoutId = await window.alfdb.workouts.add({
            name: newName, parentId: oldWorkout.id, status: 'active', isCurrent: 1, createdAt: new Date().toISOString()
          });
          const oldDays = await window.alfdb.days.where({ workoutId: oldWorkout.id }).toArray();
          for (const d of oldDays) {
            const newDayId = await window.alfdb.days.add({ workoutId: newWorkoutId, groupKey: d.groupKey, name: d.name, isAlt: d.isAlt, order: d.order });
            dayIdMap[d.id] = newDayId;
            const oldBlocks = await window.alfdb.blocks.where({ dayId: d.id }).toArray();
            for (const b of oldBlocks) {
              const newBlockId = await window.alfdb.blocks.add({
                dayId: newDayId, name: b.name, type: b.type, optional: !!b.optional,
                rounds: b.rounds, restBetweenRoundsSec: b.restBetweenRoundsSec, order: b.order
              });
              blockIdMap[b.id] = newBlockId;
              const oldP = await window.alfdb.prescriptions.where({ blockId: b.id }).toArray();
              for (const p of oldP) {
                const newPId = await window.alfdb.prescriptions.add({
                  blockId: newBlockId, exerciseId: p.exerciseId, sets: p.sets, reps: p.reps, holdSec: p.holdSec,
                  sideScheme: p.sideScheme, load: p.load, notable: !!p.notable,
                  notes: p.notes || '', order: p.order
                });
                prescriptionIdMap[p.id] = newPId;
              }
            }
          }
          await window.alfdb.workouts.update(oldWorkout.id, { isCurrent: 0 });

          const sessionPerfs = await window.alfdb.performances.where({ sessionId: session.id }).toArray();
          for (const perf of sessionPerfs) {
            const patch = {};
            if (perf.blockId && blockIdMap[perf.blockId]) patch.blockId = blockIdMap[perf.blockId];
            if (perf.prescriptionId && prescriptionIdMap[perf.prescriptionId]) patch.prescriptionId = prescriptionIdMap[perf.prescriptionId];
            if (Object.keys(patch).length) await window.alfdb.performances.update(perf.id, patch);
          }

          const newDayId = dayIdMap[session.dayId] || session.dayId;
          await window.alfdb.sessions.update(session.id, { workoutId: newWorkoutId, dayId: newDayId });
        });

      this.activeSession.workoutId = newWorkoutId;
      this.activeSession.dayId = dayIdMap[this.activeSession.dayId] || this.activeSession.dayId;
      for (const perf of this.activeSessionPerformances) {
        if (perf.blockId && blockIdMap[perf.blockId]) perf.blockId = blockIdMap[perf.blockId];
        if (perf.prescriptionId && prescriptionIdMap[perf.prescriptionId]) perf.prescriptionId = prescriptionIdMap[perf.prescriptionId];
      }
      return { newWorkoutId, blockIdMap, prescriptionIdMap, dayIdMap };
    },

    /**
     * Resolve an exercise by name (case-insensitive). Creates a new exercise
     * library entry if no match exists.
     * @param {string} query
     * @returns {Promise<object|null>}
     */
    async resolveExerciseByName(query) {
      const q = (query || '').trim();
      if (!q) return null;
      await this.loadExercises();
      let ex = this.exercises.find(e => e.name.toLowerCase() === q.toLowerCase());
      if (!ex) {
        const id = await window.alfdb.exercises.add({ name: q, parentId: null, category: '', equipment: '' });
        await this.loadExercises();
        ex = this.exercises.find(e => e.id === id);
      }
      return ex;
    },

    /**
     * Commit the sessionAdd draft with the given scope. If draft.lockedScope
     * is set (from a fresh session-only block), that scope wins regardless.
     * @param {'session'|'template'|'fork'} scope
     */
    async commitSessionAdd(scope) {
      if (!this.sessionAdd) return;
      const draft = this.sessionAdd;
      if (draft.lockedScope) scope = draft.lockedScope;
      const ex = await this.resolveExerciseByName(draft.exerciseQuery);
      if (!ex) { alert('Type or pick an exercise name.'); return; }

      let targetBlockId = draft.blockId;
      if (scope === 'fork') {
        const r = await this.forkSessionWorkout();
        if (!r) return;
        targetBlockId = r.blockIdMap[draft.blockId] || draft.blockId;
      }

      // Session-only blocks use a string sentinel id and have no Block row;
      // fall back to the block fields stashed on the draft.
      let block = typeof targetBlockId === 'number' ? await window.alfdb.blocks.get(targetBlockId) : null;
      if (!block) {
        block = {
          id: targetBlockId,
          name: draft.blockName || 'New block',
          type: draft.blockType || 'linear',
          optional: !!draft.blockOptional,
          rounds: draft.blockRounds || null,
          restBetweenRoundsSec: draft.blockRestBetweenRoundsSec || null
        };
      }

      const numSets = parseInt(draft.sets, 10) || 1;
      const holdSec = draft.holdSec ? parseInt(draft.holdSec, 10) : null;
      let prescriptionId = null;

      if (scope === 'template' || scope === 'fork') {
        const orderInBlock = await window.alfdb.prescriptions.where({ blockId: targetBlockId }).count();
        prescriptionId = await window.alfdb.prescriptions.add({
          blockId: targetBlockId,
          exerciseId: ex.id,
          sets: numSets,
          reps: draft.reps === '' || draft.reps == null ? null : draft.reps,
          load: draft.load || '',
          sideScheme: draft.sideScheme || 'bilateral',
          holdSec,
          notable: !!draft.notable,
          notes: draft.notes || '',
          order: orderInBlock + 1
        });
      }

      const sessionOrder = this.activeSessionPerformances
        .reduce((max, p) => Math.max(max, p.order || 0), 0) + 1;

      const perfRow = {
        sessionId: this.activeSessionId,
        prescriptionId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        blockId: targetBlockId,
        blockName: block.name,
        blockType: block.type,
        blockOptional: !!block.optional,
        blockRounds: block.rounds || null,
        blockRestBetweenRoundsSec: block.restBetweenRoundsSec || null,
        order: sessionOrder,
        prescribedSets: numSets,
        prescribedReps: draft.reps == null ? '' : String(draft.reps),
        prescribedLoad: draft.load || '',
        prescribedSideScheme: draft.sideScheme || 'bilateral',
        prescribedHoldSec: holdSec,
        prescribedNotable: !!draft.notable,
        notes: ''
      };
      const perfId = await window.alfdb.performances.add(perfRow);

      const newSets = [];
      for (let i = 1; i <= numSets; i++) {
        const setId = await window.alfdb.sets.add({
          performanceId: perfId, setIndex: i,
          reps: '', load: '', side: '', holdSec: null,
          notable: false, done: false, prefilled: false, notes: ''
        });
        newSets.push({ id: setId, performanceId: perfId, setIndex: i, reps: '', load: '', side: '', holdSec: null, notable: false, done: false, prefilled: false, notes: '' });
      }

      const newPerf = { id: perfId, ...perfRow, _sets: newSets, _pains: [], _showCues: false, _editingSets: false };
      let insertIdx = this.activeSessionPerformances.length;
      for (let i = this.activeSessionPerformances.length - 1; i >= 0; i--) {
        if (this.activeSessionPerformances[i].blockId === targetBlockId) {
          insertIdx = i + 1;
          break;
        }
      }
      this.activeSessionPerformances.splice(insertIdx, 0, newPerf);

      this.sessionAdd = null;
      this.showFlash('Added (' + scope + ')');
    },

    /**
     * Commit the sessionRemove draft with the given scope.
     * @param {'session'|'template'|'fork'} scope
     */
    async commitSessionRemove(scope) {
      if (!this.sessionRemove) return;
      const perf = this.activeSessionPerformances.find(p => p.id === this.sessionRemove.perfId);
      if (!perf) { this.sessionRemove = null; return; }

      if (scope === 'fork') {
        const r = await this.forkSessionWorkout();
        if (!r) return;
        // perf reference was mutated in-place to point at fork ids.
      }

      await window.alfdb.transaction('rw',
        [window.alfdb.performances, window.alfdb.sets, window.alfdb.prescriptions],
        async () => {
          await window.alfdb.sets.where({ performanceId: perf.id }).delete();
          await window.alfdb.performances.delete(perf.id);
          if ((scope === 'template' || scope === 'fork') && perf.prescriptionId) {
            await window.alfdb.prescriptions.delete(perf.prescriptionId);
          }
        });

      this.activeSessionPerformances = this.activeSessionPerformances.filter(p => p.id !== perf.id);
      this.sessionRemove = null;
      this.showFlash('Removed (' + scope + ')');
    },

    // ── Phase C: edit prescriptions and blocks mid-session ──────────────────

    /**
     * Open an inline edit draft for a single performance.
     * @param {object} perf - Performance row from activeSessionPerformances.
     */
    openEditPerf(perf) {
      const fields = {
        exerciseQuery: perf.exerciseName || '',
        sets: perf.prescribedSets || 1,
        reps: perf.prescribedReps == null ? '' : String(perf.prescribedReps),
        load: perf.prescribedLoad || '',
        sideScheme: perf.prescribedSideScheme || 'bilateral',
        holdSec: perf.prescribedHoldSec || null,
        notable: !!perf.prescribedNotable,
        notes: perf.notes || ''
      };
      fields.token = this.tokenFromFields(fields);
      this.sessionEditPerf = { perfId: perf.id, fields };
    },

    cancelEditPerf() { this.sessionEditPerf = { perfId: null, fields: {} }; },

    /**
     * Commit the sessionEditPerf draft with the given scope.
     * Set-row counts are not adjusted when prescribedSets changes;
     * the user manages actuals via existing + set / × set affordances.
     * @param {'session'|'template'|'fork'} scope
     */
    async commitEditPerf(scope) {
      if (!this.sessionEditPerf.perfId) return;
      const draft = this.sessionEditPerf;
      const perf = this.activeSessionPerformances.find(p => p.id === draft.perfId);
      if (!perf) { this.sessionEditPerf = null; return; }

      // session-only perfs (null prescriptionId) are locked to session scope.
      if (perf.prescriptionId == null) scope = 'session';

      if (this.syntax) this.fieldsFromToken(draft.fields.token, draft.fields);

      const ex = await this.resolveExerciseByName(draft.fields.exerciseQuery);
      if (!ex) { alert('Type or pick an exercise name.'); return; }

      if (scope === 'fork') {
        const r = await this.forkSessionWorkout();
        if (!r) return;
        // perf is mutated in-place by forkSessionWorkout to point at fork ids.
      }

      const holdSec = draft.fields.holdSec ? parseInt(draft.fields.holdSec, 10) : null;
      const perfPatch = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        prescribedSets: parseInt(draft.fields.sets, 10) || 1,
        prescribedReps: draft.fields.reps == null ? '' : String(draft.fields.reps),
        prescribedLoad: draft.fields.load || '',
        prescribedSideScheme: draft.fields.sideScheme || 'bilateral',
        prescribedHoldSec: holdSec,
        prescribedNotable: !!draft.fields.notable,
        notes: draft.fields.notes || ''
      };

      if (scope !== 'session' && perf.prescriptionId != null) {
        await window.alfdb.prescriptions.update(perf.prescriptionId, {
          exerciseId: ex.id,
          sets: perfPatch.prescribedSets,
          reps: perfPatch.prescribedReps === '' ? null : perfPatch.prescribedReps,
          load: perfPatch.prescribedLoad,
          sideScheme: perfPatch.prescribedSideScheme,
          holdSec,
          notable: !!draft.fields.notable,
          notes: draft.fields.notes || ''
        });
      }

      await window.alfdb.performances.update(perf.id, perfPatch);
      Object.assign(perf, perfPatch);

      this.sessionEditPerf = { perfId: null, fields: {} };
      this.showFlash('Exercise updated (' + scope + ')');
    },

    /**
     * Open an inline edit draft for a block group.
     * @param {object} g - Group object from sessionGroupedBlocks().
     */
    openEditBlock(g) {
      this.sessionEditBlock = {
        blockId: g.blockId,
        fields: {
          name: g.blockName || '',
          type: g.blockType || 'linear',
          optional: !!g.blockOptional,
          rounds: g.blockRounds || 3,
          restBetweenRoundsSec: g.performances[0] ? (g.performances[0].blockRestBetweenRoundsSec || 90) : 90
        }
      };
    },

    cancelEditBlock() { this.sessionEditBlock = { blockId: null, fields: {} }; },

    /**
     * Commit the sessionEditBlock draft with the given scope.
     * String-sentinel blockIds (session-only blocks) are locked to session scope.
     * @param {'session'|'template'|'fork'} scope
     */
    async commitEditBlock(scope) {
      if (this.sessionEditBlock.blockId === null) return;
      const draft = this.sessionEditBlock;
      let blockId = draft.blockId;

      // Sentinel guard: session-only blocks have no template row.
      if (typeof blockId === 'string') scope = 'session';

      if (scope === 'fork') {
        const r = await this.forkSessionWorkout();
        if (!r) return;
        blockId = r.blockIdMap[blockId] || blockId;
      }

      const name = (draft.fields.name || '').trim() || 'Block';
      const type = draft.fields.type || 'linear';
      const optional = !!draft.fields.optional;
      const rounds = type === 'circuit' ? (parseInt(draft.fields.rounds, 10) || 3) : null;
      const rest = type === 'circuit' ? (parseInt(draft.fields.restBetweenRoundsSec, 10) || 90) : null;

      if (scope !== 'session') {
        await window.alfdb.blocks.update(blockId, { name, type, optional, rounds, restBetweenRoundsSec: rest });
      }

      // Always patch denormalized fields on every performance in this session for this block.
      const perfPatch = { blockName: name, blockType: type, blockOptional: optional, blockRounds: rounds, blockRestBetweenRoundsSec: rest };
      for (const perf of this.activeSessionPerformances) {
        if (perf.blockId === blockId || perf.blockId === draft.blockId) {
          await window.alfdb.performances.update(perf.id, perfPatch);
          Object.assign(perf, perfPatch);
        }
      }

      this.sessionEditBlock = { blockId: null, fields: {} };
      this.showFlash('Block updated (' + scope + ')');
    },

    sessionElapsed(s) {
      if (!s) return '';
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : this.now;
      const mins = Math.max(0, Math.round((end - start) / 60000));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h ? (h + 'h ' + m + 'm') : (m + 'm');
    },

    sessionStartTime(s) {
      if (!s || !s.startedAt) return '';
      return new Date(s.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    },

    tokenFromSet(s) {
      if (s.prefilled) return '';
      let out = s.load || '';
      if (s.notable) out += '!';
      if (s.holdSec) out += (out ? ' ' : '') + s.holdSec + 's';
      if (s.reps) {
        out += (out ? ' ' : '') + s.reps;
      }
      return out.trim();
    },

    async applySetToken(perf, s, token) {
      const t = (token || '').trim();
      let reps = '', load = '', side = '', holdSec = null, notable = false;
      if (t.includes(';')) {
        const idx = t.indexOf(';');
        let lp = t.slice(0, idx).trim();
        const rp = t.slice(idx + 1).trim();
        if (lp.endsWith('!')) { notable = true; lp = lp.slice(0, -1); }
        load = lp; side = 'L';
        const hm = rp.match(/^([\d.]+)s$/i);
        if (hm) holdSec = parseInt(hm[1], 10); else reps = rp;
      } else {
        const parts = t.split(/\s+/);
        let lp = parts.length > 1 ? parts.slice(0, -1).join(' ') : t;
        const rp = parts.length > 1 ? parts[parts.length - 1] : '';
        if (lp.endsWith('!')) { notable = true; lp = lp.slice(0, -1); }
        const hm = lp.match(/^([\d.]+)s$/i);
        if (hm) holdSec = parseInt(hm[1], 10); else load = lp;
        reps = rp;
      }
      const patch = { reps, load, side, holdSec, notable };
      if (s.prefilled) { patch.prefilled = false; s.prefilled = false; }
      if (reps !== '' || load !== '') { patch.done = true; s.done = true; }
      await window.alfdb.sets.update(s.id, patch);
      Object.assign(s, patch);
      if (load !== '' && perf) {
        const idx = perf._sets.indexOf(s);
        for (let i = idx + 1; i < perf._sets.length; i++) {
          const next = perf._sets[i];
          if (next.prefilled) {
            await window.alfdb.sets.update(next.id, { load });
            next.load = load;
          }
        }
      }
    },

    /** @param {object[]} sets */
    tokenFromSets(sets) {
      return sets.map(s => this.tokenFromSet(s)).join(' / ');
    },

    /**
     * Parse a flattened token string (sets joined by " / ") and sync to DB.
     * Adds or removes set rows to match the token count.
     * @param {object} perf
     * @param {string} tokenStr
     */
    async applyAllSetsToken(perf, tokenStr) {
      const tokens = tokenStr.split('/').map(t => t.trim()).filter(Boolean);
      // Update or add sets to match token count
      for (let i = 0; i < tokens.length; i++) {
        if (i >= perf._sets.length) await this.addSet(perf);
        await this.applySetToken(perf, perf._sets[i], tokens[i]);
      }
      // Remove trailing sets if fewer tokens than existing sets
      while (perf._sets.length > tokens.length && perf._sets.length > 1) {
        await this.removeSet(perf, perf._sets[perf._sets.length - 1]);
      }
    },

    sessionDayName(s) {
      // Best-effort: load not pre-cached. Use session record's denorm if present, else fallback.
      return (s && (s.dayName || ('day ' + s.dayId))) || '';
    },

    sessionWorkoutName(s) {
      const w = this.workouts.find(x => x.id === s.workoutId);
      return w ? w.name : '';
    },

    openEndPanel() {
      this.endingSession = true;
      this.endMood = null;
      this.endEnv = 'gym';
    },
    closeEndPanel() { this.endingSession = false; },

    async commitEndSession() {
      const id = this.activeSessionId;
      if (!id) return;
      await window.alfdb.sessions.update(id, {
        endedAt: new Date().toISOString(),
        status: 'completed',
        mood: this.endMood,
        env: this.endEnv
      });
      this.activeSession.endedAt = new Date().toISOString();
      this.activeSession.status = 'completed';
      this.activeSession.mood = this.endMood;
      this.activeSession.env = this.endEnv;
      this.endingSession = false;
      this.showFlash('Session saved');
    },

    // ----- Completed-session exports -----

    /** Toggle in-place human-readable summary panel. */
    toggleSessionSummary() { this.sessionSummaryOpen = !this.sessionSummaryOpen; },

    /**
     * Build a human-readable plain-text summary of the active session,
     * including blocks, sets (with prescribed vs actual), pain marks, and notes.
     * @returns {string}
     */
    buildSessionSummary() {
      const s = this.activeSession;
      if (!s) return '';
      const lines = [];
      const date = (s.startedAt || '').slice(0, 10);
      const startT = this.sessionStartTime(s);
      const dur = this.sessionElapsed(s);
      const wk = this.sessionWorkoutName(s);
      const day = s._dayName || '';
      lines.push(`${date} ${startT} — ${wk}${day ? ' / ' + day : ''}`);
      const meta = [`duration ${dur}`];
      if (s.env) meta.push(`env ${s.env}`);
      if (s.mood) meta.push(`mood ${s.mood}/5`);
      lines.push(meta.join(' · '));
      lines.push('');

      const groups = this.sessionGroupedBlocks();
      groups.forEach((g, gi) => {
        let head = `${gi + 1}. ${g.blockName}`;
        if (g.blockType === 'circuit') head += ` (circuit · ${g.blockRounds} rounds)`;
        if (g.blockOptional) head += ' (optional)';
        lines.push(head);
        g.performances.forEach((p, pi) => {
          const presc = [];
          if (p.prescribedLoad) presc.push(`load ${p.prescribedLoad}`);
          if (p.prescribedReps) presc.push(`reps ${p.prescribedReps}`);
          const prescStr = presc.length ? ` — prescribed: ${presc.join(', ')}` : '';
          lines.push(`  ${gi + 1}.${pi + 1} ${p.exerciseName}${prescStr}`);
          (p._sets || []).forEach(st => {
            const parts = [`#${st.setIndex}`];
            const load = st.prefilled ? `(${st.load})` : (st.load || '—');
            const reps = st.prefilled ? `(${st.reps})` : (st.reps || '—');
            parts.push(`load ${load}`, `reps ${reps}`);
            if (st.holdSec) parts.push(`${st.holdSec}s hold`);
            if (st.notable) parts.push('notable');
            parts.push(st.done ? 'done' : 'not done');
            if (st.notes) parts.push(`note: ${st.notes}`);
            lines.push(`      ${parts.join(' · ')}`);
          });
          if (p._pains && p._pains.length) {
            const pains = p._pains.map(pn => `$${pn.severity} ${pn.side || ''} ${pn.region || ''}`.trim()).join('; ');
            lines.push(`      pain: ${pains}`);
          }
          if (p.notes) lines.push(`      note: ${p.notes}`);
        });
        lines.push('');
      });
      return lines.join('\n').trimEnd() + '\n';
    },

    /** Filename stem for exports tied to the active session. */
    _sessionFileStem() {
      const s = this.activeSession;
      const date = (s && s.startedAt || '').slice(0, 10) || 'session';
      const wk = (this.sessionWorkoutName(s) || 'session').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      return `alfgym-${date}-${wk}`;
    },

    downloadSessionSummary() {
      const text = this.buildSessionSummary();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this._sessionFileStem() + '.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showFlash('Summary downloaded');
    },

    async copySessionSummary() {
      await navigator.clipboard.writeText(this.buildSessionSummary());
      this.showFlash('Summary copied');
    },

    /** Quote a CSV cell if it contains comma, quote, or newline. */
    _csvCell(v) {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    },

    /**
     * Build a CSV (one row per set) for the active session.
     * @returns {string}
     */
    buildSessionCsv() {
      const s = this.activeSession;
      if (!s) return '';
      const date = (s.startedAt || '').slice(0, 10);
      const wk = this.sessionWorkoutName(s) || '';
      const day = s._dayName || '';
      const cols = ['date','workout','day','block','block_type','exercise','set','prescribed_load','prescribed_reps','actual_load','actual_reps','hold_sec','done','notable','prefilled','set_notes','perf_notes','pain'];
      const rows = [cols.join(',')];
      const groups = this.sessionGroupedBlocks();
      for (const g of groups) {
        for (const p of g.performances) {
          const painStr = (p._pains || []).map(pn => `$${pn.severity} ${pn.side || ''} ${pn.region || ''}`.trim()).join('; ');
          const sets = p._sets && p._sets.length ? p._sets : [{ setIndex: '', load: '', reps: '', holdSec: '', done: '', notable: '', prefilled: '', notes: '' }];
          for (const st of sets) {
            const row = [
              date, wk, day, g.blockName, g.blockType, p.exerciseName, st.setIndex,
              p.prescribedLoad || '', p.prescribedReps || '',
              st.load || '', st.reps || '', st.holdSec || '',
              st.done ? 'yes' : 'no', st.notable ? 'yes' : 'no', st.prefilled ? 'yes' : 'no',
              st.notes || '', p.notes || '', painStr
            ].map(v => this._csvCell(v));
            rows.push(row.join(','));
          }
        }
      }
      return rows.join('\n') + '\n';
    },

    exportSessionCsv() {
      const csv = this.buildSessionCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this._sessionFileStem() + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showFlash('CSV downloaded');
    },

    async deleteSession(s) {
      if (!confirm('Delete this session and all its captured data?')) return;
      const perfs = await window.alfdb.performances.where({ sessionId: s.id }).toArray();
      for (const p of perfs) {
        await window.alfdb.sets.where({ performanceId: p.id }).delete();
      }
      await window.alfdb.performances.where({ sessionId: s.id }).delete();
      await window.alfdb.painMarks.where({ sessionId: s.id }).delete();
      await window.alfdb.sessions.delete(s.id);
      await this.loadSessions();
      this.showFlash('Session deleted');
    },

    // ----- Plan E 1.3: session date editing -----

    openSessionStartPicker(dayId) {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const local = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
        + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      this.sessionStartDraft = { dayId, startedAt: local };
    },

    cancelSessionStartPicker() { this.sessionStartDraft = null; },

    async commitSessionStart() {
      if (!this.sessionStartDraft) return;
      const { dayId, startedAt } = this.sessionStartDraft;
      this.sessionStartDraft = null;
      await this.startSessionForDay(dayId, new Date(startedAt).toISOString());
    },

    openSessionDateEdit(s) {
      this.sessionEditDate = { id: s.id, date: (s.startedAt || '').slice(0, 10), _session: s };
    },

    closeSessionDateEdit() { this.sessionEditDate = null; },

    async commitSessionDateEdit() {
      if (!this.sessionEditDate) return;
      const { id, date, _session } = this.sessionEditDate;
      const origIso = _session.startedAt || new Date().toISOString();
      // Keep original time-of-day, change only the calendar date.
      const origTime = origIso.slice(10); // 'T...Z' suffix
      const newStartedAt = date + origTime;
      const update = { startedAt: newStartedAt };
      if (_session.endedAt) {
        const delta = new Date(newStartedAt) - new Date(origIso);
        update.endedAt = new Date(new Date(_session.endedAt).getTime() + delta).toISOString();
      }
      await window.alfdb.sessions.update(id, update);
      Object.assign(_session, update);
      if (this.activeSession && this.activeSession.id === id) {
        Object.assign(this.activeSession, update);
      }
      await this.loadSessions();
      this.sessionEditDate = null;
      this.showFlash('Date updated');
    },

    // ----- Wishlist actions -----
    async addToWishlistFromEditor() {
      const q = (this.editing && this.editing.exerciseQuery || '').trim();
      if (!q) { alert('Type an exercise name first.'); return; }
      await window.alfdb.wishlist.add({
        exerciseName: q,
        notes: (this.editing.fields.notes || '').trim(),
        createdAt: new Date().toISOString()
      });
      await this.loadWishlist();
      this.showFlash('Added to wishlist');
    },
    async addStandaloneWishlistItem() {
      const name = prompt('Exercise to wishlist (just the name):');
      if (!name || !name.trim()) return;
      await window.alfdb.wishlist.add({
        exerciseName: name.trim(),
        notes: '',
        createdAt: new Date().toISOString()
      });
      await this.loadWishlist();
      this.showFlash('Added to wishlist');
    },
    async removeWishlistItem(item) {
      await window.alfdb.wishlist.delete(item.id);
      await this.loadWishlist();
    },

    // ----- Plan F: floating toolbar / wishlist quick-add -----

    openWishlistSheet() {
      this.showToolbar = false;
      this.wishlistSheet = { query: '' };
    },

    closeWishlistSheet() { this.wishlistSheet = null; },

    async commitWishlistQuickAdd() {
      if (!this.wishlistSheet) return;
      const name = (this.wishlistSheet.query || '').trim();
      if (!name) { this.showFlash('Enter an exercise name'); return; }
      await window.alfdb.wishlist.add({
        exerciseName: name,
        notes: '',
        createdAt: new Date().toISOString()
      });
      await this.loadWishlist();
      this.wishlistSheet = null;
      this.showFlash('Added to wishlist: ' + name);
    },

    async pullFromWishlist(item) {
      // Open the add-exercise draft with this name pre-filled.
      await this.openAddExercise();
      this.editing.exerciseQuery = item.exerciseName;
      if (item.notes) this.editing.fields.notes = item.notes;
      // Optionally remove on use; leave it for now so user keeps the wishlist intact until they confirm.
    },

    exerciseName(id) { const ex = this.exercises.find(e => e.id === id); return ex ? ex.name : '?'; },
    exerciseCues(id) { const ex = this.exercises.find(e => e.id === id); return ex ? (ex.cues || '') : ''; },
    prescribedForSet(str, setIndex) {
      if (!str && str !== 0) return '';
      const parts = String(str).split(',').map(p => p.trim());
      return parts[setIndex - 1] ?? parts[parts.length - 1] ?? '';
    },
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
        notable: false, notes: '', cues: '', order
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
      const ex = this.exercises.find(e => e.id === p.exerciseId);
      const fields = { ...p, notable: !!p.notable, notes: p.notes || '', loadKind: parsed.kind, loadValue: parsed.value, cues: ex ? (ex.cues || '') : '' };
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
      if (this.editing.fields.cues !== undefined) {
        await window.alfdb.exercises.update(ex.id, { cues: this.editing.fields.cues || '' });
        await this.loadExercises();
      }
      const f = { ...this.editing.fields };
      // strip ui-only fields before save
      delete f.loadKind; delete f.loadValue; delete f.cues;
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

    async duplicateExercise(p) {
      const order = this.prescriptions.length + 1;
      const copy = { ...p };
      delete copy.id;
      copy.order = order;
      await window.alfdb.prescriptions.add(copy);
      await this.loadPrescriptions(this.activeBlockId);
      this.showFlash('Duplicated');
    },

    async saveAndAddAnother() {
      // Save current draft, then immediately open a fresh add-exercise draft.
      await this.saveEdit();
      await this.openAddExercise();
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
        if (this.visibleWorkouts().length === 1) return { text: 'Tap your workout to open its days, or jump to Sessions to see history.' };
        return { text: 'Tap a workout to open its days, or fork one to a new revision.' };
      }
      if (this.view === 'workout') {
        const empty = this.days.filter(d => (d._blockCount || 0) === 0);
        if (empty.length) return { text: 'Empty days waiting: ' + empty.map(d => d.name).join(', ') };
        return { text: 'Tap a day to edit its blocks, or tap ▶ on a day to start a session.' };
      }
      if (this.view === 'day') {
        if (this.blocks.length === 0) return { text: 'Add the first block.' };
        const empty = this.blocks.filter(b => (b._exCount || 0) === 0);
        if (empty.length) return { text: 'Empty blocks: ' + empty.map(b => b.name).join(', ') };
        return { text: 'All blocks have exercises. Tap ▶ start session above to log this day.' };
      }
      if (this.view === 'block') {
        if (this.prescriptions.length === 0) return { text: 'Add the first exercise.' };
        return { text: 'Tap an exercise title to edit. Tap again to close.' };
      }
      if (this.view === 'sessions') {
        if (this.sessions.length === 0) return { text: 'No sessions yet. Start one from any day.' };
        return { text: 'Tap a session to view or continue.' };
      }
      if (this.view === 'session') {
        if (this.activeSession && this.activeSession.status === 'in_progress') return { text: 'Capture set values inline. Tap End when finished.' };
        return { text: 'This session is completed. View only.' };
      }
      return null;
    },

    async resetEverything() {
      if (!confirm('Wipe local IndexedDB and re-seed?')) return;
      await window.alfdbReset();
      this.gotoHash('#/');
      this.showFlash('DB reset');
    },

    // ----- Phase A: Backup / Restore -----

    async refreshJsonDump() {
      if (this.jsonDumpMode === 'idb') {
        const data = await this.buildBackup();
        this.jsonDump = JSON.stringify(data, null, 2);
      } else {
        const { workouts, days, blocks, prescriptions, exercises } = this;
        this.jsonDump = JSON.stringify(
          { workouts, days, blocks, prescriptions, exercises, _hash: window.location.hash },
          null, 2
        );
      }
    },

    async setJsonDumpMode(mode) {
      this.jsonDumpMode = mode;
      await this.refreshJsonDump();
    },

    async buildBackup() {
      const stores = {};
      for (const name of this.BACKUP_STORES) {
        stores[name] = await window.alfdb[name].toArray();
      }
      return {
        app: 'alf-gym',
        schemaVersion: this.BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        stores,
        settings: { syntax: localStorage.getItem('alfgym.syntax') === '1' }
      };
    },

    async downloadBackup() {
      const data = await this.buildBackup();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = 'alfgym-backup-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showFlash('Backup downloaded');
    },

    async copyBackup() {
      const data = await this.buildBackup();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      this.showFlash('Backup copied');
    },

    stageImport() {
      this.importError = '';
      this.importPreview = null;
      const text = (this.importText || '').trim();
      if (!text) { this.importError = 'Paste a backup JSON or pick a file.'; return; }
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) { this.importError = 'Not valid JSON: ' + e.message; return; }
      if (parsed.app !== 'alf-gym') { this.importError = 'Not an alf-gym backup.'; return; }
      if (parsed.schemaVersion !== this.BACKUP_SCHEMA_VERSION) {
        this.importError = 'Schema mismatch (file: v' + parsed.schemaVersion + ', app: v' + this.BACKUP_SCHEMA_VERSION + '). Cross-version restore not supported.';
        return;
      }
      if (!parsed.stores || typeof parsed.stores !== 'object') {
        this.importError = 'Missing "stores" object.';
        return;
      }
      const counts = {};
      for (const name of this.BACKUP_STORES) {
        counts[name] = Array.isArray(parsed.stores[name]) ? parsed.stores[name].length : 0;
      }
      this.importPreview = { parsed, counts };
    },

    async stageImportFromFile(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      this.importText = await file.text();
      ev.target.value = '';
      this.stageImport();
    },

    async confirmImport() {
      console.log('[import] confirmImport build=2026-05-14-b'); // bump on each fix to verify cache freshness
      if (!this.importPreview) return;
      if (!confirm('Replace ALL local data with this backup? Current state will be stashed for one-cycle undo.')) return;
      try {
        const current = await this.buildBackup();
        localStorage.setItem('alfgym.lastBackup', JSON.stringify(current));
      } catch (e) {
        if (!confirm('Could not save undo snapshot (' + (e.message || e.name) + '). Proceed without undo?')) return;
      }
      try {
        // Re-parse from raw text to get a plain object, not an Alpine reactive proxy.
        // IDB's structured clone cannot serialize Proxy objects (DataCloneError).
        const rawParsed = JSON.parse(this.importText);
        await this.applyBackupReplace(rawParsed);
        this.importText = '';
        this.importPreview = null;
        this.hasUndo = !!localStorage.getItem('alfgym.lastBackup');
        const sc = this.sessions.length;
        this.showFlash('Restored: ' + sc + ' session' + (sc !== 1 ? 's' : ''));
        this.gotoHash('#/sessions');
      } catch (e) {
        console.error('confirmImport failed:', e.name, e.message, e);
        this.importError = 'Import failed: ' + (e.message || e.name || String(e));
      }
    },

    async applyBackupReplace(parsed) {
      const db = window.alfdb;
      const tables = this.BACKUP_STORES.map(n => db[n]);
      await db.transaction('rw', tables, async () => {
        for (const name of this.BACKUP_STORES) {
          await db[name].clear();
          const rows = parsed.stores[name] || [];
          if (rows.length) await db[name].bulkPut(rows);
        }
      });
      if (parsed.settings && typeof parsed.settings.syntax === 'boolean') {
        localStorage.setItem('alfgym.syntax', parsed.settings.syntax ? '1' : '0');
        this.syntax = parsed.settings.syntax;
      }
      await this.loadWorkouts();
      await this.loadWishlist();
      await this.loadSessions();
    },

    async undoLastRestore() {
      const raw = localStorage.getItem('alfgym.lastBackup');
      if (!raw) { this.showFlash('No undo available'); return; }
      if (!confirm('Roll back to pre-restore state? This consumes the one-cycle undo.')) return;
      const parsed = JSON.parse(raw);
      await this.applyBackupReplace(parsed);
      localStorage.removeItem('alfgym.lastBackup');
      this.hasUndo = false;
      this.showFlash('Reverted to pre-restore state');
      this.gotoHash('#/');
    }
  };
}

window.alfApp = alfApp;
