+++
date = "2026-03-12"
title = "You can make an SQL editor with CodeMirror and SQLGlot"
tags = ['sql', 'web-dev']
+++

{{< rawhtml >}}

<style>
  #sqlglot-container {
    margin: 1.5em 0;
    margin-top: 0;
  }
  .sqlglot-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #ddd;
  }
  .sqlglot-tab {
    padding: 6px 16px;
    font-size: 14px;
    font-family: monospace;
    cursor: pointer;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: none;
    color: #666;
  }
  .sqlglot-tab:hover { color: #333; }
  .sqlglot-tab.active {
    border-color: #ddd;
    background: #fff;
    color: #333;
    margin-bottom: -1px;
    padding-bottom: 7px;
  }
  .sqlglot-editor-pane {
    border: 1px solid #ddd;
    border-top: none;
    overflow: hidden;
  }
  .sqlglot-editor-pane .cm-editor {
    font-size: 15px;
    min-height: 200px;
  }
  .sqlglot-editor-pane .cm-editor.cm-focused {
    outline: none;
  }
  .sqlglot-editor-pane.hidden { display: none; }
  #sqlglot-status {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-size: 14px;
    font-family: monospace;
    border: 1px solid #ddd;
    border-top: none;
  }
  #sqlglot-status.loading { background: #fff3cd; color: #856404; }
  #sqlglot-status.valid { background: #d4edda; color: #155724; }
  #sqlglot-status.invalid { background: #f8d7da; color: #721c24; }
  #sqlglot-message {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #sqlglot-status.invalid .sqlglot-error { display: inline; }
  .sqlglot-error {
    display: none;
    margin-left: 1em;
  }
  #sqlglot-actions {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    margin-left: 12px;
  }
  .sqlglot-btn {
    background: none;
    border: 1px solid currentColor;
    color: inherit;
    font-family: monospace;
    font-size: 13px;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    opacity: 0.8;
  }
  .sqlglot-btn:hover { opacity: 1; }
  .sqlglot-btn:disabled { opacity: 0.4; cursor: default; }
  .cm-errorLine {
    background: #f8d7da40;
    box-shadow: inset 3px 0 0 #dc3545;
  }
  #sqlglot-results:empty { display: none; }
  #sqlglot-results {
    border: 1px solid #ddd;
    border-top: none;
    max-height: 400px;
    overflow: auto;
  }
  #sqlglot-results table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    font-family: monospace;
    margin: 0;
  }
  #sqlglot-results th,
  #sqlglot-results td {
    padding: 6px 12px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  #sqlglot-results th {
    background: #f8f9fa;
    font-weight: 600;
    position: sticky;
    top: 0;
  }
  #sqlglot-results tbody tr:last-child td { border-bottom: none; }
  #sqlglot-results tr:hover td { background: #f8f9fa; }
  #sqlglot-results .sqlglot-error-msg {
    padding: 8px 12px;
    color: #721c24;
    background: #f8d7da;
    font-family: monospace;
    font-size: 14px;
    white-space: pre-wrap;
  }
</style>

<div id="sqlglot-container">
  <div class="sqlglot-tabs">
    <button class="sqlglot-tab active" data-tab="query">Query</button>
    <button class="sqlglot-tab" data-tab="data">Data</button>
  </div>
  <div id="sqlglot-editor-query" class="sqlglot-editor-pane"></div>
  <div id="sqlglot-editor-data" class="sqlglot-editor-pane hidden"></div>
  <div id="sqlglot-status" class="loading">
    <div id="sqlglot-message">
      <span class="sqlglot-label">Loading Pyodide + SQLGlot...</span>
      <span class="sqlglot-error"></span>
    </div>
    <div id="sqlglot-actions">
      <button id="sqlglot-format" class="sqlglot-btn" disabled>Format</button>
      <button id="sqlglot-run" class="sqlglot-btn" disabled>Run</button>
    </div>
  </div>
  <div id="sqlglot-results"></div>
</div>

<script type="importmap">
{
  "imports": {
    "codemirror": "https://esm.sh/*codemirror@6.0.1",
    "@codemirror/": "https://esm.sh/*@codemirror/",
    "@lezer/": "https://esm.sh/*@lezer/",
    "style-mod": "https://esm.sh/style-mod",
    "w3c-keyname": "https://esm.sh/w3c-keyname",
    "crelt": "https://esm.sh/crelt",
    "@marijn/find-cluster-break": "https://esm.sh/@marijn/find-cluster-break"
  }
}
</script>

<script type="module">

import { EditorView, lineNumbers, highlightSpecialChars, drawSelection, dropCursor, highlightActiveLine, Decoration } from "@codemirror/view"
import { EditorState, StateField, StateEffect } from "@codemirror/state"
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands"
import { syntaxHighlighting, indentUnit, bracketMatching, defaultHighlightStyle } from "@codemirror/language"
import { highlightSelectionMatches } from "@codemirror/search"
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, completionStatus } from "@codemirror/autocomplete"
import { sql } from "@codemirror/lang-sql"
import { keymap } from "@codemirror/view"
import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm"

const defaultQuery = `SELECT
  customer_id,
  COUNT(*) AS order_count,
  SUM(amount) AS total_spent
FROM orders
WHERE created_at >= '2025-01-01'
GROUP BY customer_id
HAVING total_spent > 100
ORDER BY total_spent DESC
LIMIT 10`

const defaultData = `CREATE OR REPLACE TABLE orders (
  customer_id INTEGER,
  amount DECIMAL(10,2),
  created_at DATE
);

INSERT INTO orders VALUES
  (1, 250.00, '2025-01-15'),
  (1, 75.50, '2025-02-20'),
  (2, 180.00, '2025-01-10'),
  (2, 320.00, '2025-03-05'),
  (2, 45.00, '2024-12-01'),
  (3, 500.00, '2025-01-22'),
  (3, 120.00, '2025-02-14'),
  (4, 89.99, '2024-11-30'),
  (4, 210.00, '2025-01-05'),
  (4, 155.00, '2025-03-01');`

const statusEl = document.getElementById("sqlglot-status")
const labelEl = statusEl.querySelector(".sqlglot-label")
const errorEl = statusEl.querySelector(".sqlglot-error")
const formatBtn = document.getElementById("sqlglot-format")
const runBtn = document.getElementById("sqlglot-run")
const resultsEl = document.getElementById("sqlglot-results")

// Per-tab state: validation status + results HTML
const tabState = {
  query: { statusClass: "loading", label: "Loading...", error: "", results: "" },
  data:  { statusClass: "loading", label: "Loading...", error: "", results: "" },
}

function applyTabState(tab) {
  const s = tabState[tab]
  statusEl.className = s.statusClass
  labelEl.textContent = s.label
  errorEl.textContent = s.error
  resultsEl.innerHTML = s.results
}

function saveTabState(tab) {
  tabState[tab].results = resultsEl.innerHTML
}

// Error line decoration (shared definition, each editor gets its own state)
const setErrorLines = StateEffect.define()
const errorLineDeco = Decoration.line({ class: "cm-errorLine" })
const errorLineField = StateField.define({
  create() { return Decoration.none },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLines)) return e.value
    }
    return decos.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f),
})

// Shared CodeMirror extensions
const baseExtensions = [
  errorLineField,
  lineNumbers(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  highlightActiveLine(),
  EditorState.allowMultipleSelections.of(true),
  indentUnit.of("  "),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  highlightSelectionMatches(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  sql({ upperCaseKeywords: true }),
  keymap.of([indentWithTab, ...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap]),
]

// Query editor
const queryEditor = new EditorView({
  doc: defaultQuery,
  extensions: [
    ...baseExtensions,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        debouncedValidate()
        tabState.query.results = ""
        if (activeTab === "query") resultsEl.innerHTML = ""
      }
    }),
  ],
  parent: document.getElementById("sqlglot-editor-query"),
})

// Data editor
const dataEditor = new EditorView({
  doc: defaultData,
  extensions: [
    ...baseExtensions,
    EditorView.updateListener.of(update => {
      if (update.docChanged) debouncedValidate()
    }),
  ],
  parent: document.getElementById("sqlglot-editor-data"),
})

// Tab switching
let activeTab = "query"
const tabButtons = document.querySelectorAll(".sqlglot-tab")
const queryPane = document.getElementById("sqlglot-editor-query")
const dataPane = document.getElementById("sqlglot-editor-data")

function getActiveEditor() {
  return activeTab === "query" ? queryEditor : dataEditor
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === activeTab) return
    saveTabState(activeTab)
    tabButtons.forEach(t => t.classList.remove("active"))
    btn.classList.add("active")
    activeTab = btn.dataset.tab
    if (activeTab === "query") {
      queryPane.classList.remove("hidden")
      dataPane.classList.add("hidden")
    } else {
      queryPane.classList.add("hidden")
      dataPane.classList.remove("hidden")
    }
    applyTabState(activeTab)
  })
})

// Load Pyodide + SQLGlot
let pyodide = null

async function initPyodide() {
  const script = document.createElement("script")
  script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js"
  document.head.appendChild(script)
  await new Promise(resolve => script.onload = resolve)

  pyodide = await loadPyodide()
  await pyodide.loadPackage("micropip")
  const micropip = pyodide.pyimport("micropip")
  await micropip.install("sqlglot")

  pyodide.runPython(`
import json
import sqlglot
from sqlglot import exp
from sqlglot.errors import ErrorLevel, ParseError

def extract_tables(query):
    """Extract table names from CREATE statements."""
    tables = set()
    try:
        for expr in sqlglot.parse(query, read="duckdb"):
            if isinstance(expr, exp.Create):
                tables.add(expr.this.this.name)
    except Exception:
        pass
    return json.dumps(list(tables))

def validate_sql(query, known_tables_json="[]"):
    known_tables = {t.lower() for t in json.loads(known_tables_json)}
    errors = []
    try:
        expressions = sqlglot.parse(query, read="duckdb", error_level=ErrorLevel.RAISE)
    except ParseError as e:
        for err in e.errors:
            errors.append({
                "message": err.get("description", str(e)),
                "line": err.get("line"),
                "col": err.get("col"),
                "highlight": err.get("highlight", ""),
            })
        if not errors:
            errors.append({"message": str(e)})
        return json.dumps(errors)
    except Exception as e:
        return json.dumps([{"message": str(e)}])

    for expression in expressions:
        if expression is None:
            continue
        for node in expression.find_all(exp.Anonymous):
            errors.append({"message": f"Unknown function: {node.this}"})
        if known_tables:
            cte_names = {cte.alias.lower() for cte in expression.find_all(exp.CTE)}
            seen = set()
            for table in expression.find_all(exp.Table):
                name = table.name
                if name.lower() not in known_tables and name.lower() not in cte_names and name.lower() not in seen:
                    seen.add(name.lower())
                    errors.append({"message": f"Unknown table: {name}"})

    return json.dumps(errors)

def format_sql(query):
    statements = sqlglot.transpile(query, read="duckdb", write="duckdb", pretty=True)
    return ";\\n\\n".join(statements) + ";" if statements else ""
  `)

  formatBtn.disabled = false
}

// Load DuckDB WASM
let db = null
let conn = null

async function initDuckDB() {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })
  )
  const worker = new Worker(workerUrl)
  const logger = new duckdb.ConsoleLogger()
  db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(workerUrl)
  conn = await db.connect()
  runBtn.disabled = false
}

// Initialize both in parallel
Promise.all([initPyodide(), initDuckDB()]).then(() => {
  // Validate both tabs so each has its initial state
  validateTab("query", queryEditor)
  validateTab("data", dataEditor)
  applyTabState(activeTab)
}).catch(e => {
  console.error("Init failed:", e)
  setStatus(activeTab, "invalid", "Initialization error", "— " + e.message)
  applyTabState(activeTab)
})

// Validation with debounce
let timeout = null

function debouncedValidate() {
  if (!pyodide) return
  clearTimeout(timeout)
  timeout = setTimeout(validate, 150)
}

function clearErrorLines(editor) {
  editor.dispatch({ effects: setErrorLines.of(Decoration.none) })
}

function markErrorLines(editor, errors) {
  const doc = editor.state.doc
  const decos = []
  for (const err of errors) {
    if (err.line && err.line >= 1 && err.line <= doc.lines) {
      const line = doc.line(err.line)
      decos.push(errorLineDeco.range(line.from))
    }
  }
  editor.dispatch({
    effects: setErrorLines.of(Decoration.set(decos, true))
  })
}

function setStatus(tab, cls, label, error) {
  tabState[tab].statusClass = cls
  tabState[tab].label = label
  tabState[tab].error = error
  if (tab === activeTab) {
    statusEl.className = cls
    labelEl.textContent = label
    errorEl.textContent = error
  }
}

function validateTab(tab, editor) {
  if (!pyodide) return
  if (completionStatus(editor.state)) {
    debouncedValidate()
    return
  }
  const query = editor.state.doc.toString()
  if (!query.trim()) {
    setStatus(tab, "loading", "Empty query", "")
    clearErrorLines(editor)
    return
  }
  let knownTables = "[]"
  if (tab === "query") {
    knownTables = pyodide.globals.get("extract_tables")(dataEditor.state.doc.toString())
  }
  const result = pyodide.globals.get("validate_sql")(query, knownTables)
  const errors = JSON.parse(result)
  if (errors.length === 0) {
    setStatus(tab, "valid", "Valid DuckDB SQL", "")
    clearErrorLines(editor)
  } else {
    const messages = errors.map(e => e.message).join("; ")
    setStatus(tab, "invalid", "Invalid SQL", "— " + messages)
    markErrorLines(editor, errors)
  }
}

function validate() {
  validateTab(activeTab, getActiveEditor())
}

// Format button
formatBtn.addEventListener("click", () => {
  if (!pyodide) return
  const editor = getActiveEditor()
  const query = editor.state.doc.toString()
  try {
    const formatted = pyodide.globals.get("format_sql")(query)
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: formatted }
    })
  } catch (e) {
    // Can't format invalid SQL — validation will show the error
  }
})

// Run button
runBtn.addEventListener("click", async () => {
  if (!conn) return
  runBtn.disabled = true
  resultsEl.innerHTML = ""
  try {
    if (activeTab === "data") {
      const dataSQL = dataEditor.state.doc.toString()
      if (dataSQL.trim()) {
        await conn.query(dataSQL)
      }
      const html = '<div style="padding:8px 12px;font-family:monospace;font-size:14px;color:#155724;background:#d4edda;">Data loaded successfully.</div>'
      resultsEl.innerHTML = html
      tabState.data.results = html
    } else {
      // Query tab: seed data first, then run query
      const dataSQL = dataEditor.state.doc.toString()
      if (dataSQL.trim()) {
        await conn.query(dataSQL)
      }
      const querySQL = queryEditor.state.doc.toString()
      const result = await conn.query(querySQL)
      const rows = result.toArray().map(row => row.toJSON())
      let html
      if (rows.length === 0) {
        html = '<div style="padding:8px 12px;font-family:monospace;font-size:14px;color:#666;">No rows returned.</div>'
      } else {
        const cols = Object.keys(rows[0])
        const header = cols.map(c => `<th>${c}</th>`).join("")
        const body = rows.map(row =>
          "<tr>" + cols.map(c => `<td>${row[c]}</td>`).join("") + "</tr>"
        ).join("")
        html = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
      }
      resultsEl.innerHTML = html
      tabState.query.results = html
    }
  } catch (e) {
    const html = `<div class="sqlglot-error-msg">${e.message}</div>`
    resultsEl.innerHTML = html
    tabState[activeTab].results = html
  } finally {
    runBtn.disabled = false
  }
})

</script>

{{< /rawhtml >}}

## Where do people write SQL?

It's 2026, and I'm not convinced there's one place people flock to for writing SQL.

There are excellent tools like [DataGrip](https://www.jetbrains.com/datagrip/), [Count.co](https://count.co/), and [Hex](https://hex.tech/blog/sql-for-data-analysis/), but you have to pay for them. You can use the code editors offered by BigQuery/DataBricks/Snowflake, but I find them subpar and not actively maintained. Also, they're closed source so the community can't improve them. [MotherDuck](https://motherduck.com/) is an exception in this category and is excellent -- see their [FixIt](https://motherduck.com/blog/introducing-fixit-ai-sql-error-fixer/) feature -- but it only caters to DuckDB, which is still a niche.

There are some great free generalist tools, such as [Beekeeper Studio](https://www.beekeeperstudio.io/), [DBeaver](https://dbeaver.io/), and [QStudio](https://www.timestored.com/qstudio/). There are also apps that cater to specific databases like [Postico](https://eggerapps.at/postico/v1.php) for PostgreSQL. For CLI aficionados there's [Harlequin](https://harlequin.sh/) and the more recent [sqlit](https://github.com/Maxteabag/sqlit). I would argue that these solutions focus on traditional relational database workloads, and less so on modern analytical workloads like what DataGrip/Count.co/Hex are trying to solve for. Last but not least [dbt](https://docs.getdbt.com/docs/install-dbt-extension) and [SQLMesh](https://sqlmesh.readthedocs.io/en/stable/guides/vscode/) both have official VSCode plugins, which have some great features. But [hell knows](https://www.reddit.com/r/dataengineering/comments/1r0ff3b/ama_were_dbt_labs_ask_us_anything/) what lies in both tools' future.

I don't believe people will pay for fancy code editors going forward, now that shipping software isn't a blocker. Any copycat with a bit of patience and a credit card can mimic any app, so a good UX is not enough of a moat anymore. As an example, I think the pricing model offered by [Zed](https://zed.dev/) is what will make sense: you can use the app as much as you want for free, and you can pay a premium for features that require compute -- e.g. edit predictions, usage analytics, etc. It's fair and square.

## Making a code editor is not so difficult anymore

I vibe coded the widget at the top of this article. It combines two excellent pieces of open-source software:

- [CodeMirror](https://codemirror.net/) is a code editor for the web. It is used in many high-traffic web interfaces, including Huggingface and MotherDuck. Here I tweaked the config to auto-complete keywords in uppercase and insert tabs on new lines.
- [SQLGlot](https://github.com/tobymao/sqlglot) is a SQL parser. It's written in pure Python, and can therefore be used in the browser via WASM, using [Pyodide](https://pyodide.org/en/stable/). Because it's a parser, it can do different things like detecting syntax errors, semantic errors, transpiling, formatting, etc.

Both tools work well together. CodeMirror can be customized in many ways, allowing you to benefit from SQLGlot's goodness:

- Queries can be formatted at will -- insert [SQL caps lock meme](https://www.reddit.com/media?url=https://i.redd.it/0ciiv1xlmue61.png)
- Syntax errors are caught *before* running the query
- Unknown table references are detected too -- try changing `orders`

And that's just after vibe coding for an hour. But don't take my word for it, try it! The widget's source code is embedded in this web page, so you can point your coding agent to this page to reproduce it and go further.

*Sidenote: recently [Polyglot](https://github.com/tobilg/polyglot) made the rounds. It's a Rust reimplementation of SQLGlot, [made](https://www.linkedin.com/posts/tobiasmuellerlg_introducing-polyglot-a-rust-sql-transpiler-activity-7429117368427241472-CbJA?utm_source=share&utm_medium=member_desktop&rcm=ACoAABFKzCAB2vLy2pHCTDvHMEDJyQ4OWTtNZD8) with a [Ralph Wiggum loop](https://ghuntley.com/loop/). I'm not sure how I feel about this. It's as if SQLGlot was handmade woodwork and Polyglot is plastic injection molding.*

## Will we still need to write SQL?

Here I am rambling on about writing SQL, when omens foretell a world where analysts just write natural language. There's indeed been [movement](https://juhache.substack.com/p/sql-is-solved-heres-where-chat-bi) on the so-called *Text to SQL* topic, also known as *Chat BI*. It's been going on for a while in a semi-serious manner, but the meteoric rise of agentic workflows is making it very real indeed. My girlfriend works at Airbnb and showed me their internal tool, which is honestly outstanding. It's so good she simply doesn't write SQL anymore, and doesn't have to nag her Data team.

I think analytics agent tools like [nao](https://getnao.io/) are on the right track. They will probably give established dashboarding tools a run for their money. It's probably a great thing that most end users will end up not having to write SQL, or to manually fiddle with bloated charting tools. However, for this to be possible, someone has to lay down the foundations. Someone has to construct the right data models, give the agents their context, debug dual sources of truth, etc. I simply do not see a world where writing SQL disappears entirely.

My belief is that there will always be a need to interact with databases by writing SQL, with the assistance of an AI or not. I've never been fully satisfied with the tools I've used in the past, so I've decided to roll out my own. I've named it [Squill](https://squill.dev/), and I'll write more about it in future articles!
