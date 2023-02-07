$(function() {
consoleInit(main)
});

async function main() {
    window.loadTracker = LoadHelper.initLoadTracker();
    await loadBasisFork(Basis.Basis);
    await window.loadTracker.completeLoad();
  }
