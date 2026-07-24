import { RoleGrade } from './spec-catalog';

// The organization's actual technical + behavioural interview rubric — replaces the
// generic tracks/platforms/topics taxonomy as the source of both (a) the category list
// AI-generated questions are scoped to, and (b) the Overall Scoring Rubric grid's
// dimensions and score-band language. Score scale is 1-4 per the org framework
// (Does Not Meet / Partially Meets / Meets Expectation / Exceeds Expectation) — distinct
// from the AI's own per-question 1-5 rubric, which stays as-is.

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
      'Same, plus their Databricks architecture decisions are adopted as a standard/playbook beyond their own project/account; advises other teams/accounts.',
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
      'Has basic knowledge, able to explain macros, models, snapshot, seeds.',
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

// The full list of valid question/rubric category labels for a role grade — technical
// (tier-specific) + the shared behavioural set. Used both as the AI prompt's allowed
// "category" list and as verifyQuestionSet's focusAreas.
export function deriveFocusAreas(roleGrade: RoleGrade): string[] {
  const tier = getOrgTier(roleGrade);
  const technical = TECHNICAL_CATEGORIES_BY_TIER[tier].map((c) => TECHNICAL_CATEGORY_LABEL[c]);
  const behavioural = BEHAVIOURAL_CATEGORIES.map((c) => BEHAVIOURAL_CATEGORY_LABEL[c]);
  return [...technical, ...behavioural];
}

// The Overall Scoring Rubric grid's dimensions for a role grade, each with its org-defined
// 1-4 band text (technical bands are tier-specific; behavioural bands are shared).
export function rubricDimensionsWithBands(roleGrade: RoleGrade): { label: string; bands: Bands }[] {
  const tier = getOrgTier(roleGrade);
  const technical = TECHNICAL_CATEGORIES_BY_TIER[tier].map((c) => ({
    label: TECHNICAL_CATEGORY_LABEL[c],
    bands: TECHNICAL_RUBRIC[tier][c] as Bands,
  }));
  const behavioural = BEHAVIOURAL_CATEGORIES.map((c) => ({
    label: BEHAVIOURAL_CATEGORY_LABEL[c],
    bands: BEHAVIOURAL_RUBRIC[c],
  }));
  return [...technical, ...behavioural];
}
