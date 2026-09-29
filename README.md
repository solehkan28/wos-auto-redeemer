# WOS Auto Giftcode Redeemer

Automatic Whiteout Survival giftcode listener/redeemer for Vercel.

## Flow

1. Vercel Cron calls `/api/listener` every 5 minutes.
2. Listener reads validated WoS giftcodes from WOSControl.
3. It selects codes newer than `lastValidatedGiftcodeDatetime`.
4. Account files are read from `accounts/`.
5. Filename `<name>_<server>.txt` supplies the server/KID.
6. Each FID is redeemed against the CenturyGame giftcode API.
7. **Only `SUCCESS` and `RECEIVED` are terminal.**
8. `SAME TYPE EXCHANGE`, HTTP 429, timeout, network error, unknown API response, and other errors are retryable.
9. The exact giftcode/group/FID cursor is stored in `state/listener.json` on GitHub.
10. The watermark advances only after every FID for the giftcode is `SUCCESS` or `RECEIVED`.

## Account file

Example: `accounts/account-list-pribadi_3037.txt`

- `3037` = server/KID
- one FID per line
- blank lines and `# comments` are ignored
- comma/semicolon suffixes are ignored for compatibility with the Python parser
- duplicate FIDs are removed

## Environment variables

- `WOS_GIFTCODE_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (default `main`)
- `WOSCONTROL_API_URL` (optional)
- `WOS_GIFTCODE_API_URL` (optional)
- `LISTENER_SECRET` (optional)
- `LISTENER_RUN_BUDGET_MS` (optional, default `25000`)

Never commit the giftcode signing secret or GitHub token.

## Retry behavior

The listener deliberately does **not** mark ordinary API failures as final.

For one FID:

- `SUCCESS` -> advance to next FID
- `RECEIVED.` -> advance to next FID
- everything else -> retry the same FID

Because Vercel functions have execution limits, "retry terus" is implemented as a persistent retry cursor: the function retries during its current execution budget, commits the cursor to GitHub, and the next cron invocation resumes the same FID. This continues until `SUCCESS` or `RECEIVED`.
# wos-auto-redeemer
