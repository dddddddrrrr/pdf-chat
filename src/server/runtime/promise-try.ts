type PromiseWithTry = PromiseConstructor & {
  try?: <T, TArgs extends unknown[]>(
    callback: (...args: TArgs) => T | PromiseLike<T>,
    ...args: TArgs
  ) => Promise<T>;
};

export function installPromiseTry(): void {
  const promise = Promise as PromiseWithTry;
  promise.try ??= function promiseTry<T, TArgs extends unknown[]>(
    callback: (...args: TArgs) => T | PromiseLike<T>,
    ...args: TArgs
  ): Promise<T> {
    return new Promise((resolve) => resolve(callback(...args)));
  };
}

installPromiseTry();
