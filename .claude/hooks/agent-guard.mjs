#!/usr/bin/env node
// PreToolUse guard for Housemate's project subagents.
//
// Wired from each agent's frontmatter:
//   node "$CLAUDE_PROJECT_DIR/.claude/hooks/agent-guard.mjs" <mode>
// Modes: security | product | design | engineer
//
// Exit 0 allows the tool call; exit 2 blocks it and shows stderr to the agent.
// Fails closed: unreadable input, unknown modes or unexpected errors all block.

import { readFileSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2];

function block(reason) {
  process.stderr.write(`Blocked by the ${mode ?? "?"} agent guard: ${reason}\n`);
  process.exit(2);
}

const AGENT = {
  security: "security-reviewer",
  product: "product-manager",
  design: "designer",
  engineer: "engineer",
}[mode];

// ---------------------------------------------------------------- writes ----

function checkWrite(filePath, root, scratchpad) {
  if (!filePath) block("no file path in tool input");
  const abs = path.resolve(root, filePath);
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const memory = `.claude/agent-memory/${AGENT}/`;
  const inside = (prefixes) => prefixes.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));

  // Own memory is always writable (memory: project enables Write/Edit for this).
  if (inside([memory])) return;

  // Temporary files for agents that build things.
  if ((mode === "engineer" || mode === "design") && scratchpad && abs.startsWith(path.resolve(scratchpad) + path.sep)) return;

  if (rel.startsWith("..") || path.isAbsolute(rel)) block(`${filePath} is outside the project`);

  // Never: secrets, git internals, deployment links, other agents' definitions or memory.
  if (inside([".env", ".git/", ".vercel/", ".neon", ".claude/agents/", ".claude/hooks/", ".claude/settings.json", ".claude/settings.local.json"]) ||
      rel.startsWith(".env") || (rel.startsWith(".claude/agent-memory") && !rel.startsWith(memory)))
    block(`${rel} is protected`);

  const allow = {
    security: [],
    product: ["docs/product/"],
    design: ["docs/design/", "app/", "components/", "public/", "tailwind.config.ts"],
    engineer: null, // anywhere not protected above
  }[mode];
  const deny = {
    design: ["app/api/", "lib/", "prisma/", "scripts/", "tests/", "package.json", "package-lock.json", "next.config.ts"],
  }[mode] ?? [];

  if (inside(deny)) block(`${rel} is outside the ${AGENT}'s remit — hand this change to the engineer`);
  if (allow === null) return;
  if (!inside(allow)) {
    block(
      mode === "security"
        ? "the security reviewer is read-only; report findings instead of editing files"
        : `the ${AGENT} may only write to ${allow.join(", ")} (and its memory)`
    );
  }
}

// ----------------------------------------------------------------- shell ----

// Split on unquoted ; & | and newlines; collect the unquoted text of each segment.
function segments(cmd) {
  const out = [];
  let cur = "", bare = "", q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) q = null;
      else if (c === "\\" && q === '"') { cur += c + (cmd[++i] ?? ""); continue; }
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (c === "\\") { cur += c + (cmd[++i] ?? ""); continue; }
    if (c === ";" || c === "|" || c === "&" || c === "\n") {
      if (c === "&" && (cmd[i - 1] === ">" || cmd[i + 1] === ">")) { cur += c; bare += c; continue; } // 2>&1, &>
      if (cur.trim()) out.push({ text: cur.trim(), bare });
      cur = ""; bare = "";
      continue;
    }
    cur += c;
    bare += c;
  }
  if (q) block("unbalanced quotes");
  if (cur.trim()) out.push({ text: cur.trim(), bare });
  return out;
}

function words(s) {
  return (s.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((w) => w.replace(/^["']|["']$/g, ""));
}

const READONLY_COMMANDS = new Set([
  "cd", "pwd", "ls", "cat", "head", "tail", "wc", "grep", "egrep", "rg", "find", "tree", "file", "stat",
  "sort", "uniq", "cut", "tr", "diff", "comm", "basename", "dirname", "realpath", "echo", "printf",
  "date", "which", "true", "false", "test", "[", "git", "npm", "npx",
]);
const GIT_READ = new Set(["status", "diff", "log", "show", "blame", "ls-files", "ls-tree", "grep", "rev-parse", "shortlog", "describe", "branch", "remote", "cat-file"]);

function checkReadOnlyBash(cmd) {
  if (/\$\(|`|<\(|>\(/.test(cmd)) block("command substitution is not allowed in read-only mode");
  for (const seg of segments(cmd)) {
    // Output redirection: only to /dev/null or 2>&1.
    const redir = seg.bare.replace(/\d?>&\d/g, "").replace(/&?\d?>>?\s*\/dev\/null/g, "");
    if (/>/.test(redir)) block("writing to files via redirection is not allowed in read-only mode");

    let w = words(seg.text);
    while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) w = w.slice(1); // VAR=x cmd
    const [cmd0, sub, ...rest] = w;
    if (!cmd0) continue;
    if (!READONLY_COMMANDS.has(cmd0)) block(`"${cmd0}" is not on the read-only command list`);

    if (cmd0 === "find" && w.some((x) => /^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/.test(x)))
      block("find actions that run commands or write files are not allowed");
    // Flags that write files or run programs: git/sort --output, sort -o, tree -o, rg --pre.
    if (w.some((x) => /^--(output|pre)(=|$)/.test(x)) ||
        (cmd0 === "sort" && w.some((x) => /^-[a-zA-Z]*o/.test(x))) ||
        (cmd0 === "tree" && w.includes("-o")))
      block("flags that write files or run other programs are not allowed in read-only mode");
    if (cmd0 === "git") {
      if (!GIT_READ.has(sub)) block(`"git ${sub ?? ""}" is not read-only`);
      if (sub === "branch" && rest.some((x) => /^(-d|-D|-m|-M|-c|-C|--delete|--move|--copy|-f|--force|--set-upstream-to|-u)$/.test(x) || !x.startsWith("-")))
        block("git branch may only list branches");
      if (sub === "remote" && rest.some((x) => !x.startsWith("-"))) block("git remote may only list remotes");
    }
    if (cmd0 === "npm") {
      const ok = (sub === "audit" && !rest.includes("fix")) || ["ls", "view", "outdated"].includes(sub) ||
        (sub === "run" && ["typecheck", "test:unit"].includes(rest[0]));
      if (!ok) block(`"npm ${w.slice(1).join(" ")}" is not read-only`);
    }
    if (cmd0 === "npx") {
      const ok = (sub === "tsc" && rest.includes("--noEmit")) || (sub === "prisma" && rest[0] === "validate");
      if (!ok) block(`"npx ${w.slice(1).join(" ")}" is not read-only`);
    }
  }
}

// Things no agent may run: deploys, production config, remote-database destruction.
function checkDangerousBash(cmd) {
  const c = cmd.replace(/\s+/g, " ");
  const remoteDb = /\bneon connection-string\b|neon\.tech|postgres(?:ql)?:\/\/[^@\s]*@(?!localhost|127\.0\.0\.1)/i.test(c);
  const rules = [
    [/\bgit push\b[^;&|]*\b(main|master|production)\b/, "pushing to main deploys production — the founder does this"],
    [/\bgit push( +origin)? *($|[;&|])/, "name the branch explicitly (a bare git push may deploy main)"],
    [/\bgit push\b[^;&|]*(--force\b|--force-with-lease\b| -f\b)/, "force-pushing is not allowed"],
    [/\bgit (reset --hard|clean -[a-z]*f)/, "discarding work is not allowed"],
    [/\bvercel\b[^;&|]*(--prod\b|\benv (add|rm|pull)\b|\bpromote\b|\brollback\b|\bremove\b|\brm\b|\bdomains?\b|\balias\b)/, "production Vercel changes are for the founder"],
    [/\bneon\b[^;&|]*\b(branch(es)? (create|delete|reset|rename|restore|set-default)|project(s)? delete|set-context|link)\b/, "Neon branch/project changes are for the founder"],
    [/\bprisma (db push|migrate reset)\b/, "use Prisma Migrate (npm run db:migrate:dev); never push or reset"],
    [/\bgh (repo (delete|edit|archive)|secret|release (create|delete))\b/, "GitHub repository changes are for the founder"],
    [/\brm -[a-z]*(rf|fr)[a-z]* +(\/|~|\$HOME|\.\.)/, "recursive delete outside the project"],
  ];
  for (const [re, why] of rules) if (re.test(c)) block(why);
  if (remoteDb && /(db:reset|db:seed|npm run setup|prisma\/seed|\b(delete|drop|truncate|update|insert|alter)\b)/i.test(c))
    block("writing to a cloud database needs the founder's explicit approval — ask in your report");
}

function checkBash(cmd) {
  if (mode === "security" || mode === "product") checkReadOnlyBash(cmd);
  checkDangerousBash(cmd);
}

// ----------------------------------------------------------------- main -----
// Runs last so every rule above is initialised.

try {
  if (!AGENT) block(`unknown mode "${mode}"`);
  const input = JSON.parse(readFileSync(0, "utf8"));
  const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};

  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
    checkWrite(ti.file_path ?? ti.notebook_path, root, input.scratchpad_dir);
  } else if (tool === "Bash") {
    checkBash(String(ti.command ?? ""));
  }
  process.exit(0);
} catch (e) {
  block(`guard error (${e?.message ?? e})`);
}
