import { Container, Graphics } from "pixi.js";

const BACKGROUND_SPEED = 42;

export class ArtCruiseBackground {
  public readonly view = new Container();
  private readonly skyGraphics = new Graphics();
  private readonly gridGraphics = new Graphics();
  private readonly scanlineGraphics = new Graphics();
  private backgroundOffset = 0;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor() {
    this.view.addChild(
      this.skyGraphics,
      this.gridGraphics,
      this.scanlineGraphics,
    );
  }

  update(deltaSeconds: number, screenWidth: number, screenHeight: number) {
    this.backgroundOffset =
      (this.backgroundOffset + BACKGROUND_SPEED * deltaSeconds) % 96;

    if (screenWidth !== this.lastWidth || screenHeight !== this.lastHeight) {
      this.lastWidth = screenWidth;
      this.lastHeight = screenHeight;
      // Re-draw grid if needed? 
      // The original code didn't actually draw anything in drawBackground except setting lastBackgroundWidth/Height.
      // Wait, let me check the original code again.
    }
  }
}
