var looksSame = require("looks-same");

looksSame.createDiff(
  {
    reference: "test/code.1.png",
    current: "test/code.png",
    diff: "test/code.diff.png",
    highlightColor: "#90ee90", // color to highlight the differences
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
