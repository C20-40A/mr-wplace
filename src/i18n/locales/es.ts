// スペイン語翻訳辞書
export const esTranslations = {
  // Gallery
  gallery: "Galería",
  back: "Atrás",
  close: "Cerrar",

  // Buttons
  save: "Guardar",
  delete: "Eliminar",
  edit: "Editar",
  update: "Actualizar",
  updated: "Actualizado",
  add: "Añadir",
  select: "Seleccionar",
  cancel: "Cancelar",
  bookmarks: "favoritos",
  bookmark: "Favorito",
  save_location: "Guardar Ubicación",
  draw: "Dibujar",
  draw_image: "Imagen",
  text_draw: "Texto",
  text_clear: "Borrar Texto",
  timetravel: "Archivo",
  export: "Exportar",
  import: "Importar",

  // Gallery Export/Import
  gallery_data: "Datos de Galería",
  import_gallery: "Importar Galería",
  export_gallery: "Exportar Galería",
  reset_gallery: "Restablecer Galería",
  exporting: "Exportando...",
  importing: "Importando...",
  resetting: "Restableciendo...",
  export_success: "{count} imágenes exportadas",
  export_failed: "Error al exportar",
  import_success: "{count} imágenes importadas",
  import_failed: "Error al importar",
  reset_failed: "Error al restablecer",
  gallery_reset_success: "La galería ha sido restablecida",
  no_images_to_export:
    "No hay imágenes para exportar (se requieren imágenes con coordenadas)",
  no_valid_images_in_zip:
    "No se encontraron imágenes válidas en el archivo ZIP",
  confirm_import:
    "¿Estás seguro de que quieres importar? Se agregarán nuevas imágenes a tu galería.",
  confirm_reset:
    "¿Estás seguro de que quieres restablecer todas las imágenes de la galería? Esta acción no se puede deshacer.",

  // Messages
  loading: "Cargando...",
  no_items: "Sin elementos",
  delete_confirm: "¿Estás seguro de que quieres eliminar?",
  deleted_message: "Eliminado",

  // Bookmarks
  no_bookmarks: "Sin favoritos",
  add_bookmark_instruction:
    'Haz clic en el mapa y usa el botón "Favorito" para añadir',
  location_unavailable: "No se pudo obtener la información de ubicación.",
  location_unavailable_instruction:
    "No se pudo obtener la información de ubicación. Por favor, haz clic en el mapa y luego guarda.",
  enter_bookmark_name: "Por favor, introduce el nombre del favorito:",
  location_point: "Punto",
  bookmark_list: "Lista de Favoritos",
  sort_created: "Fecha de Adición",
  sort_accessed: "Último Acceso",
  sort_tag: "Por Etiqueta",
  sort_distance: "Por Distancia",
  sort_last_updated: "Guardados Recientemente",
  sort_tile_count: "Por Cantidad de Bloques",
  sort_name: "Por Nombre",
  sort_layer: "Orden de Capa",

  // Import/Export
  import_export: "Importar/Exportar",
  import_description: "Importar favoritos desde archivo JSON",
  export_all: "Exportar Todo",
  export_all_description: "Exportar todos los favoritos",
  export_by_tag: "Exportar por Etiqueta",
  export_by_tag_description:
    "Exportar solo favoritos con etiquetas seleccionadas",
  export_selected_tags: "Exportar Etiquetas Seleccionadas",
  no_tags_available: "No hay etiquetas disponibles",
  no_name: "Sin nombre",
  no_export_bookmarks: "Sin favoritos para exportar",
  bookmarks_exported: " favoritos exportados",
  file_input_not_found: "Entrada de archivo no encontrada",
  no_file_selected: "Ningún archivo seleccionado",
  invalid_file_format: "Formato de archivo inválido",
  import_confirm:
    "¿Estás seguro de que quieres importar favoritos?\nLos datos existentes se conservarán.",
  import_cancelled: "Importación cancelada",
  bookmarks_imported: " favoritos importados",

  // Snapshots
  timetravel_modal_title: "Máquina del Tiempo",
  timetravel_current_position: "Instantáneas de Posición Actual",
  timetravel_tile_list: "Lista de Azulejos",
  timetravel_tile_snapshots: "Instantáneas de Azulejos",
  save_current_snapshot: "Guardar Instantánea Actual",
  snapshot_detail: "Detalle de Instantánea",
  snapshot_share: "Compartir Instantánea",
  snapshot_timestamp: "Marca de Tiempo de Instantánea",
  snapshot_share_description:
    "Este nombre de archivo contiene información de coordenadas y marca de tiempo. Cuando lo reimportes desde la lista de bloques, se registrará como una instantánea en la misma posición y hora.",
  return_to_current: "Volver a Actual",
  enter_snapshot_name:
    "Introduce el nombre de la instantánea (vacío para marca de tiempo):",
  enter_tile_name: "Introduce el nombre del azulejo (vacío para coordenadas):",

  // Image Editor
  drag_drop_or_click: "Arrastra y suelta o haz clic para seleccionar imagen",
  clear_image: "Limpiar imagen",
  original_image: "Imagen original",
  click_or_drop_to_change: "Haz clic o suelta para cambiar",
  current_image: "Imagen actual",
  reset_edit: "Restablecer edición",
  reset_viewport: "Restablecer Vista",
  size_reduction: "Tamaño",
  brightness: "Brillo",
  contrast: "Contraste",
  saturation: "Saturación",
  sharpness: "Nitidez",
  dithering: "Tramado",
  quantization_method: "Método de Cuantización",
  quantization_rgb_euclidean: "Distancia RGB (Rápido, Predeterminado)",
  quantization_weighted_rgb: "RGB Ponderado (Medio, Natural)",
  quantization_lab: "Espacio de Color Lab (Lento, Alta Calidad)",
  include_paid_colors: "Incluir colores de pago",
  transparent_color: "Color transparente",
  add_to_gallery: "Añadir a galería",
  download: "Descargar",
  clear_image_confirm: "¿Limpiar imagen y volver al estado inicial?",
  saved_to_gallery: "Imagen guardada en galería",
  large_image_resize_confirm:
    "El tamaño de la imagen es grande y puede causar procesamiento lento.\n¿Te gustaría cambiar el tamaño de la imagen?",
  current_size: "Tamaño actual",
  resize_to: "Cambiar tamaño a",
  resize_image: "Cambiar tamaño",
  edit_image: "Editar",
  edit_image_mode: "Editar Imagen",
  add_to_gallery_directly: "Añadir directamente a galería",
  select_image: "Seleccionar imagen",
  click_image_to_draw: "Haz clic en la imagen que quieres dibujar en el mapa",
  click_to_draw: "Clic para dibujar",
  no_draw_images: "Sin imágenes para dibujar.",
  no_saved_images: "Sin imágenes guardadas",
  empty_gallery_message:
    "Para mostrar una imagen en el mapa, primero agregue una imagen",
  add_first_image: "Agregar Primera Imagen",
  unplaced_images: "Imágenes Sin Colocar",
  layers: "Capas",
  no_layers: "Sin capas",
  delete_image_confirm: "¿Quieres eliminar esta imagen?",

  // Drawing/Loading
  drawing_image: "Dibujando imagen...",
  processing_image: "Procesando imagen...",
  waiting_for_update: "Esperando actualización...",

  // File related
  upload: "Subir",
  file_select: "Seleccionar Archivo",
  image_editor: "Editor de Imágenes",
  add_image: "Agregar Imagen",
  image_detail: "Detalle de Imagen",
  title: "Título",
  edit_image_title: "Editar Título de Imagen",
  image_title_placeholder: "Nombre de la imagen (opcional)",
  title_updated: "Título actualizado",

  // Drawing
  draw_enabled: "Dibujo ON",
  draw_disabled: "Dibujo OFF",
  draw_state: "Estado de Dibujo",
  draw_this_tile: "Dibujar este tile",
  enabled: "Habilitado",
  disabled: "Deshabilitado",
  invalid_coordinates: "Coordenadas inválidas",
  coordinates_updated: "Coordenadas actualizadas",
  goto_map: "Ir al Mapa",
  share: "Descargar",
  image_share: "Compartir Imagen",
  tile_coordinate: "Coordenada de Azulejo",
  pixel_coordinate: "Coordenada de Píxel",
  lat_lng: "Latitud/Longitud",
  coordinates: "Coordenadas",
  share_description:
    "Este nombre de archivo de imagen contiene información de coordenadas. Cuando agregues la imagen descargada a la galería nuevamente, se colocará automáticamente en la misma posición.",
  no_position_data: "Sin datos de posición",
  download_success: "Descarga Exitosa",
  error: "Error",
  deleted: "Eliminado",

  // popup専用
  buy_me_coffee: "Cómprame un café",
  popup_language: "Idioma",
  popup_navigation: "Navegación",
  popup_navigation_map_jump: "Salto en Mapa",
  popup_navigation_url_jump: "Salto por URL",
  popup_lock_button: "Botón de Bloqueo Grande (Móvil)",
  popup_close_confirm: "Confirmar al Cerrar Panel de Pintura",
  popup_paint_mode_style: "Ocultar Botones en Modo Pintura",
  popup_bug_report: "Reportar Error",
  popup_fab_visibility: "Visibilidad de Botones",
  popup_fab_gallery: "Galería",
  popup_fab_bookmark: "Marcadores",
  popup_fab_time_travel: "Viaje en el Tiempo",
  popup_fab_color_filter: "Filtro de Color",
  popup_fab_data_saver: "Ahorro de Datos",
  popup_fab_map_filter: "Filtro de Mapa",

  // Color Filter
  color_filter: "Filtro de Color",
  enable_all: "Activar Todos",
  disable_all: "Desactivar Todos",
  free_colors_only: "Solo Colores Gratis",
  owned_colors_only: "Solo Colores Poseídos",
  disable_unused_colors: "Desactivar no usados",
  enhanced: "Mejorado",
  show_selected_color_only: "Mostrar Solo Color Seleccionado",

  // User Status (Notification Modal)
  user_status_details: "Detalles del Estado del Usuario",
  level_progress: "Progreso de Nivel",
  current_level: "Nivel Actual",
  pixels_painted: "Píxeles Pintados",
  next_level: "Siguiente Nivel",
  charge_status: "Estado de Carga",
  time_to_full: "Tiempo hasta Carga Completa",
  full_charge_at: "Carga Completa A",
  fully_charged: "⚡ ¡COMPLETAMENTE CARGADO!",
  alarm_active: "⏰ Alarma Activa",
  scheduled: "Programado",
  no_alarm_set: "😴 Sin Alarma Configurada",
  charge_alarm: "🔔 Alarma de Carga",
  alarm_browser_warning: "※ No se notificará si se cierra el navegador",
  loading_alarm_settings: "Cargando configuración de alarma...",
  notification_threshold: "Umbral de Notificación",
  estimated_time: "Tiempo estimado",
  already_reached: "Ya alcanzado",
  enable_alarm: "Activar Alarma",
  disable_alarm: "Desactivar Alarma",
  add_to_calendar_title: "Google Calendar",
  wplace_charged_event: "WPlace Cargado ⚡",

  // Theme Toggle
  theme_toggle: "Cambiar Tema",
  theme_light: "Tema Claro",
  theme_dark: "Tema Oscuro",
  theme_switched: "Tema cambiado",

  // Enhanced Draw Modes
  enhanced_mode_label: "Dibujo",
  enhanced_mode_dot: "Punto",
  enhanced_mode_cross: "Cruz",
  enhanced_mode_fill: "Rellenar",
  enhanced_mode_red_cross: "Cruz de Color",
  enhanced_mode_border_only: "Solo Borde",
  enhanced_mode_dark_cross: "Cruz Oscura",
  enhanced_mode_complement_cross: "Cruz Complementaria",
  enhanced_mode_red_border: "Borde de Color",
  enhanced_mode_huge_red_cross: "Gran Cruz de Color",
  enhanced_mode_huge_red_cross_bold: "Gran Cruz de Color (Negrita)",
  enhanced_mode_huge_red_diamond: "Gran Diamante de Color",
  enhanced_mode_huge_red_ring: "Gran Anillo de Color",
  marker_color: "Color del Marcador",

  // Auto Spoit
  auto_spoit: "Selector de Color Automático",
  auto_spoit_tooltip: "Selector de color automático",

  auto_dotter_warning: `
• Esta es una función experimental que "presiona automáticamente Espacio al pasar sobre áreas rojas"
• Esta es una función de verificación para desarrolladores
• Úsela solo con fines de prueba
• Una pintura demasiado rápida o poco natural puede ser malinterpretada como comportamiento de BOT
• Úsela bajo su propio riesgo
`,

  // Sort Order
  sort_order_default: "Predeterminado",
  sort_order_most_missing: "Más Faltantes",
  sort_order_least_remaining: "Casi Completo",

  // Compute Device
  compute_device_label: "Procesamiento",

  // Show Unplaced Only
  show_unplaced_only: "Colocados",

  // Tile Merge
  tile_merge: "Fusionar Bloques",
  merge_tiles: "Fusionar Bloques",
  export_png: "Exportar PNG",
  clear_selection: "Limpiar Selección",
  selected: "Seleccionado",

  // Tile Statistics
  tile_statistics: "Estadísticas de Bloques",
  statistics: "Estadísticas",
  calculating: "Calculando",
  total_pixels: "Total de Píxeles",
  color_distribution: "Distribución de Colores",

  // Bookmark Tags
  existing_tags: "Etiquetas Existentes",
  remove_tag: "Quitar Etiqueta",
  bookmark_name: "Nombre del Favorito",
  tag_name: "Nombre de Etiqueta",
  tag_color: "Color de Etiqueta",
  optional: "Opcional",
  required: "Obligatorio",
  edit_tag: "Editar Etiqueta",
  tag_edit_title: "Editar Etiqueta",
  tag_edit_description:
    "Todos los favoritos que usan esta etiqueta serán actualizados",
  tag_delete_confirm:
    "¿Eliminar esta etiqueta? La etiqueta será eliminada de todos los favoritos que la usan.",

  // Coordinate Jumper
  coordinate_jumper: "Salto de Coordenadas",
  geographic_coordinates: "Coordenadas Geográficas",
  tile_coordinates: "Coordenadas de Bloques",
  jump_to_coordinates: "Saltar a Coordenadas",

  // Location Search
  location_search: "Búsqueda de Ubicación",
  search_location: "Buscar Ubicación",
  enter_place_name: "Introduce el nombre del lugar",
  searching: "Buscando...",
  no_results_found: "No se encontraron resultados",
  search_results: "Resultados de Búsqueda",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Entrada de Coordenadas (Opcional)",
  tile_x: "Bloque X",
  tile_y: "Bloque Y",
  pixel_x: "Píxel X",
  pixel_y: "Píxel Y",
  coordinate_input_hint:
    "Si introduces coordenadas, la imagen se colocará automáticamente en esa posición al añadirse a la galería",

  // Data Saver
  data_saver: "Ahorro de Datos",
  data_saver_on: "Ahorro de Datos ACTIVADO",
  data_saver_off: "Ahorro de Datos DESACTIVADO",
  data_saver_rendering_paused: "Usando caché sin conexión",
  storage_usage: "Uso de Almacenamiento",
  cache_usage: "Uso de Caché",
  offline_cache_settings: "Configuración de Caché Sin Conexión",
  maximum_cache_size: "Tamaño Máximo de Caché",
  clear_all_cache: "Limpiar Toda la Caché",
  clearing: "Limpiando...",
  cache_cleared: "¡Caché Limpiada!",
  tiles: "bloques",

  // Close Confirm
  confirm_close_paint_modal:
    "Puede perder el trabajo en progreso. ¿Estás seguro de que quieres cerrar?",

  // Friends Book
  friends_book: "Amigos",
  add_to_friends: "Añadir a Amigos",
  add_friend: "Añadir Amigo",
  user_id: "ID de Usuario",
  user_id_placeholder: "ej. 12345",
  user_name: "Nombre de Usuario",
  user_name_placeholder: "ej. NombreJugador",
  please_enter_id_and_name: "Por favor ingrese ID y nombre",
  edit_friend: "Editar Amigo",
  description: "Descripción",
  description_placeholder: "Ingrese descripción...",
  tag: "Etiqueta",
  tags: "Etiquetas",
  new_tag: "Nueva Etiqueta",
  create_new_tag: "Crear Nueva Etiqueta",
  clear_tag: "Borrar Etiqueta",
  tag_name_placeholder: "ej: Amigo, Rival...",
  select_color: "Seleccionar Color",
  create: "Crear",
  no_friends: "Sin amigos",
  sort_added: "Fecha de Adición",
  sort_id: "ID",
  import_merge_confirm:
    "amigos para importar?\nSe fusionará con datos existentes (mismo ID será sobrescrito).",
  import_merge_description: "Los datos existentes se mantendrán.",
  import_friends_description: "Importar lista de jugadores desde archivo CSV",
  export_all_friends_description: "Exportar todos los amigos como archivo CSV",
  export_friends_by_tag_description:
    "Exportar solo amigos con etiquetas seleccionadas como CSV",
  online_sync: "Importación en línea",
  online_sync_description:
    "Importar lista de amigos desde URL CSV (ej. URL publicada de Google Sheets)",
  sync_merge: "Importación por fusión",
  sync_replace: "Importación por reemplazo",
  please_enter_sync_url: "Por favor ingrese la URL de importación",
  sync_failed: "Error en la importación",
  sync_replace_confirm:
    "¿Estás seguro de que quieres reemplazar todos los amigos?\nTodos los amigos existentes serán eliminados y reemplazados con los datos de la URL.",
  open_url: "Abrir URL",

  // Tutorial
  tutorial_title: "Tutorial",
  tutorial_how_to_draw_title: "Cómo dibujar imágenes en el mapa",
  tutorial_how_to_draw_step1: "Guarda una imagen en la galería",
  tutorial_how_to_draw_step2:
    "Haz clic en el mapa y selecciona el botón «Imagen»",
  tutorial_how_to_draw_step3:
    "Haz clic en la imagen que quieres colocar y aparecerá como capa en el bloque del mapa",
  tutorial_how_to_archive_title: "Cómo archivar pixel art en el mapa",
  tutorial_how_to_archive_step1: "Haz clic en el mapa y selecciona «Archivo»",
  tutorial_how_to_archive_step2:
    "Haz clic en el botón «Guardar Instantánea Actual»",
  tutorial_how_to_draw_archive_title: "Cómo dibujar pixel art archivado",
  tutorial_how_to_draw_archive_step1:
    "Haz clic en el mapa y selecciona «Archivo»",
  tutorial_how_to_draw_archive_step2:
    "Haz clic en el archivo que quieres mostrar",
  tutorial_how_to_draw_archive_step3: "Haz clic en el botón de dibujar",
  tutorial_how_to_draw_text_title: "Cómo mostrar texto en el mapa",
  tutorial_how_to_draw_text_step1: "Haz clic en el mapa y selecciona «Texto»",
  tutorial_how_to_draw_text_step2:
    "Escribe el texto, elige una fuente y haz clic en «Dibujar»",
  tutorial_how_to_draw_text_step3:
    "Opcional: usa los botones de flecha para ajustar la posición",
  tutorial_how_to_bookmark_title: "Cómo añadir y navegar entre favoritos",
  tutorial_how_to_bookmark_step1:
    "Haz clic en el mapa y selecciona el icono ⭐",
  tutorial_how_to_bookmark_step2: "Introduce un nombre de favorito y guárdalo",
  tutorial_how_to_bookmark_step3:
    "Haz clic en el botón ⭐ en la esquina inferior izquierda y selecciona un favorito para navegar",

  // Empty states
  empty_archive_message:
    "Aún no hay bloques archivados. ¡Haz clic en el mapa para comenzar a archivar!",
  empty_bookmark_message:
    "Aún no hay favoritos. ¡Haz clic en el mapa y selecciona el icono ⭐ para guardar tus lugares favoritos!",

  // Map Filter Menu
  map_filter_darkTheme: "Tema Oscuro",
  map_filter_highContrast: "Alto Contraste",
  map_filter_tileBoundaries: "Límites de Bloques",
  map_filter_gridDisplay: "Cuadrícula de Píxeles",
  map_filter_backgroundColor: "Color de Fondo",
  map_filter_map3d: "Vista 3D",
  map_filter_mapSky: "Cielo y Niebla",
  draw_on_map: "Dibujar en mapa",
  outline_preserve: "Preservar contorno",
  outline_width: "Grosor del contorno",
  outline_sensitivity: "Sensibilidad",
  outline_use_fixed_color: "Usar color de línea fijo",
  outline_color: "Color de línea",
  hint_title: "Consejo",
  hint_close: "Cerrar consejo",
  hint_show_unplaced_only:
    "Esta función hace menos notorios los colores ya colocados.",
  hint_color_isolate:
    "Mostrar solo el color seleccionado resalta solo el color seleccionado actualmente para que puedas concentrarte al pintar.",
  hint_data_saver:
    "El ahorro de datos reduce el uso de red reutilizando datos de imagen. Cuando está activado, las actualizaciones de pixel art se pausan.",
  hint_palette_toggle: "Pulsa aquí para abrir el filtro de color.",
  hint_drawing_btn: "Draw images on the map from here.",
  hint_unplaced_grid: "Press an image to draw it on the map.",
  transparency_tool: "Herramienta de Transparencia",
  transparency_flood_fill: "Relleno de Límites",
  transparency_flood_fill_desc:
    "Haga clic en un punto para hacer transparente la región conectada del mismo color. Use ajuste de límite para expandir o reducir.",
  transparency_threshold: "Ajuste de Límite",
  transparency_apply: "Aplicar",
  transparency_reset: "Restablecer",
  transparency_no_image:
    "Primero cargue una imagen para usar la herramienta de transparencia",
  popup_overlay_mode: "Capa",
  popup_overlay_mode_composite: "Compuesto",
  popup_overlay_mode_layer: "Independiente",
  developer_warning_splash_title: "Advertencia de Función de Desarrollador",
  developer_warning_splash_ok: "OK",
  developer_warning_splash_close: "Cerrar",
  show_unplaced_color: "Color",
  map_filter_scaleDisplay: "Medida de Distancia",
  map_filter_areaMeasure: "Visualización de Área",
  map_filter_area_manager_title: "Gestor de Áreas",
  map_filter_area_mode: "Modo",
  map_filter_area_mode_display: "Mostrar",
  map_filter_area_mode_editing: "Editando",
  map_filter_area_editing: "Editando",
  map_filter_area_start_new: "Iniciar Nueva Edición",
  map_filter_area_stop_editing: "Detener Edición",
  map_filter_area_save_new: "Guardar como Nuevo",
  map_filter_area_save_update: "Guardar Actualización",
  map_filter_area_saved_regions: "Áreas Guardadas",
  map_filter_area_empty: "No hay áreas guardadas",
  map_filter_area_points: "puntos",
  map_filter_area_show: "Mostrar",
  map_filter_area_hide: "Ocultar",
  map_filter_area_rename: "Renombrar",
  map_filter_area_delete_confirm: "¿Eliminar esta área guardada?",
  map_filter_area_name_placeholder: "Nombre del área",
  map_filter_area_default_name: "Área",
  map_filter_area_new_region: "Nueva Área",
  map_filter_area_need_polygon: "No se encontró polígono editable",
  map_filter_area_add: "Agregar Área",
  map_filter_area_save_map: "Guardar Área",
  map_filter_area_color: "Color",
  map_filter_area_online_sync_description:
    "Importar datos de área desde URL GeoJSON/JSON (ej. URL de almacenamiento en la nube pública)",
  map_filter_area_import_description:
    "Importar áreas desde un archivo GeoJSON o JSON",
  map_filter_area_import_file: "Importar desde Archivo de Área",
  map_filter_area_export_all_description:
    "Exportar todas las áreas guardadas como GeoJSON",
  map_filter_area_export_selected: "Exportar Áreas Seleccionadas",
  map_filter_area_export_selected_description:
    "Exportar solo las áreas marcadas como GeoJSON",
  map_filter_area_export_selected_button: "Exportar Áreas Seleccionadas",
  map_filter_area_no_regions_available: "No hay áreas disponibles",
  map_filter_area_no_export_regions: "No hay áreas para exportar",
  map_filter_area_no_importable_regions: "No se encontraron áreas importables",
  map_filter_area_sync_replace_confirm:
    "¿Reemplazar todas las áreas guardadas con los datos de la URL?\nLas áreas actuales se sobrescribirán.",
  map_filter_map3d_drag_rotate: "Habilitar Rotación",
  hint_gallery_btn: "Puedes registrar imágenes para dibujar desde aquí.",
  hint_overlay_mode_independent_prefix:
    "Experimental pero potente: agregamos un nuevo modo. Por favor prueba el modo ",
  hint_overlay_mode_independent_suffix:
    " (si encuentras errores, repórtalos a través de Popup > BugReport).",
  hint_user_status_container:
    "Presiona aquí para configurar la alarma cuando se haya acumulado Paint",
  hint_bookmark_btn: "Puedes marcar esta ubicación",
  hint_timetravel_btn: "Puedes guardar arte cerca de esta ubicación",
  hint_text_draw_btn: "Puedes mostrar texto en el mapa",
  hint_bookmarks_btn: "Tus marcadores guardados están aquí",
  hint_timetravel_fab_btn: "La lista de áreas archivadas está aquí",
  hint_save_current_snapshot_btn:
    "Puedes archivar imágenes cerca de esta ubicación",
  import_snapshot_tile_x_label: "Coordenada de Tile X",
  import_snapshot_tile_y_label: "Coordenada de Tile Y",
  import_snapshot_tile_x_placeholder: "ej. 520",
  import_snapshot_tile_y_placeholder: "ej. 218",
  import_snapshot_datetime_label: "Fecha/Hora",
  import_snapshot_success: "Importación completada",
  hint_map_filter_trigger: "Aquí puedes cambiar cómo se ve el mapa",
  hint_edit_card: "Aquí puedes cambiar el nombre y agregar etiquetas",
  hint_image_detail_draw_on_map:
    "Presiona aquí para colocar la imagen en el centro del mapa actual",
  hint_image_detail_dpad: "Puedes mover la imagen aquí",
  hint_image_detail_download:
    "Para compartir con otros, descarga la imagen desde aquí. El nombre del archivo contiene las coordenadas, por lo que al cargarlo se colocará la imagen en la misma posición",
  hint_image_detail_edit_title: "Pulsa el título de la imagen para editarlo",
  popup_close_button_big: "Botón de Cierre Grande",
  map_filter_area_display_settings: "Configuración de visualización",
  map_filter_area_opacity: "Opacidad del área",
  map_filter_area_name_display: "Mostrar nombre del área",
  map_filter_area_name_display_on: "Mostrar",
  map_filter_area_name_display_off: "Ocultar",
  map_filter_area_name_font_size: "Tamaño de fuente",
  map_filter_area_name_style: "Apariencia del texto",
  map_filter_area_name_style_halo: "Estándar",
  map_filter_area_name_style_badge: "Insignia circular",
  map_filter_area_group_compose: "Combinar áreas",
  map_filter_area_group_compose_action: "Combinar",
  map_filter_area_group_not_enough: "No hay suficientes áreas para combinar",
  map_filter_area_group_name_placeholder: "Nombre del grupo (opcional)",
  selected_color_only_mark: "Marcar solo color seleccionado",
  tmp_tile_board_data_notice:
    "Muestra solo datos de tiles ya recibidos. Para reducir la carga del servidor, no se envian nuevas solicitudes.",
  hint_gallery_backup: "Se recomienda hacer backups aquí frecuentemente.",
  all_short: "TODO",
  popup_overlay_mode_composite_detail: "Funciones básicas, alto rendimiento",
  popup_overlay_mode_layer_detail: "Funciones avanzadas, visualización rápida",
  adjust_tool: "Herramienta de ajuste",
  adjust_tool_confirm: "Confirmar",
  adjust_tool_cancel_confirm:
    "¿Salir de la herramienta de ajuste? Los cambios no se aplicarán.",
  adjust_tool_target_size: "Tamaño objetivo",
  popup_hide_my_location: "Ocultar botón de ubicación",
  quantization_oklab: "Espacio de Color OKLab (Lento, Mas Uniforme)",
  color_flatten: "Aplanado de Color",
  color_flatten_none: "Plano: Off",
  color_flatten_light: "Plano: Suave",
  color_flatten_medium: "Plano: Medio",
};
