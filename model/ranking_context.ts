import remapValueClamped from "./util/remap_value_clamped";

class RankingContext {
  topOutlierCount: number;
  timeWindowStart: number | null;
  timeWindowEnd: number | null;
  timeDecayFactor: number;
  highValueEventModifier: number;

  constructor() {
    this.topOutlierCount = 10; // teams with at least as good performance as the 10th best team get the same modifiers
    this.timeWindowStart = null;
    this.timeWindowEnd = null;
    this.timeDecayFactor = 1; // default to linear; <1 gives more weight to matches in the past, >1 gives less.
    this.highValueEventModifier = 1; // extra weight placed on RMR/major events.
  }

  // set window of times for getTimestampModifier
  setTimeWindow(start: number, end: number) {
    this.timeWindowStart = start;
    this.timeWindowEnd = Math.max(start, end);
  }

  getTimestampModifier(timeStamp: number) {
    if (this.timeWindowStart === null || this.timeWindowEnd === null) {
      return 1;
    }

    let clamp = remapValueClamped(
      timeStamp,
      this.timeWindowStart,
      this.timeWindowEnd,
      0,
      1,
    );
    return Math.pow(clamp, this.timeDecayFactor);
  }

  // Currently we use the same value for both prize pool outlier count, and distinct opponent outlier count.
  setOutlierCount(nth: number) {
    this.topOutlierCount = nth;
    return this;
  }
  getOutlierCount() {
    return this.topOutlierCount;
  }

  setHveMod(modifier: number) {
    this.highValueEventModifier = modifier;
    return this;
  }
  getHveMod() {
    return this.highValueEventModifier;
  }
}

export default RankingContext;

