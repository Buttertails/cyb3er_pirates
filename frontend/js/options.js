// Placeholder data for the intake flow. Edit these lists to change what users see.

// New-user sign-up: the employers to choose from. Fictional, except that
// 'acme-co' matches the sample employer the backend seeds (backend/dental/catalog.py),
// so these ids are meant to line up with employers/{employerId} later.
const COMPANIES = [
  { id: 'acme-co', label: 'Acme Corporation', description: 'Sample employer' },
  { id: 'demo-company-2', label: 'Placeholder Industries', description: 'Sample employer' },
  { id: 'demo-company-3', label: 'Example Health Partners', description: 'Sample employer' },
  { id: 'other', label: "My company isn't listed", description: 'You can still look for care' },
];

// New-user sign-up: the questions signup.html asks, one per screen, keyed by its
// ?q= value. Location and office reuse the intake pages (see ONBOARDING in shared.js).
// Text questions build their error messages from `label`; `confirmLabel` adds a
// second field that must match. Choice questions show `options` as radio cards.
const SIGNUP_QUESTIONS = {
  email: {
    heading: "What's your email?",
    lead: "You'll use it to sign in.",
    label: 'Email',
    type: 'email',
    autocomplete: 'email',
    format: 'email',
    confirmLabel: 'Confirm email',
    button: 'Continue',
  },
  password: {
    heading: 'Create a password',
    lead: 'Use at least 6 characters.',
    label: 'Password',
    type: 'password',
    autocomplete: 'new-password',
    minLength: 6,
    confirmLabel: 'Confirm password',
    button: 'Create account',
  },
  name: {
    heading: "What's your name?",
    lead: 'So we know what to call you.',
    label: 'Full name',
    type: 'text',
    autocomplete: 'name',
    maxLength: 100,
    button: 'Continue',
  },
  company: {
    heading: 'Who do you work for?',
    lead: 'Your employer provides your dental plan.',
    kind: 'choice',
    options: COMPANIES,
    button: 'Finish',
  },
};

// Step 1: where the user is.
const STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// Steps 3 and 4: the three categories, each holding the procedures that fall under it.
// `prompt` is the heading shown on step 3. `skipTiming` ends the flow after step 3
// and records the timing as ASAP, which is what emergency work uses.
const CATEGORIES = [
  {
    id: 'checkup',
    label: 'Cleaning or checkup',
    description: 'Routine visits and preventive care',
    prompt: 'Which visit do you need?',
    procedures: [
      { id: 'cleaning', label: 'Routine cleaning', description: 'Regular hygiene visit' },
      { id: 'exam-xrays', label: 'Exam and X-rays', description: 'Checkup with imaging' },
      { id: 'deep-cleaning', label: 'Deep cleaning', description: 'Scaling and root planing' },
    ],
  },
  {
    id: 'general',
    label: 'General toothwork',
    description: 'Planned treatment and restorative work',
    prompt: 'What work do you need done?',
    procedures: [
      { id: 'filling', label: 'Filling', description: 'Treatment for a cavity' },
      { id: 'crown-bridge', label: 'Crown or bridge', description: 'Cap or replacement for damaged teeth' },
      { id: 'root-canal', label: 'Root canal', description: 'Treatment for an infected tooth' },
      { id: 'extraction', label: 'Extraction', description: 'Tooth removal, including wisdom teeth' },
      { id: 'implant', label: 'Implant', description: 'Permanent replacement for a missing tooth' },
      { id: 'dentures', label: 'Dentures or partials', description: 'Removable tooth replacement' },
      { id: 'orthodontics', label: 'Orthodontics', description: 'Braces or clear aligners' },
      { id: 'cosmetic', label: 'Cosmetic', description: 'Whitening, veneers, or bonding' },
      { id: 'other', label: 'Other', description: 'Something not listed here' },
    ],
  },
  {
    id: 'emergency',
    label: 'Emergency work',
    description: "Pain, swelling, or damage that can't wait",
    prompt: "What's going on?",
    skipTiming: true,
    procedures: [
      { id: 'severe-pain', label: 'Severe tooth pain', description: 'Ongoing or worsening pain' },
      { id: 'broken-tooth', label: 'Broken or knocked-out tooth', description: 'Injury or sudden damage' },
      { id: 'swelling', label: 'Swelling or infection', description: 'Abscess, swelling, or fever' },
      { id: 'lost-filling', label: 'Lost filling or crown', description: 'A restoration came loose or fell out' },
      { id: 'bleeding', label: "Bleeding that won't stop", description: 'After a procedure or an injury' },
      { id: 'urgent-other', label: 'Other urgent problem', description: 'Something not listed here' },
    ],
  },
];

// Update info: the categories whose entries are procedures someone has had, for
// recording recent dental work. Emergency lists symptoms, not procedures.
const HISTORY_CATEGORIES = CATEGORIES.filter(function (c) {
  return c.id === 'checkup' || c.id === 'general';
});

// Step 5: when the user needs it done. Emergency work skips this and is recorded as ASAP.
const TIMEFRAMES = [
  { id: 'asap', label: 'As soon as possible', description: "I'm in pain or it's urgent" },
  { id: 'two-weeks', label: 'Within 2 weeks', description: 'Soon, but not an emergency' },
  { id: 'one-to-three-months', label: '1 to 3 months', description: 'Scheduling ahead' },
  { id: 'three-to-six-months', label: '3 to 6 months', description: 'Planning for later this year' },
  { id: 'six-months-plus', label: '6 months or more', description: 'No rush' },
  { id: 'not-sure', label: 'Not sure yet', description: 'Still deciding' },
];

// ZIP check on step 1: the first three digits of a ZIP code identify its state.
// Each state lists [low, high] ranges of 3-digit prefixes (inclusive). Entered
// from memory of the USPS ranges, not generated from a dataset, so treat it as
// approximate. A prefix no state claims (territories, military) is never flagged,
// and a prefix that straddles a border is listed under both states.
const ZIP_PREFIXES = {
  AL: [[350, 352], [354, 369]],
  AK: [[995, 999]],
  AZ: [[850, 850], [852, 853], [855, 857], [859, 860], [863, 865]],
  AR: [[716, 729]],
  CA: [[900, 908], [910, 928], [930, 961]],
  CO: [[800, 816]],
  CT: [[60, 69]],
  DE: [[197, 199]],
  DC: [[200, 200], [202, 205]],
  FL: [[320, 342], [344, 344], [346, 347], [349, 349]],
  GA: [[300, 319], [398, 399]],
  HI: [[967, 968]],
  ID: [[832, 838]],
  IL: [[600, 620], [622, 629]],
  IN: [[460, 479]],
  IA: [[500, 516], [520, 528]],
  KS: [[660, 662], [664, 679]],
  KY: [[400, 418], [420, 427]],
  LA: [[700, 701], [703, 708], [710, 714]],
  ME: [[39, 49]],
  MD: [[206, 212], [214, 219]],
  MA: [[10, 27], [55, 55]],
  MI: [[480, 499]],
  MN: [[550, 551], [553, 567]],
  MS: [[386, 397]],
  MO: [[630, 631], [633, 641], [644, 658]],
  MT: [[590, 599]],
  NE: [[680, 681], [683, 693]],
  NV: [[889, 891], [893, 898]],
  NH: [[30, 38]],
  NJ: [[70, 89]],
  NM: [[870, 871], [873, 875], [877, 884]],
  NY: [[5, 5], [100, 149]],
  NC: [[270, 289]],
  ND: [[580, 588]],
  OH: [[430, 459]],
  OK: [[730, 731], [734, 741], [743, 749]],
  OR: [[970, 979]],
  PA: [[150, 196]],
  RI: [[28, 29]],
  SC: [[290, 299]],
  SD: [[570, 577]],
  TN: [[370, 385]],
  TX: [[733, 733], [750, 799], [885, 885]],
  UT: [[840, 847]],
  VT: [[50, 54], [56, 59]],
  VA: [[201, 201], [220, 246]],
  WA: [[980, 986], [988, 994]],
  WV: [[247, 268]],
  WI: [[530, 532], [534, 535], [537, 539], [541, 549]],
  WY: [[820, 831], [834, 834]],
};

// Local demo only: stand-ins for the dentist offices the backend will return for
// step 2. Fictional. api.js fills in the state and ZIP the user entered.
const LOCAL_DEMO_OFFICES = [
  { id: 'demo-office-1', name: 'Sample Family Dental', street: '100 Example Street', distance_miles: 1.2 },
  { id: 'demo-office-2', name: 'Placeholder Smiles', street: '250 Sample Avenue', distance_miles: 3.4 },
  { id: 'demo-office-3', name: 'Demo Dental Group', street: '75 Test Boulevard', distance_miles: 5.8 },
];
