// Scripted stand-in for the chatbot. Each step asks one of the questions the
// old intake pages asked, reads a tapped chip or typed text, and saves the
// answer with the same storage and api.js calls those pages made. The bot's
// messages use the { text, choices } shape the backend's /api/chat returns, so
// the live bot can replace this script without changing ChatPage.
import {
  CATEGORIES,
  HISTORY_CATEGORIES,
  STATES,
  TIMEFRAMES,
} from '../../js/options.js';
import {
  fetchProcedures,
  finishFlow,
  requestEstimate,
  requestSequence,
  saveProcedures,
  saveProfileDetails,
  saveProfileLocation,
  saveSavedPlan,
  sendStep,
  sendSteps,
} from './api.js';
import {
  answeredSteps,
  categoryById,
  describeProcedure,
  formatDay,
  formatLocation,
  inOnboarding,
  inUpdate,
  isLastStep,
  labelFor,
  officeLabel,
  readStep,
  ROUTES,
  saveStep,
  savedOffices,
  stateName,
  statesForZip,
  zipFitsState,
} from './storage.js';

// Matching typed answers

export function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const ORDINALS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

// Words too common to tell two choices apart.
const FILLER = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'for', 'to', 'in', 'on', 'my', 'me', 'i', 'im',
  'it', 'is', 'with', 'need', 'want', 'get', 'got', 'some', 'done', 'have', 'had',
  'please', 'think', 'like', 'would', 'this', 'that', 'one', 'option', 'other', 'not',
]);

function words(text) {
  return normalize(text).split(' ').filter((word) => word && !FILLER.has(word));
}

function hasPhrase(text, phrase) {
  const wanted = normalize(phrase);
  return Boolean(wanted) && ` ${text} `.includes(` ${wanted} `);
}

function only(list) {
  return list.length === 1 ? list[0] : null;
}

// Finds the one choice a typed answer means, or null when it is unclear.
export function matchChoice(text, choices) {
  const said = normalize(text);
  if (!said || choices.length === 0) return null;

  const exact = choices.find((choice) =>
    normalize(choice.id) === said || normalize(choice.label) === said);
  if (exact) return exact;

  const number = said.match(/^(?:number |option |the )?(\d{1,2})(?:st|nd|rd|th)?(?: one)?$/);
  const ordinal = Object.keys(ORDINALS).find((word) => hasPhrase(said, word));
  const position = number ? Number(number[1]) : ORDINALS[ordinal];
  if (position && choices[position - 1]) return choices[position - 1];
  if (hasPhrase(said, 'last') && said.split(' ').length <= 3) return choices.at(-1);

  const byAlias = only(choices.filter((choice) =>
    (choice.aliases || []).some((alias) => hasPhrase(said, alias))));
  if (byAlias) return byAlias;

  const byLabel = only(choices.filter((choice) => hasPhrase(said, choice.label)));
  if (byLabel) return byLabel;

  const saidWords = new Set(words(said));
  const scored = choices.map((choice) => ({
    choice,
    score: [...new Set(words(`${choice.label} ${choice.id}`))]
      .filter((word) => word.length > 2 && saidWords.has(word)).length,
  }));
  const best = Math.max(...scored.map((item) => item.score));
  if (best === 0) return null;
  return only(scored.filter((item) => item.score === best))?.choice || null;
}

function pick(input, choices) {
  if (input.choiceId) return choices.find((choice) => choice.id === input.choiceId) || null;
  return matchChoice(input.text, choices);
}

// "Ohio", "OH 43215", "I'm in Pennsylvania, 19103", or just "43215".
export function parseLocation(text) {
  const raw = String(text ?? '');
  const zips = raw.match(/\b\d{5}\b/g) || [];
  if (zips.length > 1) return { error: 'Give me just one ZIP code.' };
  const zip = zips[0] || '';
  const rest = raw.replace(zip, ' ');
  if (/\d/.test(rest)) return { error: 'Enter a 5-digit ZIP code, or leave it out.' };

  const said = normalize(rest);
  const byName = [...STATES]
    .sort((a, b) => b.name.length - a.name.length)
    .find((item) => hasPhrase(said, item.name));
  let state = byName?.code || '';
  if (!state) {
    // Two-letter codes collide with words like "in", "me" and "ok", so a code
    // counts when it is typed in capitals or is the whole answer.
    const tokens = rest.split(/[^A-Za-z]+/).filter(Boolean);
    const codes = new Set(STATES.map((item) => item.code));
    const upper = tokens.find((token) => token.length === 2 && codes.has(token));
    const alone = tokens.length === 1 && codes.has(tokens[0].toUpperCase()) ? tokens[0].toUpperCase() : '';
    state = upper || alone;
  }

  if (!state && zip) {
    const owners = statesForZip(zip);
    if (owners.length === 1) state = owners[0];
    else if (owners.length > 1) {
      return { error: `ZIP code ${zip} crosses state lines. Which state are you in: ${owners.map(stateName).join(' or ')}?` };
    }
  }
  if (!state) {
    return { error: 'I didn’t catch a state. Try something like “Ohio” or “PA 19103”.' };
  }
  if (zip && !zipFitsState(zip, state)) {
    const actual = statesForZip(zip).map(stateName).join(' or ');
    return { error: `ZIP code ${zip} is in ${actual}, not ${stateName(state)}. Check your state and ZIP code.` };
  }
  return { value: { state, zip } };
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

// "2026-03", "3/2026", "March 2026", "mar", "this month", "last month".
export function parseMonth(text, now = new Date()) {
  const said = normalize(text);
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  let year;
  let month;
  if (hasPhrase(said, 'this month')) [year, month] = [thisYear, thisMonth];
  else if (hasPhrase(said, 'last month')) {
    [year, month] = thisMonth === 1 ? [thisYear - 1, 12] : [thisYear, thisMonth - 1];
  } else {
    const iso = String(text).match(/\b(\d{4})-(\d{1,2})\b/);
    const slash = String(text).match(/\b(\d{1,2})\/(\d{4})\b/);
    if (iso) [year, month] = [Number(iso[1]), Number(iso[2])];
    else if (slash) [year, month] = [Number(slash[2]), Number(slash[1])];
    else {
      const name = said.split(' ').find((word) => word.length >= 3 &&
        MONTHS.some((item) => item.startsWith(word)));
      if (name) {
        month = MONTHS.findIndex((item) => item.startsWith(name)) + 1;
        const typedYear = said.match(/\b(\d{4})\b/);
        year = typedYear ? Number(typedYear[1]) : (month > thisMonth ? thisYear - 1 : thisYear);
      }
    }
  }
  if (!month || month < 1 || month > 12) {
    return { error: 'What month was it? Try something like “March 2026”.' };
  }
  const value = monthKey(year, month);
  if (value > monthKey(thisYear, thisMonth)) {
    return { error: 'Choose a month that has already happened.' };
  }
  return { value };
}

// Blank is null; anything that isn't a dollar amount is NaN.
export function parseAmount(text) {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

// Where the conversation goes next

const ALIASES = {
  yes: ['yes', 'yeah', 'yep', 'yup', 'sure', 'y'],
  no: ['no', 'nope', 'nah', 'n', 'nothing'],
  checkup: ['checkup', 'check up', 'cleaning', 'routine', 'preventive'],
  general: ['general', 'toothwork', 'treatment', 'restorative'],
  emergency: ['emergency', 'urgent', 'right away', 'cant wait', 'hurts', 'hurt', 'pain'],
  asap: ['asap', 'right away', 'immediately', 'now', 'urgent'],
  'two-weeks': ['2 weeks', 'two weeks', 'next week', 'soon'],
  'one-to-three-months': ['1 month', 'one month', '2 months', 'two months', 'few months'],
  'three-to-six-months': ['4 months', '5 months', 'later this year'],
  'six-months-plus': ['6 months', 'six months', 'no rush', 'next year'],
  'not-sure': ['not sure', 'unsure', 'dont know', 'idk', 'no idea'],
};

function withAliases(items) {
  return items.map((item) => ({
    id: item.id,
    label: item.label ?? item.name,
    description: item.description,
    aliases: ALIASES[item.id],
  }));
}

function chip(id, label, aliases = ALIASES[id]) {
  return { id, label, aliases };
}

// Only the most common answers show as buttons. Anything in choices() can
// still be typed, so the buttons stay short without narrowing what's accepted.
function featured(choices, ids) {
  return ids.map((id) => choices.find((choice) => choice.id === id)).filter(Boolean);
}

const FEATURED_PROCEDURES = {
  general: ['filling', 'crown-bridge', 'root-canal', 'extraction'],
  emergency: ['severe-pain', 'broken-tooth', 'swelling'],
};

const RESTART_CHIP = chip('restart', 'Start over', ['start over', 'restart', 'reset']);

// The first intake question that still needs an answer.
export function nextIntakeStep() {
  const saved = answeredSteps();
  if (!saved.location) return 'location';
  if (!saved.office) return 'office';
  const category = categoryById(saved.category);
  if (!category) return 'category';
  if (!category.procedures.some((item) => item.id === saved.procedure)) return 'procedure';
  if (!category.skipTiming && !saved.timing) return 'timing';
  return 'confirm';
}

// Where a new or restarted conversation begins.
export function firstStep() {
  if (inUpdate()) {
    if (!readStep('procedures_saved')) return 'procedures';
    if (readStep('still_here') === 'no') return 'location';
    return readStep('location') ? 'location-check' : 'location';
  }
  return nextIntakeStep();
}

export function greeting() {
  const name = (readStep('name') || '').trim().split(/\s+/)[0];
  return `Hi${name ? ` ${name}` : ''}! I’m your dental benefits assistant. I can help you find a dental office and estimate what your plan covers.`;
}

// Closes the update questions and says where to go from here.
async function finishUpdate(replies = []) {
  const returnTo = readStep('update_return');
  await finishFlow();
  saveStep('work_entry', null);
  const done = replies.concat('Thanks, your profile is up to date.');
  if (returnTo === ROUTES.profile) return { replies: done, next: 'update-done' };
  return { replies: done, next: nextIntakeStep() };
}

function afterRecentWork(replies) {
  if (readStep('location')) return { replies, next: 'location-check' };
  saveStep('still_here', 'no');
  return { replies, next: 'location' };
}

function workEntry() {
  return readStep('work_entry') || {};
}

function draftEntries() {
  return readStep('procedures_draft')?.entries || [];
}

// One optional dollar amount for the procedure being recorded.
function amountStep(key, question, after) {
  return {
    input: { placeholder: 'Amount in dollars', inputMode: 'decimal' },
    choices: () => [chip('skip', 'Skip', ['skip', 'dont know', 'not sure', 'no idea', 'none'])],
    ask: () => [{ text: question }],
    answer(input) {
      const skipped = pick(input, this.choices())?.id === 'skip';
      const amount = skipped ? null : parseAmount(input.text);
      if (Number.isNaN(amount)) return { error: 'Enter an amount like 120 or 120.50, or tap Skip.' };
      saveStep('work_entry', { ...workEntry(), [key]: amount });
      return after();
    },
  };
}

// Same rules the old recent-work form used, then the entry joins the draft.
function addWorkEntry() {
  const entry = workEntry();
  const paid = (entry.you_paid || 0) + (entry.insurance_paid || 0);
  if (entry.cost != null && paid > entry.cost) {
    return {
      replies: ['What you and insurance paid adds up to more than the total cost. Let’s try those amounts again.'],
      next: 'work-cost',
    };
  }
  const category = HISTORY_CATEGORIES.find((item) =>
    item.procedures.some((procedure) => procedure.id === entry.procedure));
  saveStep('procedures_draft', {
    entries: draftEntries().concat({
      procedure: entry.procedure,
      category: category.id,
      date: entry.date,
      cost: entry.cost ?? null,
      you_paid: entry.you_paid ?? null,
      insurance_paid: entry.insurance_paid ?? null,
    }),
  });
  saveStep('work_entry', null);
  return { next: 'work-more' };
}

const HISTORY_CHOICES = HISTORY_CATEGORIES.flatMap((category) => withAliases(category.procedures));

// Procedures a user can plan across the year. Real, priceable procedures only
// (the engine needs catalog ids), so the catch-all "other" is left out.
const SEQUENCE_PROCEDURES = HISTORY_CATEGORIES
  .flatMap((category) => category.procedures)
  .filter((procedure) => procedure.id !== 'other');

async function commitCare(category, procedureId) {
  const saved = answeredSteps();
  if (category.id !== saved.category) {
    saveStep('procedure', null);
    if (categoryById(saved.category)?.skipTiming) saveStep('timing', null);
  }
  saveStep('category', category.id);
  const pieces = [{ step: 'category', parameters: { category: category.id } }];
  const replies = [];
  if (procedureId) {
    saveStep('procedure', procedureId);
    pieces.push({ step: 'procedure', parameters: { procedure: procedureId } });
    replies.push(`Got it: ${labelFor(category.procedures, procedureId).toLowerCase()}.`);
    if (category.skipTiming) {
      saveStep('timing', 'asap');
      pieces.push({ step: 'timing', parameters: { timing: 'asap' }, autoSet: true });
      replies.push('Since this is emergency care, I’ve marked it as needed right away.');
    }
  }
  await sendSteps(pieces);
  return { replies, next: nextIntakeStep() };
}

// Reads "a filling" or "my tooth broke" as a category plus the procedure itself.
export function matchCare(text) {
  const categories = withAliases(CATEGORIES);
  const said = normalize(text);
  const exact = categories.find((item) => normalize(item.id) === said || normalize(item.label) === said);
  if (exact) return { category: categoryById(exact.id) };
  const procedures = CATEGORIES.flatMap((category) =>
    withAliases(category.procedures).map((procedure) => ({ ...procedure, category })));
  const procedure = matchChoice(text, procedures);
  if (procedure) return { category: procedure.category, procedure: procedure.id };
  const category = matchChoice(text, categories);
  return category ? { category: categoryById(category.id) } : null;
}

const NOT_SURE = 'Sorry, I didn’t catch that. Tap one of these, or type it another way.';

export const STEPS = {
  procedures: {
    choices: () => [
      chip('yes', 'Yes', ALIASES.yes.concat('i have', 'add')),
      chip('no', 'No, nothing new', ALIASES.no.concat('none')),
    ],
    async ask() {
      const messages = [];
      const since = readStep('update_reason') === 'stale' ? formatDay(readStep('previous_sign_in')) : '';
      messages.push({
        text: since
          ? 'It’s been more than 90 days since you last signed in. Before we look for care, let’s catch up on any dental work.'
          : 'Let’s make sure your profile is up to date.',
      });
      const recorded = await fetchProcedures(readStep('demo_employee_id'));
      if (recorded.length > 0) {
        messages.push({ text: `Here’s what I already have on file:\n${recorded.map((item) => `• ${describeProcedure(item)}`).join('\n')}` });
      }
      messages.push({
        text: since
          ? `Have you had any dental work since ${since}?`
          : 'Have you had any dental work that isn’t on file yet?',
      });
      return messages;
    },
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'yes') {
        saveStep('procedures_draft', { entries: [] });
        saveStep('work_entry', null);
        return { next: 'work-procedure' };
      }
      await saveProcedures([], readStep('demo_employee_id'));
      saveStep('procedures_saved', true);
      saveStep('procedures_draft', null);
      return afterRecentWork([]);
    },
  },

  'work-procedure': {
    input: { placeholder: 'Or type it, like “implant”' },
    choices: () => HISTORY_CHOICES,
    suggestions: () => featured(HISTORY_CHOICES, ['cleaning', 'filling', 'crown-bridge', 'root-canal']),
    ask: () => [{ text: 'What did you have done?' }],
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: 'I don’t know that one yet. Pick the closest match below.' };
      saveStep('work_entry', { procedure: choice.id });
      return { next: 'work-date' };
    },
  },

  'work-date': {
    input: { placeholder: 'e.g. March 2026' },
    choices: () => [chip('this-month', 'This month'), chip('last-month', 'Last month')],
    ask: () => [{ text: 'What month was that?' }],
    answer(input) {
      const chosen = pick(input, this.choices());
      const parsed = parseMonth(chosen ? chosen.label : input.text);
      if (parsed.error) return { error: parsed.error };
      saveStep('work_entry', { ...workEntry(), date: parsed.value });
      return { next: 'work-cost' };
    },
  },

  'work-cost': amountStep('cost', 'About how much did it cost in total?',
    () => ({ next: 'work-you-paid' })),
  'work-you-paid': amountStep('you_paid', 'How much did you pay out of pocket?',
    () => ({ next: 'work-insurance' })),
  'work-insurance': amountStep('insurance_paid', 'And how much did insurance pay?', addWorkEntry),

  'work-more': {
    choices: () => [
      chip('more', 'Add another', ['add another', 'another', 'more', 'yes', 'yeah', 'yep']),
      chip('done', 'That’s everything', ['thats everything', 'thats all', 'done', 'no', 'nope', 'finished']),
    ],
    ask: () => [{ text: `Got it: ${describeProcedure(draftEntries().at(-1))}. Anything else?` }],
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'more') return { next: 'work-procedure' };
      const entries = draftEntries();
      await saveProcedures(entries, readStep('demo_employee_id'));
      saveStep('procedures_saved', true);
      saveStep('procedures_draft', null);
      const count = entries.length === 1 ? 'that procedure' : `those ${entries.length} procedures`;
      return afterRecentWork([`Thanks, I saved ${count} to your profile.`]);
    },
  },

  'location-check': {
    choices: () => [
      chip('yes', 'Yes, I’m still here', ALIASES.yes.concat('still here', 'same')),
      chip('no', 'No, I’ve moved', ALIASES.no.concat('moved', 'new place')),
    ],
    ask() {
      const office = readStep('office');
      return [{
        text: `Are you still in ${formatLocation(readStep('location'))}?` +
          (office ? ` Your dental office is ${officeLabel(office)}.` : ''),
      }];
    },
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'no') {
        saveStep('still_here', 'no');
        return { next: 'location' };
      }
      saveStep('still_here', 'yes');
      return finishUpdate();
    },
  },

  'update-done': {
    choices: () => [chip('profile', 'Back to my profile', ['profile', 'back']), chip('care', 'Find care', ['care', 'estimate', 'office'])],
    ask: () => [{ text: 'Want to head back to your profile, or look for care?' }],
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'profile') return { navigate: ROUTES.profile };
      return { next: nextIntakeStep() };
    },
  },

  location: {
    input: { placeholder: 'State and ZIP, e.g. PA 19103' },
    choices() {
      const saved = readStep('location');
      if (!saved?.state || readStep('still_here') === 'no') return [];
      return [chip('keep', `Use ${formatLocation(saved)}`, ['same', 'keep', 'use that'])];
    },
    ask() {
      if (readStep('still_here') === 'no') return [{ text: 'Where are you now? Tell me your state, and your ZIP code if you like.' }];
      const intro = inOnboarding() ? 'Let’s find dental offices near you. ' : '';
      return [{ text: `${intro}What state are you in? You can add your ZIP code too, like “Ohio 43215”.` }];
    },
    async answer(input) {
      const keep = pick(input, this.choices())?.id === 'keep';
      const parsed = keep ? { value: readStep('location') } : parseLocation(input.text);
      if (parsed.error) return { error: parsed.error };
      const { state, zip } = parsed.value;
      saveStep('location', { state, zip: zip || '' });
      await saveProfileLocation(state, zip || null);
      await sendStep('location', { state, zip: zip || null });
      return { next: 'office' };
    },
  },

  office: {
    // Addresses and distances help pick an office, so these buttons keep them.
    details: true,
    choices() {
      const offices = savedOffices().map((office) => ({
        id: office.id,
        label: office.name,
        description: [
          office.address,
          typeof office.distance_miles === 'number' ? `${office.distance_miles} mi away` : '',
        ].filter(Boolean).join(' · '),
      }));
      return offices.concat(chip('change-location', 'Change location', ['change location', 'different location', 'moved']));
    },
    ask() {
      const place = formatLocation(readStep('location'));
      if (savedOffices().length === 0) {
        return [{ text: `I couldn’t find any dental offices near ${place}. Try a different state or ZIP code.` }];
      }
      if (inOnboarding() || inUpdate()) return [{ text: `Here are dental offices near ${place}. Which one do you go to?` }];
      return [{ text: `Here are dental offices near ${place}. Which one would you like?` }];
    },
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: 'I didn’t catch which office. Tap one below.' };
      if (choice.id === 'change-location') {
        if (inUpdate()) saveStep('still_here', 'no');
        return { next: 'location' };
      }
      saveStep('office', choice.id);
      const wasOnboarding = inOnboarding();
      const wasUpdate = inUpdate();
      const last = isLastStep('office');
      if (wasOnboarding || wasUpdate) await saveProfileDetails({ office: choice.id });
      await sendStep('office', { office: choice.id });
      if (last && wasUpdate) return finishUpdate();
      if (last) {
        await finishFlow();
        return { replies: ['You’re all set up.'], next: nextIntakeStep() };
      }
      return { next: nextIntakeStep() };
    },
  },

  category: {
    input: { placeholder: 'e.g. a filling, or my tooth hurts' },
    choices: () => withAliases(CATEGORIES),
    ask: () => [{ text: 'What kind of care do you need?' }],
    async answer(input) {
      const care = input.choiceId
        ? { category: categoryById(input.choiceId) }
        : matchCare(input.text);
      if (!care?.category) return { error: 'I’m not sure what kind of care that is. Pick one below.' };
      return commitCare(care.category, care.procedure);
    },
  },

  procedure: {
    input: { placeholder: 'Or type what you need' },
    choices: () => withAliases(categoryById(readStep('category'))?.procedures || []),
    suggestions() {
      const ids = FEATURED_PROCEDURES[readStep('category')];
      return ids ? featured(this.choices(), ids) : this.choices();
    },
    ask() {
      const category = categoryById(readStep('category'));
      return [{ text: category?.prompt || 'What do you need done?' }];
    },
    async answer(input) {
      const category = categoryById(readStep('category'));
      if (!category) return { next: 'category' };
      const choice = pick(input, this.choices());
      if (!choice) return { error: 'I don’t know that one yet. Pick the closest match below.' };
      return commitCare(category, choice.id);
    },
  },

  timing: {
    input: { placeholder: 'Or type a timeframe, like “in 6 months”' },
    choices: () => withAliases(TIMEFRAMES),
    suggestions() {
      return featured(this.choices(), ['asap', 'two-weeks', 'one-to-three-months']);
    },
    ask: () => [{ text: 'When do you need it done?' }],
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      saveStep('timing', choice.id);
      await sendStep('timing', { timing: choice.id });
      return { next: nextIntakeStep() };
    },
  },

  confirm: {
    choices: () => [
      chip('estimate', 'Get my estimate', ['estimate', 'yes', 'looks good', 'submit', 'go']),
      chip('change', 'Change something', ['change', 'edit', 'fix', 'no']),
      RESTART_CHIP,
    ],
    ask() {
      const saved = answeredSteps();
      const category = categoryById(saved.category);
      const rows = [
        `• Location: ${formatLocation(saved.location)}`,
        `• Office: ${officeLabel(saved.office)}`,
        `• Care type: ${category.label}`,
        `• Procedure: ${labelFor(category.procedures, saved.procedure)}`,
        `• Timing: ${labelFor(TIMEFRAMES, saved.timing || 'asap')}`,
      ];
      return [{ text: `Here’s what you told me:\n${rows.join('\n')}\n\nShall I estimate your cost?` }];
    },
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'restart') return { restart: true };
      return { next: choice.id };
    },
  },

  change: {
    choices() {
      const category = categoryById(readStep('category'));
      return [
        chip('location', 'Location'),
        chip('office', 'Office'),
        chip('category', 'Care type', ['care', 'type', 'category']),
        chip('procedure', 'Procedure'),
        ...(category?.skipTiming ? [] : [chip('timing', 'Timing', ['when', 'time', 'date'])]),
        chip('confirm', 'Never mind', ['never mind', 'nothing', 'back', 'cancel']),
      ];
    },
    ask: () => [{ text: 'What would you like to change?' }],
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      return { next: choice.id };
    },
  },

  estimate: {
    choices: () => [
      chip('save', 'Save this estimate', ['save', 'keep', 'remember', 'bookmark']),
      chip('plan-year', 'Plan care across the year', ['plan', 'sequence', 'schedule', 'maximize', 'multiple', 'several']),
      chip('another', 'Estimate another procedure', ['another', 'different procedure', 'something else']),
      chip('change', 'Change something', ['change', 'edit']),
      chip('retry', 'Try again', ['try again', 'retry']),
      chip('sent', 'Show what was sent', ['sent', 'messages', 'debug']),
      RESTART_CHIP,
    ],
    suggestions() {
      return featured(this.choices(), ['save', 'plan-year', 'another']);
    },
    async ask() {
      const saved = answeredSteps();
      try {
        const estimate = await requestEstimate(saved.procedure, { employeeId: readStep('demo_employee_id') });
        if (!estimate.lines?.[0]) throw new Error('empty-estimate');
        saveStep('last_estimate', estimate);
        return [
          { kind: 'estimate', data: estimate, text: 'Here’s what to expect, based on your plan and the care you picked.' },
          { text: 'Want to save this, or do something else?' },
        ];
      } catch (cause) {
        saveStep('last_estimate', null);
        return [{
          text: cause?.message === 'unmapped-procedure'
            ? 'I can’t estimate that selection yet. Try a different procedure.'
            : 'I couldn’t calculate your estimate just now.',
          choices: featured(this.choices(), ['retry', 'another', 'restart']),
        }];
      }
    },
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'restart') return { restart: true };
      if (choice.id === 'retry') return { next: 'estimate' };
      if (choice.id === 'sent') return { navigate: ROUTES.summary };
      if (choice.id === 'save') {
        const estimate = readStep('last_estimate');
        if (!estimate) return { error: 'There’s no estimate to save right now.' };
        await saveSavedPlan({
          employeeId: readStep('demo_employee_id'), kind: 'estimate', result: estimate,
          label: estimate.lines?.[0]?.label,
        });
        return { next: 'estimate-saved' };
      }
      if (choice.id === 'plan-year') {
        // Seed the plan with the procedure they just estimated.
        const started = readStep('procedure') ? [readStep('procedure')] : [];
        saveStep('sequence_picks', started);
        return { next: 'plan-add' };
      }
      if (choice.id === 'another') {
        ['category', 'procedure', 'timing'].forEach((key) => saveStep(key, null));
        return { next: 'category' };
      }
      return { next: 'change' };
    },
  },

  'estimate-saved': {
    choices: () => [
      chip('profile', 'View it on my profile', ['profile', 'view', 'saved']),
      chip('plan-year', 'Plan care across the year', ['plan', 'sequence']),
      chip('another', 'Estimate another procedure', ['another', 'different']),
      RESTART_CHIP,
    ],
    suggestions() {
      return featured(this.choices(), ['profile', 'another', 'plan-year']);
    },
    ask: () => [{ text: 'Saved. You can find it on your profile anytime. What’s next?' }],
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'restart') return { restart: true };
      if (choice.id === 'profile') return { navigate: ROUTES.profile };
      if (choice.id === 'plan-year') {
        const started = readStep('procedure') ? [readStep('procedure')] : [];
        saveStep('sequence_picks', started);
        return { next: 'plan-add' };
      }
      ['category', 'procedure', 'timing'].forEach((key) => saveStep(key, null));
      return { next: 'category' };
    },
  },

  // --- Care sequencing across the plan year (challenge core feature #3) ------

  'plan-add': {
    input: { placeholder: 'Or type a procedure, like “crown” or “root canal”' },
    choices: () => withAliases(SEQUENCE_PROCEDURES),
    suggestions() {
      const picked = new Set(readStep('sequence_picks') || []);
      const remaining = SEQUENCE_PROCEDURES.filter((item) => !picked.has(item.id));
      return withAliases(remaining).slice(0, 4);
    },
    ask() {
      const picks = readStep('sequence_picks') || [];
      if (picks.length === 0) {
        return [{ text: 'Which procedures are you planning? Add the first one and we’ll build a schedule that makes the most of your annual maximum.' }];
      }
      const named = picks.map((id) => labelFor(SEQUENCE_PROCEDURES, id).toLowerCase()).join(', ');
      return [{ text: `So far: ${named}. Add another procedure to plan, or tap “That’s all”.` }];
    },
    answer(input) {
      // Let the user finish from this step too.
      const done = matchChoice(input.text, [chip('done', 'That’s all', ['thats all', 'done', 'finished', 'no more', 'nothing else'])]);
      if (done) return { next: 'plan-review' };
      const choice = pick(input, this.choices());
      if (!choice) return { error: 'I don’t know that one yet. Pick the closest match below.' };
      const picks = readStep('sequence_picks') || [];
      if (!picks.includes(choice.id)) picks.push(choice.id);
      saveStep('sequence_picks', picks);
      return { next: 'plan-more' };
    },
  },

  'plan-more': {
    choices: () => [
      chip('more', 'Add another', ['add another', 'another', 'more', 'yes']),
      chip('done', 'That’s all', ['thats all', 'done', 'finished', 'no', 'nope']),
    ],
    ask() {
      const picks = readStep('sequence_picks') || [];
      const named = picks.map((id) => labelFor(SEQUENCE_PROCEDURES, id).toLowerCase()).join(', ');
      return [{ text: `Planning: ${named}. Anything else?` }];
    },
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      return { next: choice.id === 'more' ? 'plan-add' : 'plan-review' };
    },
  },

  'plan-review': {
    choices: () => [
      chip('save', 'Save this plan', ['save', 'keep', 'remember', 'bookmark']),
      chip('another', 'Plan different procedures', ['another', 'different', 'redo']),
      chip('care', 'Back to care options', ['care', 'estimate', 'back']),
      RESTART_CHIP,
    ],
    suggestions() {
      return featured(this.choices(), ['save', 'another', 'care']);
    },
    async ask() {
      const picks = readStep('sequence_picks') || [];
      if (picks.length === 0) {
        return [{ text: 'Add at least one procedure to plan.', choices: this.choices() }];
      }
      try {
        const sequence = await requestSequence(picks, { employeeId: readStep('demo_employee_id') });
        saveStep('last_sequence', sequence);
        return [
          { kind: 'sequence', data: sequence, text: 'Here’s how to time this care to get the most from your plan.' },
          { text: 'Want to save this plan, or do something else?' },
        ];
      } catch (cause) {
        saveStep('last_sequence', null);
        return [{
          text: cause?.message === 'unmapped-procedure'
            ? 'I can’t plan one of those selections yet. Try different procedures.'
            : 'I couldn’t build a plan just now.',
          choices: featured(this.choices(), ['another', 'care', 'restart']),
        }];
      }
    },
    async answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'restart') return { restart: true };
      if (choice.id === 'save') {
        const sequence = readStep('last_sequence');
        if (!sequence) return { error: 'There’s no plan to save right now.' };
        const picks = readStep('sequence_picks') || [];
        await saveSavedPlan({
          employeeId: readStep('demo_employee_id'), kind: 'sequence', result: sequence,
          label: picks.map((id) => labelFor(SEQUENCE_PROCEDURES, id)).join(', '),
        });
        return { next: 'plan-saved' };
      }
      if (choice.id === 'another') {
        saveStep('sequence_picks', []);
        return { next: 'plan-add' };
      }
      return { next: 'estimate' };
    },
  },

  'plan-saved': {
    choices: () => [
      chip('profile', 'View it on my profile', ['profile', 'view', 'saved']),
      chip('another', 'Plan different procedures', ['another', 'different']),
      chip('care', 'Back to care options', ['care', 'estimate', 'back']),
      RESTART_CHIP,
    ],
    suggestions() {
      return featured(this.choices(), ['profile', 'another', 'care']);
    },
    ask: () => [{ text: 'Saved. Your plan is on your profile whenever you need it. What’s next?' }],
    answer(input) {
      const choice = pick(input, this.choices());
      if (!choice) return { error: NOT_SURE };
      if (choice.id === 'restart') return { restart: true };
      if (choice.id === 'profile') return { navigate: ROUTES.profile };
      if (choice.id === 'another') {
        saveStep('sequence_picks', []);
        return { next: 'plan-add' };
      }
      return { next: 'estimate' };
    },
  },
};
