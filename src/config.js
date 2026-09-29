export const config = {
  wosControlUrl:
    process.env.WOSCONTROL_API_URL ||
    "https://woscontrol.com/api/codes",

  redeemUrl:
    process.env.WOS_GIFTCODE_API_URL ||
    "https://wos-giftcode-api.centurygame.com/api/gift_code",

  redeemSecret: process.env.WOS_GIFTCODE_SECRET,

  githubToken: process.env.GITHUB_TOKEN,
  githubOwner: process.env.GITHUB_OWNER,
  githubRepo: process.env.GITHUB_REPO,
  githubBranch: process.env.GITHUB_BRANCH || "main",

  statePath: "state/listener.json",
  accountsDir: "accounts"
};

export function assertConfig() {
  const required = [
    ["WOS_GIFTCODE_SECRET", config.redeemSecret],
    ["GITHUB_TOKEN", config.githubToken],
    ["GITHUB_OWNER", config.githubOwner],
    ["GITHUB_REPO", config.githubRepo]
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}