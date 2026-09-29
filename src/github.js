import { config } from "./config.js";

function repoUrl(filePath = "") {
  return `https://api.github.com/repos/${encodeURIComponent(config.githubOwner)}/${encodeURIComponent(config.githubRepo)}/contents/${filePath}`;
}

const headers = {
  "Accept": "application/vnd.github+json",
  "Authorization": `Bearer ${config.githubToken}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "wos-auto-redeemer"
};

export async function readState() {
  const url = `${repoUrl(config.statePath)}?ref=${encodeURIComponent(config.githubBranch)}`;

  const response = await fetch(url, { headers, cache: "no-store" });

  if (response.status === 404) {
    return {
      sha: null,
      state: {
        lastValidatedGiftcodeDatetime: null
      }
    };
  }

  if (!response.ok) {
    throw new Error(`GitHub read state HTTP ${response.status}`);
  }

  const data = await response.json();
  const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");

  return {
    sha: data.sha,
    state: JSON.parse(decoded)
  };
}

export async function writeState(state, sha) {
  const content = Buffer.from(
    JSON.stringify(state, null, 2) + "\n",
    "utf8"
  ).toString("base64");

  const body = {
    message: `chore: update giftcode listener state`,
    content,
    branch: config.githubBranch
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(repoUrl(config.statePath), {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write state HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { sha: data.content?.sha || null, data };
}