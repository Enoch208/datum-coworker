import { mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { hasErrorCode, readIfExists, writePrivateFile } from "../files";
import { parseShape } from "../parse";
import { lifecycleStateSchema, type LifecycleState } from "./state";

export interface Journal {
  load(taskId: string): Promise<LifecycleState | null>;
  save(state: LifecycleState): Promise<void>;
  saveResult(taskId: string, text: string): Promise<void>;
  loadResult(taskId: string): Promise<string | null>;
  lock(taskId: string): Promise<() => Promise<void>>;
}

const taskIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export function createFileJournal(directory: string): Journal {
  const fileFor = (taskId: string, suffix: string) => {
    if (!taskIdPattern.test(taskId)) {
      throw new RangeError("Task ID is not safe to use as a journal file name");
    }
    return join(directory, `${taskId}${suffix}`);
  };

  async function claimLock(path: string): Promise<boolean> {
    try {
      const handle = await open(path, "wx", 0o600);
      await handle.writeFile(String(process.pid), "utf8");
      await handle.close();
      return true;
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) {
        return false;
      }
      throw error;
    }
  }

  return {
    async load(taskId) {
      const raw = await readIfExists(fileFor(taskId, ".json"));
      if (raw === null) {
        return null;
      }
      return parseShape(`Journal for Task ${taskId}`, lifecycleStateSchema, JSON.parse(raw));
    },
    save: (state) =>
      writePrivateFile(directory, fileFor(state.taskId, ".json"), JSON.stringify(state, null, 2)),
    saveResult: (taskId, text) => writePrivateFile(directory, fileFor(taskId, ".result.txt"), text),
    loadResult: (taskId) => readIfExists(fileFor(taskId, ".result.txt")),
    async lock(taskId) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const path = fileFor(taskId, ".lock");
      if (!(await claimLock(path))) {
        const holder = Number(await readIfExists(path));
        if (Number.isInteger(holder) && holder > 0 && isAlive(holder)) {
          throw new Error(`Task ${taskId} is already being worked by process ${String(holder)}`);
        }
        await unlink(path);
        if (!(await claimLock(path))) {
          throw new Error(`Task ${taskId} lock was taken by another process`);
        }
      }
      return () => unlink(path);
    },
  };
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ESRCH")) {
      return false;
    }
    if (hasErrorCode(error, "EPERM")) {
      return true;
    }
    throw error;
  }
}
