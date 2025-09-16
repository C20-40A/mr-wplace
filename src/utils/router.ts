export class Router<T extends string> {
  private currentRoute: T;
  private onRouteChange: ((route: T) => void) | null = null;
  private history: T[] = []; // ルーティングヒストリー

  constructor(defaultRoute: T) {
    this.currentRoute = defaultRoute;
  }

  getCurrentRoute(): T {
    return this.currentRoute;
  }

  navigate(route: T): void {
    console.log(`Navigating to route: ${route}`);

    // 現在のルートをヒストリーに追加
    if (this.currentRoute !== route) {
      this.history.push(this.currentRoute);
    }

    this.currentRoute = route;
    this.onRouteChange?.(route);
  }

  // ヒストリーをクリアして初期化
  initialize(route: T): void {
    this.history = [];
    this.currentRoute = route;
    this.onRouteChange?.(route);
    console.log(`Router initialized to route: ${route}`);
  }

  setOnRouteChange(callback: (route: T) => void): void {
    console.log("Setting onRouteChange callback");
    this.onRouteChange = callback;
  }

  canNavigateBack(): boolean {
    return this.history.length > 0;
  }

  navigateBack(): void {
    if (!this.canNavigateBack()) {
      console.warn("No previous route to navigate back to.");
      return;
    }
    const previousRoute = this.history.pop()!;
    console.log(`Navigating back to route: ${previousRoute}`);
    this.currentRoute = previousRoute;
    this.onRouteChange?.(previousRoute);
  }
}
