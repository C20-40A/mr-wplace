export type GalleryRoute = "list" | "image-editor" | "image-detail";

export class GalleryRouter {
  private currentRoute: GalleryRoute = "list";
  private onRouteChange: ((route: GalleryRoute) => void) | null = null;

  getCurrentRoute(): GalleryRoute {
    return this.currentRoute;
  }

  navigate(route: GalleryRoute): void {
    console.log(`Navigating to route: ${route}`);
    this.currentRoute = route;
    this.onRouteChange?.(route);
  }

  setOnRouteChange(callback: (route: GalleryRoute) => void): void {
    console.log("Setting onRouteChange callback");
    this.onRouteChange = callback;
  }

  canNavigateBack(): boolean {
    return this.currentRoute !== "list";
  }

  navigateBack(): void {
    if (this.canNavigateBack()) {
      this.navigate("list");
    }
  }
}
