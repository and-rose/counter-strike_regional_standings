// @filename: fit.js
import Fit from "./fit.js";

function run() {
  const analysis = Fit.init();

  // Evaluation loop
  let currentTimestamp = analysis.dataset().mostRecentMatch();

  while (currentTimestamp > analysis.dataset().earliestMatch()) {
    currentTimestamp -= analysis.glickoParams().sampleWindow;
    analysis.dataset().updateRanking(currentTimestamp);
    analysis.dataset().setSampleMatches(currentTimestamp);
    analysis.evaluate();
  }

  Fit.outputEWRBins(analysis);
}

run();
