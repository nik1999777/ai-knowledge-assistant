export async function measureTime<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const start = performance.now();

  const result = await fn();

  const end = performance.now();

  return {
    result,
    ms: Number((end - start).toFixed(2)),
  };
}
