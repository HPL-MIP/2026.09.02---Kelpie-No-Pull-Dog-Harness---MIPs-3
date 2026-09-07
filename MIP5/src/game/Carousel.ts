import Phaser from 'phaser';
import { endcardHtml, type AssetKey } from '../assets';
import { Depth } from '../constants';
import { getViewport, sd, sx, sy } from '../utils/responsive';
import { AudioController } from './AudioController';

export const CAROUSEL_LAYOUT = {
  transitionMs: 330,
  idleAutoAdvanceMs: 4000,
  swipeThreshold: 54,
  sceneCount: 6,
  endcardInputDelayMs: 150,
  ctaPulse: { scale: 1.3, duration: 650 },
  logo: { x: 540, y: 152, width: 556, height: 80 },
  // bottomOffset keeps the dogs flush with the physical viewport edge.
  lowerDesign: { x: 540, width: 1080, height: 187, bottomOffset: 0 },
  cta: { x: 545.5, y: 1734.5, width: 551, height: 155 },
  arrow: { leftX: 97.5, rightX: 992.5, y: 964.5, width: 93, height: 93 },
  handHint: {
    x: 992.5,
    y: 964.5,
    width: 178,
    height: 182,
    // The source hand points up-left. Flip it and anchor its visible fingertip
    // (source pixel 10,15) so the pulse stays pinned to the right arrow.
    originX: (178 - 10) / 178,
    originY: 15 / 182,
    fadeMs: 250,
    pulseDownScale: 0.9,
    pulseMs: 220,
    pulseGapMs: 1000,
    idleMs: 5000,
  },
  slide1: {
    text: { x: 539.5, y: 442 },
    main: { x: 540.5, y: 1118 },
  },
  slide2: {
    main: { x: 540.5, y: 770 },
    icons: { x: 539.5, y: 1357.5 },
    iconText: { x: 541, y: 1491.5 },
  },
  slide3: {
    text: { x: 543.5, y: 451 },
    main: { x: 538, y: 977 },
    labelLeft: { x: 311.5, y: 1361 },
    labelRight: { x: 757.5, y: 1359.5 },
    captionLeft: { x: 320, y: 1490 },
    captionRight: { x: 758, y: 1489 },
  },
  slide4: {
    text: { x: 540, y: 451.5 },
    main: { x: 540.5, y: 1118 },
  },
  slide5: {
    headline: { x: 539.5, y: 805.5 },
    subtext: { x: 545, y: 958.5 },
    timer: {
      x: 543.5,
      y: 1144,
      digitXs: [282, 542.5, 803],
      digitsY: 1143,
      fontSize: 59,
      seconds: 10 * 60,
    },
  },
} as const;

const IMAGE_SIZE: Record<AssetKey, readonly [number, number]> = {
  cta: [551, 155],
  design: [1080, 187],
  handHint: [178, 182],
  leftArrow: [93, 93],
  logo: [556, 80],
  rightArrow: [93, 93],
  slide1Main: [759, 844],
  slide1Text: [845, 274],
  slide2IconText: [760, 97],
  slide2Icons: [759, 171],
  slide2Main: [759, 922],
  slide3CaptionLeft: [334, 118],
  slide3CaptionRight: [302, 118],
  slide3LabelLeft: [331, 44],
  slide3LabelRight: [143, 45],
  slide3Main: [850, 612],
  slide3Text: [641, 238],
  slide4Main: [759, 844],
  slide4Text: [714, 287],
  slide5Headline: [641, 113],
  slide5Subtext: [676, 49],
  slide5Timer: [729, 154],
};

type PositionedObject = Phaser.GameObjects.GameObject & {
  setPosition: (x: number, y: number) => unknown;
  setDisplaySize?: (width: number, height: number) => unknown;
  setFontSize?: (size: number) => unknown;
};

class LayoutGroup {
  protected readonly objects: PositionedObject[] = [];
  protected offset = 0;

  constructor(protected readonly scene: Phaser.Scene) {}

  relayout(offset = this.offset): void {
    this.offset = offset;
    for (const object of this.objects) (object as any).layout?.(offset);
  }

  destroy(): void {
    for (const object of this.objects) object.destroy();
  }

  protected addImage(
    key: AssetKey,
    x: number,
    y: number,
    depth: number = Depth.Game,
    onPress?: () => void,
  ): Phaser.GameObjects.Image {
    const [width, height] = IMAGE_SIZE[key];
    const image = this.scene.add.image(0, 0, key).setDepth(depth);
    if (onPress) {
      image.setInteractive({ useHandCursor: true });
      image.on('pointerdown', onPress);
    }
    (image as any).layout = (offset: number) => image
      .setPosition(sx(x) + offset, sy(y))
      .setDisplaySize(sd(width), sd(height));
    this.objects.push(image);
    return image;
  }

  protected addBottomImage(
    key: AssetKey,
    x: number,
    bottomOffset: number,
    depth: number = Depth.Game,
  ): Phaser.GameObjects.Image {
    const [width, height] = IMAGE_SIZE[key];
    const image = this.scene.add.image(0, 0, key).setDepth(depth);
    (image as any).layout = (offset: number) => image
      .setPosition(
        sx(x) + offset,
        getViewport().height - sd(height) / 2 - sd(bottomOffset),
      )
      .setDisplaySize(sd(width), sd(height));
    this.objects.push(image);
    return image;
  }

  protected addText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    depth: number = Depth.Hud,
  ): Phaser.GameObjects.Text {
    const node = this.scene.add.text(0, 0, text, {
      fontFamily: 'Bricolage Grotesque, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: 'normal',
      color: '#000000',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth);
    (node as any).layout = (offset: number) => node
      .setPosition(sx(x) + offset, sy(y))
      .setFontSize(sd(fontSize));
    this.objects.push(node);
    return node;
  }
}

class SharedChrome extends LayoutGroup {
  private readonly pulse: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, audio: AudioController, onCta: () => void) {
    super(scene);
    this.addImage('logo', CAROUSEL_LAYOUT.logo.x, CAROUSEL_LAYOUT.logo.y, Depth.Hud);
    this.addBottomImage(
      'design',
      CAROUSEL_LAYOUT.lowerDesign.x,
      CAROUSEL_LAYOUT.lowerDesign.bottomOffset,
      Depth.Hud,
    );
    const cta = this.addImage(
      'cta',
      CAROUSEL_LAYOUT.cta.x,
      CAROUSEL_LAYOUT.cta.y,
      Depth.Input,
      () => {
        audio.unlock();
        onCta();
      },
    );
    const { scale, duration } = CAROUSEL_LAYOUT.ctaPulse;
    this.pulse = scene.tweens.addCounter({
      from: 1,
      to: scale,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 1;
        cta.setDisplaySize(
          sd(CAROUSEL_LAYOUT.cta.width) * value,
          sd(CAROUSEL_LAYOUT.cta.height) * value,
        );
      },
    });
  }

  override destroy(): void {
    this.pulse.remove();
    super.destroy();
  }
}

class Navigation extends LayoutGroup {
  private index = 0;
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly onMove: (direction: -1 | 1) => void,
    private readonly audio: AudioController,
  ) {
    super(scene);
    this.left = this.addImage(
      'leftArrow',
      CAROUSEL_LAYOUT.arrow.leftX,
      CAROUSEL_LAYOUT.arrow.y,
      Depth.Input,
      () => {
        if (this.index <= 0) return;
        this.audio.unlock();
        this.audio.playClick();
        this.onMove(-1);
      },
    );
    this.right = this.addImage(
      'rightArrow',
      CAROUSEL_LAYOUT.arrow.rightX,
      CAROUSEL_LAYOUT.arrow.y,
      Depth.Input,
      () => {
        if (this.index >= CAROUSEL_LAYOUT.sceneCount - 1) return;
        this.audio.unlock();
        this.audio.playClick();
        this.onMove(1);
      },
    );
  }

  setIndex(index: number): void {
    this.index = index;
    this.left.setVisible(index > 0);
    this.right.setVisible(index < CAROUSEL_LAYOUT.sceneCount - 1);
  }

  canMoveForward(): boolean {
    return this.index < CAROUSEL_LAYOUT.sceneCount - 1;
  }
}

class TutorialHint extends LayoutGroup {
  private readonly hand: Phaser.GameObjects.Image;
  private fade?: Phaser.Tweens.Tween;
  private pulse?: Phaser.Tweens.Tween;
  private loopTimer?: Phaser.Time.TimerEvent;
  private idleTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, private readonly canShow: () => boolean) {
    super(scene);
    const { x, y, originX, originY } = CAROUSEL_LAYOUT.handHint;
    this.hand = this.addImage('handHint', x, y, Depth.Input)
      .setFlipX(true)
      .setOrigin(originX, originY)
      .setVisible(false)
      .setAlpha(0);
  }

  start(): void { this.show(); }

  onInteraction(): void {
    this.hide(true);
    this.idleTimer?.remove();
    this.idleTimer = this.scene.time.delayedCall(
      CAROUSEL_LAYOUT.handHint.idleMs,
      () => this.show(),
    );
  }

  refreshTarget(): void {
    if (!this.canShow()) this.hide(false);
  }

  override relayout(offset = 0): void { super.relayout(offset); }

  override destroy(): void {
    this.clearMotion();
    this.idleTimer?.remove();
    super.destroy();
  }

  private show(): void {
    if (!this.canShow()) return;
    this.clearMotion();
    this.hand.setVisible(true).setAlpha(0);
    this.relayout();
    this.fade = this.scene.tweens.add({
      targets: this.hand,
      alpha: 1,
      duration: CAROUSEL_LAYOUT.handHint.fadeMs,
      ease: 'Sine.Out',
      onComplete: () => this.pulseOnce(),
    });
  }

  private hide(fadeOut: boolean): void {
    this.clearMotion();
    if (!this.hand.visible) return;
    if (!fadeOut) {
      this.hand.setVisible(false).setAlpha(0);
      return;
    }
    this.fade = this.scene.tweens.add({
      targets: this.hand,
      alpha: 0,
      duration: CAROUSEL_LAYOUT.handHint.fadeMs,
      ease: 'Sine.In',
      onComplete: () => this.hand.setVisible(false),
    });
  }

  private pulseOnce(): void {
    if (!this.canShow() || !this.hand.visible) return;
    const {
      width,
      height,
      pulseDownScale,
      pulseMs,
      pulseGapMs,
    } = CAROUSEL_LAYOUT.handHint;
    this.pulse = this.scene.tweens.addCounter({
      from: 1,
      to: pulseDownScale,
      duration: pulseMs,
      yoyo: true,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const scale = tween.getValue() ?? 1;
        this.hand.setDisplaySize(sd(width) * scale, sd(height) * scale);
      },
      onComplete: () => {
        this.loopTimer = this.scene.time.delayedCall(pulseGapMs, () => this.pulseOnce());
      },
    });
  }

  private clearMotion(): void {
    this.fade?.remove();
    this.pulse?.remove();
    this.loopTimer?.remove();
    this.fade = undefined;
    this.pulse = undefined;
    this.loopTimer = undefined;
  }
}

class EndcardOverlay {
  private iframe?: HTMLIFrameElement;
  private shown = false;
  private inputTimer?: number;

  constructor(private readonly onShow: () => void) {}

  prepare(): void {
    if (this.iframe) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Kelpie end card');
    iframe.setAttribute('scrolling', 'no');
    iframe.dataset.presentationActive = 'false';
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:50;opacity:0;pointer-events:none;background:#fee8e6;transition:opacity 100ms linear;';
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.setSipPresentationActive?.(this.shown);
      window.syncMraidMediaState?.();
    }, { once: true });
    const parentBridge = '<script>window.mraid=window.parent.mraid;</script>';
    iframe.srcdoc = endcardHtml.replace('</head>', `${parentBridge}</head>`);
    document.body.appendChild(iframe);
    this.iframe = iframe;
    window.syncMraidMediaState?.();
  }

  show(): void {
    this.prepare();
    if (!this.iframe || this.shown) return;
    this.shown = true;
    this.iframe.dataset.presentationActive = 'true';
    this.iframe.contentWindow?.setSipPresentationActive?.(true);
    window.syncMraidMediaState?.();
    this.iframe.style.opacity = '1';
    this.onShow();
    const iframe = this.iframe;
    this.inputTimer = window.setTimeout(() => {
      if (this.iframe === iframe && this.shown) iframe.style.pointerEvents = 'auto';
    }, CAROUSEL_LAYOUT.endcardInputDelayMs);
  }

  hide(): void {
    if (this.inputTimer !== undefined) window.clearTimeout(this.inputTimer);
    this.inputTimer = undefined;
    if (this.iframe) this.iframe.dataset.presentationActive = 'false';
    this.iframe?.contentWindow?.setSipPresentationActive?.(false);
    this.iframe?.remove();
    this.iframe = undefined;
    this.shown = false;
  }
}

class Slide extends LayoutGroup {
  private readonly timerEvents: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene, readonly index: number) {
    super(scene);
    this.build();
  }

  override destroy(): void {
    for (const event of this.timerEvents) event.remove();
    super.destroy();
  }

  private addLongTimer(): void {
    const timer = CAROUSEL_LAYOUT.slide5.timer;
    this.addImage('slide5Timer', timer.x, timer.y, Depth.Hud);
    const [hoursX, minutesX, secondsX] = timer.digitXs;
    const hours = this.addText('00', hoursX, timer.digitsY, timer.fontSize);
    const minutes = this.addText('10', minutesX, timer.digitsY, timer.fontSize);
    const seconds = this.addText('00', secondsX, timer.digitsY, timer.fontSize);
    let remaining = timer.seconds;
    const render = (): void => {
      const safeRemaining = Math.max(0, remaining);
      hours.setText(String(Math.floor(safeRemaining / 3600)).padStart(2, '0'));
      minutes.setText(String(Math.floor((safeRemaining % 3600) / 60)).padStart(2, '0'));
      seconds.setText(String(safeRemaining % 60).padStart(2, '0'));
    };
    this.timerEvents.push(this.scene.time.addEvent({
      delay: 1000,
      repeat: remaining - 1,
      callback: () => {
        remaining--;
        render();
      },
    }));
  }

  private build(): void {
    if (this.index === 0) {
      const layout = CAROUSEL_LAYOUT.slide1;
      this.addImage('slide1Text', layout.text.x, layout.text.y, Depth.Hud);
      this.addImage('slide1Main', layout.main.x, layout.main.y, Depth.Game);
      return;
    }
    if (this.index === 1) {
      const layout = CAROUSEL_LAYOUT.slide2;
      this.addImage('slide2Main', layout.main.x, layout.main.y, Depth.Game);
      this.addImage('slide2Icons', layout.icons.x, layout.icons.y, Depth.Hud);
      this.addImage('slide2IconText', layout.iconText.x, layout.iconText.y, Depth.Hud);
      return;
    }
    if (this.index === 2) {
      const layout = CAROUSEL_LAYOUT.slide3;
      this.addImage('slide3Text', layout.text.x, layout.text.y, Depth.Hud);
      this.addImage('slide3Main', layout.main.x, layout.main.y, Depth.Game);
      this.addImage('slide3LabelLeft', layout.labelLeft.x, layout.labelLeft.y, Depth.Hud);
      this.addImage('slide3LabelRight', layout.labelRight.x, layout.labelRight.y, Depth.Hud);
      this.addImage('slide3CaptionLeft', layout.captionLeft.x, layout.captionLeft.y, Depth.Hud);
      this.addImage('slide3CaptionRight', layout.captionRight.x, layout.captionRight.y, Depth.Hud);
      return;
    }
    if (this.index === 3) {
      const layout = CAROUSEL_LAYOUT.slide4;
      this.addImage('slide4Text', layout.text.x, layout.text.y, Depth.Hud);
      this.addImage('slide4Main', layout.main.x, layout.main.y, Depth.Game);
      return;
    }
    if (this.index === 4) {
      const layout = CAROUSEL_LAYOUT.slide5;
      this.addImage('slide5Headline', layout.headline.x, layout.headline.y, Depth.Hud);
      this.addImage('slide5Subtext', layout.subtext.x, layout.subtext.y, Depth.Hud);
      this.addLongTimer();
    }
  }
}

export class Carousel {
  private readonly chrome: SharedChrome;
  private readonly navigation: Navigation;
  private readonly tutorial: TutorialHint;
  private readonly endcard: EndcardOverlay;
  private current?: Slide;
  private idleTimer?: Phaser.Time.TimerEvent;
  private currentIndex = 0;
  private busy = false;
  private downX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioController,
    onCta: () => void,
    onEndcardShown: () => void,
  ) {
    this.endcard = new EndcardOverlay(() => {
      onEndcardShown();
      this.audio.playEnd();
    });
    this.chrome = new SharedChrome(scene, audio, onCta);
    this.navigation = new Navigation(scene, (direction) => this.move(direction), audio);
    this.show(0, 0);
    this.tutorial = new TutorialHint(scene, () => this.navigation.canMoveForward());
    this.tutorial.start();
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.downX = pointer.x;
      this.tutorial.onInteraction();
      this.armIdleAdvance();
    });
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const difference = pointer.x - this.downX;
      if (Math.abs(difference) >= sd(CAROUSEL_LAYOUT.swipeThreshold)) {
        this.move(difference < 0 ? 1 : -1);
      }
    });
  }

  relayout(): void {
    this.chrome.relayout();
    this.navigation.relayout();
    this.current?.relayout();
    this.tutorial?.relayout();
  }

  private armIdleAdvance(): void {
    this.idleTimer?.remove();
    if (this.currentIndex >= CAROUSEL_LAYOUT.sceneCount - 1) return;
    this.idleTimer = this.scene.time.delayedCall(
      CAROUSEL_LAYOUT.idleAutoAdvanceMs,
      () => {
        if (this.busy) {
          this.armIdleAdvance();
          return;
        }
        this.move(1);
      },
    );
  }

  private move(direction: -1 | 1): void {
    const next = this.currentIndex + direction;
    if (this.busy || next < 0 || next >= CAROUSEL_LAYOUT.sceneCount) return;
    this.idleTimer?.remove();
    // Reveal the pre-parsed end card on the advancing action, before the slide
    // transition can expose an empty frame.
    if (next === CAROUSEL_LAYOUT.sceneCount - 1) this.endcard.show();
    this.show(next, direction);
  }

  private show(next: number, direction: -1 | 0 | 1): void {
    this.navigation.setIndex(next);
    this.tutorial?.refreshTarget();
    const incoming = new Slide(this.scene, next);
    if (!this.current || direction === 0) {
      this.current?.destroy();
      this.current = incoming;
      this.currentIndex = next;
      incoming.relayout();
      this.relayout();
      if (next === CAROUSEL_LAYOUT.sceneCount - 2) this.endcard.prepare();
      this.armIdleAdvance();
      return;
    }

    this.busy = true;
    const distance = getViewport().width * direction;
    incoming.relayout(distance);
    const leaving = this.current;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: CAROUSEL_LAYOUT.transitionMs,
      ease: 'Cubic.Out',
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        leaving.relayout(-distance * progress);
        incoming.relayout(distance * (1 - progress));
      },
      onComplete: () => {
        leaving.destroy();
        if (next === CAROUSEL_LAYOUT.sceneCount - 1) this.endcard.show();
        else this.endcard.hide();
        this.current = incoming;
        this.currentIndex = next;
        this.busy = false;
        incoming.relayout();
        if (next === CAROUSEL_LAYOUT.sceneCount - 2) this.endcard.prepare();
        this.armIdleAdvance();
      },
    });
  }
}
