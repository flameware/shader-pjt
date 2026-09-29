import { BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output } from 'mediabunny';
import { RECORDING_FPS, avcCodec, frameTimestamp, isKeyFrame, videoBitrate, videoSize } from './encoding';

/** Frames waiting in the encoder beyond which rendering waits for it (#42 decision 9). */
const MAX_ENCODE_QUEUE = 4;

/** One Recording's video: WebCodecs H.264 frames muxed into an mp4 in memory by Mediabunny. */
export interface VideoRecorder {
  /** The video's frame size (`videoSize` of the render size it started at). */
  readonly size: readonly [number, number];
  /** Frames encoded so far. */
  frames(): number;
  /**
   * True while the encoder is behind: the caller skips this animation frame altogether (no draw,
   * no clock tick), so frames wait instead of being dropped.
   */
  busy(): boolean;
  /** Encodes what `canvas` shows now as the next video frame (call right after it is drawn). */
  addFrame(canvas: HTMLCanvasElement): void;
  /** Encodes what is still queued and finalizes the mp4. */
  finish(): Promise<Uint8Array>;
  /** Stops without a file. */
  cancel(): void;
}

export type RecorderStart = { ok: true; recorder: VideoRecorder } | { ok: false; reason: string };

/**
 * Starts encoding a video of a canvas whose render size is `renderSize`, or says why this browser
 * can't (#42 decision 10: no `VideoEncoder`, or the H.264 config isn't supported). `onError` is
 * called once if encoding fails later on; the recorder is unusable after that.
 */
export async function startVideoRecorder(renderSize: readonly [number, number], onError: (error: Error) => void): Promise<RecorderStart> {
  if (typeof VideoEncoder === 'undefined') {
    return { ok: false, reason: '이 브라우저는 WebCodecs VideoEncoder가 없어 Recording을 할 수 없습니다' };
  }
  const size = videoSize(renderSize);
  const [width, height] = size;
  const codec = avcCodec(size);
  if (codec === null) return { ok: false, reason: `${width}×${height}는 H.264로 담을 수 없는 크기라 Recording을 할 수 없습니다` };
  const config: VideoEncoderConfig = {
    codec,
    width,
    height,
    bitrate: videoBitrate(size),
    framerate: RECORDING_FPS,
    latencyMode: 'quality',
    avc: { format: 'avc' },
  };
  const unsupported = `이 브라우저는 ${width}×${height} H.264(${codec}) 인코딩을 지원하지 않아 Recording을 할 수 없습니다`;
  try {
    if (!(await VideoEncoder.isConfigSupported(config)).supported) return { ok: false, reason: unsupported };
  } catch {
    return { ok: false, reason: unsupported };
  }

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new EncodedVideoPacketSource('avc');
  output.addVideoTrack(source, { frameRate: RECORDING_FPS });
  await output.start();

  let failed = false;
  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    onError(error instanceof Error ? error : new Error(String(error)));
  };
  // Packets go to the muxer one after another, in the order the encoder emits them.
  let writing = Promise.resolve();
  const encoder = new VideoEncoder({
    output(chunk, meta) {
      writing = writing.then(() => source.add(EncodedPacket.fromEncodedChunk(chunk), meta)).catch(fail);
    },
    error: fail,
  });
  encoder.configure(config);

  let frames = 0;
  const close = () => {
    if (encoder.state !== 'closed') encoder.close();
  };
  return {
    ok: true,
    recorder: {
      size,
      frames: () => frames,
      busy: () => encoder.encodeQueueSize > MAX_ENCODE_QUEUE,
      addFrame(canvas) {
        if (failed) return;
        const frame = new VideoFrame(canvas, {
          timestamp: frameTimestamp(frames),
          duration: frameTimestamp(frames + 1) - frameTimestamp(frames),
          visibleRect: { x: 0, y: 0, width, height },
        });
        try {
          encoder.encode(frame, { keyFrame: isKeyFrame(frames) });
          frames += 1;
        } catch (error) {
          fail(error);
        } finally {
          frame.close();
        }
      },
      async finish() {
        try {
          await encoder.flush();
          close();
          await writing;
          if (failed) throw new Error('인코딩 중 오류가 났습니다');
          await output.finalize();
        } catch (error) {
          close();
          void output.cancel();
          throw error;
        }
        // `finalize` has resolved, so the buffer is there.
        return new Uint8Array(target.buffer!);
      },
      cancel() {
        failed = true;
        close();
        void output.cancel();
      },
    },
  };
}
