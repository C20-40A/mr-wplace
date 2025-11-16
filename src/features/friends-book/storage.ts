import { Friend, Tag } from "./types";
import { storage } from "@/utils/browser-api";

export class FriendsBookStorage {
  private static readonly STORAGE_KEY = "mr_wplace_friends_book";

  private static async setValue(value: any): Promise<void> {
    await storage.set({ [this.STORAGE_KEY]: value });
  }

  private static async getValue(): Promise<any> {
    const result = await storage.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY];
  }

  static async getFriends(): Promise<Friend[]> {
    const stored = await this.getValue();
    return stored ? JSON.parse(stored) : [];
  }

  static async addFriend(friend: Friend): Promise<void> {
    const friends = await this.getFriends();
    friends.push(friend);
    await this.setValue(JSON.stringify(friends));
  }

  static async removeFriend(id: number): Promise<void> {
    const friends = await this.getFriends();
    const filtered = friends.filter((f) => f.id !== id);
    await this.setValue(JSON.stringify(filtered));
  }

  static async updateFriend(friend: Friend): Promise<void> {
    const friends = await this.getFriends();
    const index = friends.findIndex((f) => f.id === friend.id);
    if (index !== -1) {
      friends[index] = friend;
      await this.setValue(JSON.stringify(friends));
    }
  }

  static async getFriendById(id: number): Promise<Friend | undefined> {
    const friends = await this.getFriends();
    return friends.find((f) => f.id === id);
  }

  static async getExistingTags(): Promise<Tag[]> {
    const friends = await this.getFriends();
    const tagMap = new Map<string, Tag>();

    for (const friend of friends) {
      if (friend.tag) {
        const key = `${friend.tag.color}-${friend.tag.name || ""}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, friend.tag);
        }
      }
    }

    const tags = Array.from(tagMap.values());
    tags.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    return tags;
  }

  static async updateTag(oldTag: Tag, newTag: Tag): Promise<void> {
    const friends = await this.getFriends();
    let updated = false;

    for (const friend of friends) {
      if (
        friend.tag &&
        friend.tag.color === oldTag.color &&
        (friend.tag.name || "") === (oldTag.name || "")
      ) {
        friend.tag = newTag;
        updated = true;
      }
    }

    if (updated) {
      await this.setValue(JSON.stringify(friends));
    }
  }

  static async deleteTag(tag: Tag): Promise<void> {
    const friends = await this.getFriends();
    let updated = false;

    for (const friend of friends) {
      if (
        friend.tag &&
        friend.tag.color === tag.color &&
        (friend.tag.name || "") === (tag.name || "")
      ) {
        friend.tag = undefined;
        updated = true;
      }
    }

    if (updated) {
      await this.setValue(JSON.stringify(friends));
    }
  }
}
