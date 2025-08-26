export interface Position {
  lat: number;
  lng: number;
  zoom: number;
}

export interface Favorite {
  id: number;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  date: string;
}

export interface ButtonConfig {
  id: string;
  selector: string;
  containerSelector: string;
  create: (container: Element) => void;
}
