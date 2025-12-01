# Inject Context State Management

This folder contains state management for the inject context (page context).

## Purpose

Store and manage states that are:
- Received from content script via `postMessage`
- Used across multiple files within inject context
- Independent of `window` object exposure

## Pattern

Each state module should export:
- Type definition (interface/type)
- Getter function(s)
- Setter/updater function(s)

Example:
```typescript
export interface SomeState {
  enabled: boolean;
  value: string;
}

let state: SomeState = { enabled: false, value: "" };

export const getSomeState = (): SomeState => state;

export const updateSomeState = (newState: Partial<SomeState>): void => {
  state = { ...state, ...newState };
};
```

## Current States

- `colorFilterState.ts`: Color filter settings from content script (isFilterActive, selectedRGBs, enhancedMode, extraColorsBitmap)
- `migrationState.ts`: Migration architecture instances (layerRepository, workerMessenger)
