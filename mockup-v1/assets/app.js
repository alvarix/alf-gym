// alf-gym mockup shared state. Alpine components live here.
// All "data" is fixture data so views render consistently.

// Reusable fixture: today's session in progress, Workout 9.2 Day A.
window.alfgymData = {
  program: { id: 'p9', name: 'Workout 9' },
  variant: { id: 'v9.2', name: '9.2', programId: 'p9' },
  day: { id: 'dA', name: 'Day A - Front', variantId: 'v9.2' },
  dayVariant: { id: 'dva-gym', name: 'gym', dayId: 'dA' },
  session: {
    id: 's1',
    startedAt: '2026-04-29T10:15:00',
    elapsed: '47:22',
    env: 'gym',
    mood: null
  },
  blocks: [
    {
      id: 'b1',
      name: 'Warmup',
      order: 1,
      type: 'linear',
      prescriptions: [
        { id: 'p1', order: 1, exercise: "World's greatest stretch", prescr: ':5-1', ghost: ':5-1', status: 'done' },
        { id: 'p2', order: 2, exercise: 'Banded monster walks', prescr: ':12-2', ghost: ':12-2', status: 'done' },
        { id: 'p3', order: 3, exercise: 'Single-leg balance, eyes closed', prescr: ':30s-1', ghost: ':30s 2-4s before slip', status: 'done' },
        { id: 'p4', order: 4, exercise: 'Single-leg forward hop to stick', prescr: ':3-3', ghost: ':3-3 left worst', status: 'done' }
      ]
    },
    {
      id: 'b2',
      name: 'Anchor',
      order: 2,
      type: 'linear',
      prescriptions: [
        { id: 'p5', order: 1, exercise: 'Smith machine BSS', prescr: '50!:8,50:10,50:12', ghost: '30!:10-3 (DB tempo, alt)', status: 'active', sets: [
          { w: 50, r: 8, bang: true, done: true },
          { w: 50, r: 10, bang: false, done: true },
          { w: null, r: 12, bang: false, done: false }
        ] },
        { id: 'p6', order: 2, exercise: 'Zercher squat', prescr: '70:8-3', ghost: '60!:8-3', status: 'pending' }
      ]
    },
    {
      id: 'b3',
      name: 'Anti-rotation',
      order: 3,
      type: 'linear',
      prescriptions: [
        { id: 'p7', order: 1, exercise: 'Cable woodchop high-to-low', prescr: '^15::10-3', ghost: '^15::10-3 (red+yellow band, light)', status: 'pending' }
      ]
    },
    {
      id: 'b4',
      name: 'KB compound circuit',
      order: 4,
      type: 'circuit',
      rounds: 3,
      restBetweenRoundsSec: 90,
      prescriptions: [
        { id: 'p8', order: 1, exercise: 'KB clean to front squat', prescr: ':6', ghost: ':6 @16kg', status: 'pending' },
        { id: 'p9', order: 2, exercise: 'KB figure 8', prescr: '10', ghost: '10 @16kg', status: 'pending' },
        { id: 'p10', order: 3, exercise: 'Sprawl', prescr: '8', ghost: '8', status: 'pending' }
      ]
    },
    {
      id: 'b5',
      name: 'Shoulder ramp',
      order: 5,
      type: 'linear',
      prescriptions: [
        { id: 'p11', order: 1, exercise: 'Cross cable Y raise', prescr: '^3:10-2', ghost: '—', status: 'pending' },
        { id: 'p12', order: 2, exercise: 'Light cable face pull', prescr: '^35:12-2', ghost: '^35:12-2', status: 'pending' }
      ]
    },
    {
      id: 'b6',
      name: 'Calf PT',
      order: 6,
      type: 'linear',
      prescriptions: [
        { id: 'p13', order: 1, exercise: 'Seated bent-knee calf raise', prescr: '85:12-3', ghost: '50:12-3 + pressure', status: 'pending' },
        { id: 'p14', order: 2, exercise: 'Eccentric calf raise off step', prescr: '45::8-3', ghost: '45::8-3', status: 'pending' },
        { id: 'p15', order: 3, exercise: 'Banded dorsiflexion mob', prescr: ':30s-2', ghost: ':30s-2', status: 'pending' }
      ]
    }
  ],
  painLog: [
    { id: 'pn1', text: '$2 L hip', performanceId: 'p5' }
  ],
  recentSessions: [
    { id: 's0', date: '4/27', day: 'A', variant: '9.2', env: 'gym', minutes: 100 },
    { id: 'sm1', date: '4/24', day: 'C', variant: '9.2', env: 'park', minutes: 55 },
    { id: 'sm2', date: '4/22', day: 'B', variant: '9.2', env: 'gym', minutes: 92 },
    { id: 'sm3', date: '4/19', day: 'A', variant: '9.2', env: 'home', minutes: 110 },
    { id: 'sm4', date: '4/16', day: 'A', variant: '9.2', env: 'home', minutes: 95 }
  ]
};

// Setpad state for in-session capture.
function setpad(initial) {
  return {
    sets: initial.sets,
    idx: initial.activeIdx ?? 0,
    focus: 'w',
    staged: { w: null, r: null, bang: false },
    select(i, f) {
      this.idx = i;
      this.focus = f;
      this.staged = { ...this.sets[i] };
    },
    addSet() {
      this.sets.push({ w: null, r: null, bang: false, done: false });
      this.idx = this.sets.length - 1;
      this.focus = 'w';
      this.staged = { w: null, r: null, bang: false };
    },
    press(k) {
      if (k === '!') { this.staged.bang = !this.staged.bang; return; }
      const f = this.focus;
      const cur = this.staged[f];
      if (k === 'back') {
        if (cur === null) return;
        const s = String(cur).slice(0, -1);
        this.staged[f] = s.length ? Number(s) : null;
      } else {
        const s = (cur === null ? '' : String(cur)) + String(k);
        this.staged[f] = Number(s);
      }
    },
    toggleField() { this.focus = this.focus === 'w' ? 'r' : 'w'; },
    commit() {
      this.sets[this.idx] = { ...this.staged, done: true };
      if (this.idx < this.sets.length - 1) {
        this.idx++;
        this.focus = 'w';
        this.staged = { ...this.sets[this.idx] };
      } else {
        this.staged = { w: null, r: null, bang: false };
      }
    }
  };
}

window.alfgymSetpad = setpad;
