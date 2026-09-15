const list = document.querySelector("#list");

function copy(text) {
  return navigator.clipboard.writeText(text);
}

const runs = await fetch("/api/history").then((r) => r.json());
if (!runs.runs?.length) {
  list.textContent = "No runs yet.";
} else {
  for (const run of runs.runs) {
    const article = document.createElement("article");
    const head = document.createElement("header");
    const meta = document.createElement("span");
    meta.textContent = `${run.created_at} · ${run.mode}${run.tone ? ` · ${run.tone}` : ""}`;
    const actions = document.createElement("span");
    const copyIn = document.createElement("button");
    copyIn.className = "copy";
    copyIn.textContent = "Copy input";
    copyIn.addEventListener("click", () => copy(run.input));
    const copyOut = document.createElement("button");
    copyOut.className = "copy";
    copyOut.textContent = "Copy output";
    copyOut.addEventListener("click", () => copy(run.output));
    actions.append(copyIn, copyOut);
    head.append(meta, actions);
    const input = document.createElement("pre");
    input.textContent = run.input;
    const output = document.createElement("pre");
    output.textContent = run.output;
    article.append(head, input, output);
    list.append(article);
  }
}
