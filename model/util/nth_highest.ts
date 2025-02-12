function nthHighest(
  arr: any[],
  nth: number,
  compare = (a: number, b: number) => b - a,
) {
  // 1-based
  if (nth < 1) {
    throw new Error("nth < 1");
  }

  if (arr.length === 0) {
    throw new Error("attempting to get Nth highest from empty list");
  }

  nth = Math.min(nth, arr.length);
  return [...arr].sort(compare)[nth - 1];
}

export default nthHighest;
