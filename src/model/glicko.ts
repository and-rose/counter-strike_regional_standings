// rank delta of 400 points = 90% chance of victory
const Q = Math.log(10) / 400;

// constant for decaying (increasing) RD over time
// This defaults to decaying back to the maximum of 350 RD after 100 time units.
const C = 34.6;

const ONE_OVER_PI_SQUARED = 1 / (Math.PI * Math.PI);

export class GlickoTeam {
  mRank: number;
  mRD: number;
  mAdjRank: number;
  mAdjRDSq: number;

  constructor(rank: number, rd: number) {
    this.mRank = rank;
    this.mRD = rd;
    this.mAdjRank = 0;
    this.mAdjRDSq = 0;
  }

  rank() {
    return this.mRank;
  }

  rd() {
    return this.mRD;
  }

  // Increase RD based on time since last observation for this player
  decayRD(glicko: Glicko, t: number) {
    const rd = this.mRD;
    this.mRD = glicko.clampRD(Math.sqrt(rd * rd + C * C * t));
  }

  // Clear any pending ('incremental') match data
  resetPendingMatches() {
    this.mAdjRank = 0;
    this.mAdjRDSq = 0;
  }

  // Add a match to an event.  To make the adjustments, call
  // applyPendingMatches() after all matches for that event have
  // been submitted.
  //
  // info is a measure of the information content of the match;
  // low information content matches have less of an effect on the
  // adjustments to rd/rank
  addPendingMatch(otherTeam: GlickoTeam, score: number, info: number) {
    const r = this.mRank;
    const ro = otherTeam.mRank;
    const rdo = otherTeam.mRD;

    const g = 1 / Math.sqrt(1 + 3 * Q * Q * rdo * rdo * ONE_OVER_PI_SQUARED);
    const ev = 1 / (1 + Math.pow(10, (g * (r - ro)) / -400));

    this.mAdjRDSq += g * g * ev * (1 - ev) * info * info;
    this.mAdjRank += g * (score - ev) * info;
  }

  // Apply any pending rating adjustments
  applyPendingMatches(glicko: Glicko) {
    const rd = this.mRD;
    const adjustedRDSq = 1 / (1 / (rd * rd) + Q * Q * this.mAdjRDSq);

    this.mRank += Q * adjustedRDSq * this.mAdjRank;
    this.mRD = glicko.clampRD(Math.sqrt(adjustedRDSq));

    this.resetPendingMatches();
  }
}

class Glicko {
  static Team = GlickoTeam;

  mStartingRank: number;
  mStartingRD: number;
  mMaxRD: number;
  mMinRD: number;

  constructor() {
    this.mStartingRank = 1500;
    this.mStartingRD = 350;
    this.mMaxRD = 350;
    this.mMinRD = 35;
  }

  // converts glicko to elo by ignoring rd calculation
  setFixedRD(val: number) {
    this.mStartingRD = val;
    this.mMaxRD = val;
    this.mMinRD = val;
    return this;
  }

  startingRank() {
    return this.mStartingRank;
  }

  startingRD() {
    return this.mStartingRD;
  }

  maxRD() {
    return this.mMaxRD;
  }

  minRD() {
    return this.mMinRD;
  }

  clampRD(rd: number) {
    return Math.max(this.mMinRD, Math.min(this.mMaxRD, rd));
  }

  newTeam(
    rank: number | undefined = undefined,
    rd: number | undefined = undefined,
  ) {
    if (rank === undefined) rank = this.mStartingRank;
    if (rd === undefined) rd = this.mStartingRD;

    return new GlickoTeam(rank, rd);
  }

  // informationContent scales the 'value' of the information in this match;
  // If the information content of the match is low, pass a lower content
  // and the rankings won't be as affected.
  //
  incrementalMatch(
    winningTeam: GlickoTeam,
    losingTeam: GlickoTeam,
    informationContent = 1.0,
  ) {
    winningTeam.addPendingMatch(losingTeam, 1.0, informationContent);
    losingTeam.addPendingMatch(winningTeam, 0.0, informationContent);
  }

  finalizeMatches(teams: GlickoTeam[]) {
    for (const team of teams) {
      team.applyPendingMatches(this);
    }
  }

  // informationContent scales the 'value' of the information in this match;
  // If the information content of the match is low, pass a lower content
  // and the rankings won't be as affected.
  singleMatch(
    winningTeam: GlickoTeam,
    losingTeam: GlickoTeam,
    informationContent = 1.0,
  ) {
    this.incrementalMatch(winningTeam, losingTeam, informationContent);
    this.finalizeMatches([winningTeam, losingTeam]);
  }
}

export default Glicko;
