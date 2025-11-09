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
  add: "Añadir",
  select: "Seleccionar",
  cancel: "Cancelar",
  bookmarks: "favoritos",
  bookmark: "Favorito",
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
  no_images_to_export: "No hay imágenes para exportar (se requieren imágenes con coordenadas)",
  no_valid_images_in_zip: "No se encontraron imágenes válidas en el archivo ZIP",
  confirm_import: "¿Estás seguro de que quieres importar? Se agregarán nuevas imágenes a tu galería.",
  confirm_reset: "¿Estás seguro de que quieres restablecer todas las imágenes de la galería? Esta acción no se puede deshacer.",

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

  // Import/Export関連
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
  include_paid_colors: "Incluir colores de pago",
  add_to_gallery: "Añadir a galería",
  download: "Descargar",
  clear_image_confirm: "¿Limpiar imagen y volver al estado inicial?",
  saved_to_gallery: "Imagen guardada en galería",
  select_image: "Seleccionar imagen",
  click_image_to_draw: "Haz clic en la imagen que quieres dibujar en el mapa",
  no_draw_images: "Sin imágenes para dibujar.",
  no_saved_images: "Sin imágenes guardadas",
  delete_image_confirm: "¿Quieres eliminar esta imagen?",

  // Drawing/Loading
  drawing_image: "Dibujando imagen...",
  processing_image: "Procesando imagen...",
  waiting_for_update: "Esperando actualización...",

  // File related
  upload: "Subir",
  file_select: "Seleccionar Archivo",
  image_editor: "Editor de Imágenes",
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
  enhanced: "Mejorado",

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
  loading_alarm_settings: "Cargando configuración de alarma...",
  notification_threshold: "Umbral de Notificación",
  estimated_time: "Tiempo estimado",
  already_reached: "Ya alcanzado",
  enable_alarm: "Activar Alarma",
  disable_alarm: "Desactivar Alarma",
  add_to_calendar_title: "Añadir a Google Calendar",
  wplace_charged_event: "WPlace Cargado ⚡",

  // Data Saver
  data_saver: "Ahorro de Datos",
  data_saver_on: "Ahorro de Datos ACTIVADO",
  data_saver_off: "Ahorro de Datos DESACTIVADO",
  data_saver_rendering_paused: "Renderizado Pausado",
};
