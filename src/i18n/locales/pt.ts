// ポルトガル語翻訳辞書
export const ptTranslations = {
  // Gallery
  gallery: "Galeria",
  back: "Voltar",
  close: "Fechar",

  // Buttons
  save: "Salvar",
  delete: "Deletar",
  edit: "Editar",
  add: "Adicionar",
  select: "Selecionar",
  cancel: "Cancelar",
  bookmarks: "favoritos",
  bookmark: "Favorito",
  draw_image: "Imagem",
  text_draw: "Texto",
  text_clear: "Limpar Texto",
  timetravel: "Arquivo",
  export: "Exportar",
  import: "Importar",

  // Gallery Export/Import
  gallery_data: "Dados da Galeria",
  import_gallery: "Importar Galeria",
  export_gallery: "Exportar Galeria",
  reset_gallery: "Redefinir Galeria",
  exporting: "Exportando...",
  importing: "Importando...",
  resetting: "Redefinindo...",
  export_success: "{count} imagens exportadas",
  export_failed: "Falha ao exportar",
  import_success: "{count} imagens importadas",
  import_failed: "Falha ao importar",
  reset_failed: "Falha ao redefinir",
  gallery_reset_success: "A galeria foi redefinida",
  no_images_to_export: "Nenhuma imagem para exportar (imagens com coordenadas necessárias)",
  no_valid_images_in_zip: "Nenhuma imagem válida encontrada no arquivo ZIP",
  confirm_import: "Tem certeza de que deseja importar? Novas imagens serão adicionadas à sua galeria.",
  confirm_reset: "Tem certeza de que deseja redefinir todas as imagens da galeria? Esta ação não pode ser desfeita.",

  // Messages
  loading: "Carregando...",
  no_items: "Sem itens",
  delete_confirm: "Tem certeza que deseja deletar?",
  saved_message: "salvo",
  deleted_message: "Deletado",

  // Bookmarks
  no_bookmarks: "Sem favoritos",
  add_bookmark_instruction:
    'Clique no mapa e use o botão "Favorito" para adicionar',
  location_unavailable: "Não foi possível obter as informações de localização.",
  location_unavailable_instruction:
    "Não foi possível obter as informações de localização. Por favor, clique no mapa e depois salve.",
  enter_bookmark_name: "Por favor, insira o nome do favorito:",
  location_point: "Ponto",
  bookmark_list: "Lista de Favoritos",

  // Import/Export関連
  no_export_bookmarks: "Sem favoritos para exportar",
  bookmarks_exported: " favoritos exportados",
  file_input_not_found: "Entrada de arquivo não encontrada",
  no_file_selected: "Nenhum arquivo selecionado",
  invalid_file_format: "Formato de arquivo inválido",
  import_confirm:
    "Tem certeza que deseja importar favoritos?\nOs dados existentes serão preservados.",
  import_cancelled: "Importação cancelada",
  bookmarks_imported: " favoritos importados",

  // Snapshots
  timetravel_modal_title: "Máquina do Tempo",
  timetravel_current_position: "Snapshots da Posição Atual",
  timetravel_tile_list: "Lista de Tiles",
  timetravel_tile_snapshots: "Snapshots de Tiles",
  save_current_snapshot: "Salvar Snapshot Atual",
  snapshot_detail: "Detalhe do Snapshot",
  return_to_current: "Retornar ao Atual",
  enter_snapshot_name: "Insira o nome do snapshot (vazio para timestamp):",
  enter_tile_name: "Insira o nome do tile (vazio para coordenadas):",

  // Image Editor
  drag_drop_or_click: "Arraste e solte ou clique para selecionar imagem",
  clear_image: "Limpar imagem",
  original_image: "Imagem original",
  click_or_drop_to_change: "Clique ou solte para alterar",
  current_image: "Imagem atual",
  reset_edit: "Resetar edição",
  reset_viewport: "Resetar Visualização",
  size_reduction: "Redução de tamanho",
  brightness: "Brilho",
  contrast: "Contraste",
  saturation: "Saturação",
  sharpness: "Nitidez",
  dithering: "Pontilhamento",
  include_paid_colors: "Incluir cores pagas",
  add_to_gallery: "Adicionar à galeria",
  download: "Download",
  clear_image_confirm: "Limpar imagem e retornar ao estado inicial?",
  saved_to_gallery: "Imagem salva na galeria",
  select_image: "Selecionar imagem",
  click_image_to_draw: "Clique na imagem que deseja desenhar no mapa",
  no_draw_images: "Sem imagens para desenhar.",
  no_saved_images: "Sem imagens salvas",
  delete_image_confirm: "Deseja deletar esta imagem?",

  // Drawing/Loading
  drawing_image: "Desenhando imagem...",
  processing_image: "Processando imagem...",
  waiting_for_update: "Aguardando atualização...",

  // File related
  upload: "Upload",
  file_select: "Selecionar Arquivo",
  image_editor: "Editor de Imagens",
  image_detail: "Detalhe da Imagem",
  title: "Título",
  edit_image_title: "Editar Título da Imagem",
  image_title_placeholder: "Nome da imagem (opcional)",
  title_updated: "Título atualizado",

  // Drawing
  draw_enabled: "Desenho ON",
  draw_disabled: "Desenho OFF",
  draw_state: "Estado do Desenho",
  draw_this_tile: "Desenhar este tile",
  enabled: "Habilitado",
  disabled: "Desabilitado",
  goto_map: "Ir ao Mapa",
  share: "Compartilhar",
  image_share: "Compartilhar Imagem",
  tile_coordinate: "Coordenada do Tile",
  pixel_coordinate: "Coordenada do Pixel",
  lat_lng: "Latitude/Longitude",
  coordinates: "Coordenadas",
  share_description:
    "Este nome de arquivo de imagem contém informações de coordenadas. Quando você adicionar a imagem baixada à galeria novamente, ela será automaticamente colocada na mesma posição.",
  no_position_data: "Sem dados de posição",
  download_success: "Download com Sucesso",
  error: "Erro",
  deleted: "Deletado",

  // popup専用
  buy_me_coffee: "Me pague um café",

  // Color Filter
  color_filter: "Filtro de Cor",
  enable_all: "Ativar Todos",
  disable_all: "Desativar Todos",
  enhanced: "Aprimorado",

  // User Status (Notification Modal)
  user_status_details: "Detalhes do Status do Usuário",
  level_progress: "Progresso de Nível",
  current_level: "Nível Atual",
  pixels_painted: "Pixels Pintados",
  next_level: "Próximo Nível",
  charge_status: "Status de Carga",
  time_to_full: "Tempo até Carga Completa",
  full_charge_at: "Carga Completa Em",
  fully_charged: "⚡ TOTALMENTE CARREGADO!",
  alarm_active: "⏰ Alarme Ativo",
  scheduled: "Agendado",
  no_alarm_set: "😴 Sem Alarme Definido",
  charge_alarm: "🔔 Alarme de Carga",
  loading_alarm_settings: "Carregando configurações de alarme...",
  notification_threshold: "Limite de Notificação",
  estimated_time: "Tempo estimado",
  already_reached: "Já alcançado",
  enable_alarm: "Ativar Alarme",
  disable_alarm: "Desativar Alarme",
  add_to_calendar_title: "Google Calendar",
  wplace_charged_event: "WPlace Carregado ⚡",

  // Theme Toggle
  theme_toggle: "Alternar Tema",
  theme_light: "Tema Claro",
  theme_dark: "Tema Escuro",
  theme_switched: "Tema alterado",

  // Data Saver
  data_saver: "Economizador de Dados",
  data_saver_on: "Economizador de Dados ATIVADO",
  data_saver_off: "Economizador de Dados DESATIVADO",
  data_saver_rendering_paused: "Renderização Pausada",
};
