import { AREA_MESSAGE_SOURCE } from "@/constants/area-message";
import type {
  AreaDisplayOptions,
  AreaRegion,
  AreaRegionBounds,
  AreaRegionEditSnapshot,
  AreaRegionVertex,
} from "@/types/area-region";

const MAP_INSTANCE_CAPTURED_SOURCE = "mr-wplace-map-instance-captured";
const AREA_EDIT_REQUEST_TIMEOUT_MS = 5000;

interface AreaManagerMessageHandlers {
  onMapReady: () => void;
  onSaveClick: () => void;
  onCancelClick: () => void;
}

interface AreaRegionEditStartPayload {
  regionId: string | null;
  name: string;
  color: string;
  vertices: AreaRegionVertex[];
  saveLabel: string;
  cancelLabel: string;
}

interface RequestAreaEditSnapshotParams {
  normalizeVertices: (value: unknown) => AreaRegionVertex[];
}

let areaRequestCounter = 0;

const generateAreaEditRequestId = (): string =>
  `area_edit_${Date.now()}_${++areaRequestCounter}`;

export const bindAreaManagerMessageHandlers = ({
  onMapReady,
  onSaveClick,
  onCancelClick,
}: AreaManagerMessageHandlers): (() => void) => {
  const handler = (event: MessageEvent) => {
    const source = event.data?.source;

    if (source === MAP_INSTANCE_CAPTURED_SOURCE && event.data?.ready) {
      onMapReady();
      return;
    }

    if (source === AREA_MESSAGE_SOURCE.REGION_SAVE_CLICK) {
      onSaveClick();
      return;
    }

    if (source === AREA_MESSAGE_SOURCE.REGION_CANCEL_CLICK) {
      onCancelClick();
    }
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
};

export const postAreaMeasureUpdate = (visible: boolean): void => {
  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.MEASURE_UPDATE,
      visible,
    },
    "*",
  );
};

export const postAreaRegionsSync = (regions: AreaRegion[]): void => {
  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.REGIONS_SYNC,
      regions,
    },
    "*",
  );
};

export const postAreaDisplayOptionsUpdate = (
  options: AreaDisplayOptions,
): void => {
  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.DISPLAY_OPTIONS_UPDATE,
      options,
    },
    "*",
  );
};

export const postAreaRegionGoto = (payload: {
  regionId: string;
  lng: number;
  lat: number;
  bounds: AreaRegionBounds | null;
}): void => {
  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.REGION_GOTO,
      regionId: payload.regionId,
      lng: payload.lng,
      lat: payload.lat,
      bounds: payload.bounds,
    },
    "*",
  );
};

export const postAreaRegionEditStart = (
  payload: AreaRegionEditStartPayload,
): void => {
  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.REGION_EDIT_START,
      regionId: payload.regionId,
      name: payload.name,
      color: payload.color,
      vertices: payload.vertices,
      saveLabel: payload.saveLabel,
      cancelLabel: payload.cancelLabel,
    },
    "*",
  );
};

export const postAreaRegionEditStop = (): void => {
  window.postMessage({ source: AREA_MESSAGE_SOURCE.REGION_EDIT_STOP }, "*");
};

export const requestAreaEditSnapshot = async ({
  normalizeVertices,
}: RequestAreaEditSnapshotParams): Promise<AreaRegionEditSnapshot | null> => {
  const requestId = generateAreaEditRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      window.removeEventListener("message", handler);
      clearTimeout(timeoutId);
    };

    const handler = (event: MessageEvent) => {
      if (
        event.data?.source !== AREA_MESSAGE_SOURCE.REGION_EDIT_RESPONSE ||
        event.data?.requestId !== requestId
      ) {
        return;
      }

      cleanup();

      const result = event.data.result as AreaRegionEditSnapshot | null;
      if (!result || typeof result !== "object") {
        resolve(null);
        return;
      }

      const vertices = normalizeVertices(result.vertices);
      if (vertices.length < 3) {
        resolve(null);
        return;
      }

      resolve({
        regionId: typeof result.regionId === "string" ? result.regionId : null,
        name: typeof result.name === "string" ? result.name : "",
        vertices,
      });
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: AREA_MESSAGE_SOURCE.REGION_EDIT_REQUEST,
        requestId,
      },
      "*",
    );

    timeoutId = setTimeout(() => {
      cleanup();
      console.warn("🧑‍🎨 : Area edit request timed out");
      resolve(null);
    }, AREA_EDIT_REQUEST_TIMEOUT_MS);
  });
};
