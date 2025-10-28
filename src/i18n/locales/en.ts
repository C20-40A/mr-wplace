// 英語翻訳辞書
export const enTranslations = {
  // Gallery
  gallery: "Gallery",
  back: "Back",
  close: "Close",

  // Buttons
  save: "Save",
  delete: "Delete",
  edit: "Edit",
  update: "Update",
  updated: "Updated",
  add: "Add",
  select: "Select",
  cancel: "Cancel",
  bookmarks: "bookmarks",
  bookmark: "Bookmark",
  save_location: "Save Location",
  draw: "Draw",
  draw_image: "Image",
  text_draw: "Text",
  text_clear: "Clear Text",
  timetravel: "Archive",
  export: "Export",
  import: "Import",

  // Messages
  loading: "Loading...",
  no_items: "No items",
  delete_confirm: "Are you sure you want to delete?",
  saved_message: "saved",
  deleted_message: "Deleted",

  // Bookmarks
  no_bookmarks: "No bookmarks",
  add_bookmark_instruction:
    'Click on the map and use the "Bookmark" button to add',
  location_unavailable: "Could not retrieve location information.",
  location_unavailable_instruction:
    "Could not retrieve location information. Please click on the map and then save.",
  enter_bookmark_name: "Please enter bookmark name:",
  location_point: "Point",
  bookmark_list: "Bookmark List",
  sort_by: "Sort by",
  sort_created: "Date Added",
  sort_accessed: "Last Accessed",
  sort_tag: "By Tag",

  // Import/Export関連
  no_export_bookmarks: "No favorites to export",
  bookmarks_exported: " favorites exported",
  file_input_not_found: "File input not found",
  no_file_selected: "No file selected",
  invalid_file_format: "Invalid file format",
  import_confirm:
    "Are you sure you want to import favorites?\nExisting data will be preserved.",
  import_cancelled: "Import cancelled",
  bookmarks_imported: " favorites imported",

  // Snapshots
  timetravel_modal_title: "Time Machine",
  timetravel_current_position: "Current Position Snapshots",
  timetravel_tile_list: "Tile List",
  timetravel_tile_snapshots: "Tile Snapshots",
  save_current_snapshot: "Save Current Snapshot",
  snapshot_detail: "Snapshot Detail",
  snapshot_share: "Snapshot Share",
  snapshot_timestamp: "Snapshot Timestamp",
  snapshot_share_description:
    "This filename contains coordinate and timestamp information. When you re-import it from the tile list, it will be registered as a snapshot at the same position and time.",
  return_to_current: "Return to Current",
  enter_snapshot_name: "Enter snapshot name (empty for timestamp):",
  enter_tile_name: "Enter tile name (empty for coordinates):",

  // Image Editor
  drag_drop_or_click: "Drag & drop or click to select image",
  clear_image: "Clear image",
  original_image: "Original image",
  current_image: "Current image",
  reset_edit: "Reset edit",
  reset_viewport: "Reset View",
  size_reduction: "Size reduction",
  brightness: "Brightness",
  contrast: "Contrast",
  saturation: "Saturation",
  dithering: "Dithering",
  include_paid_colors: "Include paid colors",
  add_to_gallery: "Add to gallery",
  download: "Download",
  clear_image_confirm: "Clear image and return to initial state?",
  saved_to_gallery: "Image saved to gallery",
  large_image_resize_confirm:
    "The image size is large and may cause slow processing.\nWould you like to resize the image?",
  current_size: "Current size",
  resize_to: "Resize to",
  resize_image: "Resize",
  edit_image: "Edit",
  add_to_gallery_directly: "Add directly to gallery",
  select_image: "Select image",
  click_image_to_draw: "Click on the image you want to draw on the map",
  no_draw_images: "No images for drawing.",
  no_saved_images: "No saved images",
  unplaced_images: "Unplaced Images",
  layers: "Layers",
  no_layers: "No layers",
  delete_image_confirm: "Do you want to delete this image?",

  // Drawing/Loading
  drawing_image: "Drawing image...",
  processing_image: "Processing image...",
  waiting_for_update: "Waiting for update...",

  // File related
  upload: "Upload",
  file_select: "Select File",
  image_editor: "Image Editor",
  image_detail: "Image Detail",

  // Drawing
  draw_enabled: "Draw ON",
  draw_disabled: "Draw OFF",
  draw_state: "Draw State",
  draw_this_tile: "Draw this tile",
  enabled: "Enabled",
  disabled: "Disabled",
  invalid_coordinates: "Invalid coordinates",
  coordinates_updated: "Coordinates updated",
  goto_map: "Go to Map",
  share: "Share",
  image_share: "Image Share",
  tile_coordinate: "Tile Coordinate",
  pixel_coordinate: "Pixel Coordinate",
  lat_lng: "Latitude/Longitude",
  coordinates: "Coordinates",
  share_description:
    "This image filename contains coordinate information. When you add the downloaded image to the gallery again, it will be automatically placed at the same position.",
  no_position_data: "No position data",
  download_success: "Download Success",
  error: "Error",
  deleted: "Deleted",

  // popup専用
  buy_me_coffee: "Buy me a coffee",

  // Color Filter
  color_filter: "Color Filter",
  enable_all: "Enable All",
  disable_all: "Disable All",
  free_colors_only: "Free Colors",
  owned_colors_only: "Owned Colors",
  enhanced: "Enhanced",

  // User Status (Notification Modal)
  user_status_details: "User Status Details",
  level_progress: "Level Progress",
  current_level: "Current Level",
  pixels_painted: "Pixels Painted",
  next_level: "Next Level",
  charge_status: "Charge Status",
  time_to_full: "Time to Full",
  full_charge_at: "Full Charge At",
  fully_charged: "⚡ FULLY CHARGED!",
  alarm_active: "⏰ Alarm Active",
  scheduled: "Scheduled",
  no_alarm_set: "😴 No Alarm Set",
  charge_alarm: "🔔 Charge Alarm",
  loading_alarm_settings: "Loading alarm settings...",
  notification_threshold: "Notification Threshold",
  estimated_time: "Estimated time",
  already_reached: "Already reached",
  enable_alarm: "Enable Alarm",
  disable_alarm: "Disable Alarm",
  add_to_calendar_title: "Google Calendar",
  wplace_charged_event: "WPlace Charged ⚡",

  // Theme Toggle
  theme_toggle: "Toggle Theme",
  theme_light: "Light Theme",
  theme_dark: "Dark Theme",
  theme_switched: "Theme switched",

  // Enhanced Draw Modes
  enhanced_mode_label: "Draw Mode",
  enhanced_mode_dot: "Dot",
  enhanced_mode_cross: "Cross",
  enhanced_mode_fill: "Fill",
  enhanced_mode_red_cross: "Red Cross",
  enhanced_mode_cyan_cross: "Cyan Cross",
  enhanced_mode_dark_cross: "Dark Cross",
  enhanced_mode_complement_cross: "Complement Cross",
  enhanced_mode_red_border: "Red Border",

  // Auto Spoit
  auto_spoit: "Auto Color Picker",
  auto_spoit_tooltip: "Auto color picker",
  auto_spoit_warning: `【Auto Color Picker - Important Notice】

This is a simple feature that just makes "repeatedly clicking the i button to pick colors" a bit easier.
However, please pay careful attention to the following:

⚠ Notice
• This is a developer verification feature
• This feature is not publicly available
• Use only for testing the color picker functionality
• To avoid misunderstanding, always paint at a natural speed and in a natural way
  (Paint from edges, paint easier areas first, etc. - paint like a human would)
• Too fast movements or unnatural painting patterns may cause pixel misalignment or misunderstanding
`,

  // Sort Order
  sort_order_default: "Default",
  sort_order_most_missing: "Most Missing",
  sort_order_least_remaining: "Almost Done",

  // Compute Device
  compute_device_label: "Processing",

  // Tile Merge
  tile_merge: "Tile Merge",
  merge_tiles: "Merge Tiles",
  export_png: "Export PNG",
  clear_selection: "Clear Selection",
  selected: "Selected",

  // Tile Statistics
  tile_statistics: "Tile Statistics",
  statistics: "Statistics",
  calculating: "Calculating",
  total_pixels: "Total Pixels",
  color_distribution: "Color Distribution",

  // Bookmark Tags
  existing_tags: "Existing Tags",
  new_tag: "Create New Tag",
  remove_tag: "Remove Tag",
  bookmark_name: "Bookmark Name",
  tag_name: "Tag Name",
  tag_color: "Tag Color",
  optional: "Optional",
  required: "Required",

  // Coordinate Jumper
  coordinate_jumper: "Coordinate Jumper",
  geographic_coordinates: "Geographic Coordinates",
  tile_coordinates: "Tile Coordinates",
  jump_to_coordinates: "Jump to Coordinates",

  // Location Search
  location_search: "Location Search",
  search_location: "Search Location",
  enter_place_name: "Enter place name",
  searching: "Searching...",
  no_results_found: "No results found",
  search_results: "Search Results",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Coordinate Input (Optional)",
  tile_x: "Tile X",
  tile_y: "Tile Y",
  pixel_x: "Pixel X",
  pixel_y: "Pixel Y",
  coordinate_input_hint: "If you enter coordinates, the image will be automatically placed at that position when added to the gallery",

  // Data Saver
  data_saver_on: "Data Saver ON",
  data_saver_off: "Data Saver OFF",
  data_saver_rendering_paused: "Rendering Paused",
};
