import Team from "./team";

export type EventData = {
  eventId: number;
  eventName: string;
  prizePool: string;
  lan: boolean;
  prizeDistribution: Array<{
    placement: number;
    teamId: number;
    prize: number;
    shared: boolean;
  }>;
};

export type Player = {
  playerId: number;
  nick: string;
  country: string;
  countryIso: string;
  steamIds: Array<{
    steamId: string;
    count: number;
  }>;
};

export type Match = {
  matchStartTime: number;
  informationContent: number | undefined;
  umid: number | undefined;
  valveRanked: boolean | undefined;
  team1: Team | undefined;
  team2: Team | undefined;
  winnerDeltaRankValue: number | undefined;
  loserDeltaRankValue: number | undefined;
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  eventId: number;
  team1Players: Array<Player>;
  team2Players: Array<Player>;
  maps: Array<{
    mapName: string;
    team1Score: number;
    team2Score: number;
  }>;
  winningTeam: number;
};

export type MatchDataJSON = {
  events: EventData[];
  matches: Match[];
};

export type Bounty = {
  id: number;
  context: number;
  base: number;
  val: number;
};

export type Network = {
  id: number;
  context: number;
  base: number;
  val: number;
};

export type Modifiers = {
  bountyCollected: number;
  bountyOffered: number;
  opponentNetwork: number;
  ownNetwork: number;
  lanFactor: number;
};

export type LanWin = {
  id: number;
  context: number;
  base: number;
  val: number;
};

export type Winning = {
  id: number;
  eventTime: number;
  age: number;
  base: number;
  val: number;
};
