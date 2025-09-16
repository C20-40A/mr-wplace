import { t } from "../i18n/manager";

interface HeaderElements {
  titleElement: HTMLElement;
  backButton: HTMLElement;
}

export class Router<T extends string> {
  private currentRoute: T;
  private onRouteChange: ((route: T) => void) | null = null;
  private history: T[] = []; // ルーティングヒストリー
  private headerElements: HeaderElements | null = null;
  private titleMap: Record<T, string> = {} as Record<T, string>;

  constructor(defaultRoute: T, titleMap?: Record<T, string>) {
    this.currentRoute = defaultRoute;
    if (titleMap) this.titleMap = titleMap;
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
    this.updateHeader();
    this.onRouteChange?.(route);
  }

  // ヒストリーをクリアして初期化
  initialize(route: T): void {
    this.history = [];
    this.currentRoute = route;
    this.updateHeader();
    this.onRouteChange?.(route);
    console.log(`Router initialized to route: ${route}`);
  }

  setOnRouteChange(callback: (route: T) => void): void {
    console.log("Setting onRouteChange callback");
    this.onRouteChange = callback;
  }

  setHeaderElements(titleElement: HTMLElement, backButton: HTMLElement): void {
    this.headerElements = { titleElement, backButton };
  }

  setTitleMap(titleMap: Record<T, string>): void {
    this.titleMap = titleMap;
  }

  private updateHeader(): void {
    if (!this.headerElements) return;

    const { titleElement, backButton } = this.headerElements;
    const i18nKey = this.titleMap[this.currentRoute];
    
    if (i18nKey && titleElement) {
      titleElement.textContent = t`${i18nKey}`;
    }

    if (backButton) {
      if (this.canNavigateBack()) {
        backButton.classList.remove("hidden");
      } else {
        backButton.classList.add("hidden");
      }
    }
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
    this.updateHeader();
    this.onRouteChange?.(previousRoute);
  }
}
