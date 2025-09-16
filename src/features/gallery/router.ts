import { Router } from "../../utils/router";

export type GalleryRoute = "list" | "image-editor" | "image-detail";

export class GalleryRouter extends Router<GalleryRoute> {
  constructor() {
    const titleMap: Record<GalleryRoute, string> = {
      "list": "gallery",
      "image-editor": "image_editor",
      "image-detail": "image_detail",
    };
    super("list", titleMap);
  }
}
