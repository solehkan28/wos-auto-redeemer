import { assertConfig, config } from "./config.js";
import { loadAccountGroups } from "./accounts.js";
import { fetchValidatedWosCodes } from "./woscontrol.js";
import { readState, writeState } from "./github.js";
import { redeemOne } from "./redeemer.js";

const DEFAULT_RUN_BUDGET_MS = 25_000;
const RUN_BUDGET_MS = Number(process.env.LISTENER_RUN_BUDGET_MS) || DEFAULT_RUN_BUDGET_MS;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeState(state) {
  return {
    lastValidatedGiftcodeDatetime: state?.lastValidatedGiftcodeDatetime ?? null,
    pending: state?.pending ?? null
  };
}

function findNextCode(codes, lastDatetime) {
  const last = lastDatetime ? new Date(lastDatetime).getTime() : null;

  return codes.find((code) => {
    if (last === null) return true;
    return code.date.getTime() > last;
  });
}

function currentTarget(groups, pending) {
  const group = groups[pending.groupIndex];
  if (!group) return null;

  const fid = group.fids[pending.fidIndex];
  if (!fid) return null;

  return { group, fid };
}

function advancePending(state, groups) {
  const pending = state.pending;
  const group = groups[pending.groupIndex];

  if (pending.fidIndex + 1 < group.fids.length) {
    pending.fidIndex += 1;
    return false;
  }

  if (pending.groupIndex + 1 < groups.length) {
    pending.groupIndex += 1;
    pending.fidIndex = 0;
    return false;
  }

  // Every FID for this giftcode reached SUCCESS or RECEIVED.
  state.lastValidatedGiftcodeDatetime = pending.date;
  state.pending = null;
  return true;
}

export async function runListener() {
  assertConfig();

  const startedAt = Date.now();
  const { sha: initialSha, state: rawState } = await readState();
  const state = normalizeState(rawState);
  let sha = initialSha;

  const groups = await loadAccountGroups();
  if (!groups.length) {
    throw new Error("No valid account files found.");
  }

  const totalFids = groups.reduce((sum, group) => sum + group.fids.length, 0);
  if (!totalFids) {
    throw new Error("No FID found in account files.");
  }

  const codes = await fetchValidatedWosCodes();

  console.log(
    `[LISTENER] fetched=${codes.length} last=${state.lastValidatedGiftcodeDatetime ?? "null"} ` +
    `pending=${state.pending ? state.pending.giftcode : "null"}`
  );

  // If a previous invocation was interrupted, resume the exact FID first.
  if (!state.pending) {
    const nextCode = findNextCode(codes, state.lastValidatedGiftcodeDatetime);

    if (!nextCode) {
      return {
        ok: true,
        status: "IDLE",
        processed: [],
        state: state.lastValidatedGiftcodeDatetime
      };
    }

    state.pending = {
      giftcode: nextCode.giftcode,
      date: nextCode.date.toISOString(),
      groupIndex: 0,
      fidIndex: 0
    };

    // Persist the cursor BEFORE redeeming. If Vercel dies during a retry,
    // the next cron invocation knows exactly which giftcode/FID to resume.
    const saved = await writeState(state, sha);
    sha = saved.sha;
  }

  const processed = [];

  while (Date.now() - startedAt < RUN_BUDGET_MS) {
    const target = currentTarget(groups, state.pending);

    if (!target) {
      throw new Error(
        `Invalid listener cursor: groupIndex=${state.pending?.groupIndex} ` +
        `fidIndex=${state.pending?.fidIndex}`
      );
    }

    const { group, fid } = target;
    const { giftcode, date } = state.pending;

    const result = await redeemOne({
      fid,
      server: group.server,
      giftcode
    });

    console.log(
      `[REDEEM] ${giftcode} | ${group.name} | server=${group.server} | ` +
      `fid=${fid} | status=${result.status} | http=${result.httpStatus ?? "ERR"}`
    );

    if (!result.terminal) {
      // Do not advance the cursor. Retry the SAME FID until it becomes
      // SUCCESS or RECEIVED. If the current invocation is near its limit,
      // persist the cursor and let the next cron invocation continue.
      const remaining = RUN_BUDGET_MS - (Date.now() - startedAt);
      const delay = Math.min(result.retryAfterMs || 2000, Math.max(0, remaining));

      if (delay > 0) {
        await sleep(delay);
      }

      continue;
    }

    processed.push({
      giftcode,
      date,
      account: group.name,
      server: group.server,
      fid,
      status: result.status,
      httpStatus: result.httpStatus
    });

    const codeCompleted = advancePending(state, groups);

    // Persist after EVERY terminal FID so a later invocation resumes from
    // the next FID, and only update the watermark when the whole code is done.
    const saved = await writeState(state, sha);
    sha = saved.sha;

    if (codeCompleted) {
      console.log(`[CODE] completed ${giftcode}; watermark=${state.lastValidatedGiftcodeDatetime}`);

      // Immediately pick up the next validated code if time remains.
      if (Date.now() - startedAt >= RUN_BUDGET_MS) {
        break;
      }

      const nextCode = findNextCode(codes, state.lastValidatedGiftcodeDatetime);
      if (!nextCode) {
        break;
      }

      state.pending = {
        giftcode: nextCode.giftcode,
        date: nextCode.date.toISOString(),
        groupIndex: 0,
        fidIndex: 0
      };

      const pendingSaved = await writeState(state, sha);
      sha = pendingSaved.sha;
    }
  }

  return {
    ok: true,
    status: state.pending ? "RETRYING" : "IDLE",
    processed,
    pending: state.pending,
    state: state.lastValidatedGiftcodeDatetime
  };
}
