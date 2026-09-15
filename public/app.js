const inputEl = document.querySelector("#input");
const outputEl = document.querySelector("#output");
const diffEl = document.querySelector("#diff");
const statusEl = document.querySelector("#status");
const issuesWrap = document.querySelector(".issues");
const issuesEl = document.querySelector("#issues");
const runBtn = document.querySelector("#run");
const toneEl = document.querySelector("#tone");
const modeBtns = [...document.querySelectorAll(".mode")];

let selectedMode = "paraphrase";
let issues = [];

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;
    modeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  });
});

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function renderDiff(parts) {
  diffEl.replaceChildren();
  for (const part of parts || []) {
    if (part.added) {
      const el = document.createElement("ins");
      el.textContent = part.value;
      diffEl.append(el);
    } else if (part.removed) {
      const el = document.createElement("del");
      el.textContent = part.value;
      diffEl.append(el);
    } else {
      diffEl.append(part.value);
    }
  }
}

function applyIssue(index, replacement) {
  const issue = issues[index];
  if (!issue) return;
  const text = inputEl.value;
  const next =
    text.slice(0, issue.offset) + replacement + text.slice(issue.offset + issue.length);
  const delta = replacement.length - issue.length;
  inputEl.value = next;
  issues = issues
    .filter((_, i) => i !== index)
    .map((other) => {
      if (other.offset >= issue.offset + issue.length) {
        return { ...other, offset: other.offset + delta };
      }
      if (other.offset + other.length <= issue.offset) return other;
      return null;
    })
    .filter(Boolean);
  renderIssues();
  outputEl.textContent = next;
  renderDiff([{ value: next }]);
}

function renderIssues() {
  issuesEl.replaceChildren();
  if (!issues.length) {
    issuesWrap.hidden = true;
    return;
  }
  issuesWrap.hidden = false;
  issues.forEach((issue, index) => {
    const li = document.createElement("li");
    li.className = "issue";
    const msg = document.createElement("p");
    msg.textContent = issue.message;
    const excerpt = document.createElement("p");
    excerpt.className = "excerpt";
    excerpt.textContent = inputEl.value.slice(issue.offset, issue.offset + issue.length);
    const actions = document.createElement("div");
    (issue.replacements.length ? issue.replacements : [""]).forEach((rep) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = rep || "(remove)";
      btn.addEventListener("click", () => applyIssue(index, rep));
      actions.append(btn);
    });
    li.append(msg, excerpt, actions);
    issuesEl.append(li);
  });
}

async function readSse(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

async function runRewrite() {
  const input = inputEl.value;
  outputEl.textContent = "";
  issuesWrap.hidden = true;
  setStatus("Streaming…");
  const response = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: selectedMode,
      tone: toneEl.value,
      input,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  let output = "";
  await readSse(response, (event, data) => {
    if (event === "token") {
      output += data.text;
      outputEl.textContent = output;
    }
    if (event === "done") {
      outputEl.textContent = data.output;
      renderDiff(data.diff);
      setStatus("Saved to history.");
    }
    if (event === "error") {
      throw new Error(data.error);
    }
  });
}

async function runGrammar() {
  setStatus("Checking with local LanguageTool…");
  issuesWrap.hidden = true;
  const response = await fetch("/api/grammar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: inputEl.value }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "LanguageTool request failed. See README for setup.");
  }
  issues = body.issues || [];
  outputEl.textContent = body.output || inputEl.value;
  renderDiff(body.diff);
  renderIssues();
  setStatus(issues.length ? `${issues.length} issue(s). Click a suggestion to apply.` : "No issues found.");
}

async function run() {
  const input = inputEl.value.trim();
  if (!input) {
    setStatus("Enter some text first.", true);
    return;
  }
  runBtn.disabled = true;
  try {
    if (selectedMode === "grammar") await runGrammar();
    else await runRewrite();
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", run);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    run();
  }
});
