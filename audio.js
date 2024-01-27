// replace with url for music
export const SFX = "sfx";
const ARRAY_BUFFER_PROMISES = {};
for (const src of [SFX]) {
    ARRAY_BUFFER_PROMISES[src] = fetch(src).then(data => data.arrayBuffer());
}
const MUSIC_BEATS_PER_MINUTE = 120;
const MUSIC_BEATS_PER_SECOND = MUSIC_BEATS_PER_MINUTE / 60;
const MUSIC_BEAT_LENGTH = 1 / MUSIC_BEATS_PER_SECOND;
const MUSIC_MEASURE_LENGTH = MUSIC_BEAT_LENGTH * 4;
const LOOP_POINTS = {
    [SFX]: {
        loopStart: 16,
        loopEnd: 48,
    },
};
class AudioManager {
    constructor() {
        this.audioCtx = new AudioContext();
        this.bufferPromises = {};
        this.musicStartTime = 0;
        this.currentThemeBufferSourceNode = null;
        for (const [src, p] of Object.entries(ARRAY_BUFFER_PROMISES)) {
            this.bufferPromises[src] = p.then(arrayBuffer => this.audioCtx.decodeAudioData(arrayBuffer.slice()));
        }
        this.globalGainNode = this.audioCtx.createGain();
        this.globalGainNode.gain.value = 1;
        this.globalGainNode.connect(this.audioCtx.destination);
        this.filterNode = this.audioCtx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
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
        this.musicGainNode.gain.linearRampToValueAtTime(gain, this.audioCtx.currentTime + 1);
    }
    setGainForSfx(gain) {
        this.sfxGainNode.gain.linearRampToValueAtTime(gain, this.audioCtx.currentTime + 1);
    }
    setGainForGlobalAudio(gain) {
        this.globalGainNode.gain.linearRampToValueAtTime(gain, this.audioCtx.currentTime + 1);
    }
    getTargetMeasureTimeForNextSection() {
        const timeInMusic = this.audioCtx.currentTime - this.musicStartTime;
        const measureStartTime = timeInMusic - (timeInMusic % MUSIC_MEASURE_LENGTH);
        const hasPassedBeat3 = timeInMusic > measureStartTime + MUSIC_MEASURE_LENGTH - MUSIC_BEAT_LENGTH * 2;
        return this.musicStartTime + measureStartTime + MUSIC_MEASURE_LENGTH * (hasPassedBeat3 ? 2 : 1);
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
    async queueSoundEffect(src, time = this.audioCtx.currentTime, destination = this.sfxDestination) {
        const buffer = await this.getBufferForSrc(src);
        const bufferSourceNode = this.audioCtx.createBufferSource();
        bufferSourceNode.buffer = buffer;
        bufferSourceNode.connect(destination);
        bufferSourceNode.start(time);
    }
    async queueSceneTransitionSoundEffect(src, nextMeasureTime = this.getTargetMeasureTimeForNextSection()) {
        return this.queueSoundEffect(src, nextMeasureTime - MUSIC_BEAT_LENGTH * 2, this.musicDestination);
    }
    async queueTheme(src, offset = 0) {
        const buffer = await this.getBufferForSrc(src);
        const bufferSourceNode = this.audioCtx.createBufferSource();
        bufferSourceNode.buffer = buffer;
        bufferSourceNode.loop = true;
        bufferSourceNode.loopStart = LOOP_POINTS[src].loopStart;
        bufferSourceNode.loopEnd = LOOP_POINTS[src].loopEnd;
        bufferSourceNode.connect(this.musicDestination);
        let timeToStartMusic;
        if (this.currentThemeBufferSourceNode) {
            timeToStartMusic = this.getTargetMeasureTimeForNextSection();
            bufferSourceNode.start(timeToStartMusic, offset);
            this.currentThemeBufferSourceNode.stop(timeToStartMusic);
        }
        else {
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
    if (!audioManager)
        return;
    if (paused) {
        audioManager.setGainForGlobalAudio(0.02);
    }
    else {
        audioManager.setGainForGlobalAudio(1);
    }
}
// music start is also responsible for creating the audio manager
// if it doesn't exist yet. we do this because it responds on click
// so it will have the needed permissions to set up the audio context.
export async function startMusic() {
    audioManager = audioManager || new AudioManager();
    await audioManager.queueTheme(SFX);
}

export function stopMusic() {
    if (audioManager)
        audioManager.stopTheme();
}
export async function playSoundEffect(src) {
    if (!audioManager)
        return;
    return audioManager.queueSoundEffect(src);
}
