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
  update: "Atualizar",
  updated: "Atualizado",
  add: "Adicionar",
  select: "Selecionar",
  cancel: "Cancelar",
  bookmarks: "favoritos",
  bookmark: "Favorito",
  save_location: "Salvar Localização",
  draw: "Desenhar",
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
  sort_created: "Data de Adição",
  sort_accessed: "Último Acesso",
  sort_tag: "Por Tag",
  sort_distance: "Por Distância",
  sort_last_updated: "Salvos Recentemente",
  sort_tile_count: "Por Contagem de Blocos",
  sort_name: "Por Nome",
  sort_layer: "Ordem de Camada",

  // Import/Export
  import_export: "Importar/Exportar",
  import_description: "Importar favoritos de arquivo JSON",
  export_all: "Exportar Todos",
  export_all_description: "Exportar todos os favoritos",
  export_by_tag: "Exportar por Tag",
  export_by_tag_description: "Exportar apenas favoritos com tags selecionadas",
  export_selected_tags: "Exportar Tags Selecionadas",
  no_tags_available: "Nenhuma tag disponível",
  no_name: "Sem nome",
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
  snapshot_share: "Compartilhar Snapshot",
  snapshot_timestamp: "Marca de Tempo do Snapshot",
  snapshot_share_description:
    "Este nome de arquivo contém informações de coordenadas e marcação de tempo. Quando você reimportá-lo da lista de blocos, ele será registrado como um snapshot na mesma posição e horário.",
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
  quantization_method: "Método de Quantização",
  quantization_rgb_euclidean: "Distância RGB (Rápido, Padrão)",
  quantization_weighted_rgb: "RGB Ponderado (Médio, Natural)",
  quantization_lab: "Espaço de Cor Lab (Lento, Alta Qualidade)",
  include_paid_colors: "Incluir cores pagas",
  add_to_gallery: "Adicionar à galeria",
  download: "Download",
  clear_image_confirm: "Limpar imagem e retornar ao estado inicial?",
  saved_to_gallery: "Imagem salva na galeria",
  large_image_resize_confirm:
    "O tamanho da imagem é grande e pode causar processamento lento.\nVocê gostaria de redimensionar a imagem?",
  current_size: "Tamanho atual",
  resize_to: "Redimensionar para",
  resize_image: "Redimensionar",
  edit_image: "Editar",
  add_to_gallery_directly: "Adicionar diretamente à galeria",
  select_image: "Selecionar imagem",
  click_image_to_draw: "Clique na imagem que deseja desenhar no mapa",
  no_draw_images: "Sem imagens para desenhar.",
  no_saved_images: "Sem imagens salvas",
  unplaced_images: "Imagens Não Colocadas",
  layers: "Camadas",
  no_layers: "Sem camadas",
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
  invalid_coordinates: "Coordenadas inválidas",
  coordinates_updated: "Coordenadas atualizadas",
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
  free_colors_only: "Apenas Cores Grátis",
  owned_colors_only: "Apenas Cores Possuídas",
  enhanced: "Aprimorado",
  show_selected_color_only: "Mostrar Apenas Cor Selecionada",

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

  // Enhanced Draw Modes
  enhanced_mode_label: "Modo de Desenho",
  enhanced_mode_dot: "Ponto",
  enhanced_mode_cross: "Cruz",
  enhanced_mode_fill: "Preencher",
  enhanced_mode_red_cross: "Cruz Vermelha",
  enhanced_mode_cyan_cross: "Cruz Ciano",
  enhanced_mode_dark_cross: "Cruz Escura",
  enhanced_mode_complement_cross: "Cruz Complementar",
  enhanced_mode_red_border: "Borda Vermelha",

  // Auto Spoit
  auto_spoit: "Seletor de Cor Automático",
  auto_spoit_tooltip: "Seletor de cor automático",
  auto_spoit_warning: `【Seletor de Cor Automático - Aviso Importante】

Este é um recurso simples que apenas torna "clicar repetidamente no botão i para escolher cores" um pouco mais fácil.
No entanto, preste muita atenção ao seguinte:

⚠ Aviso
• Este é um recurso de verificação do desenvolvedor
• Este recurso não está disponível publicamente
• Use apenas para testar a funcionalidade do seletor de cores
• Para evitar mal-entendidos, sempre pinte em velocidade natural e de maneira natural
  (Pinte das bordas, pinte áreas mais fáceis primeiro, etc. - pinte como um humano faria)
• Movimentos muito rápidos ou padrões de pintura não naturais podem causar desalinhamento de pixels ou mal-entendidos
`,

  // Sort Order
  sort_order_default: "Padrão",
  sort_order_most_missing: "Mais Faltando",
  sort_order_least_remaining: "Quase Pronto",

  // Compute Device
  compute_device_label: "Processamento",

  // Show Unplaced Only
  show_unplaced_only: "Apenas Não Colocados",

  // Tile Merge
  tile_merge: "Mesclar Blocos",
  merge_tiles: "Mesclar Blocos",
  export_png: "Exportar PNG",
  clear_selection: "Limpar Seleção",
  selected: "Selecionado",

  // Tile Statistics
  tile_statistics: "Estatísticas de Blocos",
  statistics: "Estatísticas",
  calculating: "Calculando",
  total_pixels: "Total de Pixels",
  color_distribution: "Distribuição de Cores",

  // Bookmark Tags
  existing_tags: "Tags Existentes",
  new_tag: "Criar Nova Tag",
  remove_tag: "Remover Tag",
  bookmark_name: "Nome do Favorito",
  tag_name: "Nome da Tag",
  tag_color: "Cor da Tag",
  optional: "Opcional",
  required: "Obrigatório",
  edit_tag: "Editar Tag",
  tag_edit_title: "Editar Tag",
  tag_edit_description: "Todos os favoritos usando esta tag serão atualizados",
  tag_delete_confirm:
    "Deletar esta tag? A tag será removida de todos os favoritos que a usam.",

  // Coordinate Jumper
  coordinate_jumper: "Salto de Coordenadas",
  geographic_coordinates: "Coordenadas Geográficas",
  tile_coordinates: "Coordenadas de Blocos",
  jump_to_coordinates: "Saltar para Coordenadas",

  // Location Search
  location_search: "Busca de Localização",
  search_location: "Buscar Localização",
  enter_place_name: "Digite o nome do lugar",
  searching: "Buscando...",
  no_results_found: "Nenhum resultado encontrado",
  search_results: "Resultados da Busca",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Entrada de Coordenadas (Opcional)",
  tile_x: "Bloco X",
  tile_y: "Bloco Y",
  pixel_x: "Pixel X",
  pixel_y: "Pixel Y",
  coordinate_input_hint:
    "Se você inserir coordenadas, a imagem será automaticamente colocada nessa posição ao ser adicionada à galeria",

  // Data Saver
  data_saver: "Economizador de Dados",
  data_saver_on: "Economizador de Dados ATIVADO",
  data_saver_off: "Economizador de Dados DESATIVADO",
  data_saver_rendering_paused: "Renderização Pausada",
  storage_usage: "Uso de Armazenamento",
  cache_usage: "Uso de Cache",
  offline_cache_settings: "Configurações de Cache Offline",
  maximum_cache_size: "Tamanho Máximo do Cache",
  clear_all_cache: "Limpar Todo o Cache",
  clearing: "Limpando...",
  cache_cleared: "Cache Limpo!",
  tiles: "blocos",
};
