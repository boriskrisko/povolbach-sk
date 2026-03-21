export interface Task {
  id: string;
  label: string;
  week?: string;
  due?: string;
}

export interface Gate {
  id: string;
  label: string;
}

export interface Phase {
  id: number;
  label: string;
  title: string;
  dates: string;
  status: 'completed' | 'active' | 'upcoming';
  tasks: Task[];
  gates: Gate[];
}

export const phases: Phase[] = [
  {
    id: 0,
    label: 'Phase 0+1',
    title: 'Build V1',
    dates: 'Mar 17–21',
    status: 'completed',
    tasks: [
      { id: 'p0_scorecards', label: '2,926 municipality scorecards' },
      { id: 'p0_map', label: 'Interactive map + search + leaderboard' },
      { id: 'p0_percapita', label: 'Per-capita normalization with historical population' },
      { id: 'p0_comparison', label: 'Comparison tool (neighbors + similar size)' },
      { id: 'p0_potential', label: 'Unfulfilled potential metric + progress bar' },
      { id: 'p0_pdf', label: 'PDF export' },
      { id: 'p0_vuc', label: 'VÚC + Mikroregióny sections' },
      { id: 'p0_rpo', label: 'RPO subsidiary attribution' },
      { id: 'p0_og', label: 'OG meta + images + sharing' },
      { id: 'p0_bilingual', label: 'Bilingual SK/EN' },
      { id: 'p0_periods', label: 'Period comparison (14–20 vs 21–27)' },
    ],
    gates: [],
  },
  {
    id: 2,
    label: 'Phase 2',
    title: 'Launch & Distribution',
    dates: 'Mar 22 – Apr 30',
    status: 'active',
    tasks: [
      { id: 'p2_snem_stories', label: 'Prepare data stories for Snem', week: 'W1', due: '2026-03-28' },
      { id: 'p2_demo_prep', label: 'Demo prep for PS contacts', week: 'W1', due: '2026-03-28' },
      { id: 'p2_varhanovce', label: 'Varhaňovce/Čižatice story draft', week: 'W1', due: '2026-03-28' },
      { id: 'p2_366zeros', label: '366 zeros story draft', week: 'W1', due: '2026-03-28' },
      { id: 'p2_snem_launch', label: 'Snem PS soft launch', week: 'W2', due: '2026-04-04' },
      { id: 'p2_ps_push', label: 'PS network distribution push', week: 'W2', due: '2026-04-04' },
      { id: 'p2_journalists', label: 'Journalist outreach list (10+)', week: 'W3–4', due: '2026-04-18' },
      { id: 'p2_blog', label: 'Blog post on methodology', week: 'W3–4', due: '2026-04-18' },
      { id: 'p2_social', label: 'Social media campaign', week: 'W3–4', due: '2026-04-18' },
      { id: 'p2_petrzalka', label: 'Petržalka gap story', week: 'W3–4', due: '2026-04-18' },
      { id: 'p2_motw', label: 'Municipality of the Week #1', week: 'W5–6', due: '2026-04-30' },
      { id: 'p2_newsletter', label: 'Newsletter setup', week: 'W5–6', due: '2026-04-30' },
      { id: 'p2_growth', label: 'Growth loops analysis', week: 'W5–6', due: '2026-04-30' },
    ],
    gates: [
      { id: 'g2_visitors', label: '50K visitors' },
      { id: 'g2_munis', label: '500+ municipalities viewed' },
      { id: 'g2_shares', label: '1,000+ shares' },
      { id: 'g2_media', label: '3+ media mentions' },
      { id: 'g2_inbound', label: 'Inbound from municipal staff > 0' },
    ],
  },
  {
    id: 3,
    label: 'Phase 3',
    title: 'Domain Immersion & SaaS Validation',
    dates: 'May – June',
    status: 'upcoming',
    tasks: [
      { id: 'p3_interviews', label: 'Interview 15–20 municipal staff' },
      { id: 'p3_events', label: 'Attend 2–3 EU fund events' },
      { id: 'p3_study_success', label: 'Study 5 successful + 5 failed municipalities' },
      { id: 'p3_workflow', label: 'Map full municipal EU fund workflow' },
      { id: 'p3_hypothesis', label: 'Define + validate SaaS hypothesis' },
      { id: 'p3_itms21', label: 'ITMS21 miestaRealizacie integration' },
      { id: 'p3_refresh', label: 'Automated data refresh pipeline' },
      { id: 'p3_opencalls', label: 'Open calls feature' },
    ],
    gates: [
      { id: 'g3_workflow', label: 'Can describe workflow without notes' },
      { id: 'g3_pay', label: '5+ would pay' },
      { id: 'g3_pain', label: '#1 pain point identified' },
      { id: 'g3_pricing', label: 'Pricing hypothesis validated' },
    ],
  },
  {
    id: 4,
    label: 'Phase 4',
    title: 'Build SaaS V1',
    dates: 'Jul – Aug',
    status: 'upcoming',
    tasks: [
      { id: 'p4_mvp', label: 'Build MVP (1–2 weeks)' },
      { id: 'p4_pilot', label: 'Pilot at €99/month' },
      { id: 'p4_pricing', label: 'Define pricing tiers (€199/€399/€799)' },
      { id: 'p4_onboard', label: 'Onboard 5 pilots' },
      { id: 'p4_nps', label: 'Collect NPS' },
      { id: 'p4_success', label: 'Document success story' },
    ],
    gates: [
      { id: 'g4_pilots', label: '5 active pilots' },
      { id: 'g4_paying', label: '3 paying' },
      { id: 'g4_nps', label: 'NPS > 7' },
      { id: 'g4_story', label: '1 success story' },
    ],
  },
  {
    id: 5,
    label: 'Phase 5',
    title: 'Growth & Scale',
    dates: 'Sep 2026 – Mar 2027',
    status: 'upcoming',
    tasks: [
      { id: 'p5_flywheel', label: 'Success-story marketing flywheel' },
      { id: 'p5_partnerships', label: 'ZMOS/ÚMS/SK8 partnerships' },
      { id: 'p5_eu_tsi', label: 'EU Technical Support Instrument' },
      { id: 'p5_czech', label: 'Czech expansion' },
    ],
    gates: [
      { id: 'g5_100', label: '100+ paying municipalities' },
      { id: 'g5_revenue', label: '€30K+/month' },
      { id: 'g5_cross', label: 'Cross-border pilot' },
    ],
  },
];
