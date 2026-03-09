// German locale
export const deTranslations = {
  // Gallery
  gallery: "Galerie",
  back: "Zurück",
  close: "Schließen",

  // Buttons
  save: "Speichern",
  delete: "Löschen",
  edit: "Bearbeiten",
  update: "Aktualisieren",
  updated: "Aktualisiert",
  add: "Hinzufügen",
  select: "Auswählen",
  cancel: "Abbrechen",
  bookmarks: "Lesezeichen",
  bookmark: "Lesezeichen",
  save_location: "Ort speichern",
  draw: "Zeichnen",
  draw_image: "Bild",
  text_draw: "Text",
  text_clear: "Text löschen",
  timetravel: "Archiv",
  export: "Exportieren",
  import: "Importieren",

  // Gallery Export/Import
  gallery_data: "Galeriedaten",
  import_gallery: "Galerie importieren",
  export_gallery: "Galerie exportieren",
  reset_gallery: "Galerie zurücksetzen",
  exporting: "Wird exportiert...",
  importing: "Wird importiert...",
  resetting: "Wird zurückgesetzt...",
  export_success: "{count} Bilder exportiert",
  export_failed: "Export fehlgeschlagen",
  import_success: "{count} Bilder importiert",
  import_failed: "Import fehlgeschlagen",
  reset_failed: "Zurücksetzen fehlgeschlagen",
  gallery_reset_success: "Galerie wurde zurückgesetzt",
  no_images_to_export:
    "Keine Bilder zum Exportieren (Bilder mit Koordinaten sind erforderlich)",
  no_valid_images_in_zip: "Keine gültigen Bilder in der ZIP-Datei gefunden",
  confirm_import:
    "Möchtest du wirklich importieren? Neue Bilder werden deiner Galerie hinzugefügt.",
  confirm_reset:
    "Möchtest du wirklich alle Galeriebilder zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.",

  // Messages
  loading: "Wird geladen...",
  no_items: "Keine Einträge",
  delete_confirm: "Möchtest du wirklich löschen?",
  deleted_message: "Gelöscht",

  // Bookmarks
  no_bookmarks: "Keine Lesezeichen",
  add_bookmark_instruction:
    'Klicke auf die Karte und nutze die Schaltfläche "Lesezeichen", um hinzuzufügen',
  location_unavailable: "Standortinformationen konnten nicht abgerufen werden.",
  location_unavailable_instruction:
    "Standortinformationen konnten nicht abgerufen werden. Bitte klicke auf die Karte und speichere dann.",
  enter_bookmark_name: "Bitte Namen für das Lesezeichen eingeben:",
  location_point: "Punkt",
  bookmark_list: "Lesezeichenliste",
  sort_created: "Hinzugefügt am",
  sort_accessed: "Zuletzt verwendet",
  sort_tag: "Nach Tag",
  sort_distance: "Nach Entfernung",
  sort_last_updated: "Zuletzt gespeichert",
  sort_tile_count: "Nach Kachelanzahl",
  sort_name: "Nach Name",
  sort_layer: "Ebenenreihenfolge",

  // Import/Export関連
  import_export: "Import/Export",
  import_description: "Lesezeichen aus JSON-Datei importieren",
  export_all: "Alle exportieren",
  export_all_description: "Alle Lesezeichen exportieren",
  export_by_tag: "Nach Tag exportieren",
  export_by_tag_description:
    "Nur Lesezeichen mit ausgewählten Tags exportieren",
  export_selected_tags: "Ausgewählte Tags exportieren",
  no_tags_available: "Keine Tags verfügbar",
  no_name: "Kein Name",
  no_export_bookmarks: "Keine Favoriten zum Exportieren",
  bookmarks_exported: " Favoriten exportiert",
  file_input_not_found: "Dateieingabe nicht gefunden",
  no_file_selected: "Keine Datei ausgewählt",
  invalid_file_format: "Ungültiges Dateiformat",
  import_confirm:
    "Möchtest du wirklich Favoriten importieren?\nVorhandene Daten bleiben erhalten.",
  import_cancelled: "Import abgebrochen",
  bookmarks_imported: " Favoriten importiert",

  // Snapshots
  timetravel_modal_title: "Zeitmaschine",
  timetravel_current_position: "Archiv der aktuellen Position",
  timetravel_tile_list: "Kachelliste",
  timetravel_tile_snapshots: "Kachelarchive",
  save_current_snapshot: "Aktuelle Kachel speichern",
  snapshot_detail: "Kacheldetails",
  snapshot_share: "Kachel teilen",
  snapshot_timestamp: "Zeitstempel",
  snapshot_share_description:
    "Dieser Dateiname enthält Koordinaten- und Zeitstempelinformationen. Wenn du ihn aus der Kachelliste erneut importierst, wird er als Snapshot an derselben Position und Zeit registriert.",
  return_to_current: "Zur aktuellen Ansicht zurückkehren",
  enter_snapshot_name: "Snapshot-Namen eingeben (leer = Zeitstempel):",
  enter_tile_name: "Kachelnamen eingeben (leer = Koordinaten):",

  // Image Editor
  drag_drop_or_click: "Ziehen & ablegen oder klicken, um ein Bild auszuwählen",
  clear_image: "Bild löschen",
  original_image: "Originalbild",
  click_or_drop_to_change: "Klicken oder ablegen zum Ändern",
  current_image: "Aktuelles Bild",
  reset_edit: "Bearbeitung zurücksetzen",
  reset_viewport: "Ansicht zurücksetzen",
  size_reduction: "Größe",
  brightness: "Helligkeit",
  contrast: "Kontrast",
  saturation: "Sättigung",
  sharpness: "Schärfe",
  dithering: "Dithering",
  quantization_method: "Quantisierungsmethode",
  quantization_rgb_euclidean: "RGB-Abstand (Schnell, Standard)",
  quantization_weighted_rgb: "Gewichtetes RGB (Mittel, Natürlich)",
  quantization_lab: "Lab-Farbraum (Langsam, Hohe Qualität)",
  include_paid_colors: "Kostenpflichtige Farben einschließen",
  transparent_color: "Transparente Farbe",
  transparency_tool: "Transparenzwerkzeug",
  transparency_flood_fill: "Grenz-Flutfüllung",
  transparency_flood_fill_desc:
    "Klicke auf einen Punkt, um den verbundenen Bereich mit gleicher Farbe transparent zu machen. Mit der Grenzanpassung kannst du den Bereich erweitern oder verkleinern.",
  transparency_threshold: "Grenzanpassung",
  transparency_apply: "Anwenden",
  transparency_reset: "Zurücksetzen",
  transparency_no_image:
    "Lade zuerst ein Bild, um das Transparenzwerkzeug zu nutzen",
  add_to_gallery: "Zur Galerie hinzufügen",
  download: "Herunterladen",
  clear_image_confirm: "Bild löschen und in den Ausgangszustand zurückkehren?",
  saved_to_gallery: "Bild in der Galerie gespeichert",
  large_image_resize_confirm:
    "Die Bildgröße ist groß und kann die Verarbeitung verlangsamen.\nMöchtest du das Bild skalieren?",
  current_size: "Aktuelle Größe",
  resize_to: "Skalieren auf",
  resize_image: "Größe ändern",
  edit_image: "Bild bearbeiten",
  edit_image_mode: "Bildbearbeitung",
  add_to_gallery_directly: "Direkt zur Galerie hinzufügen",
  select_image: "Bild auswählen",
  click_image_to_draw:
    "Klicke auf das Bild, das du auf der Karte zeichnen möchtest",
  click_to_draw: "Klicken zum Zeichnen",
  no_draw_images: "Keine Bilder zum Zeichnen.",
  no_saved_images: "Keine gespeicherten Bilder",
  empty_gallery_message:
    "Um ein Bild auf der Karte anzuzeigen, füge zuerst ein Bild hinzu",
  add_first_image: "Erstes Bild hinzufügen",
  unplaced_images: "Nicht platzierte Bilder",
  layers: "Ebenen",
  no_layers: "Keine Ebenen",
  delete_image_confirm: "Möchtest du dieses Bild löschen?",

  // Drawing/Loading
  drawing_image: "Bild wird gezeichnet...",
  processing_image: "Bild wird verarbeitet...",
  waiting_for_update: "Warte auf Aktualisierung...",

  // File related
  upload: "Hochladen",
  file_select: "Datei auswählen",
  image_editor: "Bildeditor",
  add_image: "Bild hinzufügen",
  image_detail: "Bilddetails",
  title: "Titel",
  edit_image_title: "Bildtitel bearbeiten",
  image_title_placeholder: "Bildname (optional)",
  title_updated: "Titel aktualisiert",

  // Drawing
  draw_enabled: "Zeichnen EIN",
  draw_disabled: "Zeichnen AUS",
  draw_state: "Zeichenstatus",
  draw_this_tile: "Diese Kachel zeichnen",
  enabled: "Aktiviert",
  disabled: "Deaktiviert",
  invalid_coordinates: "Ungültige Koordinaten",
  coordinates_updated: "Koordinaten aktualisiert",
  goto_map: "Zur Karte",
  share: "Herunterladen",
  image_share: "Bild teilen",
  tile_coordinate: "Kachelkoordinate",
  pixel_coordinate: "Pixelkoordinate",
  lat_lng: "Breitengrad/Längengrad",
  coordinates: "Koordinaten",
  share_description:
    "Dieser Bilddateiname enthält Koordinateninformationen. Wenn du das heruntergeladene Bild erneut zur Galerie hinzufügst, wird es automatisch an derselben Position platziert.",
  no_position_data: "Keine Positionsdaten",
  download_success: "Download erfolgreich",
  error: "Fehler",
  deleted: "Gelöscht",

  // popup専用
  buy_me_coffee: "Spendier mir einen Kaffee",
  popup_language: "Sprache",
  popup_navigation: "Navigation",
  popup_navigation_map_jump: "Kartensprung",
  popup_navigation_url_jump: "URL-Sprung",
  popup_lock_button: "Großer Sperrbutton (für Mobilgeräte)",
  popup_close_confirm: "Bestätigung beim Schließen des Paint-Modals",
  popup_paint_mode_style: "Schaltflächen im Zeichenmodus ausblenden",
  popup_overlay_mode: "Overlay",
  popup_overlay_mode_composite: "Komposit",
  popup_overlay_mode_composite_lite: "Komposit + Minimal",
  popup_overlay_mode_layer: "Unabhängig",
  popup_bug_report: "Fehler melden",
  popup_fab_visibility: "Schaltflächen-Sichtbarkeit",
  popup_fab_gallery: "Galerie",
  popup_fab_bookmark: "Lesezeichen",
  popup_fab_time_travel: "Zeitreise",
  popup_fab_color_filter: "Farbfilter",
  popup_fab_data_saver: "Datensparer",
  popup_fab_map_filter: "Kartenfilter",

  // Color Filter
  color_filter: "Farbfilter",
  enable_all: "Alle aktivieren",
  disable_all: "Alle deaktivieren",
  free_colors_only: "Nur kostenlose Farben",
  owned_colors_only: "Nur eigene Farben",
  disable_unused_colors: "Ungenutzte deaktivieren",
  enhanced: "Erweitert",
  show_selected_color_only: "Nur ausgewählte Farbe anzeigen",

  // User Status (Notification Modal)
  user_status_details: "Benutzerstatus-Details",
  level_progress: "Level-Fortschritt",
  current_level: "Aktuelles Level",
  pixels_painted: "Gemalte Pixel",
  next_level: "Nächstes Level",
  charge_status: "Ladestatus",
  time_to_full: "Zeit bis voll",
  full_charge_at: "Voll aufgeladen um",
  fully_charged: "⚡ VOLL AUFGELADEN!",
  alarm_active: "⏰ Alarm aktiv",
  scheduled: "Geplant",
  no_alarm_set: "😴 Kein Alarm gesetzt",
  charge_alarm: "🔔 Ladealarm",
  alarm_browser_warning:
    "※ Benachrichtigungen funktionieren nicht, wenn der Browser geschlossen ist",
  loading_alarm_settings: "Alarmeinstellungen werden geladen...",
  notification_threshold: "Benachrichtigungsschwelle",
  estimated_time: "Geschätzte Zeit",
  already_reached: "Bereits erreicht",
  enable_alarm: "Alarm aktivieren",
  disable_alarm: "Alarm deaktivieren",
  add_to_calendar_title: "Google Kalender",
  wplace_charged_event: "WPlace aufgeladen ⚡",

  // Theme Toggle
  theme_toggle: "Theme wechseln",
  theme_light: "Helles Theme",
  theme_dark: "Dunkles Theme",
  theme_switched: "Theme gewechselt",

  // Enhanced Draw Modes
  enhanced_mode_label: "Zeichnen",
  enhanced_mode_dot: "Punkt",
  enhanced_mode_cross: "Kreuz",
  enhanced_mode_fill: "Füllen",
  enhanced_mode_red_cross: "Farbiges Kreuz",
  enhanced_mode_border_only: "Nur Rand",
  enhanced_mode_dark_cross: "Dunkles Kreuz",
  enhanced_mode_complement_cross: "Komplementär-Kreuz",
  enhanced_mode_red_border: "Farbiger Rand",
  enhanced_mode_huge_red_cross: "Großes farbiges Kreuz",
  enhanced_mode_huge_red_cross_bold: "Großes farbiges Kreuz (Fett)",
  enhanced_mode_huge_red_diamond: "Große farbige Raute",
  enhanced_mode_huge_red_ring: "Großer farbiger Ring",
  marker_color: "Markerfarbe",

  // Auto Spoit
  auto_spoit: "Automatische Farbauswahl",
  auto_spoit_tooltip: "Automatische Farbauswahl",

  auto_dotter_warning: `
• Dies ist eine experimentelle Funktion, die "beim Überfahren roter Bereiche automatisch die Leertaste drückt"
• Dies ist eine Entwickler-Testfunktion
• Nur zu Testzwecken verwenden
• Zu schnelles oder unnatürliches Zeichnen kann als BOT-Verhalten missverstanden werden
• Nutzung auf eigenes Risiko
`,
  developer_warning_splash_title: "Warnung zur Entwicklerfunktion",
  developer_warning_splash_body: `Diese Funktion ist nur für Entwicklertests vorgesehen.
Sie ist nicht für den normalen Einsatz geeignet.

Die Verwendung dieser Funktion zum Zeichnen von Pixeln kann gegen die Nutzungsbedingungen verstoßen.
Verwende diese Funktion nicht zum Zeichnen echter Pixel.`,
  developer_warning_splash_ok: "OK",
  developer_warning_splash_close: "Schließen",

  // Sort Order
  sort_order_default: "Standard",
  sort_order_most_missing: "Meiste fehlen",
  sort_order_least_remaining: "Fast fertig",

  // Compute Device
  compute_device_label: "Template-Rendering-Verarbeitung",

  // Show Unplaced Only
  show_unplaced_only: "Gefüllt",
  show_unplaced_color: "Farbe",

  // Tile Merge
  tile_merge: "Kacheln zusammenführen",
  merge_tiles: "Kacheln zusammenführen",
  export_png: "PNG exportieren",
  clear_selection: "Auswahl löschen",
  selected: "Ausgewählt",

  // Tile Statistics
  tile_statistics: "Kachelstatistik",
  statistics: "Statistik",
  calculating: "Wird berechnet",
  total_pixels: "Gesamtpixel",
  color_distribution: "Farbverteilung",

  // Bookmark Tags
  existing_tags: "Vorhandene Tags",
  remove_tag: "Tag entfernen",
  bookmark_name: "Lesezeichenname",
  tag_name: "Tag-Name",
  tag_color: "Tag-Farbe",
  optional: "Optional",
  required: "Erforderlich",
  edit_tag: "Tag bearbeiten",
  tag_edit_title: "Tag bearbeiten",
  tag_edit_description: "Alle Lesezeichen mit diesem Tag werden aktualisiert",
  tag_delete_confirm:
    "Diesen Tag löschen? Der Tag wird aus allen Lesezeichen entfernt, die ihn verwenden.",

  // Coordinate Jumper
  coordinate_jumper: "Koordinatensprung",
  geographic_coordinates: "Geografische Koordinaten",
  tile_coordinates: "Kachelkoordinaten",
  jump_to_coordinates: "Zu Koordinaten springen",

  // Location Search
  location_search: "Ortssuche",
  search_location: "Ort suchen",
  enter_place_name: "Ortsnamen eingeben",
  searching: "Suche läuft...",
  no_results_found: "Keine Ergebnisse gefunden",
  search_results: "Suchergebnisse",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Koordinateneingabe (optional)",
  tile_x: "Kachel X",
  tile_y: "Kachel Y",
  pixel_x: "Pixel X",
  pixel_y: "Pixel Y",
  coordinate_input_hint:
    "Wenn du Koordinaten eingibst, wird das Bild beim Hinzufügen zur Galerie automatisch an dieser Position platziert",

  // Data Saver
  data_saver: "Datensparer",
  data_saver_on: "Datensparer EIN",
  data_saver_off: "Datensparer AUS",
  data_saver_rendering_paused: "Offline-Cache aktiv",
  storage_usage: "Speichernutzung",
  cache_usage: "Cache-Nutzung",
  offline_cache_settings: "Offline-Cache-Einstellungen",
  maximum_cache_size: "Maximale Cache-Größe",
  clear_all_cache: "Gesamten Cache leeren",
  clearing: "Wird geleert...",
  cache_cleared: "Cache geleert!",
  tiles: "Kacheln",

  // Close Confirm
  confirm_close_paint_modal:
    "Deine aktuelle Arbeit kann verloren gehen. Möchtest du wirklich schließen?",

  // Friends Book
  friends_book: "Freunde",
  add_to_friends: "Zu Freunden hinzufügen",
  add_friend: "Freund hinzufügen",
  edit_friend: "Freund bearbeiten",
  user_id: "Benutzer-ID",
  user_id_placeholder: "z. B. 12345",
  user_name: "Benutzername",
  user_name_placeholder: "z. B. SpielerName",
  please_enter_id_and_name: "Bitte ID und Namen eingeben",
  description: "Beschreibung",
  description_placeholder: "Beschreibung eingeben...",
  tag: "Tag",
  tags: "Tags",
  new_tag: "Neuer Tag",
  create_new_tag: "Neuen Tag erstellen",
  clear_tag: "Tag löschen",
  tag_name_placeholder: "z. B. Freund, Rivale...",
  select_color: "Farbe auswählen",
  create: "Erstellen",
  no_friends: "Keine Freunde",
  sort_added: "Hinzugefügt am",
  sort_id: "ID",
  import_merge_confirm:
    " Freunde importieren?\nWird mit vorhandenen Daten zusammengeführt (gleiche ID wird überschrieben).",
  import_merge_description: "Vorhandene Daten bleiben erhalten.",
  import_friends_description: "Spielerliste aus CSV-Datei importieren",
  export_all_friends_description: "Alle Freunde als CSV-Datei exportieren",
  export_friends_by_tag_description:
    "Nur Freunde mit ausgewählten Tags als CSV exportieren",
  online_sync: "Online-Import",
  online_sync_description:
    "Freundesliste aus CSV-URL importieren (z. B. veröffentlichte Google-Sheets-URL)",
  sync_merge: "Zusammenführen und importieren",
  sync_replace: "Ersetzen und importieren",
  please_enter_sync_url: "Bitte Import-URL eingeben",
  sync_failed: "Import fehlgeschlagen",
  sync_replace_confirm:
    "Möchtest du wirklich alle Freunde ersetzen?\nAlle vorhandenen Freunde werden gelöscht und durch Daten aus der URL ersetzt.",
  open_url: "URL öffnen",

  // Tutorial
  tutorial_title: "Tutorial",
  tutorial_how_to_draw_title: "So zeichnest du Bilder auf der Karte",
  tutorial_how_to_draw_step1: "Speichere ein Bild in der Galerie",
  tutorial_how_to_draw_step2:
    "Klicke auf die Karte und wähle die Schaltfläche 'Bild'",
  tutorial_how_to_draw_step3:
    "Klicke auf das Bild, das du platzieren möchtest; es erscheint als Overlay auf der Kartenkachel",
  tutorial_how_to_archive_title: "So archivierst du Pixelkunst auf der Karte",
  tutorial_how_to_archive_step1: "Klicke auf die Karte und wähle 'Archiv'",
  tutorial_how_to_archive_step2:
    "Klicke auf die Schaltfläche 'Aktuelle Kachel speichern'",
  tutorial_how_to_draw_archive_title: "So zeichnest du archivierte Pixelkunst",
  tutorial_how_to_draw_archive_step1: "Klicke auf die Karte und wähle 'Archiv'",
  tutorial_how_to_draw_archive_step2:
    "Klicke auf das Archiv, das du anzeigen möchtest",
  tutorial_how_to_draw_archive_step3: "Klicke auf die Zeichnen-Schaltfläche",
  tutorial_how_to_draw_text_title: "So zeigst du Text auf der Karte an",
  tutorial_how_to_draw_text_step1: "Klicke auf die Karte und wähle 'Text'",
  tutorial_how_to_draw_text_step2:
    "Gib Text ein, wähle eine Schriftart und klicke auf die Schaltfläche 'Zeichnen'",
  tutorial_how_to_draw_text_step3:
    "Optional: Passe die Position mit den Pfeiltasten an",
  tutorial_how_to_bookmark_title:
    "So fügst du Lesezeichen hinzu und navigierst",
  tutorial_how_to_bookmark_step1:
    "Klicke auf die Karte und wähle das ⭐-Symbol",
  tutorial_how_to_bookmark_step2:
    "Gib einen Lesezeichennamen ein und speichere",
  tutorial_how_to_bookmark_step3:
    "Klicke unten links auf die ⭐-Schaltfläche und wähle ein Lesezeichen zur Navigation",

  // Empty states
  empty_archive_message:
    "Noch keine archivierten Kacheln. Klicke auf die Karte, um mit dem Archivieren zu beginnen!",
  empty_bookmark_message:
    "Noch keine Lesezeichen. Klicke auf die Karte und wähle das ⭐-Symbol, um deine Lieblingsorte zu speichern!",

  // Map Filter Menu
  map_filter_darkTheme: "Dunkles Theme",
  map_filter_highContrast: "Hoher Kontrast",
  map_filter_tileBoundaries: "Kachelgrenzen",
  map_filter_gridDisplay: "Pixelraster",
  map_filter_scaleDisplay: "Entfernungsmessung",
  map_filter_areaMeasure: "Flächenanzeige",
  map_filter_area_manager_title: "Flächenmanager",
  map_filter_area_mode: "Modus",
  map_filter_area_mode_display: "Anzeige",
  map_filter_area_mode_editing: "Bearbeiten",
  map_filter_area_editing: "Bearbeiten",
  map_filter_area_start_new: "Neue Bearbeitung starten",
  map_filter_area_stop_editing: "Bearbeitung beenden",
  map_filter_area_save_new: "Als neu speichern",
  map_filter_area_save_update: "Aktualisierung speichern",
  map_filter_area_saved_regions: "Gespeicherte Flächen",
  map_filter_area_empty: "Keine gespeicherten Flächen",
  map_filter_area_points: "Punkte",
  map_filter_area_show: "Anzeigen",
  map_filter_area_hide: "Ausblenden",
  map_filter_area_rename: "Umbenennen",
  map_filter_area_delete_confirm: "Diese gespeicherte Fläche löschen?",
  map_filter_area_name_placeholder: "Flächenname",
  map_filter_area_default_name: "Fläche",
  map_filter_area_new_region: "Neue Fläche",
  map_filter_area_need_polygon: "Kein bearbeitbares Polygon gefunden",
  map_filter_area_add: "Fläche hinzufügen",
  map_filter_area_save_map: "Fläche speichern",
  map_filter_area_color: "Farbe",
  map_filter_area_online_sync_description:
    "Flächendaten aus GeoJSON/JSON-URL importieren (z. B. öffentliche Cloud-Speicher-URL)",
  map_filter_area_import_description:
    "Flächen aus einer GeoJSON- oder JSON-Datei importieren",
  map_filter_area_import_file: "Aus Flächendatei importieren",
  map_filter_area_export_all_description:
    "Alle gespeicherten Flächen als GeoJSON exportieren",
  map_filter_area_export_selected: "Ausgewählte Flächen exportieren",
  map_filter_area_export_selected_description:
    "Nur markierte Flächen als GeoJSON exportieren",
  map_filter_area_export_selected_button: "Ausgewählte Flächen exportieren",
  map_filter_area_no_regions_available: "Keine Flächen verfügbar",
  map_filter_area_no_export_regions: "Keine Flächen zum Exportieren",
  map_filter_area_no_importable_regions:
    "Keine importierbaren Flächen gefunden",
  map_filter_area_sync_replace_confirm:
    "Alle gespeicherten Flächen durch URL-Daten ersetzen?\nAktuelle Flächen werden überschrieben.",
  map_filter_backgroundColor: "Hintergrundfarbe",
  map_filter_map3d: "3D-Ansicht",
  map_filter_map3d_drag_rotate: "Drehung aktivieren",
  map_filter_mapSky: "Himmel & Nebel",
  draw_on_map: "Auf Karte zeichnen",
  outline_preserve: "Kontur beibehalten",
  outline_width: "Konturstärke",
  outline_sensitivity: "Empfindlichkeit",
  outline_use_fixed_color: "Feste Linienfarbe verwenden",
  outline_color: "Linienfarbe",
  hint_title: "Hinweis",
  hint_close: "Hinweis schließen",
  hint_show_unplaced_only:
    "Diese Funktion macht bereits platzierte Farben weniger auffällig.",
  hint_color_isolate:
    "Nur ausgewählte Farbe anzeigen hebt nur die aktuell ausgewählte Farbe hervor, damit du dich beim Zeichnen besser konzentrieren kannst.",
  hint_data_saver:
    "Datensparer reduziert die Netzwerknutzung durch Wiederverwendung von Bilddaten. Bei Aktivierung werden Pixelkunst-Updates pausiert.",
  hint_palette_toggle: "Hier drücken, um den Farbfilter zu öffnen.",
  hint_gallery_btn: "Hier kannst du Bilder zum Zeichnen registrieren.",
  hint_user_status_container:
    "Hier drücken, um den Alarm einzustellen, wenn sich Paint aufgeladen hat",
  hint_drawing_btn: "Hier kannst du Bilder auf der Karte zeichnen.",
  hint_unplaced_grid: "Drücke ein Bild, um es auf der Karte zu zeichnen.",
  hint_bookmark_btn: "Du kannst diesen Ort als Lesezeichen speichern",
  hint_timetravel_btn: "Du kannst Kunst in der Nähe dieses Ortes speichern",
  hint_text_draw_btn: "Du kannst Text auf der Karte anzeigen",
  hint_bookmarks_btn: "Hier sind deine gespeicherten Lesezeichen",
  hint_timetravel_fab_btn: "Hier ist die Liste archivierter Bereiche",
  import_snapshot_tile_x_label: "Kachelkoordinate X",
  import_snapshot_tile_y_label: "Kachelkoordinate Y",
  import_snapshot_tile_x_placeholder: "z. B. 520",
  import_snapshot_tile_y_placeholder: "z. B. 218",
  import_snapshot_datetime_label: "Datum/Uhrzeit",
  import_snapshot_success: "Import abgeschlossen",
  hint_map_filter_trigger: "Hier kannst du ändern, wie die Karte aussieht",
  hint_edit_card: "Hier kannst du den Namen ändern und Tags hinzufügen",
  hint_image_detail_draw_on_map:
    "Hier drücken, um das Bild im aktuellen Kartenzentrum zu platzieren",
  hint_image_detail_dpad: "Hier kannst du das Bild verschieben",
  hint_image_detail_download:
    "Zum Teilen mit anderen kannst du das Bild hier herunterladen. Der Dateiname enthält die Koordinaten, sodass das Bild beim Laden an derselben Position platziert wird",
  tutorial_reset_hints_button: "Hinweise erneut anzeigen",
  hint_image_detail_edit_title:
    "Klicke auf den Bildtitel, um ihn zu bearbeiten",
  popup_close_button_big: "Schließen-Schaltfläche vergrößern",
  selected_color_only_mark: "Nur ausgewählte Farbe markieren",
  tmp_tile_board_data_notice:
    "Zeigt nur bereits empfangene Kacheldaten. Zur Reduzierung der Serverlast werden keine neuen Anfragen gesendet.",
  all_short: "ALLE",
  popup_overlay_mode_composite_detail: "Wenige Funktionen, hohe Leistung",
  popup_overlay_mode_composite_lite_detail:
    "Minimal und leichtester (transparent + Punkt, ohne Vergleich/Statistik)",
  popup_overlay_mode_layer_detail: "Erweiterte Funktionen, schnelle Anzeige",
  adjust_tool: "Anpassungswerkzeug",
  adjust_tool_confirm: "Bestätigen",
  adjust_tool_cancel_confirm:
    "Anpassungswerkzeug beenden? Änderungen werden nicht angewendet.",
  quantization_oklab: "OKLab-Farbraum (Langsam, gleichmaessiger)",
  color_flatten: "Farbflaechung",
  color_flatten_none: "Flat: Aus",
  color_flatten_light: "Flat: Leicht",
  color_flatten_medium: "Flat: Mittel",
  open_tmp_tile_board: "Umgebung herunterladen",
  hint_overlay_mode_performance:
    "Falls das Rendern langsam ist, probiere einen anderen Modus",
};
