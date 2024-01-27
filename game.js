import { handlePauseMenuAudioState, startMusic, stopMusic } from "./audio.js";
import { publicToken, mainSceneUUID } from "./config.js";
import * as TimeoutOverlay from "./TimeoutOverlay.js";

const canvasContainerRef = {
  current: document.querySelector(".canvas-container"),
};

const canvasRef = {
  current: canvasContainerRef.current.querySelector("canvas"),
};

function Game() {
  /**
   * @typedef {'waiting-to-start' | 'active' | 'paused'} GameActiveState
   */
  /**
   * @type {[GameActiveState, React.SetStateAction<GameActiveState>]}
   */
  const [gameActiveState, setGameActiveState] = React.useState("active");
  React.useEffect(() => {
    console.log(document.getElementById("display-canvas"), 'hello')
    SDK3DVerse.startSession({
      userToken: publicToken,
      sceneUUID: mainSceneUUID,
      canvas: document.getElementById("display-canvas"),
      isTransient: true,
      viewportProperties: {
        defaultControllerType: SDK3DVerse.controller_type.orbit,
      },
    }).then(() => {
        TimeoutOverlay.setup();
    })
    const musicStartOnClick = () => {
      startMusic();
      window.removeEventListener("click", musicStartOnClick);
    };
    window.addEventListener("click", musicStartOnClick);
    return () => {
      window.removeEventListener("click", musicStartOnClick);
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
            SDK3DVerse.enableInputs();
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
  return null;
}

const domRoot = ReactDOM.createRoot(
  document.getElementById("overlay")
);
domRoot.render(<Game />);

TimeoutOverlay.initUI();
window.TimeoutOverlay = TimeoutOverlay;
