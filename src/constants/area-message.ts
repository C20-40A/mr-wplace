export const AREA_MESSAGE_SOURCE = {
  MEASURE_UPDATE: "mr-wplace-area-measure-update",
  REGIONS_SYNC: "mr-wplace-area-regions-sync",
  DISPLAY_OPTIONS_UPDATE: "mr-wplace-area-display-options-update",
  REGION_EDIT_START: "mr-wplace-area-region-edit-start",
  REGION_EDIT_STOP: "mr-wplace-area-region-edit-stop",
  REGION_EDIT_REQUEST: "mr-wplace-area-region-edit-request",
  REGION_EDIT_RESPONSE: "mr-wplace-area-region-edit-response",
  REGION_SAVE_CLICK: "mr-wplace-area-region-save-click",
  REGION_CANCEL_CLICK: "mr-wplace-area-region-cancel-click",
  REGION_GOTO: "mr-wplace-area-region-goto",
} as const;

export type AreaMessageSource =
  (typeof AREA_MESSAGE_SOURCE)[keyof typeof AREA_MESSAGE_SOURCE];
