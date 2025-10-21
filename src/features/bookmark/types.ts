export interface Position {
  lat: number;
  lng: number;
  zoom: number;
}

export interface Tag {
  name?: string;
  color: string;
}

export interface Bookmark {
  id: number;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  date: string;
  lastAccessedDate?: string;
  tag?: Tag;
}
