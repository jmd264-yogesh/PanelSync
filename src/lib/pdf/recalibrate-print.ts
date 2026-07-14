// Print-to-PDF document builders for Recalibrate, mirroring the Calibrate DE CoE
// Interview Kit prototype's buildPrintDoc()/downloadPdf() approach: build a styled HTML
// string and hand it to the browser's print dialog ("Save as PDF") via a hidden iframe.
// No PDF library dependency, consistent with the rest of this app.

export interface RecalibrateRubricBand {
  band: string;
  description: string;
}

export interface RecalibrateQuestion {
  id: string;
  category: string;
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxMarks: number;
  rubric: RecalibrateRubricBand[];
}

export interface RecalibratePrintInput {
  candidateName: string;
  positionTitle: string;
  roleGradeLabel: string;
  tracksLabel: string;
  styleLabel: string;
  panelistName: string;
  date: string; // e.g. 2026-07-13
  questions: RecalibrateQuestion[];
  questionScores: Record<string, number>;
  rubricDimensions: string[];
  rubricScores: Record<string, number>;
  notes: string;
  durationLabel: string; // e.g. "42:10" or "—"
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function avgOf(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function analysisRows(input: RecalibratePrintInput): { rows: string; flag: string } {
  const qScores = input.questions.map((q) => input.questionScores[q.id]).filter((v): v is number => typeof v === 'number');
  const rScores = input.rubricDimensions.map((d) => input.rubricScores[d]).filter((v): v is number => typeof v === 'number');
  const avgQ = avgOf(qScores);
  const avgR = avgOf(rScores);

  let rows = `<tr><td>Avg question score</td><td>${avgQ !== null ? avgQ.toFixed(1) + ' / 5' : '—'}</td></tr>`;
  rows += `<tr><td>Avg rubric score</td><td>${avgR !== null ? avgR.toFixed(1) + ' / 5' : '—'}</td></tr>`;
  let flag = '';
  if (avgQ !== null && avgR !== null) {
    const diff = avgR - avgQ;
    rows += `<tr><td>Rubric vs question gap</td><td>${(diff >= 0 ? '+' : '') + diff.toFixed(1)}</td></tr>`;
    flag = Math.abs(diff) >= 1.0
      ? `<p class="flag">DISCREPANCY FLAG: rubric average is ${Math.abs(diff).toFixed(1)} points ${diff > 0 ? 'higher' : 'lower'} than the per-question average — review before finalizing.</p>`
      : `<p class="flagok">Rubric and per-question scores are consistent (gap under 1.0).</p>`;
  }
  return { rows, flag };
}

const BASE_STYLE = `
  @page{margin:18mm 16mm;}
  *{box-sizing:border-box;}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0B1E33;font-size:11.5px;line-height:1.5;}
  h1{font-size:19px;margin:0 0 2px;color:#0B1E33;}
  .badge{display:inline-block;background:#0B1E33;color:#fff;font-size:9px;letter-spacing:.12em;padding:3px 8px;text-transform:uppercase;margin-bottom:10px;}
  h2{font-size:13px;margin:20px 0 8px;border-bottom:2px solid #0B1E33;padding-bottom:3px;}
  table{width:100%;border-collapse:collapse;margin:6px 0 4px;}
  th,td{border:1px solid #b7c3d0;padding:5px 7px;text-align:left;vertical-align:top;}
  th{background:#eef2f6;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;}
  table.meta td:first-child{width:32%;color:#4a5c70;font-weight:600;}
  table.score td:last-child{text-align:center;width:20%;font-weight:700;}
  .q{border:1px solid #d5dde5;padding:9px 12px;margin:8px 0;page-break-inside:avoid;}
  .qh{margin:0 0 4px;} .area{color:#4a5c70;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;}
  .qt{margin:0 0 6px;font-weight:600;}
  .gg{margin:0 0 6px;color:#33475b;font-size:10px;}
  .sc{margin:0;}
  .flag{border:1.5px solid #D97757;background:#fbeee8;color:#8a3418;padding:8px 10px;font-weight:600;margin-top:8px;}
  .flagok{border:1px solid #7FD8A0;background:#eefaf1;color:#1f6b3f;padding:8px 10px;margin-top:8px;}
  .notes{border:1px solid #d5dde5;padding:9px 12px;white-space:pre-wrap;min-height:40px;}
  .foot{margin-top:16px;font-size:9px;color:#7a8a9a;text-align:center;}
`;

function metaTable(input: RecalibratePrintInput): string {
  return `<table class="meta">
    <tr><td>Candidate</td><td>${escapeHtml(input.candidateName)}</td></tr>
    <tr><td>Position</td><td>${escapeHtml(input.positionTitle)}</td></tr>
    <tr><td>Role grade</td><td>${escapeHtml(input.roleGradeLabel)}</td></tr>
    <tr><td>Interview tracks</td><td>${escapeHtml(input.tracksLabel)}</td></tr>
    <tr><td>Question style</td><td>${escapeHtml(input.styleLabel)}</td></tr>
    <tr><td>Date</td><td>${escapeHtml(input.date)}</td></tr>
  </table>`;
}

// Candidate-facing sheet: questions only, no model answers/rubric/scores.
export function buildCandidateSheetHtml(input: RecalibratePrintInput): string {
  const title = `Interview Question Sheet — ${input.candidateName}`;
  let qBlock = '';
  input.questions.forEach((q, idx) => {
    qBlock += `<div class="q">
      <p class="qh"><b>Q${idx + 1}.</b> <span class="area">${escapeHtml(q.category)}</span></p>
      <p class="qt">${escapeHtml(q.question)}</p>
    </div>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>${BASE_STYLE}</style></head><body>
    <div class="badge">Recalibrate · DE CoE Interview Kit</div>
    <h1>Interview Question Sheet</h1>
    ${metaTable(input)}
    <h2>Questions</h2>
    ${qBlock}
    <p class="foot">Generated by Recalibrate · DE CoE Interview Kit</p>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
  </body></html>`;
}

// Panelist-facing report: full content — model answers, rubric, scores, analysis, notes.
export function buildPanelistReportHtml(input: RecalibratePrintInput): string {
  const title = `Full Assessment — ${input.candidateName}`;
  const { rows: anaRows, flag } = analysisRows(input);

  let qBlock = '';
  input.questions.forEach((q, idx) => {
    const score = input.questionScores[q.id];
    const rubricLines = q.rubric.map((b) => `<b>${escapeHtml(b.band)}:</b> ${escapeHtml(b.description)}`).join(' &nbsp; ');
    qBlock += `<div class="q">
      <p class="qh"><b>Q${idx + 1}.</b> <span class="area">${escapeHtml(q.category)} · ${escapeHtml(q.difficulty)} · ${q.maxMarks} marks</span></p>
      <p class="qt">${escapeHtml(q.question)}</p>
      <p class="gg">${rubricLines}</p>
      <p class="sc"><b>Score given:</b> ${score !== undefined ? score + ' / 5' : '— (not scored)'}</p>
    </div>`;
  });

  let rubricRows = '';
  input.rubricDimensions.forEach((dim) => {
    const val = input.rubricScores[dim];
    rubricRows += `<tr><td>${escapeHtml(dim)}</td><td>${val !== undefined ? val + ' / 5' : '—'}</td></tr>`;
  });

  const notes = escapeHtml(input.notes) || '—';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>${BASE_STYLE}</style></head><body>
    <div class="badge">Recalibrate · DE CoE Interview Assessment</div>
    <h1>Full Assessment Report</h1>
    ${metaTable(input)}
    <table class="meta"><tr><td>Panelist</td><td>${escapeHtml(input.panelistName)}</td></tr><tr><td>Interview duration</td><td>${escapeHtml(input.durationLabel)}</td></tr></table>
    <h2>Questions, rubric &amp; scores</h2>
    ${qBlock}
    <h2>Overall rubric</h2>
    <table class="score"><tr><th>Skill dimension</th><th>Rating</th></tr>${rubricRows}</table>
    <h2>Score analysis</h2>
    <table class="score">${anaRows}</table>
    ${flag}
    <h2>Panelist notes / recommendation</h2>
    <div class="notes">${notes}</div>
    <p class="foot">Generated by Recalibrate · DE CoE Interview Kit</p>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
  </body></html>`;
}

export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      // ignore
    }
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, 400);
}
