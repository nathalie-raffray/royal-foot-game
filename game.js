import { handlePauseMenuAudioState, startMusic, stopMusic } from "./audio.js";
import * as config from "./config.js";
import * as TimeoutOverlay from "./TimeoutOverlay.js";

const { publicToken, mainSceneUUID } = config;

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
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
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
              lastLeftToe = toe;
              if (lastLeftToe === 0) {
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
              lastLeftToe = toe;
              if (lastLeftToe === 4) {
                gameState.currentRequest.leftFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
        }
        if (foot === "right" || foot === "both") {
          if (direction === "left") {
            if (
              (lastRightToe === null && toe === 9) ||
              (lastRightToe !== null && toe >= 5 && toe === lastRightToe - 1)
            ) {
              lastRightToe = toe;
              if (lastRightToe === 5) {
                gameState.currentRequest.rightFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
          if (direction === "right") {
            if (
              (lastRightToe === null && toe === 5) ||
              (lastRightToe !== null && toe >= 5 && toe === lastRightToe + 1)
            ) {
              lastRightToe = toe;
              if (lastRightToe === 9) {
                gameState.currentRequest.rightFootSucceeded = true;
              }
              leftOrRightOk = true;
            }
          }
        }

        if (!leftOrRightOk) {
          lastLeftToe = null;
          lastRightToe = null;
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
  gameState.currentRequest = {
    type: "stroke-request",
    durationAllowed: 3000,
    timeRequested: performance.now(),
    direction: Math.random() < 0.5 ? "left" : "right",
    foot:
      gameState.level === 4 ? "both" : Math.random() < 0.5 ? "left" : "right",
    lastLeftToe: null,
    lastRightToe: null,
    leftFootSucceeded: false,
    rightFootSucceeded: false,
  };
  console.log(
    "stroke-request",
    gameState.currentRequest.direction,
    gameState.currentRequest.foot
  );
};

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
    durationAllowed: 3000,
    timeRequested: performance.now(),
    amountTickled: 0,
    tickleAmountNeeded: 500 * gameState.level,
    direction: Math.random() < 0.5 ? "horizontal" : "vertical",
    toes: new Set(toes),
    succeeded: false,
  };
  console.log(
    "toe-request",
    [...gameState.currentRequest.toes],
    gameState.currentRequest.direction
  );
};

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

      issueToeRequest();

      function gameLoop() {
        // re-compute positions of toes
        for (const toe of leftToes.concat(rightToes)) {
          const { position } = toe.getGlobalTransform();
          const canvasPosition = getViewport().project(position);
          toePositions.set(toe, canvasPosition);
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
            gameState.currentRequest = null;
            gameState.totalActionsSucceeded++;
            gameState.totalActionsTaken++;
            gameState.currentlyPressedKeys = new Set();
            console.log("Action success!");
            if (
              gameState.totalActionsTaken === gameState.totalActionsForLevel
            ) {
              if (gameState.level < 4) {
                gameState.level++;
                gameState.areStrokeRequestsEnabled = true;
                gameState.totalActionsSucceeded = 0;
                gameState.totalActionsTaken = 0;
                gameState.totalActionsForLevel = gameState.level * 10;
                gameState.minSuccessForLevel =
                  gameState.totalActionsForLevel / 2;
                console.log("Nice! Next level!");
              } else {
                console.log("End game!");
                // TODO: implement end game
              }
            }
          } else if (
            performance.now() - gameState.currentRequest.timeRequested >
            gameState.currentRequest.durationAllowed
          ) {
            // FAIL
            gameState.currentRequest = null;
            console.log("Action failed!");
            if (
              gameState.totalActionsTaken - gameState.totalActionsSucceeded >
              gameState.totalActionsForLevel - gameState.minSuccessForLevel
            ) {
              console.log("Gamer over!");
              // TODO: implement game failed
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

  return (
    <>
      {[...toePositions.values()].map(([x, y], i) => (
        <div
          key={i}
          style={{ top: `${y}px`, left: `${x}px` }}
          hidden={!shouldRenderToeKey(i)}
        >
          {toesToUiEvents[i].replace("Key", "")}
        </div>
      ))}
    </>
  );
}

const domRoot = ReactDOM.createRoot(document.getElementById("overlay"));
domRoot.render(<Game />);

TimeoutOverlay.initUI();
window.TimeoutOverlay = TimeoutOverlay;
