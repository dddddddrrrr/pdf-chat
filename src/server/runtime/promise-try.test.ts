import { afterEach, describe, expect, test } from "vitest";

import { installPromiseTry } from "./promise-try";

type PromiseTry = <T, TArgs extends unknown[]>(
  callback: (...args: TArgs) => T | PromiseLike<T>,
  ...args: TArgs
) => Promise<T>;

const promiseWithTry = Promise as unknown as { try?: PromiseTry };
const originalPromiseTry = promiseWithTry.try;

function getPromiseTry(): PromiseTry | undefined {
  return promiseWithTry.try;
}

afterEach(() => {
  promiseWithTry.try = originalPromiseTry;
});

describe("installPromiseTry", () => {
  test("installs Promise.try when the runtime does not provide it", async () => {
    delete promiseWithTry.try;

    installPromiseTry();
    const installedPromiseTry = getPromiseTry();
    if (!installedPromiseTry) throw new Error("Promise.try was not installed");

    await expect(installedPromiseTry((value: string) => value, "ok")).resolves.toBe(
      "ok",
    );
  });

  test("converts synchronous throws into rejected promises", async () => {
    delete promiseWithTry.try;
    installPromiseTry();
    const installedPromiseTry = getPromiseTry();
    if (!installedPromiseTry) throw new Error("Promise.try was not installed");

    await expect(
      installedPromiseTry(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
