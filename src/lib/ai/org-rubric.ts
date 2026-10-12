import { RoleGrade } from './spec-catalog';

// The organization's actual technical + behavioural interview rubric — replaces the
// generic tracks/platforms/topics taxonomy as the source of both (a) the category list
// AI-generated questions are scoped to, and (b) the Overall Scoring Rubric grid's
// dimensions and score-band language. Score scale is 1-4 per the org framework
// (Does Not Meet / Partially Meets / Meets Expectation / Exceeds Expectation) — distinct
// from the AI-generated per-question rubric, which also uses 1-4 bands but is written
// per question rather than per category.

export type OrgRubricTier = 'se_sse' | 'consultant' | 'enabler';

export const ORG_TIER_LABEL: Record<OrgRubricTier, string> = {
  se_sse: 'SE & SSE',
  consultant: 'Consultant & Sr Consultant',
  enabler: 'Enabler',
};

// "Score 3 = the bar stated in the interview framework for this role" for every tier.
export const ORG_TIER_BAR: Record<OrgRubricTier, string> = {
  se_sse: 'hands-on, builds & explains basics',
  consultant: 'architecture, scale, real trade-offs',
  enabler: 'full lifecycle, maintainable, right tool for the job',
};

// The org rubric only ships tables for these three tiers. Intern maps onto the SE & SSE
// bar (same entry-level expectation); Data Architect maps onto Consultant & Sr Consultant
// (same senior/strategic bar) — confirmed with the team as the closest fit until/unless
// dedicated tables are provided for those two grades.
export const ROLE_GRADE_TO_ORG_TIER: Record<RoleGrade, OrgRubricTier> = {
  intern: 'se_sse',
  se: 'se_sse',
  sse: 'se_sse',
  enabler: 'enabler',
  sc: 'consultant',
  ssc: 'consultant',
  architect: 'consultant',
};

export type TechnicalCategoryId =
  | 'azureDatabricks'
  | 'microsoftFabric'
  | 'snowflake'
  | 'pyspark'
  | 'sql'
  | 'dataPipeline'
  | 'awsGcp'
  | 'dbt';

export const TECHNICAL_CATEGORY_LABEL: Record<TechnicalCategoryId, string> = {
  azureDatabricks: 'Azure Databricks Experience',
  microsoftFabric: 'Microsoft Fabric Experience',
  snowflake: 'Snowflake Experience',
  pyspark: 'PySpark Expertise',
  sql: 'SQL Proficiency',
  dataPipeline: 'Data Pipeline & ETL/ELT',
  awsGcp: 'AWS / GCP Experience (Optional)',
  dbt: 'dbt',
};

// dbt is only assessed for the Enabler tier — everything else applies to all three.
export const TECHNICAL_CATEGORIES_BY_TIER: Record<OrgRubricTier, TechnicalCategoryId[]> = {
  se_sse: ['azureDatabricks', 'microsoftFabric', 'snowflake', 'pyspark', 'sql', 'dataPipeline', 'awsGcp'],
  consultant: ['azureDatabricks', 'microsoftFabric', 'snowflake', 'pyspark', 'sql', 'dataPipeline', 'awsGcp'],
  enabler: ['azureDatabricks', 'microsoftFabric', 'snowflake', 'pyspark', 'sql', 'dataPipeline', 'awsGcp', 'dbt'],
};

// [score1, score2, score3, score4] description text, verbatim from the org's rubric sheets.
type Bands = [string, string, string, string];

export const TECHNICAL_RUBRIC: Record<OrgRubricTier, Partial<Record<TechnicalCategoryId, Bands>>> = {
  se_sse: {
    azureDatabricks: [
      'Aware of Databricks concepts (notebooks, clusters) only — no hands-on.',
      'Uses notebooks with guidance; runs/modifies existing jobs but unfamiliar with cluster config or scheduling.',
      'Independently builds and runs notebooks/jobs; explains what a pipeline does; knows when something is broken and roughly why.',
      'Same, plus some independent cluster config and basic performance/quality checks without close supervision.',
    ],
    microsoftFabric: [
      'Can name Fabric/OneLake and a few artifacts — no hands-on.',
      "Explored in sandbox/POC; navigates Lakehouse/Warehouse UI; hasn't built a working pipeline.",
      "Independently builds a basic Fabric pipeline/semantic model and explains what it does; knows when it's broken and roughly why.",
      'Same, plus some independent handling of workspace/environment basics beyond the minimum.',
    ],
    snowflake: [
      'No hands-on Snowflake — theoretical knowledge only.',
      'Writes basic queries and loads data with guidance; unfamiliar with warehouses, roles, cost management.',
      "Independently writes and runs standard queries/loads; explains what a pipeline does; knows when something's broken and roughly why.",
      'Same, plus starting to use warehouses/roles sensibly and basic query optimization without heavy guidance.',
    ],
    pyspark: [
      "Knows Spark concepts (RDD/DataFrame) but can't write working code unaided.",
      'Writes basic DataFrame transformations with guidance; struggles with partitioning/shuffles.',
      "Writes clean, working PySpark for a basic pipeline independently; explains what it does; knows when something's broken and roughly why.",
      'Same, plus early awareness of partitioning/performance basics and follows team code standards.',
    ],
    sql: [
      'Simple SELECT/WHERE only; struggles with joins.',
      'Comfortable with joins & aggregations; struggles with window functions, CTEs, optimization.',
      "Writes clean, working SQL independently for standard tasks; explains what a query/pipeline does; knows when something's broken and roughly why.",
      'Same, plus starting to use window functions/CTEs and basic optimization without heavy guidance.',
    ],
    dataPipeline: [
      'Theoretical understanding only — no hands-on pipeline building.',
      'Builds simple pipelines with guidance/templates; limited grasp of error handling, scheduling, or data quality checks.',
      'Independently builds a basic pipeline end to end; explains what it does; knows when something is broken and roughly why.',
      'Same, plus starting to add basic error handling or scheduling awareness without being asked.',
    ],
    awsGcp: [
      'No hands-on cloud experience — conceptual awareness only.',
      'Used a few core services (S3/GCS, basic compute) with guidance; limited IAM/networking understanding.',
      'Independently uses core services for a basic pipeline; explains what it does; knows when something is broken and roughly why.',
      'Same, plus some independent use of IAM/config basics without heavy guidance.',
    ],
  },
  consultant: {
    azureDatabricks: [
      "Operates within an existing Databricks setup but doesn't design one; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; trade-offs (cost, performance, governance) still developing.',
      'Designs end-to-end Databricks architecture that scales — clusters, Unity Catalog, Delta Lake, DABs, LakeFlow, Genie; makes real trade-offs; troubleshoots performance/cost issues.',
      'Same, plus their Databricks architecture decisions are adopted as a standard/playbook beyond their own project; advises other teams/accounts.',
    ],
    microsoftFabric: [
      "Operates within an existing Fabric setup but doesn't design one; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; trade-offs on OneLake/capacity/workspace design still developing.',
      'Designs end-to-end Fabric architecture across OneLake, Lakehouse, Warehouse, Real-Time Analytics; makes real trade-offs on workspace/environment/capacity management.',
      'Same, plus advises on Fabric adoption strategy beyond their own project; decisions referenced as a standard elsewhere. Environment handling, deployments, capacity management.',
    ],
    snowflake: [
      "Operates within an existing Snowflake setup but doesn't design one; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; cost/governance trade-offs still developing.',
      'Designs Snowflake architecture at scale — cost optimization, clustering keys, data sharing, Snowpark; makes real trade-offs; designs a multi-team governance model.',
      'Same, plus their Snowflake governance/architecture model is adopted as the standard beyond their own project. Good knowledge in using native snowflake AI, cortex, CoCo.',
    ],
    pyspark: [
      "Operates within existing PySpark jobs but doesn't design the approach; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; scale-related trade-offs still developing.',
      'Designs PySpark solutions that scale — partition strategy, broadcast joins, caching, Catalyst/Tungsten-aware decisions; makes real trade-offs.',
      'Same, plus their approach to PySpark at scale is adopted as a standard/playbook beyond their own project.',
    ],
    sql: [
      "Operates within existing SQL/schema but doesn't design it; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; indexing/schema trade-offs still developing.',
      'Designs efficient schema/indexing strategy at scale; optimizes complex queries; reads execution plans to make real trade-offs.',
      'Same, plus their schema/query design approach is adopted as a standard/playbook beyond their own project.',
    ],
    dataPipeline: [
      "Operates within an existing pipeline architecture but doesn't design one; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; resilience/tooling trade-offs still developing.',
      'Designs scalable, resilient pipeline architectures — orchestration, retries, data quality frameworks, CDC; evaluates tooling trade-offs.',
      'Same, plus their pipeline architecture approach is adopted as a standard/playbook beyond their own project.',
    ],
    awsGcp: [
      "Operates within an existing cloud setup but doesn't design one; trade-off reasoning is shallow.",
      'Makes some architectural contributions with support; cost/security trade-offs still developing.',
      'Architects multi-service cloud solutions (Glue/Dataflow, IAM policies, cost optimization, security) that scale; makes real trade-offs.',
      'Same, plus advises on cloud strategy beyond their own project; decisions adopted as a standard elsewhere.',
    ],
  },
  enabler: {
    azureDatabricks: [
      'Aware of notebooks/jobs but not the full lifecycle.',
      'Covers most of the lifecycle with some gaps.',
      'Comfortable across the full Databricks lifecycle; picks it appropriately for the job; writes maintainable notebooks/jobs; supports deployment and quality checks (cluster config, workflows, performance tuning).',
      "Same, plus raises the team's Databricks standards — hands-on with DABs, LakeFlow, Genie, environment handling; mentors others; resolves non-trivial performance/cost issues.",
    ],
    microsoftFabric: [
      'Comfortable with basic Fabric artifacts but not the full lifecycle.',
      'Covers most of the lifecycle with some gaps; pipelines work but maintainability or integration (Power BI, Data Factory) is not aware.',
      'Comfortable across the full Fabric lifecycle; picks the right Fabric component for the job; builds maintainable pipelines/semantic models (Lakehouse, Data Factory, Power BI) independently.',
      'Same, plus manages workspace/environment/capacity considerations and raises team Fabric standards; mentors others.',
    ],
    snowflake: [
      'Comfortable with basic queries/loads but not the full lifecycle.',
      'Covers most of the lifecycle with some gaps; manages warehouses/roles with support.',
      'Comfortable across the full Snowflake lifecycle; picks warehouse/config appropriately; independently manages roles/permissions, query optimization, and common features (Streams, Tasks, Time Travel).',
      'Same, plus raises team Snowflake standards — cost optimization, clustering, Snowpark use; mentors others. RBAC, CoCo, Cortex.',
    ],
    pyspark: [
      'Comfortable with basic transformations but not the full lifecycle; code not reliably maintainable by others.',
      'Covers most of the lifecycle with some gaps; partitioning/performance choices inconsistent.',
      'Comfortable across the full PySpark lifecycle; writes efficient, maintainable jobs; understands partitioning & joins (follows best practice: docstrings, functions); debugs independently with occasional support.',
      'Same, plus optimizes at scale (partition tuning, broadcast joins, caching) and raises team PySpark standards; mentors others.',
    ],
    sql: [
      'Comfortable with standard queries but not the full lifecycle; maintainability/optimization inconsistent.',
      'Covers most needs with some gaps; writes complex queries with support.',
      'Comfortable across the full SQL lifecycle for this role; writes complex, maintainable queries independently (window functions, CTEs, subqueries); understands indexing and basic optimization.',
      'Same, plus optimizes complex queries at scale and raises team SQL standards; mentors others.',
    ],
    dataPipeline: [
      'Comfortable building pipelines but not the full lifecycle; error handling/scheduling/monitoring inconsistent.',
      'Covers most of the lifecycle with some gaps in error handling, scheduling, or monitoring.',
      'Comfortable across the full pipeline lifecycle; picks the right approach for the job; builds maintainable production pipelines with error handling, scheduling, and monitoring.',
      'Same, plus raises team pipeline standards — resilience patterns, tooling choices; mentors others. Good knowledge in orchestration.',
    ],
    awsGcp: [
      'Comfortable with a few services but not the full lifecycle; IAM/networking choices inconsistent.',
      'Covers most needs with some gaps; provisions core services with support.',
      'Comfortable across core AWS/GCP services for the role; picks the right service for the job; independently provisions/manages storage, compute, IAM; writes maintainable infra config.',
      'Same, plus raises team cloud standards — cost/security awareness beyond the basics; mentors others.',
    ],
    dbt: [
      'Has basic knowledge on dbt and how it works.',
      'Has dbt knowledge, able to explain macros, models, snapshot, seeds.',
      'Able to clearly define dbt folders, variables, usecases for macros, jinja template, understanding of CI/CD, unit test.',
      'Complete knowledge on dbt, same as #3 and covering anchors, selectors, hooks, state, freshness, lineage, document.',
    ],
  },
};

export type BehaviouralCategoryId = 'businessUnderstanding' | 'logicalThinking' | 'peopleManagement' | 'assertivenessComms';

export const BEHAVIOURAL_CATEGORY_LABEL: Record<BehaviouralCategoryId, string> = {
  businessUnderstanding: 'Business Understanding',
  logicalThinking: 'Logical Thinking & Problem Solving',
  peopleManagement: 'People Management',
  assertivenessComms: 'Assertiveness & Comms',
};

export const BEHAVIOURAL_CATEGORIES: BehaviouralCategoryId[] = [
  'businessUnderstanding', 'logicalThinking', 'peopleManagement', 'assertivenessComms',
];

// One shared scale across every role — the score reflects rough seniority, not the role
// being interviewed for (see BEHAVIOURAL_EXPECTED_BAND for how to read a given score).
export const BEHAVIOURAL_RUBRIC: Record<BehaviouralCategoryId, Bands> = {
  businessUnderstanding: [
    'Sees only the technical task, not how it connects to the business.',
    'Understands basic business context and can translate it into simple technical logic (e.g., grouping customers as internal/external).',
    'Understands the business context, links it to their technical work, and can help estimate delivery timelines for business deliverables.',
    "Has a clear picture of the client's business; defines problem statements, explains them to the team, and translates business needs into technical asks.",
  ],
  logicalThinking: [
    'Needs step-by-step guidance to solve even simple problems.',
    'Solves familiar problems but struggles with new or unexpected issues.',
    'Breaks problems down logically and solves most issues independently, asking for help when needed.',
    'Spots root causes of complex problems quickly and solves them independently, often anticipating issues in advance.',
  ],
  peopleManagement: [
    "Supports peers with code and helps review each other's work.",
    'Helps and mentors junior team members; flags concerns or risks to the project lead.',
    'Guides and mentors reportees, supports their career growth, and enables them on the project.',
    'Mentors the wider project team and manages the growth of direct reportees.',
  ],
  assertivenessComms: [
    'Hesitant to speak up; avoids raising concerns or disagreeing.',
    'Shares views when asked but rarely raises concerns on their own.',
    'Speaks up confidently, raises concerns proactively, and communicates clearly with the team and stakeholders.',
    'Drives discussions confidently, pushes back when needed, and influences decisions through clear communication.',
  ],
};

// "How the score tiers map to seniority" — which score range is the expected bar for a
// given org tier on the (role-agnostic) behavioural scale. Not applicable as a strict
// per-tier table like TECHNICAL_RUBRIC — it's one scale, read differently by seniority.
export const BEHAVIOURAL_EXPECTED_BAND: Record<OrgRubricTier, string> = {
  se_sse: '1-2',
  enabler: '2-3',
  consultant: '3-4',
};

export function getOrgTier(roleGrade: RoleGrade): OrgRubricTier {
  return ROLE_GRADE_TO_ORG_TIER[roleGrade];
}

export function getTechnicalCategoriesForRoleGrade(roleGrade: RoleGrade): TechnicalCategoryId[] {
  return TECHNICAL_CATEGORIES_BY_TIER[getOrgTier(roleGrade)];
}

// Narrows a tier's technical category list to a panelist-selected subset (the tech
// stacks actually relevant to a given candidate) — ignored/dropped ids (wrong tier, or
// stale from a role-grade change) are filtered out defensively. Undefined/empty selection
// falls back to the full tier list, so callers with no selection yet (or pre-existing data
// from before this feature existed) keep today's "everything" behaviour.
function selectedOrAllTechnical(tier: OrgRubricTier, selectedTechStacks?: TechnicalCategoryId[]): TechnicalCategoryId[] {
  const all = TECHNICAL_CATEGORIES_BY_TIER[tier];
  if (!selectedTechStacks || selectedTechStacks.length === 0) return all;
  const selected = new Set(selectedTechStacks);
  return all.filter((id) => selected.has(id));
}

// ── Technical case study (Consultant & above) ───────────────────────────────
// The org's "Technical Case Studies — Panel Reference" slide: for Solution Consultant,
// Senior Solution Consultant and Data Architect, every question set must include exactly
// one case-study question built on one of these scenarios. It's scored as its own
// rubric dimension so the panel's case-study observation is a number, not just a note.

export const CASE_STUDY_CATEGORY_LABEL = 'Technical Case Study';

export type CaseStudyId = 'multiEntityAcquisition' | 'multiPortcoPe' | 'exitReadiness';

export interface CaseStudy {
  id: CaseStudyId;
  title: string;
  scenario: string;
  followUps: string[];
}

export const CASE_STUDIES: Record<CaseStudyId, CaseStudy> = {
  multiEntityAcquisition: {
    id: 'multiEntityAcquisition',
    title: 'Multi-Entity Acquisition',
    scenario:
      'LensKart operates across multiple regions and has acquired John Jacobs — both specs-making companies (same business model), but their operating models differ, with separate CRM and ERP systems for each.',
    followUps: [
      'Explain the architecture solution.',
      'How would you organise the data?',
      'If they acquire another similar specs company, how quickly can you integrate and get them into reporting?',
      'What questions would you ask?',
      'Are you aware of compliance (e.g. GDPR, PCI DSS, HIPAA)? (good to have)',
      'Explain the development process.',
    ],
  },
  multiPortcoPe: {
    id: 'multiPortcoPe',
    title: 'Multi-Portco PE Reporting',
    scenario:
      'A PE firm with 10 portfolio companies (e.g. Banking, Pharma, others) has no unified reporting layer for cross-portco insights. 5 portcos run on-prem SQL Server; 5 run web apps with API connectivity. Each portco has its own chart of accounts, KPIs, and operating cadence.',
    followUps: [
      'What questions would you ask the client to better understand the situation before proposing a solution?',
      'How would you propose the technical architecture, and why?',
      'How can we build the ingestion efficiently?',
      'How easy would it be to integrate a newly acquired business into the data platform?',
      'How would you recommend governing this platform?',
      'How easy would it be to leverage AI capabilities in your platform? Any use case?',
    ],
  },
  exitReadiness: {
    id: 'exitReadiness',
    title: 'PE Exit-Readiness Reporting',
    scenario:
      'Meridian Home & Garden — a £180M home & garden products company — was acquired by a PE firm 14 months ago and has since acquired two more brands, resulting in multiple disconnected systems: ERP (orders, inventory, finance — Meridian), SAP (Acquired Brand 2), Shopify / Amazon (D2C Brand 3), a 3PL warehouse (daily shipment CSVs), and Excel (product mappings, exchange rates, revenue reconciliation). Finance and Brand teams report different revenue figures each month; month-end close takes 9 days. Exit is expected in 2-3 years, and current reporting lacks the trust/governance required for due diligence.',
    followUps: [
      'Before you design anything — what would you want to know, and who would you want to talk to?',
      'Which KPIs or reports would you recommend to create value for the PE business?',
      'Design the target data architecture, including layers and data model — why this approach?',
      'IT lead wants everything built on the existing Matillion/Alteryx instance (licences owned), or fully on-prem — how do you respond?',
      "It's week 4 of 12. The CFO asks you to also build inventory forecasting dashboards. What do you say?",
    ],
  },
};

export const CASE_STUDY_IDS = Object.keys(CASE_STUDIES) as CaseStudyId[];

// The deck defines the case studies and their follow-ups but not 1-4 band text for
// scoring them, so these bands apply the Consultant & Sr Consultant bar ("architecture,
// scale, real trade-offs") to what the follow-up questions probe: clarifying questions,
// target architecture, ingestion/integration of new entities, governance, and handling
// stakeholder pushback.
export const CASE_STUDY_RUBRIC: Bands = [
  'Jumps straight to a tool or generic diagram without clarifying the business problem; architecture is incomplete or not scalable; struggles with the follow-ups.',
  'Asks a few clarifying questions and proposes a workable architecture, but trade-offs, integration of new entities, or governance are thin and need prompting.',
  'Asks the right business questions first; designs a scalable end-to-end architecture (layers, data model, ingestion) with real trade-offs; credibly covers onboarding new acquisitions and governance.',
  'Same, plus ties the design to business value (KPIs, exit readiness, cross-portco insight), handles stakeholder pushback and scope changes with confidence, and raises compliance/AI opportunities unprompted.',
];

/** Consultant & above (SC, SSC, Architect) must be asked one technical case study. */
export function requiresCaseStudy(roleGrade: RoleGrade): boolean {
  return getOrgTier(roleGrade) === 'consultant';
}

export function pickCaseStudy(preferred?: CaseStudyId | null): CaseStudy {
  if (preferred && CASE_STUDIES[preferred]) return CASE_STUDIES[preferred];
  return CASE_STUDIES[CASE_STUDY_IDS[Math.floor(Math.random() * CASE_STUDY_IDS.length)]];
}

// The full list of valid question/rubric category labels for a role grade — technical
// (tier-specific, optionally narrowed to `selectedTechStacks`), the case study for
// Consultant & above, and the shared behavioural set (always all — behavioural
// categories are role-agnostic, not stack-specific). Used both as the AI prompt's
// allowed "category" list and as verifyQuestionSet's focusAreas.
export function deriveFocusAreas(roleGrade: RoleGrade, selectedTechStacks?: TechnicalCategoryId[]): string[] {
  const tier = getOrgTier(roleGrade);
  const technical = selectedOrAllTechnical(tier, selectedTechStacks).map((c) => TECHNICAL_CATEGORY_LABEL[c]);
  const caseStudy = requiresCaseStudy(roleGrade) ? [CASE_STUDY_CATEGORY_LABEL] : [];
  const behavioural = BEHAVIOURAL_CATEGORIES.map((c) => BEHAVIOURAL_CATEGORY_LABEL[c]);
  return [...technical, ...caseStudy, ...behavioural];
}

// Every focus area needs at least one question for the set to be scorable across the
// whole rubric — so the minimum question count is simply the number of areas.
export const MIN_QUESTION_FLOOR = 3;
export const MAX_QUESTION_COUNT = 20;

export function minimumQuestionCount(roleGrade: RoleGrade, selectedTechStacks?: TechnicalCategoryId[]): number {
  return Math.max(MIN_QUESTION_FLOOR, deriveFocusAreas(roleGrade, selectedTechStacks).length);
}

// The Overall Scoring Rubric grid's dimensions for a role grade, each with its org-defined
// 1-4 band text (technical bands are tier-specific and optionally narrowed to
// `selectedTechStacks`; the case study row is added for Consultant & above; behavioural
// bands are shared and always all included).
export function rubricDimensionsWithBands(roleGrade: RoleGrade, selectedTechStacks?: TechnicalCategoryId[]): { label: string; bands: Bands }[] {
  const tier = getOrgTier(roleGrade);
  const technical = selectedOrAllTechnical(tier, selectedTechStacks).map((c) => ({
    label: TECHNICAL_CATEGORY_LABEL[c],
    bands: TECHNICAL_RUBRIC[tier][c] as Bands,
  }));
  const caseStudy = requiresCaseStudy(roleGrade)
    ? [{ label: CASE_STUDY_CATEGORY_LABEL, bands: CASE_STUDY_RUBRIC }]
    : [];
  const behavioural = BEHAVIOURAL_CATEGORIES.map((c) => ({
    label: BEHAVIOURAL_CATEGORY_LABEL[c],
    bands: BEHAVIOURAL_RUBRIC[c],
  }));
  return [...technical, ...caseStudy, ...behavioural];
}

// ── Score calculation ───────────────────────────────────────────────────────
// How the deck says the 1-4 rubric scores are read:
//   • Technical: "Score 3 = the bar stated in the interview framework for this role",
//     so the technical average is compared against 3.
//   • Case study (Consultant & above): same bar, 3.
//   • Behavioural: one role-agnostic scale where the score itself reflects seniority
//     (1-2 = SSE, 2-3 = Enabler, 3-4 = Consultant & above, 4 = exceeds even that), so
//     the behavioural average is compared against the bottom of the role's expected band.
// Averages are unweighted and only include dimensions that were actually rated.

export const TECHNICAL_BAR = 3;

const BEHAVIOURAL_BAND_MIN: Record<OrgRubricTier, number> = { se_sse: 1, enabler: 2, consultant: 3 };

export function behaviouralSeniority(avg: number): string {
  if (avg >= 4) return 'Exceeds Consultant & above';
  if (avg >= 3) return 'Consultant & above';
  if (avg >= 2) return 'Enabler';
  return 'SSE';
}

export interface RubricSectionResult {
  average: number | null;
  rated: number;
  total: number;
  bar: number;
  meetsBar: boolean | null;
}

export interface RubricBreakdown {
  tier: OrgRubricTier;
  technical: RubricSectionResult;
  caseStudy: RubricSectionResult | null;
  behavioural: RubricSectionResult & { expectedBand: string; indicatedSeniority: string | null };
  overall: { average: number | null; rated: number; total: number };
}

function scoreSection(labels: string[], scores: Record<string, number>, bar: number): RubricSectionResult {
  const values = labels.map((l) => scores[l]).filter((v): v is number => typeof v === 'number');
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { average, rated: values.length, total: labels.length, bar, meetsBar: average === null ? null : average >= bar };
}

export function computeRubricBreakdown(
  roleGrade: RoleGrade,
  selectedTechStacks: TechnicalCategoryId[] | undefined,
  rubricScores: Record<string, number>,
): RubricBreakdown {
  const tier = getOrgTier(roleGrade);
  const technicalLabels = selectedOrAllTechnical(tier, selectedTechStacks).map((c) => TECHNICAL_CATEGORY_LABEL[c]);
  const caseLabels = requiresCaseStudy(roleGrade) ? [CASE_STUDY_CATEGORY_LABEL] : [];
  const behaviouralLabels = BEHAVIOURAL_CATEGORIES.map((c) => BEHAVIOURAL_CATEGORY_LABEL[c]);

  const behavioural = scoreSection(behaviouralLabels, rubricScores, BEHAVIOURAL_BAND_MIN[tier]);
  const overall = scoreSection([...technicalLabels, ...caseLabels, ...behaviouralLabels], rubricScores, TECHNICAL_BAR);

  return {
    tier,
    technical: scoreSection(technicalLabels, rubricScores, TECHNICAL_BAR),
    caseStudy: caseLabels.length ? scoreSection(caseLabels, rubricScores, TECHNICAL_BAR) : null,
    behavioural: {
      ...behavioural,
      expectedBand: BEHAVIOURAL_EXPECTED_BAND[tier],
      indicatedSeniority: behavioural.average === null ? null : behaviouralSeniority(behavioural.average),
    },
    overall: { average: overall.average, rated: overall.rated, total: overall.total },
  };
}
