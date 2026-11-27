/* Kathmandu Streets — story mode: "Kapil's First Week", six chapters about a
   new Uthao driver. Each chapter is a short drive with a pickup and a drop,
   a little dialogue, and a reward. Progress is saved; a chapter can be
   retried if its timer runs out. Open it from the phone (Story app). */
const S = (KS.Story = { active: null, timer: 0 });

S.CHAPTERS = [
  {
    id: 'first-ride', title: 'Day 1 · First Ride', np: 'पहिलो सवारी',
    intro: 'You just got your Uthao driver badge. Your first passenger is waiting in Thamel — a tourist who wants to see Durbar Square. Pick them up, drive gently, and drop them at the square.',
    steps: [
      { x: -135, z: -225, label: 'Pick up the tourist in Thamel', say: '“Namaste! Durbar Square, please — and slowly, I want to see everything!”' },
      { x: -135, z: 90, label: 'Drop them at Durbar Square', say: '“Dhanyabad! Five stars for you, dai!”' },
    ],
    reward: 300, time: 0,
  },
  {
    id: 'momo-run', title: 'Day 2 · The Momo Run', np: 'म:म दौड',
    intro: 'A momo house in Thamel has a big order going cold. Pick up the hot momos and get them to the customer in Asan — fast, before the steam is gone.',
    steps: [
      { x: -135, z: -225, label: 'Pick up the hot momos in Thamel', say: '“Chito! The momos are steaming — do not stop for anyone!”' },
      { x: -90, z: 0, label: 'Deliver to the customer in Asan', say: '“Still hot! You are the fastest rider in Kathmandu!”' },
    ],
    reward: 400, time: 180,
  },
  {
    id: 'hospital-dash', title: 'Day 3 · Hospital Dash', np: 'अस्पताल दौड',
    intro: 'An old man in Asan is feeling unwell and needs Bir Hospital. Drive fast but smooth — no hard braking, no bumps. His family is counting on you.',
    steps: [
      { x: -90, z: 0, label: 'Pick up the unwell passenger in Asan', say: '“Aspatal… chito… but gently, babu.”' },
      { x: 133, z: -20, label: 'Drop them at Bir Hospital', say: '“Dhanyabad, babu. You drive like a careful son.”' },
    ],
    reward: 500, time: 0,
  },
  {
    id: 'ring-road', title: 'Day 4 · The Ring Road Run', np: 'चक्रपथ दौड',
    intro: 'A shop in Kalanki needs a parcel taken all the way around to Koteshwor, on the other side of the Ring Road. It is a long drive — take the loop, not the shortcut through town.',
    steps: [
      { x: -556, z: 91, label: 'Pick up the parcel in Kalanki', say: '“This goes to Koteshwor. The Ring Road is quicker — trust me.”' },
      { x: 556, z: 375, label: 'Deliver to the shop in Koteshwor', say: '“Right on time. The Ring Road suits you!”' },
    ],
    reward: 800, time: 0,
  },
  {
    id: 'night-shift', title: 'Day 5 · Night Shift', np: 'रातको सिफ्ट',
    intro: 'A late flight just landed at the airport. A traveller needs a ride to their hotel in Thamel. The city is quieter at night — but the police are still watching.',
    steps: [
      { x: 624, z: 20, label: 'Pick up the traveller at the airport', say: '“Finally! My hotel is in Thamel — I have been flying for hours.”' },
      { x: -135, z: -225, label: 'Drop them at the hotel in Thamel', say: '“Thank you. Kathmandu at night is beautiful from your car.”' },
    ],
    reward: 600, time: 0,
  },
  {
    id: 'big-fare', title: 'Day 6 · The Big Fare', np: 'ठूलो भाडा',
    intro: 'A VIP guest flew in for one day and wants the full tour: Boudhanath, then Swayambhu, then Durbar Square. Three stops, one big fare — and a tip if you make it a good day.',
    steps: [
      { x: 624, z: 20, label: 'Pick up the VIP at the airport', say: '“I have one day in Kathmandu. Show me the best of it.”' },
      { x: 405, z: -225, label: 'First stop: Boudhanath Stupa', say: '“The eyes… I have seen photos, but this is something else.”' },
      { x: -700, z: -90, label: 'Second stop: Swayambhunath', say: '“Monkeys everywhere! And the whole valley below us.”' },
      { x: -135, z: 90, label: 'Last stop: Durbar Square', say: '“A perfect day. Here is your fare — and a little extra.”' },
    ],
    reward: 2000, time: 0,
  },
];
/* how many chapters are finished (saved) */
S.done = () => (KS.Shop.data.story && KS.Shop.data.story.done) || 0;
S.save = (n) => { KS.Shop.data.story = { done: n }; KS.Shop.save(); };
/* start a chapter (0-based). Only the next unfinished chapter can start. */
S.start = (i) => {
  if (i < 0 || i >= S.CHAPTERS.length || i > S.done()) return false;
  if (S.active) return false;
  const c = S.CHAPTERS[i];
  S.active = { i, step: 0, t: c.time || 0 };
  S.timer = c.time || 0;
  KS.Game.setWaypoint(c.steps[0].x, c.steps[0].z);
  KS.Game.notify(`📖 <b>${c.title}</b> — ${c.steps[0].label}. Follow the blue line.`);
  KS.Game.modal(`📖 ${c.title}`, `<p>${c.intro}</p><p>Reward: <b>रु ${c.reward}</b>${c.time ? ` · ${Math.floor(c.time / 60)} minutes on the clock` : ''}.</p>`, [['Let\'s go!', () => KS.Game.modalClose()]]);
  return true;
};
S.stop = (quiet) => {
  if (!S.active) return;
  S.active = null; S.timer = 0; KS.Game.clearTarget();
  if (!quiet) KS.Game.notify('📖 Story chapter stopped.', 'bad');
};
S.update = (dt) => {
  if (!S.active) return;
  const c = S.CHAPTERS[S.active.i], st = c.steps[S.active.step], P = KS.Player;
  if (S.timer > 0) {
    S.timer -= dt;
    if (S.timer <= 0) {
      S.timer = 0;
      KS.Game.modal('⏰ Too slow!', `<p>The clock ran out on <b>${c.title}</b>. The customer gave the job to someone else.</p><p>Try again from the Story app on your phone.</p>`, [['Try again', () => { KS.Game.modalClose(); S.start(S.active ? S.active.i : 0); }], ['Later', () => KS.Game.modalClose()]]);
      S.stop(true);
      return;
    }
  }
  if (!st) return;
  const d = Math.hypot(P.x - st.x, P.z - st.z);
  if (d < 12) {
    KS.Game.notify(`📖 ${st.say}`, 'good');
    KS.audio && KS.audio.ding && KS.audio.ding();
    S.active.step++;
    if (S.active.step >= c.steps.length) {
      // chapter complete
      const idx = S.active.i;
      S.stop(true);
      KS.Game.pay(c.reward, `Story: ${c.title}`);
      KS.Game.karma(5, 'Finished a story chapter');
      S.save(Math.max(S.done(), idx + 1));
      if (idx + 1 >= S.CHAPTERS.length) KS.Game.modal('🎉 Story complete!', '<p>You finished <b>Kapil\'s First Week</b> — six days, six fares, and a city that knows your name now.</p><p>Keep driving: Uthao rides, the momo run and the open road are all still there.</p>', [['Keep driving', () => KS.Game.modalClose()]]);
      else KS.Game.modal(`✅ ${c.title} — done!`, `<p>${c.steps[c.steps.length - 1].say}</p><p>Reward: <b>रु ${c.reward}</b>. Next: <b>${S.CHAPTERS[idx + 1].title}</b>.</p>`, [[`Start ${S.CHAPTERS[idx + 1].title}`, () => { KS.Game.modalClose(); S.start(idx + 1); }], ['Later', () => KS.Game.modalClose()]]);
    } else {
      const nx = c.steps[S.active.step];
      KS.Game.setWaypoint(nx.x, nx.z);
      KS.Game.notify(`📖 Next: ${nx.label}.`, 'good');
    }
  }
};
/* the current objective for the HUD (null when no chapter is running) */
S.objective = () => {
  if (!S.active) return null;
  const c = S.CHAPTERS[S.active.i], st = c.steps[S.active.step];
  if (!st) return null;
  return { title: c.title, obj: st.label, t: S.timer, dist: Math.hypot(KS.Player.x - st.x, KS.Player.z - st.z) };
};
S.render = (el) => {
  const done = S.done();
  el.innerHTML = `<p class="ph-muted">📖 <b>Kapil's First Week</b> — six days as a new Uthao driver. Each chapter is a drive with a story; finish one to unlock the next.</p>` +
    S.CHAPTERS.map((c, i) => {
      const isDone = i < done, isNext = i === done, isActive = S.active && S.active.i === i;
      return `<div class="job"><b>${isDone ? '✅' : isActive ? '▶️' : isNext ? '📖' : '🔒'} ${c.title}</b><small>${c.intro}</small><small>Reward रु ${c.reward}${c.time ? ` · ${Math.floor(c.time / 60)} min` : ''}</small>${isActive ? '<em>In progress</em>' : isNext ? `<button type="button" class="btn small-btn" data-ch="${i}">Start chapter</button>` : isDone ? '<em>Done ✔</em>' : ''}</div>`;
    }).join('') +
    (S.active ? `<div class="req-btns"><button type="button" class="btn ghost small-btn" id="storyStop">Stop this chapter</button></div>` : '');
  el.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => { if (S.start(+b.dataset.ch)) { KS.Phone.toggle(false); S.render(el); } }));
  const st = $('storyStop'); if (st) st.onclick = () => { S.stop(); S.render(el); };
};
