// Placeholder data for the intake flow. Edit these lists to change what users see.

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

// Steps 2 and 3: the three categories, each holding the procedures that fall under it.
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

// Step 4: when the user needs it done. Emergency work skips this and is recorded as ASAP.
const TIMEFRAMES = [
  { id: 'asap', label: 'As soon as possible', description: "I'm in pain or it's urgent" },
  { id: 'two-weeks', label: 'Within 2 weeks', description: 'Soon, but not an emergency' },
  { id: 'one-to-three-months', label: '1 to 3 months', description: 'Scheduling ahead' },
  { id: 'three-to-six-months', label: '3 to 6 months', description: 'Planning for later this year' },
  { id: 'six-months-plus', label: '6 months or more', description: 'No rush' },
  { id: 'not-sure', label: 'Not sure yet', description: 'Still deciding' },
];
