import {
  Bounty,
  LanWin,
  Match,
  Modifiers,
  Network,
  Player,
  Winning,
} from "../types";
import nthHighest from "./util/nth_highest";
import Region from "./util/region";
import { Event } from "./data_loader";
import { GlickoTeam } from "./glicko";
import RankingContext from "./ranking_context";
const TEAM_OVERLAP_TO_SHARE_ROSTER = 3;

class TeamEvent {
  event: Event;
  teamId: number;
  winnings: number;

  constructor(event: Event, teamId: number) {
    this.event = event;
    this.teamId = teamId;

    let prizeEntry = event.prizeDistributionByTeamId[teamId];
    this.winnings = prizeEntry === undefined ? 0 : prizeEntry.prize;
  }

  getTeamWinnings() {
    return this.winnings;
  }
}

class TeamMatch {
  match: Match;
  team: Team;
  teamNumber: number;
  isWinner: boolean;
  opponent: Team;

  constructor(team: Team, match: Match) {
    if (match.team1 !== team && match.team2 !== team) {
      throw new Error("adding a match to a team that didn't participate in it");
    }

    this.match = match;
    this.team = team;
    this.teamNumber = match.team1 === team ? 1 : 2;
    this.isWinner = match.winningTeam === this.teamNumber;
    this.opponent = this.teamNumber === 1 ? match.team2 : match.team1;
  }
}

function getPluralityRegion(players: Player[]) {
  let teamCountries = players.map((el) => el.countryIso);
  let regionAssignment = [0, 0, 0]; //EU, AMER, ROW

  teamCountries.forEach((el) => {
    regionAssignment[Region.getCountryRegion(el)] += 1;
  });

  let maxRegionalRepresentation = Math.max(...regionAssignment);
  let region = regionAssignment.map((el, _) => {
    return el === maxRegionalRepresentation ? 1 : 0;
  });

  return region;
}

class Team {
  static TeamMatch = TeamMatch;
  static TeamEvent = TeamEvent;

  rosterId: number;
  name: string;
  players: Player[];
  teamMatches: TeamMatch[];
  wonMatches: TeamMatch[];
  matchesPlayed: number;
  eventMap: Map<number, TeamEvent>;
  lastPlayed: number;
  modifiers: Modifiers;
  region: number[];
  regionalRank: number[];
  distinctTeamsDefeated: number;
  scaledWinnings: number;
  lanWins: LanWin[];
  scaledLanWins: number;
  winnings: Winning[];
  bountyOffered: number;
  ownNetwork: number;
  lanParticipation: number;
  bounties: Bounty[];
  opponentBounties: number;
  network: Network[];
  opponentNetwork: number;
  rankValue: number;
  glickoTeam: GlickoTeam;
  seedValue: number;
  rankValueSeed: number;
  startingRankValue: number;
  globalRank: number;

  constructor(rosterId: number, name: string, players: Player[]) {
    this.rosterId = rosterId;
    this.name = name;
    this.players = players;
    this.teamMatches = [];
    this.wonMatches = [];
    this.matchesPlayed = 0;
    this.eventMap = new Map();
    this.lastPlayed = 0;
    this.modifiers = {
      bountyCollected: 0,
      bountyOffered: 0,
      opponentNetwork: 0,
      ownNetwork: 0,
      lanFactor: 0,
    };
    this.region = getPluralityRegion(this.players);
    this.regionalRank = [-1, -1, -1];
    this.distinctTeamsDefeated = 0;
    this.scaledWinnings = 0;
    this.lanWins = [];
    this.scaledLanWins = 0;
    this.winnings = [];
    this.bountyOffered = 0;
    this.ownNetwork = 0;
    this.lanParticipation = 0;
    this.bounties = [];
    this.opponentBounties = 0;
    this.network = [];
    this.opponentNetwork = 0;
    this.rankValue = 0;
    this.glickoTeam = new GlickoTeam(0, 0);
    this.seedValue = 0;
    this.rankValueSeed = 0;
    this.startingRankValue = 0;
    this.globalRank = 0;
  }

  // A past team is considered as the same entity as a more recent one,
  // if it shares enough players.
  sharesRoster(players: Player[]) {
    const overlap = players.filter((pNew) =>
      this.players.some((pExisting) => pNew.playerId === pExisting.playerId),
    ).length;

    return overlap >= TEAM_OVERLAP_TO_SHARE_ROSTER;
  }

  // We only link the team ids from the source data to our teams in the context
  // of an event, because the same team might replace its players and thus would
  // not be considered the same roster -- we don't want to credit the new roster
  // with the old teams winnings, and we do want to credit some players with their
  // past winnings after they have changed teams.
  recordEventParticipation(event: Event, teamId: number) {
    if (event === undefined) return;

    if (this.eventMap.has(event.eventId)) return;

    this.eventMap.set(event.eventId, new TeamEvent(event, teamId));
  }

  accumulateMatch(match: Match) {
    const teamMatch = new TeamMatch(this, match);

    this.teamMatches.push(teamMatch);
    if (teamMatch.isWinner) {
      this.wonMatches.push(teamMatch);
    }
  }

  static initializeSeedingModifiers(teams: Team[], context: RankingContext) {
    function curveFunction(x: number) {
      return Math.pow(1 / (1 + Math.abs(Math.log10(x))), 1);
    }

    function powerFunction(x: number) {
      return Math.pow(x, 1);
    }

    function getPrizePool(x: TeamMatch) {
      return Math.max(1, x.team.eventMap.get(x.match.eventId)!.event.prizePool);
    }

    function getLAN(x: TeamMatch) {
      return x.team.eventMap.get(x.match.eventId)!.event.lan ? 1 : 0;
    }

    let bucketSize = 10; // used for all factors that track your top N results

    // no work to do
    if (teams.length === 0) return;

    // Phase 1: Do calculations we can do directly from this team's data -- we don't rely on
    // any other team info to figure this data out.
    teams.forEach((team) => {
      team.matchesPlayed = team.teamMatches.length;
      team.lastPlayed = Math.max(
        ...team.teamMatches.map((teamMatch) => teamMatch.match.matchStartTime),
      );
      team.distinctTeamsDefeated = 0;
      team.scaledWinnings = 0;

      let winnings: Winning[] = [];
      let opponentMap = new Map();
      let lanWins: LanWin[] = [];

      // Calculate the most recent match against each opponent, and also the most recent LAN wins.
      team.wonMatches.forEach((wonMatch) => {
        // Network
        let opp = wonMatch.opponent;
        let matchTime = wonMatch.match.matchStartTime;
        let prevBestMatchTime = opponentMap.get(opp);
        if (prevBestMatchTime === undefined || prevBestMatchTime < matchTime) {
          opponentMap.set(opp, matchTime);
        }

        // LAN
        let id = wonMatch.match.umid;
        let timestampModifier = context.getTimestampModifier(matchTime);
        let lan = getLAN(wonMatch);
        let matchContext = timestampModifier;
        let scaledLan = lan * matchContext;
        lanWins.push({
          id: id!,
          context: matchContext,
          base: lan,
          val: scaledLan,
        });
      });

      // A team's own 'network' is the sum of distinct opponents they defeated, scaled by how long it's been since they defeated them.
      opponentMap.forEach((lastWinTime, _) => {
        team.distinctTeamsDefeated += context.getTimestampModifier(lastWinTime);
      });

      // The 'LAN' factor is similar to 'network,' the total number of wins on LAN (up to 'bucketSize'), scaled by how long ago the event took place.
      lanWins.sort((a, b) => b.val - a.val);
      team.lanWins = lanWins.slice(0, bucketSize);
      team.scaledLanWins =
        team.lanWins.map((el) => el.val).reduce((a, b) => a + b, 0) /
        bucketSize; //a team's scaled LAN participation is the proportion of matches that were of maximum LAN context (maximum prizepool, LAN, occurred recently)

      // Also calculate top N winnings. Like 'network' and 'LAN,' Winnings are scaled by the age of the result.
      team.eventMap.forEach((teamEvent) => {
        let id = teamEvent.event.eventId;
        let timestampModifier = context.getTimestampModifier(
          teamEvent.event.lastMatchTime,
        );
        let baseWinnings = teamEvent.getTeamWinnings();
        let scaledWinnings = baseWinnings * timestampModifier;

        if (baseWinnings > 0)
          winnings.push({
            id: id,
            eventTime: teamEvent.event.lastMatchTime,
            age: timestampModifier,
            base: baseWinnings,
            val: scaledWinnings,
          });
      });
      winnings.sort((a, b) => b.val - a.val);
      team.winnings = winnings.slice(0, bucketSize);
      team.scaledWinnings = team.winnings
        .map((el) => el.val)
        .reduce((a, b) => a + b, 0);
    });

    // Phase 2 relies on the data from *all* teams in phase 1 being calculated.
    // we want to know relative data -- such as whether this team's winnings are representative
    // of the top teams in the world, or if a team has beaten a typical number of opponents.
    let referenceWinnings = nthHighest(
      teams.map((t) => t.scaledWinnings),
      context.getOutlierCount(),
    );
    let referenceOpponentCount = nthHighest(
      teams.map((t) => t.distinctTeamsDefeated),
      context.getOutlierCount(),
    );
    let referenceLanWins = nthHighest(
      teams.map((t) => t.scaledLanWins),
      context.getOutlierCount(),
    );

    teams.forEach((team) => {
      team.bountyOffered = Math.min(team.scaledWinnings / referenceWinnings, 1);
      team.ownNetwork = Math.min(
        team.distinctTeamsDefeated / referenceOpponentCount,
        1,
      );
      team.lanParticipation = Math.min(
        team.scaledLanWins / referenceLanWins,
        1,
      );
    });

    // Phase 3 looks at each team's opponents and rates each team highly if it can regularly win against other prestigous teams.

    teams.forEach((team) => {
      // Bounties (and your opponents' networks) are 'buckets' that fill up as you win matches.
      // Bounties/Networks are scaled by the stakes (i.e., prize pool) of the event where they occur and the age of the result
      // We only consider the top N best outcomes, post-scaling. So there's never any harm in playing in a low-stakes match.
      let bounties: Array<Bounty> = [];
      let network: Array<Network> = [];

      team.wonMatches.forEach((teamMatch) => {
        let id = teamMatch.match.umid!;
        let timestampModifier = context.getTimestampModifier(
          teamMatch.match.matchStartTime,
        );
        let prizepool = getPrizePool(teamMatch);
        let stakesModifier = curveFunction(Math.min(prizepool / 1000000, 1)); //prizepool of the event is curved the same as a bounty, and is limited to $1,000,000.
        let matchContext = timestampModifier * stakesModifier;

        let scaledBounty = teamMatch.opponent!.bountyOffered * matchContext;
        let scaledNetwork = teamMatch.opponent!.ownNetwork * matchContext;

        bounties.push({
          id: id,
          context: stakesModifier,
          base: teamMatch.opponent!.bountyOffered,
          val: scaledBounty,
        });
        network.push({
          id: id,
          context: stakesModifier,
          base: teamMatch.opponent!.ownNetwork,
          val: scaledNetwork,
        });
      });

      bounties.sort((a, b) => b.val - a.val);
      team.bounties = bounties.slice(0, bucketSize);
      team.opponentBounties =
        team.bounties.map((el) => el.val).reduce((a, b) => a + b, 0) /
        bucketSize;

      network.sort((a, b) => b.val - a.val);
      team.network = network.slice(0, bucketSize);
      team.opponentNetwork =
        team.network.map((el) => el.val).reduce((a, b) => a + b, 0) /
        bucketSize;
    });

    // Finally, build modifiers from calculated values

    teams.forEach((team) => {
      team.modifiers.bountyCollected = curveFunction(team.opponentBounties);
      team.modifiers.bountyOffered = curveFunction(team.bountyOffered);
      team.modifiers.opponentNetwork = powerFunction(team.opponentNetwork);
      team.modifiers.ownNetwork = powerFunction(team.ownNetwork);
      team.modifiers.lanFactor = powerFunction(team.lanParticipation);
    });
  }
}

export default Team;
