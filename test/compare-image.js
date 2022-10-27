var looksSame = require("looks-same");

looksSame.createDiff(
  {
    reference: "test/code.png",
    current: "test/code.1.png",
    diff: "test/code.diff.png",
    highlightColor: "#ffffff", // color to highlight the differences
    strict: false, // strict comparsion
    tolerance: 2.5,
    antialiasingTolerance: 0,
    ignoreAntialiasing: true, // ignore antialising by default
    ignoreCaret: true, // ignore caret by default
  },
  function (error) {
    throw error;
  }
);
