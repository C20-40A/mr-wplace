import { Router } from "@/utils/router";

export type BookmarkRoute = "list" | "coordinate-jumper";

export class BookmarkRouter extends Router<BookmarkRoute> {
  constructor() {
    const titleMap: Record<BookmarkRoute, string> = {
      "list": "bookmark_list",
      "coordinate-jumper": "coordinate_jumper",
    };
    super("list", titleMap);
  }
}
