/** log(k!) for k integer 0..170 */
const LOG_FACT: number[] = (() => {
  const a: number[] = [0];
  for (let i = 1; i <= 170; i++) a.push(a[i - 1]! + Math.log(i));
  return a;
})();

export function logFactorial(k: number): number {
  if (k < 0 || !Number.isInteger(k)) return NaN;
  if (k > 170) return logStirling(k);
  return LOG_FACT[k]!;
}

function logStirling(n: number): number {
  return n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n);
}

/** Poisson PMF P(X = k). */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (!Number.isInteger(k) || k < 0) return 0;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

/** P(X >= k) for integer k >= 0. */
export function poissonTailGe(lambda: number, k: number): number {
  if (k <= 0) return 1;
  let cdf = 0;
  for (let i = 0; i < k; i++) cdf += poissonPmf(lambda, i);
  return Math.max(0, Math.min(1, 1 - cdf));
}

/** P(at least one event) = 1 - exp(-lambda) for Poisson count. */
export function poissonAtLeastOne(lambda: number): number {
  if (lambda <= 0) return 0;
  return 1 - Math.exp(-lambda);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Deterministic xorshift PRNG for reproducible tests. */
export function createSeedRandom(seed: number): { next: () => number } {
  let s = seed >>> 0;
  return {
    next(): number {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 0x100000000;
    },
  };
}

export function samplePoisson(lambda: number, rnd: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda < 10) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= rnd();
    } while (p > L && k < 100);
    return k - 1;
  }
  const z = normalQuantileApprox(rnd);
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
}

export function sampleBernoulli(p: number, rnd: () => number): boolean {
  return rnd() < p;
}

function normalQuantileApprox(rnd: () => number): number {
  const p = clamp(rnd(), 1e-12, 1 - 1e-12);
  const a = [-3.969683028e1, 2.209460984e2, -2.759285104e2, 1.383577818e2, -3.066479806e1, 2.50662827749];
  const b = [-5.447609738e3, 1.615858368e4, -1.556989798e4, 6.68013192e3, -1.328068155e3];
  const c = [-7.784894002e-3, -3.22396405e-1, -2.400758277e0, -2.549732539e0, 4.374664141e0, 2.938163982e0];
  const d = [7.784695709e-3, 3.22467129e-1, 2.445134137e0, 3.754408661e0];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (phigh < p) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}
