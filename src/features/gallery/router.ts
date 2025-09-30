import { Router } from "../../utils/router";

export type GalleryRoute = "list" | "image-editor" | "image-detail" | "image-share" | "image-selector";

export class GalleryRouter extends Router<GalleryRoute> {
  constructor() {
    const titleMap: Record<GalleryRoute, string> = {
      "list": "gallery",
      "image-editor": "image_editor",
      "image-detail": "image_detail",
      "image-share": "image_share",
      "image-selector": "select_image",
    };
    super("list", titleMap);
  }
}
