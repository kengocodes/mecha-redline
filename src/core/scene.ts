// Scene stack + RAF loop. Phaser was only ever used as a scene state
// machine with a handful of delayed calls, so this module covers exactly
// that surface: create/update lifecycle, start/launch/restart transitions,
// shutdown hooks, and per-scene timers that die with the scene.

export abstract class Scene {
  readonly key: string;
  /** True between enter and exit — guards background events (main.ts). */
  active = false;
  /** Scene-switch requests, mirroring the facade game code already used. */
  readonly scene: SceneFacade;

  private shutdownFns: (() => void)[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();

  protected constructor(key: string) {
    this.key = key;
    this.scene = new SceneFacade(this);
  }

  /** Runs on every entry — including restart(). */
  create(): void {}
  /** dms = raw ms since the previous frame; scenes clamp it themselves. */
  update(_t: number, _dms: number): void {}

  /** Cleanup fired once when the scene exits (was Phaser's SHUTDOWN event). */
  protected onShutdown(fn: () => void): void {
    this.shutdownFns.push(fn);
  }

  /** setTimeout scoped to the scene: cancelled on exit, like Phaser's clock. */
  protected after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  /** Manager hook — game code goes through `this.scene` instead. */
  enter(): void {
    this.active = true;
    this.create();
  }

  /** Manager hook — runs shutdown hooks and cancels pending timers. */
  exit(): void {
    this.active = false;
    for (const fn of this.shutdownFns) fn();
    this.shutdownFns = [];
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }
}

/** Per-scene handle for transitions; transitions are queued to frame end. */
class SceneFacade {
  constructor(private readonly self: Scene) {}

  /** Stop this scene, start the target. */
  start(key: string): void {
    enqueue(() => {
      this.self.exit();
      enterScene(key);
    });
  }

  /** Start the target alongside this scene (HUD overlay). */
  launch(key: string): void {
    enqueue(() => enterScene(key));
  }

  /** Stop and re-enter this scene — create() runs again. */
  restart(): void {
    enqueue(() => {
      this.self.exit();
      this.self.enter();
    });
  }

  isActive(): boolean {
    return this.self.active;
  }
}

const scenes = new Map<string, Scene>();
/** Registration order = update order (main scenes before the HUD). */
const order: Scene[] = [];
const pending: (() => void)[] = [];

export function registerScenes(list: Scene[]): void {
  for (const s of list) {
    scenes.set(s.key, s);
    order.push(s);
  }
}

export function getScene<T extends Scene>(key: string): T | undefined {
  return scenes.get(key) as T | undefined;
}

/** Enter the first scene; the loop takes it from there. */
export function bootScene(key: string): void {
  enterScene(key);
}

function enterScene(key: string): void {
  const s = scenes.get(key);
  if (!s) throw new Error(`unknown scene: ${key}`);
  if (!s.active) s.enter();
}

function enqueue(op: () => void): void {
  pending.push(op);
}

export function startLoop(): void {
  let last = performance.now();
  const frame = (now: number): void => {
    const dms = now - last;
    last = now;
    // Scene switches requested mid-frame land before the next update pass.
    while (pending.length > 0) pending.shift()!();
    for (const s of order) {
      if (s.active) s.update(now, dms);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
