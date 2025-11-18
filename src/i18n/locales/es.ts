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
  saved_message: "guardado",
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
  size_reduction: "Reducción de tamaño",
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
  no_draw_images: "Sin imágenes para dibujar.",
  no_saved_images: "Sin imágenes guardadas",
  empty_gallery_message: "Para mostrar una imagen en el mapa, primero agregue una imagen",
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
  share: "Compartir",
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

  // Color Filter
  color_filter: "Filtro de Color",
  enable_all: "Activar Todos",
  disable_all: "Desactivar Todos",
  free_colors_only: "Solo Colores Gratis",
  owned_colors_only: "Solo Colores Poseídos",
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
  enhanced_mode_label: "Modo de Dibujo",
  enhanced_mode_dot: "Punto",
  enhanced_mode_cross: "Cruz",
  enhanced_mode_fill: "Rellenar",
  enhanced_mode_red_cross: "Cruz Roja",
  enhanced_mode_cyan_cross: "Cruz Cian",
  enhanced_mode_dark_cross: "Cruz Oscura",
  enhanced_mode_complement_cross: "Cruz Complementaria",
  enhanced_mode_red_border: "Borde Rojo",

  // Auto Spoit
  auto_spoit: "Selector de Color Automático",
  auto_spoit_tooltip: "Selector de color automático",

  // Sort Order
  sort_order_default: "Predeterminado",
  sort_order_most_missing: "Más Faltantes",
  sort_order_least_remaining: "Casi Completo",

  // Compute Device
  compute_device_label: "Procesamiento",

  // Show Unplaced Only
  show_unplaced_only: "Solo Sin Colocar",

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
  new_tag: "Crear Nueva Etiqueta",
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
  data_saver_rendering_paused: "Renderizado Pausado",
  storage_usage: "Uso de Almacenamiento",
  cache_usage: "Uso de Caché",
  offline_cache_settings: "Configuración de Caché Sin Conexión",
  maximum_cache_size: "Tamaño Máximo de Caché",
  clear_all_cache: "Limpiar Toda la Caché",
  clearing: "Limpiando...",
  cache_cleared: "¡Caché Limpiada!",
  tiles: "bloques",

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
  create_new_tag: "Crear Nueva Etiqueta",
  clear_tag: "Borrar Etiqueta",
  tag_name_placeholder: "ej: Amigo, Rival...",
  select_color: "Seleccionar Color",
  create: "Crear",
  no_friends: "Sin amigos",
  sort_added: "Fecha de Adición",
  import_merge_confirm:
    "amigos para importar?\nSe fusionará con datos existentes (mismo ID será sobrescrito).",
  import_merge_description: "Los datos existentes se mantendrán.",
};
