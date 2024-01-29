// replace with url for music
export const GREGORIAN_LOOP = "audio/gregorian_chant_loop.mp3";
export const TICKLE = "audio/tickle.mp3";
export const SCRATCH_LOOP = "audio/scratch_loop.wav";
export const TOE_0 = "audio/stroke-sfx/toe_0.wav";
export const TOE_1 = "audio/stroke-sfx/toe_1.wav";
export const TOE_2 = "audio/stroke-sfx/toe_2.wav";
export const TOE_3 = "audio/stroke-sfx/toe_3.wav";
export const TOE_4 = "audio/stroke-sfx/toe_4.wav";
export const TOE_5 = "audio/stroke-sfx/toe_5.wav";
export const TOE_6 = "audio/stroke-sfx/toe_6.wav";
export const TOE_7 = "audio/stroke-sfx/toe_7.wav";
export const TOE_8 = "audio/stroke-sfx/toe_8.wav";
export const TOE_9 = "audio/stroke-sfx/toe_9.wav";
export const CLEARING_THROAT_1 = "audio/bad/clearing-throat-1.wav";
export const CLEARING_THROAT_2 = "audio/bad/clearing-throat-2.wav";
export const EUHM = "audio/bad/euhm.wav";
export const GRR = "audio/bad/grr.wav";
export const HA_BUT_NOT = "audio/bad/ha-but-not.wav";
export const IVE_HAD_MEN_BEHEADED =
  "audio/bad/ive-had-men-beheaded-for-less.wav";
export const NO_ONES_LAUGHIN = "audio/bad/no-ones-laughin.wav";
export const OW = "audio/bad/ow.wav";
export const THATS_NOT_FUNNY_BOY = "audio/bad/thats-not-funny-boy.wav";
export const FANTASTIC = "audio/good/fantastic.wav";
export const HA = "audio/good/ha!.wav";
export const MARVELOUS = "audio/good/marvelous.wav";
export const MISC_LAUGH = "audio/good/misc-laugh.wav";
export const MISC_LAUGH_2 = "audio/good/misc-laugh-2.wav";
export const STUPENDOUS = "audio/good/stupendous.wav";
const ARRAY_BUFFER_PROMISES = {};
for (const src of [
  GREGORIAN_LOOP,
  TICKLE,
  SCRATCH_LOOP,
  TOE_0,
  TOE_1,
  TOE_2,
  TOE_3,
  TOE_4,
  TOE_5,
  TOE_6,
  TOE_7,
  TOE_8,
  TOE_9,
  CLEARING_THROAT_1,
  CLEARING_THROAT_2,
  EUHM,
  GRR,
  HA_BUT_NOT,
  IVE_HAD_MEN_BEHEADED,
  NO_ONES_LAUGHIN,
  OW,
  THATS_NOT_FUNNY_BOY,
  FANTASTIC,
  HA,
  MARVELOUS,
  MISC_LAUGH,
  MISC_LAUGH_2,
  STUPENDOUS,
]) {
  ARRAY_BUFFER_PROMISES[src] = fetch(src).then((data) => data.arrayBuffer());
}
const MUSIC_BEATS_PER_MINUTE = 120;
const MUSIC_BEATS_PER_SECOND = MUSIC_BEATS_PER_MINUTE / 60;
const MUSIC_BEAT_LENGTH = 1 / MUSIC_BEATS_PER_SECOND;
const MUSIC_MEASURE_LENGTH = MUSIC_BEAT_LENGTH * 4;
class AudioManager {
  constructor() {
    this.audioCtx = new AudioContext();
    this.bufferPromises = {};
    this.musicStartTime = 0;
    this.currentThemeBufferSourceNode = null;
    for (const [src, p] of Object.entries(ARRAY_BUFFER_PROMISES)) {
      this.bufferPromises[src] = p.then((arrayBuffer) =>
        this.audioCtx.decodeAudioData(arrayBuffer.slice())
      );
    }
    this.globalGainNode = this.audioCtx.createGain();
    this.globalGainNode.gain.value = 1;
    this.globalGainNode.connect(this.audioCtx.destination);
    this.filterNode = this.audioCtx.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.Q.value = 3;
    this.filterNode.frequency.value = 20000;
    this.musicGainNode = this.audioCtx.createGain();
    this.musicGainNode.gain.value = 1;
    this.filterNode.connect(this.musicGainNode);
    this.musicGainNode.connect(this.globalGainNode);
    this.musicDestination = this.filterNode;
    this.sfxGainNode = this.audioCtx.createGain();
    this.sfxGainNode.gain.value = 1;
    this.sfxGainNode.connect(this.globalGainNode);
    this.sfxDestination = this.sfxGainNode;
  }
  setFilterCutoffForMusic(frequency, time) {
    this.filterNode.frequency.linearRampToValueAtTime(frequency, time);
  }
  setGainForMusic(gain) {
    this.musicGainNode.gain.linearRampToValueAtTime(
      gain,
      this.audioCtx.currentTime + 1
    );
  }
  setGainForSfx(gain) {
    this.sfxGainNode.gain.linearRampToValueAtTime(
      gain,
      this.audioCtx.currentTime + 1
    );
  }
  setGainForGlobalAudio(gain) {
    this.globalGainNode.gain.linearRampToValueAtTime(
      gain,
      this.audioCtx.currentTime + 1
    );
  }
  getTargetMeasureTimeForNextSection() {
    const timeInMusic = this.audioCtx.currentTime - this.musicStartTime;
    const measureStartTime = timeInMusic - (timeInMusic % MUSIC_MEASURE_LENGTH);
    const hasPassedBeat3 =
      timeInMusic >
      measureStartTime + MUSIC_MEASURE_LENGTH - MUSIC_BEAT_LENGTH * 2;
    return (
      this.musicStartTime +
      measureStartTime +
      MUSIC_MEASURE_LENGTH * (hasPassedBeat3 ? 2 : 1)
    );
  }
  async getBufferForSrc(src) {
    if (!(src in this.bufferPromises)) {
      throw new Error(`Unknown src: ${src}`);
    }
    const buffer = await this.bufferPromises[src];
    if (!buffer) {
      throw new Error(`Unexpected undefined buffer for src: ${src}`);
    }
    return buffer;
  }
  async queueSoundEffect(
    src,
    time = this.audioCtx.currentTime,
    destination = this.sfxDestination
  ) {
    const buffer = await this.getBufferForSrc(src);
    const bufferSourceNode = this.audioCtx.createBufferSource();
    bufferSourceNode.buffer = buffer;
    bufferSourceNode.connect(destination);
    bufferSourceNode.start(time);
  }
  async queueSoundEffectLoop(
    src,
    time = this.audioCtx.currentTime,
    destination = this.sfxDestination
  ) {
    const buffer = await this.getBufferForSrc(src);
    const bufferSourceNode = this.audioCtx.createBufferSource();
    bufferSourceNode.buffer = buffer;
    bufferSourceNode.loop = true;
    bufferSourceNode.connect(destination);
    bufferSourceNode.start(time);
    return () => bufferSourceNode.stop();
  }
  async queueSceneTransitionSoundEffect(
    src,
    nextMeasureTime = this.getTargetMeasureTimeForNextSection()
  ) {
    return this.queueSoundEffect(
      src,
      nextMeasureTime - MUSIC_BEAT_LENGTH * 2,
      this.musicDestination
    );
  }
  async queueTheme(src, offset = 0) {
    const buffer = await this.getBufferForSrc(src);
    const bufferSourceNode = this.audioCtx.createBufferSource();
    bufferSourceNode.buffer = buffer;
    bufferSourceNode.loop = true;
    bufferSourceNode.connect(this.musicDestination);
    let timeToStartMusic;
    if (this.currentThemeBufferSourceNode) {
      timeToStartMusic = this.getTargetMeasureTimeForNextSection();
      bufferSourceNode.start(timeToStartMusic, offset);
      this.currentThemeBufferSourceNode.stop(timeToStartMusic);
    } else {
      timeToStartMusic = this.audioCtx.currentTime;
      bufferSourceNode.start(timeToStartMusic, offset);
      this.musicStartTime = timeToStartMusic;
    }
    this.currentThemeBufferSourceNode = bufferSourceNode;
    return timeToStartMusic;
  }
  stopTheme() {
    if (this.currentThemeBufferSourceNode) {
      this.currentThemeBufferSourceNode.stop();
      this.currentThemeBufferSourceNode.disconnect();
      this.currentThemeBufferSourceNode = null;
    }
  }
  destroy() {
    this.stopTheme();
    this.audioCtx.close();
  }
}
let audioManager;
export function handlePauseMenuAudioState(paused) {
  if (!audioManager) return;
  if (paused) {
    audioManager.setGainForGlobalAudio(0.02);
  } else {
    audioManager.setGainForGlobalAudio(1);
  }
}
// music start is also responsible for creating the audio manager
// if it doesn't exist yet. we do this because it responds on click
// so it will have the needed permissions to set up the audio context.
export async function startMusic() {
  audioManager = audioManager || new AudioManager();
  await audioManager.queueTheme(GREGORIAN_LOOP);
}

export function stopMusic() {
  if (audioManager) audioManager.stopTheme();
}
export async function playSoundEffect(src, loop = false) {
  if (!audioManager) return;
  if (loop) return audioManager.queueSoundEffectLoop(src);
  return audioManager.queueSoundEffect(src);
}
