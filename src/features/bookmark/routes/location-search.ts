import { gotoPosition } from "@/utils/position";
import { t } from "@/i18n/manager";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  importance: number;
}

const searchLocation = async (query: string): Promise<NominatimResult[]> => {
  if (!query.trim()) {
    return [];
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "3");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mr.Wplace Chrome Extension",
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return await response.json();
};

export const renderLocationSearch = (container: HTMLElement): void => {
  container.innerHTML = t`
    <div class="flex flex-col gap-4" style="padding: 1rem;">
      
      <!-- Search Input -->
      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          <input 
            id="wps-location-search-input" 
            type="text" 
            class="input input-bordered flex-1"
            placeholder="${"enter_place_name"}"
          >
          <button id="wps-location-search-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
              <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
            </svg>
            ${"search_location"}
          </button>
        </div>
      </div>

      <!-- Results Container -->
      <div id="wps-location-search-results" class="flex flex-col gap-2">
        <!-- Empty state -->
      </div>

    </div>
  `;

  const searchInput = container.querySelector("#wps-location-search-input") as HTMLInputElement;
  const searchBtn = container.querySelector("#wps-location-search-btn") as HTMLButtonElement;
  const resultsContainer = container.querySelector("#wps-location-search-results") as HTMLElement;

  const performSearch = async () => {
    const query = searchInput.value.trim();
    
    if (!query) {
      return;
    }

    // Show loading state
    searchBtn.disabled = true;
    resultsContainer.innerHTML = t`
      <div class="flex items-center justify-center gap-2 p-4">
        <span class="loading loading-spinner loading-sm"></span>
        <span>${"searching"}</span>
      </div>
    `;

    try {
      const results = await searchLocation(query);

      if (results.length === 0) {
        resultsContainer.innerHTML = t`
          <div class="flex flex-col items-center justify-center p-8 text-base-content/60">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-12 mb-2">
              <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
            </svg>
            <p>${"no_results_found"}</p>
          </div>
        `;
        return;
      }

      // Show results
      resultsContainer.innerHTML = t`
        <div class="text-sm font-semibold mb-2">${"search_results"}</div>
      ` + results.map(result => `
        <div 
          class="wps-location-result p-3 rounded-lg border border-base-300 bg-base-200/50 cursor-pointer hover:bg-base-300 transition-colors"
          data-lat="${result.lat}"
          data-lon="${result.lon}"
          style="cursor: pointer;"
        >
          <div class="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5 flex-shrink-0 mt-0.5">
              <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/>
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm break-words">${result.display_name}</p>
              <p class="text-xs text-base-content/60 mt-1">
                📍 ${parseFloat(result.lat).toFixed(4)}, ${parseFloat(result.lon).toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      `).join("");

    } catch (error) {
      console.error("🧑‍🎨 : Location search error:", error);
      resultsContainer.innerHTML = t`
        <div class="flex flex-col items-center justify-center p-8 text-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-12 mb-2">
            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
          </svg>
          <p>${"error"}</p>
        </div>
      `;
    } finally {
      searchBtn.disabled = false;
    }
  };

  // Event listeners
  searchBtn.addEventListener("click", performSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      performSearch();
    }
  });

  // Result click handler
  resultsContainer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const resultDiv = target.closest(".wps-location-result") as HTMLElement | null;
    
    if (!resultDiv) return;

    const lat = parseFloat(resultDiv.dataset.lat!);
    const lon = parseFloat(resultDiv.dataset.lon!);

    gotoPosition({ lat, lng: lon, zoom: 11 });
    
    // Close modal
    const modal = document.getElementById("wplace-studio-favorite-modal") as HTMLDialogElement;
    if (modal) {
      modal.close();
    }

    console.log("🧑‍🎨 : Jumping to location:", lat, lon);
  });

  console.log("🧑‍🎨 : Location Search rendered");
};
