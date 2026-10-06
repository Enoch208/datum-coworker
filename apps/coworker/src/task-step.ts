import type { CoworkerTaskRow } from "@datum/db";
import { advance } from "@datum/masumi";
import { campaignStep, type Progress } from "./campaign-step";
import type { Coworker } from "./context";
import { awaitAnswer, readTaskBrief } from "./intake";
import { intakeDeps, paymentJournal } from "./lifecycle";

async function intakeStep(coworker: Coworker, hire: CoworkerTaskRow): Promise<Progress> {
  const state = await paymentJournal(coworker, hire.sokosumiTaskId);
  if (state.step === "new") {
    const next = await advance(state, intakeDeps(coworker));
    return next.step === state.step ? "WAITING" : "MOVED";
  }
  if (state.step !== "started") {
    throw new Error(
      `Task ${hire.sokosumiTaskId} is still reading its brief but its payment journal is at ${state.step}`,
    );
  }
  await readTaskBrief(coworker, hire);
  return "MOVED";
}

export async function stepTask(
  coworker: Coworker,
  hire: CoworkerTaskRow,
  readyIds: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<Progress> {
  switch (hire.stage) {
    case "INTAKE":
      return intakeStep(coworker, hire);
    case "NEEDS_INPUT":
      await awaitAnswer(coworker, hire, readyIds);
      return "WAITING";
    case "CAMPAIGN":
      return campaignStep(coworker, hire, signal);
    case "PAID":
    case "ENDED":
    case "STOPPED":
      return "WAITING";
  }
}
