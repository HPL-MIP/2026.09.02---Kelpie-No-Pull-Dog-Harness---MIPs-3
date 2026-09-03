import Phaser from 'phaser';
import { endcardHtml, type AssetKey } from '../assets';
import { Depth, STORE_URL } from '../constants';
import { track } from '../analytics';
import { triggerCTA } from '../networks';
import { getViewport, sd, sx, sy } from '../utils/responsive';
import { AudioController } from './AudioController';

export const CAROUSEL_LAYOUT = {
  offerExpiryDays: 0,
  shortTimerSeconds: 15,
  longTimerSeconds: 15 * 60,
  transitionMs: 330,
  offerHeaderFadeMs: 220,
  idleAutoAdvanceMs: 4000,
  swipeThreshold: 54,
  sceneCount: 6,
  ctaPulse: { scale: 1.3, duration: 650, hold: 0 },
  logo: { x: 540, y: 154, width: 556, height: 80 },
  // bottomOffset keeps the design anchored to the viewport's bottom edge.
  lowerDesign: { x: 540, width: 1080, height: 187, bottomOffset: 0 },
  cta: { x: 540, y: 1735, width: 551, height: 155 },
  offerHeader: { textX: 540, textY: 360, dateY: 500, timerY: 580 },
  scene5Timer: { x: 540, y: 1420, digitsY: 1390 },
  arrow: { leftX: 96.5, rightX: 983.5, y: 960, width: 93, height: 93 },
  // Edit x/y to reposition Assets/Kelpie/handhint.png on the 1080x1920 canvas.
  handHint: { x: 1020, y: 1010, width: 142, height: 145, fadeMs: 250, pulseDownScale: 0.9, pulseMs: 220, pulseGapMs: 1000, idleMs: 5000 },
} as const;

const IMAGE_SIZE: Record<AssetKey, readonly [number, number]> = {
  arrows: [988, 93], cta: [551, 155], design: [1080, 187], handHint: [178, 182], leftArrow: [93, 93], logo: [556, 80], rightArrow: [93, 93],
  scene1Main: [765, 588], scene1Text: [802, 158], scene2Main: [747, 755], scene2Text: [899, 172], scene3Main: [747, 755],
  scene4Icon0: [298, 298], scene4Icon1: [91, 91], scene4Icon2: [101, 101], scene4Icon3: [94, 94], scene4Text0: [647, 77],
  scene4Text1: [437, 90], scene4Text2: [443, 35], scene4Text3: [477, 42], scene5Text: [976, 77],
  scene5Timer: [665, 302], timerBackground: [174, 57],
};

type PositionedObject = Phaser.GameObjects.GameObject & { setPosition: (x: number, y: number) => unknown; setDisplaySize?: (width: number, height: number) => unknown; setFontSize?: (size: number) => unknown };

class LayoutGroup {
  protected readonly objects: PositionedObject[] = [];
  protected offset = 0;
  constructor(protected readonly scene: Phaser.Scene) {}
  relayout(offset = this.offset): void { this.offset = offset; for (const object of this.objects) (object as any).layout?.(offset); }
  destroy(): void { this.objects.forEach((object) => object.destroy()); }
  protected addImage(key: AssetKey, x: number, y: number, depth: number = Depth.Game, onPress?: () => void): Phaser.GameObjects.Image {
    const [width, height] = IMAGE_SIZE[key];
    const image = this.scene.add.image(0, 0, key).setDepth(depth);
    if (onPress) { image.setInteractive({ useHandCursor: true }); image.on('pointerdown', onPress); }
    (image as any).layout = (offset: number) => image.setPosition(sx(x) + offset, sy(y)).setDisplaySize(sd(width), sd(height));
    this.objects.push(image);
    return image;
  }
  protected addBottomImage(key: AssetKey, x: number, bottomOffset: number, depth: number = Depth.Game): Phaser.GameObjects.Image {
    const [width, height] = IMAGE_SIZE[key];
    const image = this.scene.add.image(0, 0, key).setDepth(depth);
    // Anchor to the physical viewport edge rather than the artboard's bottom
    // so this decoration stays flush when the viewport aspect ratio changes.
    (image as any).layout = (offset: number) => image.setPosition(sx(x) + offset, getViewport().height - sd(height) / 2 - sd(bottomOffset)).setDisplaySize(sd(width), sd(height));
    this.objects.push(image);
    return image;
  }
  protected addText(text: string, x: number, y: number, fontSize: number, depth: number = Depth.Hud): Phaser.GameObjects.Text {
    const node = this.scene.add.text(0, 0, text, { fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: `${fontSize}px`, fontStyle: 'normal', color: '#000000', align: 'center' }).setOrigin(0.5).setDepth(depth);
    (node as any).layout = (offset: number) => node.setPosition(sx(x) + offset, sy(y)).setFontSize(sd(fontSize));
    this.objects.push(node);
    return node;
  }
  protected addDate(x: number, y: number): void {
    const date = new Date();
    date.setDate(date.getDate() + CAROUSEL_LAYOUT.offerExpiryDays);
    const label = `Offer expires ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    this.addText(label, x, y, 33).setFontStyle('500');
  }
}

class SharedChrome extends LayoutGroup {
  private readonly pulse: Phaser.Tweens.Tween;
  constructor(scene: Phaser.Scene, audio: AudioController) {
    super(scene);
    this.addImage('logo', CAROUSEL_LAYOUT.logo.x, CAROUSEL_LAYOUT.logo.y, Depth.Hud);
    this.addBottomImage('design', CAROUSEL_LAYOUT.lowerDesign.x, CAROUSEL_LAYOUT.lowerDesign.bottomOffset, Depth.Hud);
    const cta = this.addImage('cta', CAROUSEL_LAYOUT.cta.x, CAROUSEL_LAYOUT.cta.y, Depth.Input, () => { audio.unlock(); audio.playClick(); track('CTA_CLICKED'); triggerCTA(STORE_URL); });
    const { scale, duration, hold } = CAROUSEL_LAYOUT.ctaPulse;
    this.pulse = scene.tweens.addCounter({
      from: 1, to: scale, duration, hold, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      onUpdate: (tween) => { const pulse = tween.getValue() ?? 1; cta.setDisplaySize(sd(CAROUSEL_LAYOUT.cta.width) * pulse, sd(CAROUSEL_LAYOUT.cta.height) * pulse); },
    });
  }
  override destroy(): void { this.pulse.remove(); super.destroy(); }
}

class OfferHeader extends LayoutGroup {
  private readonly timer: Phaser.Time.TimerEvent;
  private fade?: Phaser.Tweens.Tween;
  constructor(scene: Phaser.Scene) {
    super(scene);
    const { textX, textY, dateY, timerY } = CAROUSEL_LAYOUT.offerHeader;
    this.addImage('scene2Text', textX, textY, Depth.Hud);
    this.addDate(textX, dateY);
    this.addImage('timerBackground', textX, timerY, Depth.Hud);
    const label = this.addText('00:15', textX, timerY + 1, 33);
    let remaining = CAROUSEL_LAYOUT.shortTimerSeconds;
    this.timer = scene.time.addEvent({ delay: 1000, repeat: remaining - 1, callback: () => { remaining--; label.setText(`00:${String(Math.max(0, remaining)).padStart(2, '0')}`); } });
  }
  fadeIn(): void {
    this.fade?.remove();
    this.objects.forEach((object) => (object as any).setAlpha?.(0));
    this.fade = this.scene.tweens.add({ targets: this.objects, alpha: 1, duration: CAROUSEL_LAYOUT.offerHeaderFadeMs, ease: 'Sine.Out' });
  }
  fadeOut(onComplete: () => void): void {
    this.fade?.remove();
    this.fade = this.scene.tweens.add({ targets: this.objects, alpha: 0, duration: CAROUSEL_LAYOUT.offerHeaderFadeMs, ease: 'Sine.In', onComplete });
  }
  override destroy(): void { this.fade?.remove(); this.timer.remove(); super.destroy(); }
}

class Navigation extends LayoutGroup {
  private index = 0;
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, private readonly onMove: (direction: -1 | 1) => void, private readonly audio: AudioController) {
    super(scene);
    this.left = this.addImage('leftArrow', CAROUSEL_LAYOUT.arrow.leftX, CAROUSEL_LAYOUT.arrow.y, Depth.Input, () => { if (this.index > 0) { this.audio.unlock(); this.audio.playClick(); this.onMove(-1); } });
    this.right = this.addImage('rightArrow', CAROUSEL_LAYOUT.arrow.rightX, CAROUSEL_LAYOUT.arrow.y, Depth.Input, () => {
      if (this.index >= CAROUSEL_LAYOUT.sceneCount - 1) return;
      this.audio.unlock();
      // Scene 5 advances straight to the end card, which plays end.mp3.
      if (this.index !== CAROUSEL_LAYOUT.sceneCount - 2) this.audio.playClick();
      this.onMove(1);
    });
  }
  setIndex(index: number): void { this.index = index; this.left.setVisible(index > 0); this.right.setVisible(index < CAROUSEL_LAYOUT.sceneCount - 1); }
  canMoveForward(): boolean { return this.index < CAROUSEL_LAYOUT.sceneCount - 1; }
}

class TutorialHint extends LayoutGroup {
  private readonly hand: Phaser.GameObjects.Image;
  private fade?: Phaser.Tweens.Tween;
  private pulse?: Phaser.Tweens.Tween;
  private loopTimer?: Phaser.Time.TimerEvent;
  private idleTimer?: Phaser.Time.TimerEvent;
  constructor(scene: Phaser.Scene, private readonly canShow: () => boolean) {
    super(scene);
    const { x, y } = CAROUSEL_LAYOUT.handHint;
    this.hand = this.addImage('handHint', x, y, Depth.Input).setVisible(false).setAlpha(0);
  }
  start(): void { this.show(); }
  onInteraction(): void {
    this.hide(true);
    this.idleTimer?.remove();
    this.idleTimer = this.scene.time.delayedCall(CAROUSEL_LAYOUT.handHint.idleMs, () => this.show());
  }
  refreshTarget(): void { if (!this.canShow()) this.hide(false); }
  override relayout(offset = 0): void { super.relayout(offset); }
  override destroy(): void { this.clearMotion(); this.idleTimer?.remove(); super.destroy(); }
  private show(): void {
    if (!this.canShow()) return;
    this.clearMotion();
    this.hand.setVisible(true).setAlpha(0);
    this.relayout();
    this.fade = this.scene.tweens.add({ targets: this.hand, alpha: 1, duration: CAROUSEL_LAYOUT.handHint.fadeMs, ease: 'Sine.Out', onComplete: () => this.pulseOnce() });
  }
  private hide(fadeOut: boolean): void {
    this.clearMotion();
    if (!this.hand.visible) return;
    if (!fadeOut) { this.hand.setVisible(false).setAlpha(0); return; }
    this.fade = this.scene.tweens.add({ targets: this.hand, alpha: 0, duration: CAROUSEL_LAYOUT.handHint.fadeMs, ease: 'Sine.In', onComplete: () => this.hand.setVisible(false) });
  }
  private pulseOnce(): void {
    if (!this.canShow() || !this.hand.visible) return;
    const { width, height, pulseDownScale, pulseMs, pulseGapMs } = CAROUSEL_LAYOUT.handHint;
    this.pulse = this.scene.tweens.addCounter({
      // One cycle: normal size -> smaller -> normal size.
      from: 1, to: pulseDownScale, duration: pulseMs, yoyo: true, ease: 'Sine.InOut',
      onUpdate: (tween) => { const scale = tween.getValue() ?? 1; this.hand.setDisplaySize(sd(width) * scale, sd(height) * scale); },
      onComplete: () => { this.loopTimer = this.scene.time.delayedCall(pulseGapMs, () => this.pulseOnce()); },
    });
  }
  private clearMotion(): void { this.fade?.remove(); this.pulse?.remove(); this.loopTimer?.remove(); this.fade = undefined; this.pulse = undefined; this.loopTimer = undefined; }
}

class EndcardOverlay {
  private iframe?: HTMLIFrameElement;
  private shown = false;
  constructor(private readonly onShow: () => void) {}
  prepare(): void {
    if (this.iframe) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Kelpie end card');
    iframe.setAttribute('scrolling', 'no');
    // Preload behind Scene 5 without intercepting its input. Once Scene 6 is
    // requested, reveal this already-parsed iframe rather than a blank frame.
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:50;opacity:0;pointer-events:none;background:#fee8e6;transition:opacity 100ms linear;';
    const parentBridge = '<script>window.mraid=window.parent.mraid;window.clickTag=window.parent.clickTag;window.clickTag1=window.parent.clickTag1;window.clickthrough=window.parent.clickthrough;window.clickThrough=window.parent.clickThrough;</script>';
    iframe.srcdoc = endcardHtml.replace('</head>', `${parentBridge}</head>`);
    document.body.appendChild(iframe);
    this.iframe = iframe;
  }
  show(): void {
    this.prepare();
    if (!this.iframe || this.shown) return;
    this.shown = true;
    this.iframe.style.opacity = '1';
    this.iframe.style.pointerEvents = 'auto';
    this.onShow();
  }
  hide(): void { this.iframe?.remove(); this.iframe = undefined; this.shown = false; }
}

class Slide extends LayoutGroup {
  private readonly timerEvents: Phaser.Time.TimerEvent[] = [];
  constructor(scene: Phaser.Scene, readonly index: number) { super(scene); this.build(); }
  override destroy(): void { this.timerEvents.forEach((event) => event.remove()); super.destroy(); }
  private addLongTimer(): void {
    const { x, y, digitsY } = CAROUSEL_LAYOUT.scene5Timer;
    this.addImage('scene5Timer', x, y, Depth.Hud);
    const minutes = this.addText('15', 522, digitsY, 59);
    const seconds = this.addText('00', 712, digitsY, 59);
    let remaining = CAROUSEL_LAYOUT.longTimerSeconds;
    this.timerEvents.push(this.scene.time.addEvent({ delay: 1000, repeat: remaining - 1, callback: () => { remaining--; minutes.setText(String(Math.floor(remaining / 60)).padStart(2, '0')); seconds.setText(String(remaining % 60).padStart(2, '0')); } }));
  }
  private build(): void {
    if (this.index === 0) { this.addImage('scene1Text', 540, 435, Depth.Hud); this.addDate(540, 600); this.addImage('scene1Main', 540, 1052); return; }
    if (this.index === 1) { this.addImage('scene2Main', 540, 1040); return; }
    if (this.index === 2) { this.addImage('scene3Main', 540, 1040); return; }
    if (this.index === 3) { this.addImage('scene4Icon0', 540, 410, Depth.Hud); this.addImage('scene4Text0', 540, 660, Depth.Hud); this.addImage('scene4Icon1', 244, 900, Depth.Hud); this.addImage('scene4Text1', 590, 900, Depth.Hud); this.addImage('scene4Icon2', 244, 1090, Depth.Hud); this.addImage('scene4Text2', 590, 1090, Depth.Hud); this.addImage('scene4Icon3', 244, 1280, Depth.Hud); this.addImage('scene4Text3', 590, 1280, Depth.Hud); return; }
    if (this.index === 4) { this.addImage('scene5Text', 540, 366, Depth.Hud); this.addImage('scene1Main', 540, 925); this.addLongTimer(); }
  }
}

const isOfferSlide = (index: number): boolean => index === 1 || index === 2;

export class Carousel {
  private readonly chrome: SharedChrome;
  private readonly navigation: Navigation;
  private readonly tutorial: TutorialHint;
  private readonly endcard: EndcardOverlay;
  private current?: Slide;
  private offerHeader?: OfferHeader;
  private idleTimer?: Phaser.Time.TimerEvent;
  private currentIndex = 0;
  private busy = false;
  private downX = 0;
  constructor(private readonly scene: Phaser.Scene, private readonly audio: AudioController) {
    this.endcard = new EndcardOverlay(() => this.audio.playEnd());
    this.chrome = new SharedChrome(scene, audio);
    this.navigation = new Navigation(scene, (direction) => this.move(direction), audio);
    this.show(0, 0);
    this.tutorial = new TutorialHint(scene, () => this.navigation.canMoveForward());
    this.tutorial.start();
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.downX = pointer.x; this.tutorial.onInteraction(); this.armIdleAdvance(); });
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => { const difference = pointer.x - this.downX; if (Math.abs(difference) >= sd(CAROUSEL_LAYOUT.swipeThreshold)) this.move(difference < 0 ? 1 : -1); });
  }
  relayout(): void { this.chrome.relayout(); this.navigation.relayout(); this.offerHeader?.relayout(); this.current?.relayout(); this.tutorial?.relayout(); }
  private armIdleAdvance(): void {
    this.idleTimer?.remove();
    if (this.currentIndex >= CAROUSEL_LAYOUT.sceneCount - 1) return;
    this.idleTimer = this.scene.time.delayedCall(CAROUSEL_LAYOUT.idleAutoAdvanceMs, () => {
      if (this.busy) { this.armIdleAdvance(); return; }
      this.move(1);
    });
  }
  private syncOfferHeader(nextIndex: number): boolean {
    if (!isOfferSlide(nextIndex) || this.offerHeader) return false;
    this.offerHeader = new OfferHeader(this.scene);
    // The header is persistent rather than part of the sliding content, so it
    // needs an immediate first layout pass when Scenes 2/3 are entered.
    this.offerHeader.relayout();
    return true;
  }
  private move(direction: -1 | 1): void {
    const next = this.currentIndex + direction;
    if (this.busy || next < 0 || next >= CAROUSEL_LAYOUT.sceneCount) return;
    this.idleTimer?.remove();
    // Scene 6 is an iframe end card. Reveal it at the user's action, not
    // after the outgoing slide finishes, so there is no white loading screen.
    if (next === CAROUSEL_LAYOUT.sceneCount - 1) this.endcard.show();
    // Fade the fixed Scene 2/3 header away before the next non-offer scene
    // starts moving, preventing it from overlapping Scene 1 or Scene 4.
    if (isOfferSlide(this.currentIndex) && !isOfferSlide(next) && this.offerHeader) {
      this.busy = true;
      this.offerHeader.fadeOut(() => {
        this.offerHeader?.destroy();
        this.offerHeader = undefined;
        this.busy = false;
        this.show(next, direction);
      });
      return;
    }
    this.show(next, direction);
  }
  private show(next: number, direction: -1 | 0 | 1): void {
    const shouldFadeInOfferHeader = this.syncOfferHeader(next);
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
      if (shouldFadeInOfferHeader) this.offerHeader?.fadeIn();
      this.armIdleAdvance();
      return;
    }
    this.busy = true;
    if (shouldFadeInOfferHeader) this.offerHeader?.fadeIn();
    const distance = getViewport().width * direction;
    incoming.relayout(distance);
    const leaving = this.current;
    const leavingIndex = this.currentIndex;
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: CAROUSEL_LAYOUT.transitionMs, ease: 'Cubic.Out',
      onUpdate: (tween) => { const progress = tween.getValue() ?? 0; leaving.relayout(-distance * progress); incoming.relayout(distance * (1 - progress)); },
      onComplete: () => {
        leaving.destroy();
        if (isOfferSlide(leavingIndex) && !isOfferSlide(next)) { this.offerHeader?.destroy(); this.offerHeader = undefined; }
        if (next === CAROUSEL_LAYOUT.sceneCount - 1) this.endcard.show(); else this.endcard.hide();
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
