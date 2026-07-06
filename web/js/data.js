// Shared data: page geometry, cover styles (with verses), template catalog.
window.LJData = (function () {
  const PAGE = { W: 1024, H: 1325, M: 72 };

  // Two render palettes matching the app themes: "Quiet Paper" (light) and
  // "Ink & Glass" (dark). COLORS is mutated in place by setPalette so the
  // template code that captured the object keeps working.
  const PALETTES = {
    light: {
      ink: '#26241f', softInk: '#8a8478', rule: '#d8d2c4', faint: '#e7e2d5',
      accent: '#b5623f', red: '#db4a33', paper: '#f7f3ea', dark: false
    },
    dark: {
      ink: '#e8ecf2', softInk: '#8b97a8', rule: '#39404d', faint: '#272d38',
      accent: '#b5623f', red: '#db4a33', paper: '#141a24', dark: true
    }
  };
  const COLORS = Object.assign({}, PALETTES.light);
  let paletteName = 'light';
  function setPalette(name) {
    if (!PALETTES[name]) name = 'light';
    paletteName = name;
    Object.assign(COLORS, PALETTES[name]);
  }
  function currentPalette() { return paletteName; }

  // Cover themes: gradient stops, foil (lettering), and an opening verse.
  const COVERS = {
    sage:       { name: 'Sage',       c1: '#4a5f50', c2: '#607967', foil: '#f4f1e8', vivid: '#3aa675', band: '#d8643a',
                  verse: '“This is the day the Lord has made; let us rejoice and be glad in it.”  — Psalm 118:24' },
    navy:       { name: 'Navy',       c1: '#1f2e44', c2: '#2a3d5c', foil: '#eef1f6', vivid: '#3b82f6', band: '#e0412a',
                  verse: '“Your word is a lamp to my feet and a light to my path.”  — Psalm 119:105' },
    terracotta: { name: 'Terracotta', c1: '#a85c46', c2: '#bd6e57', foil: '#fbeee7', vivid: '#ef8a4c', band: '#2f5d50',
                  verse: '“For I know the plans I have for you, declares the Lord.”  — Jeremiah 29:11' },
    plum:       { name: 'Plum',       c1: '#56395b', c2: '#66476b', foil: '#f3edf0', vivid: '#c25ad6', band: '#e0b13a',
                  verse: '“Be still, and know that I am God.”  — Psalm 46:10' },
    charcoal:   { name: 'Charcoal',   c1: '#2c2f36', c2: '#383d45', foil: '#eef0f2', vivid: '#64748b', band: '#e0412a',
                  verse: '“His mercies are new every morning.”  — Lamentations 3:22–23' },
    gold:       { name: 'Gold',       c1: '#9a7a37', c2: '#b38f45', foil: '#f8e9bd', vivid: '#e0a93b', band: '#33685a',
                  verse: '“Trust in the Lord with all your heart.”  — Proverbs 3:5' }
  };

  // Template catalog. `cover` is created automatically and not user-insertable.
  const TEMPLATES = {
    cover:           { name: 'Cover',                    sub: 'Journal cover page' },
    soap:            { name: 'Daily Devotion (S.O.A.P.)', sub: 'Scripture · Observation · Application · Prayer' },
    sermonNotes:     { name: 'Sermon Notes',             sub: 'Capture the message and how to apply it' },
    prayerList:      { name: 'Prayer List',              sub: 'Requests and answered prayers' },
    gratitude:       { name: 'Gratitude',                sub: "Count today's blessings" },
    dailyPlanner:    { name: 'Daily Planner',            sub: 'Schedule, priorities, and tasks' },
    weeklyTop3:      { name: 'Weekly Top 3',             sub: 'Three tasks that must be done this week' },
    weeklySchedule:  { name: 'Weekly Schedule',          sub: 'A week at a glance' },
    monthlyCalendar: { name: 'Monthly Calendar',         sub: 'A full month grid' },
    notesTasks:      { name: 'Notes / Tasks',            sub: 'Open notes with a task column' },
    foundationsDaily:{ name: 'Foundations Daily',        sub: 'Thankful · schedule · top 3 · daily steps' },
    foundationsGoals:{ name: '12-Week Goals',            sub: 'A quarterly goal for each foundation' },
    weeklyPrayer:    { name: 'Weekly Prayer Journal',    sub: '90-day prayer · weekly focus · provision' },
    weeklyFoundations:{ name: 'Weekly Five Foundations', sub: 'Goals · progress · prayer · habit tracking' },
    teachingNotes:   { name: 'Teaching Notes',           sub: 'Sermon / teaching / podcast notes' },
    lined:           { name: 'Lined',                    sub: 'Ruled writing lines' },
    dotted:          { name: 'Dotted',                   sub: 'Dot grid for free-form layout' },
    blank:           { name: 'Blank',                    sub: 'A clean blank page' },
    // Planner pages (auto-generated in LifeJournal 2026)
    planYear:        { name: 'Year Overview',            sub: 'The whole year at a glance' },
    planMonth:       { name: 'Month',                    sub: 'Monthly calendar' },
    planWeek:        { name: 'Week',                     sub: 'A week at a glance' },
    planDay:         { name: 'Daily Page',               sub: 'A dated day' },
    planWeekSermon:  { name: 'Sermon Notes',             sub: 'Weekly sermon notes' }
  };

  const INSERTABLE = [
    'foundationsGoals', 'foundationsDaily', 'weeklyPrayer', 'weeklyFoundations', 'teachingNotes',
    'soap', 'sermonNotes', 'prayerList', 'gratitude', 'dailyPlanner',
    'weeklyTop3', 'weeklySchedule', 'monthlyCalendar', 'notesTasks',
    'lined', 'dotted', 'blank'
  ];

  const SWATCH_COLORS = ['#1f2330', '#2b59c3', '#c0392b', '#2e7d32', '#b8860b', '#7d3c98'];

  // Selectable paper, drawn under the template design (GoodNotes-style).
  const PAPERS = {
    white: { name: 'White',   color: '#ffffff' },
    cream: { name: 'Cream',   color: '#f7f4ec' },
    ivory: { name: 'Ivory',   color: '#fbf8f0' },
    sand:  { name: 'Sand',    color: '#f1ead9' },
    gray:  { name: 'Gray',    color: '#eef0f3' },
    tint:  { name: 'Journal', color: null },              // journal accent tint
    grid:  { name: 'Grid',    color: '#ffffff', pattern: 'grid' },
    dots:  { name: 'Dot grid',color: '#ffffff', pattern: 'dots' },
    lines: { name: 'Lined',   color: '#ffffff', pattern: 'lines' }
  };
  const PAPER_ORDER = ['white', 'cream', 'ivory', 'sand', 'gray', 'tint', 'grid', 'dots', 'lines'];

  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  return { PAGE, COLORS, COVERS, TEMPLATES, INSERTABLE, SWATCH_COLORS, PAPERS, PAPER_ORDER, uid, setPalette, currentPalette };
})();
