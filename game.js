import {
  handlePauseMenuAudioState,
  startMusic,
  stopMusic,
  playSoundEffect,
} from "./audio.js";
import * as config from "./config.js";
import * as TimeoutOverlay from "./TimeoutOverlay.js";

const { publicToken, mainSceneUUID, animationSequences } = config;

/** @type {{ id: string; playbackSpeed: number; linker: object }[]} */
let lastAnimationSequences = [];

function stopFootAnimationSequences() {
  for (const { id, linker } of lastAnimationSequences) {
    SDK3DVerse.engineAPI.stopAnimationSequence(id, linker);
  }
}

/** @param {typeof lastAnimationSequences} sequences */
function playFootAnimationSequences(sequences) {
  stopFootAnimationSequences();
  for (const { id, playbackSpeed, linker } of sequences) {
    SDK3DVerse.engineAPI.playAnimationSequence(id, { playbackSpeed }, linker);
  }
  lastAnimationSequences = sequences;
}

const getViewport = () => {
  const viewport = SDK3DVerse.engineAPI.cameraAPI.getActiveViewports()[0];
  if (!viewport) {
    console.info("No viewport found");
  }
  return viewport;
};

const canvasContainerRef = {
  current: document.querySelector(".canvas-container"),
};

const canvasRef = {
  current: canvasContainerRef.current.querySelector("canvas"),
};

const toesToUiEvents = [
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyB",
  "KeyV",
  "KeyC",
  "KeyX",
  "KeyZ",
];

/** @type {Record<string, number>} */
const uiEventsToToes = {};
toesToUiEvents.forEach((uiEvent, i) => {
  uiEventsToToes[uiEvent] = i;
});

/**
 * @typedef {{
 *   level: 1 | 2 | 3;
 *   currentRequest: {
 *     type: 'toe-request';
 *     direction: 'vertical' | 'horizontal';
 *     toes: Set<number>;
 *     timeRequested: number;
 *     durationAllowed: number;
 *     tickleAmountNeeded: number;
 *     amountTickled: number;
 *     succeeded: boolean;
 *     endOfActionHandled: boolean;
 *   } | {
 *     type: 'stroke-request';
 *     foot: 'left' | 'right' | 'both';
 *     direction: 'left' | 'right';
 *     timeRequested: number;
 *     durationAllowed: number;
 *     lastLeftToe: number | null;
 *     lastRightToe: number | null;
 *     leftFootSucceeded: boolean;
 *     rightFootSucceeded: boolean;
 *     endOfActionHandled: boolean;
 *   } | null;
 *   areStrokeRequestsEnabled: boolean;
 *   currentlyPressedKeys: Set<string>;
 *   totalActionsForLevel: number;
 *   minSuccessForLevel: number;
 *   totalActionsSucceeded: number;
 *   totalActionsTaken: number;
 * }} GameState
 */

/** @type {GameState} */
const gameState = {
  level: 1,
  currentRequest: null,
  areStrokeRequestsEnabled: false,
  currentlyPressedKeys: new Set(),
  totalActionsForLevel: 10,
  minSuccessForLevel: 5,
  totalActionsSucceeded: 0,
  totalActionsTaken: 0,
};

document.addEventListener(
  "keydown",
  (e) => {
    if (!gameState.currentRequest) return;
    if (gameState.currentRequest.succeeded) return;
    if (
      performance.now() - gameState.currentRequest.timeRequested >
      gameState.currentRequest.durationAllowed
    ) {
      return;
    }
    if (gameState.currentRequest.type === "toe-request") {
      gameState.currentlyPressedKeys.add(e.code);
    }
    if (gameState.currentRequest.type === "stroke-request") {
      /** @type {number | undefined} */
      const toe = uiEventsToToes[e.code];
      if (typeof toe === "number") {
        const { direction, foot, lastLeftToe, lastRightToe } =
          gameState.currentRequest;
        let leftOrRightOk = false;
        if (foot === "left" || foot === "both") {
          if (direction === "left") {
            if (
              (lastLeftToe === null && toe === 4) ||
              (lastLeftToe !== null && toe < 5 && toe === lastLeftToe - 1)
            ) {
              gameState.currentRequest.lastLeftToe = toe;
              if (gameState.currentRequest.lastLeftToe === 0) {
                gameState.currentRequest.leftFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
          if (direction === "right") {
            if (
              (lastLeftToe === null && toe === 0) ||
              (lastLeftToe !== null && toe < 5 && toe === lastLeftToe + 1)
            ) {
              gameState.currentRequest.lastLeftToe = toe;
              if (gameState.currentRequest.lastLeftToe === 4) {
                gameState.currentRequest.leftFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
        }
        if (foot === "right" || foot === "both") {
          // we implement the left-direction logic for the left foot,
          // for the right direction on the right foot (and vice versa,
          // because the right foot is mirrored)
          if (direction === "right") {
            if (
              (lastRightToe === null && toe === 9) ||
              (lastRightToe !== null && toe >= 5 && toe === lastRightToe - 1)
            ) {
              gameState.currentRequest.lastRightToe = toe;
              if (gameState.currentRequest.lastRightToe === 5) {
                gameState.currentRequest.rightFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
          if (direction === "left") {
            if (
              (lastRightToe === null && toe === 5) ||
              (lastRightToe !== null && toe >= 5 && toe === lastRightToe + 1)
            ) {
              gameState.currentRequest.lastRightToe = toe;
              if (gameState.currentRequest.lastRightToe === 9) {
                gameState.currentRequest.rightFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
        }

        if (!leftOrRightOk) {
          gameState.currentRequest.lastLeftToe = null;
          gameState.currentRequest.lastRightToe = null;
        }
      }
    }
  },
  false
);

document.addEventListener(
  "keyup",
  (e) => {
    gameState.currentlyPressedKeys.delete(e.code);
  },
  false
);

let mouseClicked = false;
document.addEventListener(
  "mousedown",
  () => {
    mouseClicked = true;
  },
  false
);
document.addEventListener(
  "mouseup",
  () => {
    mouseClicked = false;
  },
  false
);

document.addEventListener(
  "mousemove",
  (e) => {
    if (!mouseClicked) return;
    if (!gameState.currentRequest) return;
    if (gameState.currentRequest.succeeded) return;
    if (
      performance.now() - gameState.currentRequest.timeRequested >
      gameState.currentRequest.durationAllowed
    ) {
      return;
    }
    if (gameState.currentRequest.type === "toe-request") {
      // make sure all of and only the requested keys are pressed
      for (const toe of gameState.currentRequest.toes) {
        if (!gameState.currentlyPressedKeys.has(toesToUiEvents[toe])) {
          return;
        }
      }
      for (const toeKey of gameState.currentlyPressedKeys) {
        if (!gameState.currentRequest.toes.has(uiEventsToToes[toeKey])) {
          return;
        }
      }
      // TODO: use measured delta instead because this is unreliable
      // https://github.com/w3c/pointerlock/issues/42
      const { movementX, movementY } = e;
      const absX = Math.abs(movementX);
      const absY = Math.abs(movementY);
      if (gameState.currentRequest.direction === "horizontal") {
        gameState.currentRequest.amountTickled += absX;
      }
      if (gameState.currentRequest.direction === "vertical") {
        gameState.currentRequest.amountTickled += absY;
      }
      if (
        gameState.currentRequest.amountTickled >=
        gameState.currentRequest.tickleAmountNeeded
      ) {
        gameState.currentRequest.succeeded = true;
      }
    }
  },
  false
);

let leftFoot;
let rightFoot;
const leftToes = [];
const rightToes = [];

const toePositions = new Map();

const issueStrokeRequest = () => {
  const foot =
    gameState.level === 4 ? "both" : Math.random() < 0.5 ? "left" : "right";
  const direction = Math.random() < 0.5 ? "left" : "right";
  gameState.currentRequest = {
    type: "stroke-request",
    durationAllowed: 5000,
    timeRequested: performance.now(),
    direction,
    foot,
    lastLeftToe: null,
    lastRightToe: null,
    leftFootSucceeded: false,
    rightFootSucceeded: false,
    endOfActionHandled: false,
  };
  if (foot === "left" || foot === "right") {
    playFootAnimationSequences([
      {
        ...((foot === "left" && direction === "right") ||
        (foot === "right" && direction === "left")
          ? animationSequences.footWobbleRight
          : animationSequences.footWobbleLeft),
        linker: foot === "left" ? leftFoot : rightFoot,
      },
    ]);
  } else {
    playFootAnimationSequences([
      {
        ...(direction === "right"
          ? animationSequences.footWobbleRight
          : animationSequences.footWobbleLeft),
        linker: leftFoot,
      },
      {
        ...(direction === "left"
          ? animationSequences.footWobbleRight
          : animationSequences.footWobbleLeft),
        linker: rightFoot,
      },
    ]);
  }
};

function playToesWaitingAnimation(toes) {
  playFootAnimationSequences(
    toes.map((toe) => ({
      ...animationSequences.toeWobble,
      linker: toe < 5 ? leftToes[toe] : rightToes[toe - 5],
    }))
  );
}

const issueToeRequest = () => {
  const toeCount = Math.floor(Math.random() * gameState.level) + 1;
  const toes = Array(toeCount).fill(null);
  for (let i = 0; i < toes.length; i++) {
    let toe;
    do {
      toe = Math.floor(Math.random() * 10);
    } while (toes.includes(toe));
    toes[i] = toe;
  }
  gameState.currentRequest = {
    type: "toe-request",
    durationAllowed: 5000,
    timeRequested: performance.now(),
    amountTickled: 0,
    tickleAmountNeeded: 2000 + 1000 * gameState.level,
    direction: Math.random() < 0.5 ? "horizontal" : "vertical",
    toes: new Set(toes),
    succeeded: false,
    endOfActionHandled: false,
  };
  playToesWaitingAnimation(toes);
};

let init = false;

const ANIMATION_STATES = {
  NotStarted: 0,
  TiptoeOutOfVoid: 1,
  PlayTickleSoundEffect: 2,
  MoveToKing: 3,
  LungeToFeet: 4,
};

let startStateChrono;
let currentAnimationState = ANIMATION_STATES.NotStarted;
function crawlToKingAndReachToTickle(tickler) {
  if (currentAnimationState === ANIMATION_STATES.NotStarted) {
    currentAnimationState = ANIMATION_STATES.TiptoeOutOfVoid;
    startStateChrono = performance.now();

    const tiptoeAnimationSequenceUUID = "af11b239-44e1-426b-a219-080c56033a82";
    SDK3DVerse.engineAPI.playAnimationSequence(tiptoeAnimationSequenceUUID);

    const animationController = tickler.getComponent("animation_controller");
    animationController.dataJSON = {
      Start: true,
      Surprise: false,
      LungeToTickle: false,
    };
    tickler.setComponent("animation_controller", animationController);
    return;
  }

  if (currentAnimationState === ANIMATION_STATES.TiptoeOutOfVoid) {
    const elapsedTimeInS = (performance.now() - startStateChrono) / 1000;
    if (elapsedTimeInS >= 4.5) {
      currentAnimationState = ANIMATION_STATES.PlayTickleSoundEffect;
      startStateChrono = performance.now();

      const animationController = tickler.getComponent("animation_controller");
      animationController.dataJSON = {
        Start: false,
        Surprise: true,
        LungeToTickle: false,
      };
      tickler.setComponent("animation_controller", animationController);
    }
    return;
  }

  if (currentAnimationState === ANIMATION_STATES.PlayTickleSoundEffect) {
    const elapsedTimeInS = (performance.now() - startStateChrono) / 1000;
    if (elapsedTimeInS >= 1.25) {
      currentAnimationState = ANIMATION_STATES.MoveToKing;
      playSoundEffect("audio/tickle.mp3");
    }
    return;
  }

  if (currentAnimationState === ANIMATION_STATES.MoveToKing) {
    const elapsedTimeInS = (performance.now() - startStateChrono) / 1000;
    if (elapsedTimeInS >= 4) {
      currentAnimationState = ANIMATION_STATES.LungeToFeet;
      startStateChrono = performance.now();
      const ticklerLinker = tickler.getParent();
      ticklerLinker.setGlobalTransform({
        position: [13.44, 0, 41.4],
        eulerOrientation: [0, 90, 0],
      });

      const animationController = tickler.getComponent("animation_controller");
      animationController.dataJSON = {
        Start: false,
        Surprise: false,
        LungeToTickle: true,
      };
      tickler.setComponent("animation_controller", animationController);

      // probably useless, paranoia
      SDK3DVerse.engineAPI.propagateChanges();
    }
    return;
  }

  if (currentAnimationState === ANIMATION_STATES.LungeToFeet) {
    const elapsedTimeInS = (performance.now() - startStateChrono) / 1000;
    if (elapsedTimeInS >= 1) {
      init = true;
    }
  }
}

function Game() {
  /**
   * @typedef {'waiting-to-start' | 'active' | 'paused'} GameActiveState
   */
  /**
   * @type {[GameActiveState, React.SetStateAction<GameActiveState>]}
   */
  const [gameActiveState, setGameActiveState] = React.useState("active");

  const [currentRequest, setCurrentRequest] = React.useState(
    /** @type {GameState['currentRequest']} */ (null)
  );

  const [postActionText, setPostActionText] = React.useState(null);
  const [postLevelText, setPostLevelText] = React.useState(null);
  const [failText, setFailText] = React.useState(null);

  React.useEffect(() => {
    SDK3DVerse.startSession({
      userToken: publicToken,
      sceneUUID: mainSceneUUID,
      canvas: document.getElementById("display-canvas"),
      isTransient: true,
      viewportProperties: {
        defaultControllerType: SDK3DVerse.controller_type.orbit,
      },
    }).then(async () => {
      SDK3DVerse.disableInputs();

      leftFoot = (
        await SDK3DVerse.engineAPI.findEntitiesByEUID(config.leftFootEntityUUID)
      )[0];
      rightFoot = (
        await SDK3DVerse.engineAPI.findEntitiesByEUID(
          config.rightFootEntityUUID
        )
      )[0];
      const toePairs = await Promise.all([
        SDK3DVerse.engineAPI.findEntitiesByEUID(config.toe1EntityUUID),
        SDK3DVerse.engineAPI.findEntitiesByEUID(config.toe2EntityUUID),
        SDK3DVerse.engineAPI.findEntitiesByEUID(config.toe3EntityUUID),
        SDK3DVerse.engineAPI.findEntitiesByEUID(config.toe4EntityUUID),
        SDK3DVerse.engineAPI.findEntitiesByEUID(config.toe5EntityUUID),
      ]);
      toePairs.forEach((pair, i) => {
        const [toeA, toeB] = pair;
        let toeAParent = toeA;
        do {
          toeAParent = toeAParent.getParent();
        } while (toeAParent !== leftFoot && toeAParent !== rightFoot);
        if (toeAParent === leftFoot) {
          leftToes[i] = toeA;
          rightToes[i] = toeB;
        } else {
          leftToes[i] = toeB;
          rightToes[i] = toeA;
        }
      });

      TimeoutOverlay.setup();

      const starRotateUUID = "98c082d9-c649-4833-bbbb-ee85f22161a1";
      const starRotateSettings = { playbackSpeed: 0.25 };
      const [star1] = await SDK3DVerse.engineAPI.findEntitiesByEUID(
        "05f37337-1c3e-46a0-9557-937af423651e"
      );
      const [star2] = await SDK3DVerse.engineAPI.findEntitiesByEUID(
        "969aa21f-e853-4087-8c3c-183df83c12f8"
      );
      const [star3] = await SDK3DVerse.engineAPI.findEntitiesByEUID(
        "6976f934-5000-4ff3-89b7-36851a70543e"
      );

      SDK3DVerse.engineAPI.playAnimationSequence(
        starRotateUUID,
        starRotateSettings,
        star1
      );
      SDK3DVerse.engineAPI.playAnimationSequence(
        starRotateUUID,
        starRotateSettings,
        star2
      );
      SDK3DVerse.engineAPI.playAnimationSequence(
        starRotateUUID,
        starRotateSettings,
        star3
      );

      issueToeRequest();

      const [tickler] = await SDK3DVerse.engineAPI.findEntitiesByEUID(
        "9ef73925-8d42-4fed-a41a-c31ae1542012"
      );

      function gameLoop() {
        if (!init) {
          crawlToKingAndReachToTickle(tickler);
          requestAnimationFrame(gameLoop);
          return;
        }

        // re-compute positions of toes
        for (const toe of leftToes.concat(rightToes)) {
          const { position } = toe.getGlobalTransform();
          const uiPromptPosition = [...position];
          // we need to move the UI prompt a bit to be above the tip of the toe
          uiPromptPosition[1] += 2.5; // y (vertical)
          uiPromptPosition[2] += 3; // z (king is looking down z axis)
          const canvasPosition = getViewport().project(uiPromptPosition);
          toePositions.set(toe, canvasPosition);
        }

        if (gameState.currentRequest?.endOfActionHandled) {
          requestAnimationFrame(gameLoop);
          return;
        }

        if (gameState.currentRequest) {
          // SUCCESS
          if (
            (gameState.currentRequest.type === "toe-request" &&
              gameState.currentRequest.succeeded) ||
            (gameState.currentRequest.type === "stroke-request" &&
              ((gameState.currentRequest.foot === "left" &&
                gameState.currentRequest.leftFootSucceeded) ||
                (gameState.currentRequest.foot === "right" &&
                  gameState.currentRequest.rightFootSucceeded) ||
                (gameState.currentRequest.foot === "both" &&
                  gameState.currentRequest.leftFootSucceeded &&
                  gameState.currentRequest.rightFootSucceeded)))
          ) {
            if (gameState.currentRequest.type === "stroke-request") {
              const { foot, direction } = gameState.currentRequest;
              if (foot === "left" || foot === "right") {
                playFootAnimationSequences([
                  {
                    ...((foot === "left" && direction === "right") ||
                    (foot === "right" && direction === "left")
                      ? animationSequences.toeWaveRight
                      : animationSequences.toeWaveLeft),
                    linker: foot === "left" ? leftFoot : rightFoot,
                  },
                ]);
              } else {
                playFootAnimationSequences([
                  {
                    ...(direction === "right"
                      ? animationSequences.toeWaveRight
                      : animationSequences.toeWaveLeft),
                    linker: leftFoot,
                  },
                  {
                    ...(direction === "left"
                      ? animationSequences.toeWaveRight
                      : animationSequences.toeWaveLeft),
                    linker: rightFoot,
                  },
                ]);
              }
            }
            if (gameState.currentRequest.type === "toe-request") {
              const { toes } = gameState.currentRequest;
              playFootAnimationSequences(
                [...toes].flatMap((toe) => {
                  const linker = toe < 5 ? leftToes[toe] : rightToes[toe - 5];
                  return [
                    {
                      ...animationSequences.joint2Bounce,
                      linker,
                    },
                    {
                      ...animationSequences.toenailHover,
                      linker,
                    },
                    {
                      ...animationSequences.toenailRotate,
                      linker,
                    },
                  ];
                })
              );
            }
            // TODO: show feedback and don't immediately cue for next request.
            // don't immediately remove request either.
            gameState.totalActionsSucceeded++;
            gameState.totalActionsTaken++;
            gameState.currentlyPressedKeys = new Set();
            gameState.currentRequest.endOfActionHandled = true;
            if (
              gameState.totalActionsTaken === gameState.totalActionsForLevel
            ) {
              if (gameState.level < 4) {
                gameState.level++;
                gameState.areStrokeRequestsEnabled = true;
                gameState.totalActionsSucceeded = 0;
                gameState.totalActionsTaken = 0;
                gameState.totalActionsForLevel = 10;
                gameState.minSuccessForLevel =
                  gameState.totalActionsForLevel / 2;
                setPostLevelText("Nice! New level!");
              } else {
                setPostLevelText("You really make me laugh!");
                // TODO: implement end game
              }
            } else {
              setPostActionText("Hahaha!");
            }
            setTimeout(() => {
              setPostActionText(null);
              setPostLevelText(null);
              setFailText(null);
              gameState.currentRequest = null;
            }, 3000);
          } else if (
            performance.now() - gameState.currentRequest.timeRequested >
            gameState.currentRequest.durationAllowed
          ) {
            // FAIL

            if (gameState.currentRequest.type === "stroke-request") {
              const { foot } = gameState.currentRequest;
              if (foot === "left" || foot === "right") {
                playFootAnimationSequences([
                  {
                    ...animationSequences.footStomp,
                    linker: foot === "left" ? leftFoot : rightFoot,
                  },
                ]);
              } else {
                playFootAnimationSequences([
                  {
                    ...animationSequences.footStomp,
                    linker: leftFoot,
                  },
                  {
                    ...animationSequences.footStomp,
                    linker: rightFoot,
                  },
                ]);
              }
            }
            if (gameState.currentRequest.type === "toe-request") {
              const { toes } = gameState.currentRequest;
              playFootAnimationSequences(
                [...toes].map((toe) => ({
                  ...animationSequences.joint2Wag,
                  linker: toe < 5 ? leftToes[toe] : rightToes[toe - 5],
                }))
              );
            }
            gameState.currentRequest.endOfActionHandled = true;

            if (
              gameState.totalActionsTaken - gameState.totalActionsSucceeded >
              gameState.totalActionsForLevel - gameState.minSuccessForLevel
            ) {
              setFailText("To the gallows you go!");
              // TODO: implement game failed
            } else {
              setFailText("Not so funny!");
              setTimeout(() => {
                setPostActionText(null);
                setPostLevelText(null);
                setFailText(null);
                gameState.currentRequest = null;
              }, 3000);
            }
          }
        } else {
          // NEED TO ISSUE A NEW REQUEST
          if (gameState.areStrokeRequestsEnabled) {
            if (Math.random() < 0.25) {
              issueStrokeRequest();
            } else {
              issueToeRequest();
            }
          } else {
            issueToeRequest();
          }
        }

        // TODO: this might not be the most performant way to render but whatever
        setCurrentRequest({ ...gameState.currentRequest });

        requestAnimationFrame(gameLoop);
      }

      requestAnimationFrame(gameLoop);
    });
    const musicStartOnClick = () => {
      startMusic();
      window.removeEventListener("click", musicStartOnClick);
    };
    const gameActiveOnClick = () => {
      setGameActiveState("active");
    };
    window.addEventListener("click", musicStartOnClick);
    window.addEventListener("click", gameActiveOnClick);
    return () => {
      window.removeEventListener("click", musicStartOnClick);
      window.removeEventListener("click", gameActiveOnClick);
      stopMusic();
    };
  }, []);

  React.useEffect(() => {
    if (gameActiveState === "active") {
      handlePauseMenuAudioState(false);
      let cancelled = false;
      const canvas = canvasRef.current;
      canvas.requestPointerLock =
        canvas.requestPointerLock ||
        canvas.mozRequestPointerLock ||
        canvas.webkitPointerLockElement;
      try {
        const promise = canvas.requestPointerLock();
        if (promise)
          promise.catch(() => {
            cancelled = true;
            setGameActiveState("waiting");
          });
      } catch (err) {
        setGameActiveState("waiting");
        return;
      }
      document.addEventListener(
        "pointerlockchange",
        () => {
          if (cancelled) return;
          try {
            // SDK3DVerse.enableInputs();
          } catch (err) {
            console.error(err);
          }
          document.addEventListener(
            "pointerlockchange",
            () => {
              try {
                SDK3DVerse.disableInputs();
              } catch (err) {
                console.error(err);
              }
              setGameActiveState("paused");
            },
            { once: true }
          );
        },
        { once: true }
      );
    } else {
      handlePauseMenuAudioState(true);
    }
  }, [gameActiveState]);

  const shouldRenderToeKey = (i) => {
    if (!currentRequest) return false;
    if (currentRequest.endOfActionHandled) return false;
    /** @type {GameState['currentRequest']} */
    const request = currentRequest;
    if (request.type === "toe-request") {
      return request.toes.has(i);
    }
    if (request.type === "stroke-request") {
      if (request.foot === "both") return true;
      if (request.foot === "left") return i < 5;
      if (request.foot === "right") return i >= 5;
    }
  };

  const toePositionsList = [...toePositions.values()];

  const actionDescriptionIconPosition = toePositionsList.length
    ? [
        Math.round((toePositionsList[4][0] + toePositionsList[9][0]) / 2),
        Math.round((toePositionsList[4][1] + toePositionsList[9][1]) / 2),
      ]
    : [0, 0];

  const strokeProgress =
    currentRequest?.type !== "stroke-request"
      ? 0
      : currentRequest.foot === "left" && currentRequest.direction === "left"
      ? (5 -
          (typeof currentRequest.lastLeftToe === "number"
            ? currentRequest.lastLeftToe
            : 5)) /
        5
      : currentRequest.foot === "left" && currentRequest.direction === "right"
      ? ((typeof currentRequest.lastLeftToe === "number"
          ? currentRequest.lastLeftToe
          : -1) +
          1) /
        5
      : currentRequest.foot === "right" && currentRequest.direction === "left"
      ? ((typeof currentRequest.lastRightToe === "number"
          ? currentRequest.lastRightToe
          : 4) -
          4) /
        5
      : currentRequest.foot === "right" && currentRequest.direction === "right"
      ? (10 -
          (typeof currentRequest.lastRightToe === "number"
            ? currentRequest.lastRightToe
            : 10)) /
        5
      : currentRequest.foot === "both" && currentRequest.direction === "left"
      ? ((5 -
          (typeof currentRequest.lastLeftToe === "number"
            ? currentRequest.lastLeftToe
            : 5)) /
          5 +
          ((typeof currentRequest.lastRightToe === "number"
            ? currentRequest.lastRightToe
            : 4) -
            4) /
            5) /
        2
      : currentRequest.foot === "both" && currentRequest.direction === "right"
      ? (((typeof currentRequest.lastLeftToe === "number"
          ? currentRequest.lastLeftToe
          : -1) +
          1) /
          5 +
          (10 -
            (typeof currentRequest.lastRightToe === "number"
              ? currentRequest.lastRightToe
              : 10)) /
            5) /
        2
      : 0;

  return (
    <>
      {toePositionsList.map(([x, y], i) => (
        <div
          key={i}
          style={{
            top: `${y}px`,
            left: `${x}px`,
            transform: "translate(-50%, -50%)",
            willChange: "top, left",
            position: "absolute",
            animationName: "hover-vertical",
            animationDuration: "3s",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
          hidden={!shouldRenderToeKey(i)}
        >
          <img src="img/key.svg" width={50} height={50} />
          <span
            style={{
              position: "absolute",
              top: "calc(50% + -1px)",
              left: "calc(50% + 1px)",
              transform: "translate(-50%, -50%)",
              color: "white",
              fontSize: "1.5rem",
            }}
          >
            {toesToUiEvents[i].replace("Key", "")}
          </span>
        </div>
      ))}
      <div
        style={{
          top: `${actionDescriptionIconPosition[1]}px`,
          left: `${actionDescriptionIconPosition[0]}px`,
          transform: "translate(-50%, -50%)",
          position: "absolute",
        }}
      >
        <img
          src="img/mouse-horizontal.svg"
          hidden={
            !currentRequest ||
            !(
              currentRequest.type === "toe-request" &&
              currentRequest.direction === "horizontal"
            )
          }
          style={{
            animationName: "bounce-horizontal",
            animationDuration: "0.7s",
            animationIterationCount: 1,
            animationTimingFunction: "ease",
          }}
        />
        <img
          src="img/mouse-vertical.svg"
          hidden={
            !currentRequest ||
            !(
              currentRequest.type === "toe-request" &&
              currentRequest.direction === "vertical"
            )
          }
          style={{
            animationName: "bounce-vertical",
            animationDuration: "0.7s",
            animationIterationCount: 1,
            animationTimingFunction: "ease",
          }}
        />
        <img
          style={{
            width: 150,
            animationName:
              currentRequest?.direction === "right"
                ? "move-right"
                : "move-left",
            animationDuration: "0.3s",
            animationIterationCount: 1,
            animationTimingFunction: "ease",
            transform: `rotate(${
              currentRequest?.direction === "left" ? 180 : 0
            }deg`,
          }}
          src="img/arrow.svg"
          hidden={!currentRequest || currentRequest.type !== "stroke-request"}
        />
      </div>
      <div
        hidden={!currentRequest}
        style={{
          bottom: `1rem`,
          left: `1rem`,
          position: "absolute",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "9%",
            bottom: "11%",
            left: "22%",
            right: "7%",
            borderRadius: 4,
            background: `linear-gradient(#39F99D, #F9815C)`,
            clipPath: `inset(${
              100 -
              (currentRequest?.type === "toe-request"
                ? (100 * currentRequest?.amountTickled) /
                  currentRequest?.tickleAmountNeeded
                : 100 * strokeProgress)
            }% 0px 0px 0px)`,
          }}
        />
        <img src="img/gauge.svg" style={{ position: "relative" }} width={50} />
      </div>
      <div
        hidden={!failText}
        className="hey-text"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <img src="img/reaction-bad.svg" />
        <span
          style={{
            color: "white",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {failText}
        </span>
      </div>
      <div
        hidden={!postActionText && !postLevelText}
        className="hey-text"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <img src="img/reaction-good.svg" />
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {postLevelText || postActionText}
        </span>
      </div>
    </>
  );
}

const domRoot = ReactDOM.createRoot(document.getElementById("overlay"));
domRoot.render(<Game />);

TimeoutOverlay.initUI();
window.TimeoutOverlay = TimeoutOverlay;
