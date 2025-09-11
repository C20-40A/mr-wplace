import { Router } from "../../utils/router";

export type GalleryRoute = "list" | "image-editor" | "image-detail";

export class GalleryRouter extends Router<GalleryRoute> {
  constructor() {
    super("list");
  }
}
