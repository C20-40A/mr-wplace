import { ArtCruiseLifecycle, type ArtCruiseStartData } from "./lifecycle";

const lifecycle = new ArtCruiseLifecycle();

export const startArtCruise = (data?: ArtCruiseStartData) => lifecycle.start(data);
export const stopArtCruise = () => lifecycle.stop();
export const isArtCruiseActive = () => lifecycle.active;
