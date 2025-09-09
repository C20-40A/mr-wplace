export type GalleryRoute = 'list' | 'image-editor' | 'image-detail';

export class GalleryRouter {
  private currentRoute: GalleryRoute = 'list';
  private onRouteChange: ((route: GalleryRoute) => void) | null = null;

  getCurrentRoute(): GalleryRoute {
    return this.currentRoute;
  }

  navigate(route: GalleryRoute): void {
    this.currentRoute = route;
    this.onRouteChange?.(route);
  }

  setOnRouteChange(callback: (route: GalleryRoute) => void): void {
    this.onRouteChange = callback;
  }

  canNavigateBack(): boolean {
    return this.currentRoute !== 'list';
  }

  navigateBack(): void {
    if (this.canNavigateBack()) {
      this.navigate('list');
    }
  }

  navigateToImageDetail(): void {
    this.navigate('image-detail');
  }
}
