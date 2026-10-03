/** Share pending/successful imports, but never cache a network failure. */
export function createRetryableLoader<T>(
  load: () => Promise<T>,
  timeoutMs = 15000,
) {
  let pending: Promise<T> | undefined;
  return () => {
    if (pending) return pending;
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Loading timed out")),
        timeoutMs,
      );
    });
    pending = Promise.race([Promise.resolve().then(load), timeout])
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      })
      .finally(() => clearTimeout(timer));
    return pending;
  };
}
