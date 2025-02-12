import fs from "fs";
import Region from "./util/region";
import Team from "./team";
import remapValueClamped from "./util/remap_value_clamped";
import RankingContext from "./ranking_context";
import { EventData, Match, MatchDataJSON, Player } from "./types";

const __highValueEvents = [6372, 6711, 6712, 6713, 6714, 6586, 6588]; //explicitly include RMR events, Majors

function parsePrizePool(prizePool: string) {
  if (prizePool === undefined) return 0;

  prizePool = prizePool.replaceAll(",", "").replace("$", "");
  if (/^[0-9]+$/.test(prizePool)) return Number(prizePool);

  return 0;
}

function sortMatches(matches: Match[], order = "desc") {
  if (order === "asc")
    matches.sort((a, b) => a.matchStartTime - b.matchStartTime);
  else matches.sort((a, b) => b.matchStartTime - a.matchStartTime);
}

function filterIncompleteMatches(matches: Match[]) {
  return matches.filter(
    (match) =>
      match.team1Players.length === 5 && match.team2Players.length === 5,
  );
}

function filterMatchesByTime(
  matches: any[],
  startTime: number,
  endTime: number,
) {
  return matches.filter(
    (match) =>
      (endTime < 0 || match.matchStartTime <= endTime) &&
      (startTime < 0 || match.matchStartTime >= startTime),
  );
}

function filterShowmatches(matches: Match[], events: Event[]) {
  return matches.filter((match) => {
    let eventName = events[match.eventId].name;

    if (eventName.toLowerCase().includes("showmatch")) return false;

    return true;
  });
}

function filterUnrankedMatches(matches: Match[]) {
  return matches.filter((match) => {
    if (match.matchStartTime < 1735689600) return true;

    if (match.valveRanked === undefined) return false;

    return match.valveRanked;
  });
}

export class EventTeam {
  placement: number;
  prize: number;
  shared: boolean;

  constructor(prizeJson: {
    placement: number;
    prize: number;
    shared: boolean;
  }) {
    this.placement = prizeJson.placement;
    this.prize = prizeJson.prize;
    this.shared = prizeJson.shared;
  }
}

export class Event {
  eventId: number;
  name: string;
  prizePool: number;
  prizeDistributionByTeamId: any;
  lan: boolean;
  lastMatchTime: number;

  constructor(eventJson: EventData) {
    this.eventId = eventJson.eventId;
    this.name = eventJson.eventName;
    this.prizePool = parsePrizePool(eventJson.prizePool);
    this.prizeDistributionByTeamId = {};
    this.lan = eventJson.lan;
    this.lastMatchTime = -1;

    eventJson.prizeDistribution.forEach((teamJson) => {
      this.prizeDistributionByTeamId[teamJson.teamId] = new EventTeam(teamJson);
    });
  }

  accumulateMatch(match: Match) {
    this.lastMatchTime = Math.max(this.lastMatchTime, match.matchStartTime);
  }
}

function initTeams(
  matches: Match[],
  events: Event[],
  rankingContext: RankingContext,
) {
  let teams: Team[] = [];

  function insertTeam(name: string, players: Player[]) {
    let team = teams.find((team) => team.sharesRoster(players));
    if (team !== undefined) return team;

    let rosterId = teams.length;
    team = new Team(rosterId, name, players);
    teams.push(team);
    return team;
  }

  matches.forEach((match, idx) => {
    match.umid = idx;

    match.team1 = insertTeam(match.team1Name, match.team1Players);
    match.team2 = insertTeam(match.team2Name, match.team2Players);

    match.team1.accumulateMatch(match);
    match.team2.accumulateMatch(match);

    // If we have event data for this match, give the teams a shot at it.
    // This is the only point where the teamId for the team matches the data
    // for that event.
    if (match.eventId !== undefined) {
      match.team1.recordEventParticipation(
        events[match.eventId],
        match.team1Id,
      );
      match.team2.recordEventParticipation(
        events[match.eventId],
        match.team2Id,
      );
    }
  });

  // Calculate seeding data for each team based on professional performance
  // (quantity/quality of professional teams defeated and prizes won)
  Team.initializeSeedingModifiers(teams, rankingContext);

  return teams;
}

function calculateMatchInformationContent(
  match: Match,
  rankingContext: RankingContext,
) {
  let informationContent = 1.0;
  informationContent *= rankingContext.getTimestampModifier(
    match.matchStartTime,
  );

  return informationContent;
}

function findTimeWindow(matches: any[], filterEnd: number, dataWindow: number) {
  let endTime = filterEnd;
  if (endTime < 0)
    endTime = Math.max(...matches.map((match) => match.matchStartTime));

  let startTime = endTime - dataWindow;

  return [startTime, endTime];
}

class DataLoader {
  matches: Match[];
  events: Record<number, Event>;
  teams: Team[];
  filterEndTime: number;
  filterWindow: number;
  rankingContext: RankingContext;

  constructor(rankingContext: RankingContext) {
    this.matches = [];
    this.events = {};
    this.teams = [];
    this.filterEndTime = -1;
    this.filterWindow = 6 * 30 * 24 * 3600;
    this.rankingContext = rankingContext;
  }

  setTimeFilter(endTime = -1, dataWindow = 6 * 30 * 24 * 3600) {
    this.filterEndTime = endTime;
    this.filterWindow = dataWindow;
    return this;
  }

  clearTimeFilter() {
    this.filterEndTime = -1;
    this.filterWindow = -1;
    return this;
  }

  getContext() {
    // TODO: is this wrong?
    // return this.context;
    return this.rankingContext;
  }

  // How much extra weight do we put on RMR/major events
  setHveMod(value: number) {
    this.rankingContext.setHveMod(value);
  }

  // When looking at data about a team's performance, how many outliers do we ignore?
  // e.g. the team with the most prize winnings is not treated differently than the team
  // with the nth most prize winnings.
  setNthHighest(nth: number) {
    this.rankingContext.setOutlierCount(nth);
  }

  loadData(versionTimestamp = -1, filename = "../data/matchdata.json") {
    const data = fs.readFileSync(filename);
    const dataJson: MatchDataJSON = JSON.parse(data.toString());

    // initialize match list
    let matches = dataJson.matches;

    // Filter matches to only the data we are interested in.
    this.setTimeFilter(versionTimestamp);
    matches = filterIncompleteMatches(matches);

    // Remove unranked events
    matches = filterUnrankedMatches(matches);

    const [startTime, endTime] = findTimeWindow(
      matches,
      this.filterEndTime,
      this.filterWindow,
    );
    let graceperiod = 30 * 24 * 3600; // 1 month
    this.rankingContext.setTimeWindow(startTime, endTime - graceperiod);
    matches = filterMatchesByTime(matches, startTime, endTime);

    // initialize event list
    let events: any = {};
    dataJson.events.forEach(
      (eventJson: EventData) =>
        (events[eventJson.eventId] = new Event(eventJson)),
    );

    // Let each event know what matches were part of it
    matches.forEach((match: Match) => {
      let event = events[match.eventId];
      if (event !== undefined) event.accumulateMatch(match);
    });

    // Remove showmatches
    matches = filterShowmatches(matches, events);

    // Estimate the information content of each match (for example, recent matches may be considered
    // to have more accurate data about the current skill of players than old ones)
    matches.forEach((match) => {
      match.informationContent = calculateMatchInformationContent(
        match,
        this.rankingContext,
      );
    });

    // Now that we have events ready, we can initialize teams.  We are going to translate from the
    // input data `teamId` to a more granular `rosterId` that is based on the players that play in
    // the teams (similarly to Major qualification rules).  Rosters that share enough players with
    // a more recent match are considered the "same" team for the purposes of ranking.

    // When initializing the teams, sort matches by reverse start time so we always see the
    // most recent match for a particular roster as the 'base' roster for that team.
    sortMatches(matches, "desc");

    let teams = initTeams(matches, events, this.rankingContext);

    // For processing the games and calculating ratings, we will go in forward order in time.  This
    // also has the effect of making sure that recent data is considered the most strongly, and also
    // with as much context as possible given past results.
    sortMatches(matches, "asc");

    this.matches = matches;
    this.teams = teams;
    this.events = events;
  }
}

export default DataLoader;
