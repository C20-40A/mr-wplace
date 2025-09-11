export class Router<T extends string> {
  private currentRoute: T;
  private onRouteChange: ((route: T) => void) | null = null;

  constructor(defaultRoute: T) {
    this.currentRoute = defaultRoute;
  }

  getCurrentRoute(): T {
    return this.currentRoute;
  }

  navigate(route: T): void {
    console.log(`Navigating to route: ${route}`);
    this.currentRoute = route;
    this.onRouteChange?.(route);
  }

  setOnRouteChange(callback: (route: T) => void): void {
    console.log("Setting onRouteChange callback");
    this.onRouteChange = callback;
  }

  canNavigateBack(listRoute: T): boolean {
    return this.currentRoute !== listRoute;
  }

  navigateBack(listRoute: T): void {
    if (this.canNavigateBack(listRoute)) {
      this.navigate(listRoute);
    }
  }
}
