// Словарь русского перевода
export const ruTranslations = {
  // Gallery
  gallery: "Галерея",
  back: "Назад",
  close: "Закрыть",

  // Buttons
  save: "Сохранить",
  delete: "Удалить",
  edit: "Редактировать",
  update: "Обновить",
  updated: "Обновлено",
  add: "Добавить",
  select: "Выбрать",
  cancel: "Отмена",
  bookmarks: "закладки",
  bookmark: "Закладка",
  save_location: "Сохранить местоположение",
  draw: "Рисовать",
  draw_image: "Изображение",
  text_draw: "Текст",
  text_clear: "Очистить текст",
  timetravel: "Архив",
  export: "Экспорт",
  import: "Импорт",

  // Gallery Export/Import
  gallery_data: "Данные галереи",
  import_gallery: "Импорт галереи",
  export_gallery: "Экспорт галереи",
  reset_gallery: "Сброс галереи",
  exporting: "Экспорт...",
  importing: "Импорт...",
  resetting: "Сброс...",
  export_success: "Экспортировано {count} изображений",
  export_failed: "Ошибка экспорта",
  import_success: "Импортировано {count} изображений",
  import_failed: "Ошибка импорта",
  reset_failed: "Ошибка сброса",
  gallery_reset_success: "Галерея была сброшена",
  no_images_to_export: "Нет изображений для экспорта (требуются координаты)",
  no_valid_images_in_zip: "В ZIP-файле не найдено допустимых изображений",
  confirm_import:
    "Вы уверены, что хотите импортировать? Это добавит новые изображения в вашу галерею.",
  confirm_reset:
    "Вы уверены, что хотите сбросить все изображения галереи? Это действие необратимо.",

  // Messages
  loading: "Загрузка...",
  no_items: "Нет элементов",
  delete_confirm: "Вы уверены, что хотите удалить?",
  deleted_message: "Удалено",

  // Bookmarks
  no_bookmarks: "Нет закладок",
  add_bookmark_instruction:
    'Нажмите на карту и используйте кнопку "Закладка" для добавления',
  location_unavailable: "Не удалось получить информацию о местоположении.",
  location_unavailable_instruction:
    "Не удалось получить информацию о местоположении. Пожалуйста, нажмите на карту, а затем сохраните.",
  enter_bookmark_name: "Пожалуйста, введите название закладки:",
  location_point: "Точка",
  bookmark_list: "Список закладок",
  sort_created: "Дата добавления",
  sort_accessed: "Последний доступ",
  sort_tag: "По тегу",
  sort_distance: "По расстоянию",
  sort_last_updated: "Недавно сохраненные",
  sort_tile_count: "По количеству тайлов",
  sort_name: "По имени",
  sort_layer: "Порядок слоев",

  // Import/Export関連
  import_export: "Импорт/Экспорт",
  import_description: "Импорт закладок из JSON-файла",
  export_all: "Экспорт всех",
  export_all_description: "Экспорт всех закладок",
  export_by_tag: "Экспорт по тегу",
  export_by_tag_description: "Экспорт только закладок с выбранными тегами",
  export_selected_tags: "Экспорт выбранных тегов",
  no_tags_available: "Нет доступных тегов",
  no_name: "Без имени",
  no_export_bookmarks: "Нет закладок для экспорта",
  bookmarks_exported: " закладок экспортировано",
  file_input_not_found: "Поле для файла не найдено",
  no_file_selected: "Файл не выбран",
  invalid_file_format: "Неверный формат файла",
  import_confirm:
    "Вы уверены, что хотите импортировать закладки?\nСуществующие данные будут сохранены.",
  import_cancelled: "Импорт отменен",
  bookmarks_imported: " закладок импортировано",

  // Snapshots
  timetravel_modal_title: "Машина времени",
  timetravel_current_position: "Снимки текущей позиции",
  timetravel_tile_list: "Список тайлов",
  timetravel_tile_snapshots: "Снимки тайлов",
  save_current_snapshot: "Сохранить текущий снимок",
  snapshot_detail: "Детали снимка",
  snapshot_share: "Поделиться снимком",
  snapshot_timestamp: "Временная метка снимка",
  snapshot_share_description:
    "Это имя файла содержит информацию о координатах и временной метке. Когда вы повторно импортируете его из списка тайлов, он будет зарегистрирован как снимок в той же позиции и в то же время.",
  return_to_current: "Вернуться к текущему",
  enter_snapshot_name: "Введите имя снимка (пусто для временной метки):",
  enter_tile_name: "Введите имя тайла (пусто для координат):",

  // Image Editor
  drag_drop_or_click: "Перетащите или нажмите, чтобы выбрать файл",
  clear_image: "Очистить изображение",
  original_image: "Исходное изображение",
  click_or_drop_to_change: "Нажмите или перетащите для изменения",
  current_image: "Текущее изображение",
  reset_edit: "Сбросить изменения",
  reset_viewport: "Сбросить вид",
  size_reduction: "Размер",
  brightness: "Яркость",
  contrast: "Контраст",
  saturation: "Насыщенность",
  sharpness: "Резкость",
  dithering: "Дизеринг",
  quantization_method: "Метод квантования",
  quantization_rgb_euclidean: "Расстояние RGB (Быстро, по умолчанию)",
  quantization_weighted_rgb: "Взвешенный RGB (Средне, естественно)",
  quantization_lab: "Цветовое пространство Lab (Медленно, высокое качество)",
  include_paid_colors: "Включить платные цвета",
  transparent_color: "Прозрачный цвет",
  add_to_gallery: "Добавить в галерею",
  download: "Скачать",
  clear_image_confirm:
    "Очистить изображение и вернуться к начальному состоянию?",
  saved_to_gallery: "Изображение сохранено в галерее",
  large_image_resize_confirm:
    "Размер изображения большой и может вызвать медленную обработку.\nХотите изменить размер изображения?",
  current_size: "Текущий размер",
  resize_to: "Изменить размер на",
  resize_image: "Изменить размер",
  edit_image: "Редактировать",
  edit_image_mode: "Редактировать изображение",
  add_to_gallery_directly: "Добавить прямо в галерею",
  select_image: "Выбрать изображение",
  click_image_to_draw:
    "Нажмите на изображение, которое хотите нарисовать на карте",
  click_to_draw: "Кликните, чтобы рисовать",
  no_draw_images: "Нет изображений для рисования.",
  no_saved_images: "Нет сохраненных изображений",
  empty_gallery_message:
    "Чтобы отобразить изображение на карте, сначала добавьте изображение",
  add_first_image: "Добавить Первое Изображение",
  unplaced_images: "Неразмещенные изображения",
  layers: "Слои",
  no_layers: "Нет слоев",
  delete_image_confirm: "Вы хотите удалить это изображение?",

  // Drawing/Loading
  drawing_image: "Рисование изображения...",
  processing_image: "Обработка изображения...",
  waiting_for_update: "Ожидание обновления...",

  // File related
  upload: "Загрузить",
  file_select: "Выбрать файл",
  image_editor: "Редактор изображений",
  add_image: "Добавить изображение",
  image_detail: "Детали изображения",
  title: "Название",
  edit_image_title: "Редактировать название изображения",
  image_title_placeholder: "Название изображения (необязательно)",
  title_updated: "Название обновлено",

  // Drawing
  draw_enabled: "Рисование ВКЛ",
  draw_disabled: "Рисование ВЫКЛ",
  draw_state: "Состояние рисования",
  draw_this_tile: "Нарисовать этот тайл",
  enabled: "Включено",
  disabled: "Отключено",
  invalid_coordinates: "Неверные координаты",
  coordinates_updated: "Координаты обновлены",
  goto_map: "Перейти на карту",
  share: "Скачать",
  image_share: "Поделиться изображением",
  tile_coordinate: "Координаты тайла",
  pixel_coordinate: "Координаты пикселя",
  lat_lng: "Широта/Долгота",
  coordinates: "Координаты",
  share_description:
    "Это имя файла изображения содержит информацию о координатах. Когда вы снова добавите загруженное изображение в галерею, оно будет автоматически размещено в той же позиции.",
  no_position_data: "Нет данных о позиции",
  download_success: "Скачивание успешно",
  error: "Ошибка",
  deleted: "Удалено",

  // popup専用
  buy_me_coffee: "Купите мне кофе",
  popup_language: "Язык",
  popup_navigation: "Навигация",
  popup_navigation_map_jump: "Переход на Карте",
  popup_navigation_url_jump: "Переход по URL",
  popup_lock_button: "Большая Кнопка Блокировки (Мобильная)",
  popup_close_confirm: "Подтверждение при Закрытии Панели Рисования",
  popup_paint_mode_style: "Скрыть Кнопки в Режиме Рисования",
  popup_bug_report: "Сообщить об Ошибке",
  popup_fab_visibility: "Видимость Кнопок",
  popup_fab_gallery: "Галерея",
  popup_fab_bookmark: "Закладки",
  popup_fab_time_travel: "Путешествие во Времени",
  popup_fab_color_filter: "Фильтр Цвета",
  popup_fab_data_saver: "Экономия Данных",
  popup_fab_map_filter: "Фильтр Карты",

  // Color Filter
  color_filter: "Фильтр цвета",
  enable_all: "Включить все",
  disable_all: "Отключить все",
  free_colors_only: "Только бесплатные цвета",
  owned_colors_only: "Только принадлежащие цвета",
  disable_unused_colors: "Отключить неиспользуемые",
  enhanced: "Улучшенный",
  show_selected_color_only: "Показать только выбранный цвет",

  // User Status (Notification Modal)
  user_status_details: "Детали статуса пользователя",
  level_progress: "Прогресс уровня",
  current_level: "Текущий уровень",
  pixels_painted: "Нарисованных пикселей",
  next_level: "Следующий уровень",
  charge_status: "Состояние заряда",
  time_to_full: "Время до полного заряда",
  full_charge_at: "Полный заряд в",
  fully_charged: "⚡ ПОЛНОСТЬЮ ЗАРЯЖЕНО!",
  alarm_active: "⏰ Будильник активен",
  scheduled: "Запланировано",
  no_alarm_set: "😴 Будильник не установлен",
  charge_alarm: "🔔 Будильник заряда",
  alarm_browser_warning:
    "※ Уведомления не будут работать при закрытом браузере",
  loading_alarm_settings: "Загрузка настроек будильника...",
  notification_threshold: "Порог уведомления",
  estimated_time: "Ориентировочное время",
  already_reached: "Уже достигнуто",
  enable_alarm: "Включить будильник",
  disable_alarm: "Отключить будильник",
  add_to_calendar_title: "Google Календарь",
  wplace_charged_event: "WPlace заряжен ⚡",

  // Theme Toggle
  theme_toggle: "Переключить тему",
  theme_light: "Светлая тема",
  theme_dark: "Темная тема",
  theme_switched: "Тема изменена",

  // Enhanced Draw Modes
  enhanced_mode_label: "Рисование",
  enhanced_mode_dot: "Точка",
  enhanced_mode_cross: "Крест",
  enhanced_mode_fill: "Заполнить",
  enhanced_mode_red_cross: "Цветной крест",
  enhanced_mode_border_only: "Только граница",
  enhanced_mode_dark_cross: "Темный крест",
  enhanced_mode_complement_cross: "Дополнительный крест",
  enhanced_mode_red_border: "Цветная граница",
  enhanced_mode_huge_red_cross: "Огромный цветной крест",
  enhanced_mode_huge_red_cross_bold: "Огромный цветной крест (Жирный)",
  enhanced_mode_huge_red_diamond: "Огромный цветной ромб",
  enhanced_mode_huge_red_ring: "Огромное цветное кольцо",
  marker_color: "Цвет маркера",

  // Auto Spoit
  auto_spoit: "Автопипетка",
  auto_spoit_tooltip: "Автоматическая пипетка",

  auto_dotter_warning: `
• Это экспериментальная функция, которая "автоматически нажимает пробел при наведении на красные области"
• Это функция проверки для разработчиков
• Использовать только в тестовых целях
• Слишком быстрое или неестественное рисование может быть воспринято как поведение бота
• Используйте на свой страх и риск
`,

  // Sort Order
  sort_order_default: "По умолчанию",
  sort_order_most_missing: "Больше всего недостает",
  sort_order_least_remaining: "Почти готово",

  // Compute Device
  compute_device_label: "Обработка",

  // Show Unplaced Only
  show_unplaced_only: "Размещённые",

  // Tile Merge
  tile_merge: "Слияние тайлов",
  merge_tiles: "Объединить тайлы",
  export_png: "Экспорт PNG",
  clear_selection: "Очистить выделение",
  selected: "Выбрано",

  // Tile Statistics
  tile_statistics: "Статистика тайла",
  statistics: "Статистика",
  calculating: "Вычисление",
  total_pixels: "Всего пикселей",
  color_distribution: "Распределение цветов",

  // Bookmark Tags
  existing_tags: "Существующие теги",
  remove_tag: "Удалить тег",
  bookmark_name: "Название закладки",
  tag_name: "Название тега",
  tag_color: "Цвет тега",
  optional: "Необязательно",
  required: "Обязательно",
  edit_tag: "Редактировать тег",
  tag_edit_title: "Редактировать тег",
  tag_edit_description: "Все закладки, использующие этот тег, будут обновлены",
  tag_delete_confirm:
    "Удалить этот тег? Тег будет удален из всех закладок, которые его используют.",

  // Coordinate Jumper
  coordinate_jumper: "Переход по координатам",
  geographic_coordinates: "Географические координаты",
  tile_coordinates: "Координаты тайла",
  jump_to_coordinates: "Перейти к координатам",

  // Location Search
  location_search: "Поиск местоположения",
  search_location: "Поиск местоположения",
  enter_place_name: "Введите название места",
  searching: "Поиск...",
  no_results_found: "Результатов не найдено",
  search_results: "Результаты поиска",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Ввод координат (необязательно)",
  tile_x: "Тайл X",
  tile_y: "Тайл Y",
  pixel_x: "Пиксель X",
  pixel_y: "Пиксель Y",
  coordinate_input_hint:
    "Если вы введете координаты, изображение будет автоматически размещено в этой позиции при добавлении в галерею",

  // Data Saver
  data_saver: "Экономия трафика",
  data_saver_on: "Экономия трафика ВКЛ",
  data_saver_off: "Экономия трафика ВЫКЛ",
  data_saver_rendering_paused: "Используется офлайн-кеш",
  storage_usage: "Использование хранилища",
  cache_usage: "Использование кэша",
  offline_cache_settings: "Настройки кэша офлайн",
  maximum_cache_size: "Максимальный размер кэша",
  clear_all_cache: "Очистить весь кэш",
  clearing: "Очистка...",
  cache_cleared: "Кэш очищен!",
  tiles: "тайлов",

  // Close Confirm
  confirm_close_paint_modal:
    "Вы можете потерять свою работу. Вы уверены, что хотите закрыть?",

  // Friends Book
  friends_book: "Друзья",
  add_to_friends: "Добавить в друзья",
  add_friend: "Добавить друга",
  user_id: "ID пользователя",
  user_id_placeholder: "напр. 12345",
  user_name: "Имя пользователя",
  user_name_placeholder: "напр. ИмяИгрока",
  please_enter_id_and_name: "Пожалуйста, введите ID и имя",
  edit_friend: "Редактировать друга",
  description: "Описание",
  description_placeholder: "Введите описание...",
  tag: "Тег",
  tags: "Теги",
  new_tag: "Новый тег",
  create_new_tag: "Создать новый тег",
  clear_tag: "Очистить тег",
  tag_name_placeholder: "напр. Друг, Соперник...",
  select_color: "Выбрать цвет",
  create: "Создать",
  no_friends: "Нет друзей",
  sort_added: "Дата добавления",
  sort_id: "ID",
  import_merge_confirm:
    "друзей для импорта?\nБудет объединено с существующими данными (тот же ID будет перезаписан).",
  import_merge_description: "Существующие данные будут сохранены.",
  import_friends_description: "Импорт списка игроков из CSV-файла",
  export_all_friends_description: "Экспорт всех друзей в CSV-файл",
  export_friends_by_tag_description:
    "Экспорт только друзей с выбранными тегами в CSV",
  online_sync: "Онлайн импорт",
  online_sync_description:
    "Импорт списка друзей из CSV URL (например, опубликованный URL Google Sheets)",
  sync_merge: "Объединить импорт",
  sync_replace: "Заменить импорт",
  please_enter_sync_url: "Пожалуйста, введите URL для импорта",
  sync_failed: "Ошибка импорта",
  sync_replace_confirm:
    "Вы уверены, что хотите заменить всех друзей?\nВсе существующие друзья будут удалены и заменены данными из URL.",
  open_url: "Открыть URL",

  // Import/Export Snapshots
  import_snapshot_tile_x_label: "Координата тайла X",
  import_snapshot_tile_y_label: "Координата тайла Y",
  import_snapshot_tile_x_placeholder: "напр.: 520",
  import_snapshot_tile_y_placeholder: "напр.: 218",
  import_snapshot_datetime_label: "Время",
  import_snapshot_success: "Импорт завершен",

  // Tutorial
  tutorial_title: "Руководство",
  tutorial_how_to_draw_title: "Как рисовать изображения на карте",
  tutorial_how_to_draw_step1: "Сохраните изображение в галерею",
  tutorial_how_to_draw_step2:
    "Нажмите на карту и выберите кнопку 'Изображение'",
  tutorial_how_to_draw_step3:
    "Нажмите на изображение, которое хотите разместить, и оно появится как слой на тайле карты",
  tutorial_how_to_archive_title: "Как архивировать пиксель-арт на карте",
  tutorial_how_to_archive_step1: "Нажмите на карту и выберите 'Архив'",
  tutorial_how_to_archive_step2: "Нажмите кнопку 'Сохранить текущий снимок'",
  tutorial_how_to_draw_archive_title: "Как рисовать архивированный пиксель-арт",
  tutorial_how_to_draw_archive_step1: "Нажмите на карту и выберите 'Архив'",
  tutorial_how_to_draw_archive_step2:
    "Нажмите на архив, который хотите отобразить",
  tutorial_how_to_draw_archive_step3: "Нажмите кнопку рисования",
  tutorial_how_to_draw_text_title: "Как отобразить текст на карте",
  tutorial_how_to_draw_text_step1: "Нажмите на карту и выберите 'Текст'",
  tutorial_how_to_draw_text_step2:
    "Введите текст, выберите шрифт и нажмите кнопку 'Рисовать'",
  tutorial_how_to_draw_text_step3:
    "Необязательно: используйте кнопки со стрелками для настройки позиции",
  tutorial_how_to_bookmark_title:
    "Как добавлять закладки и перемещаться по ним",
  tutorial_how_to_bookmark_step1: "Нажмите на карту и выберите иконку ⭐",
  tutorial_how_to_bookmark_step2: "Введите название закладки и сохраните",
  tutorial_how_to_bookmark_step3:
    "Нажмите кнопку ⭐ в левом нижнем углу и выберите закладку для перехода",

  // Empty states
  empty_archive_message:
    "Еще нет архивированных тайлов. Нажмите на карту, чтобы начать архивирование!",
  empty_bookmark_message:
    "Еще нет закладок. Нажмите на карту и выберите иконку ⭐, чтобы сохранить любимые места!",

  // Map Filter Menu
  map_filter_darkTheme: "Темная тема",
  map_filter_highContrast: "Высокий контраст",
  map_filter_tileBoundaries: "Границы тайлов",
  map_filter_gridDisplay: "Сетка пикселей",
  map_filter_backgroundColor: "Цвет фона",
  map_filter_transparentPixelFilter: "Прозрачные пиксели",
  map_filter_map3d: "3D вид",
  map_filter_mapSky: "Небо и туман",
  draw_on_map: "Рисовать на карте",
  outline_preserve: "Сохранение контура",
  outline_width: "Толщина контура",
  outline_sensitivity: "Чувствительность",
  outline_use_fixed_color: "Использовать фиксированный цвет линии",
  outline_color: "Цвет линии",
  hint_title: "Подсказка",
  hint_close: "Закрыть подсказку",
  hint_show_unplaced_only:
    "Эта функция делает уже размещённые цвета менее заметными.",
  hint_color_isolate:
    "Показывать только выбранный цвет выделяет только текущий выбранный цвет, чтобы было проще сосредоточиться при рисовании.",
  hint_data_saver:
    "Экономия данных снижает использование сети за счёт повторного использования данных изображений. При включении обновления пиксель-арта приостанавливаются.",
  hint_palette_toggle: "Нажмите здесь, чтобы открыть цветовой фильтр.",
  hint_drawing_btn: "Draw images on the map from here.",
  hint_unplaced_grid: "Press an image to draw it on the map.",
  transparency_tool: "Инструмент Прозрачности",
  transparency_flood_fill: "Заполнение Границ",
  transparency_flood_fill_desc:
    "Нажмите на точку, чтобы сделать прозрачной связанную область того же цвета. Используйте настройку границ для расширения или сужения.",
  transparency_threshold: "Настройка Границы",
  transparency_apply: "Применить",
  transparency_reset: "Сбросить",
  transparency_no_image:
    "Сначала загрузите изображение, чтобы использовать инструмент прозрачности",
  popup_overlay_mode: "Слой",
  popup_overlay_mode_composite: "Композитный",
  popup_overlay_mode_composite_lite: "Композитный + Минимум",
  popup_overlay_mode_layer: "Независимый",
  developer_warning_splash_title: "Предупреждение о Функции Разработчика",
  developer_warning_splash_ok: "OK",
  developer_warning_splash_close: "Закрыть",
  show_unplaced_color: "Цвет",
  map_filter_scaleDisplay: "Измерение Расстояния",
  map_filter_areaMeasure: "Отображение Области",
  map_filter_area_manager_title: "Менеджер Областей",
  map_filter_area_mode: "Режим",
  map_filter_area_mode_display: "Показать",
  map_filter_area_mode_editing: "Редактирование",
  map_filter_area_editing: "Редактирование",
  map_filter_area_start_new: "Начать Новое Редактирование",
  map_filter_area_stop_editing: "Остановить Редактирование",
  map_filter_area_save_new: "Сохранить как Новый",
  map_filter_area_save_update: "Сохранить Обновление",
  map_filter_area_saved_regions: "Сохраненные Области",
  map_filter_area_empty: "Нет сохраненных областей",
  map_filter_area_points: "точки",
  map_filter_area_show: "Показать",
  map_filter_area_hide: "Скрыть",
  map_filter_area_rename: "Переименовать",
  map_filter_area_delete_confirm: "Удалить эту сохраненную область?",
  map_filter_area_name_placeholder: "Название области",
  map_filter_area_default_name: "Область",
  map_filter_area_new_region: "Новая Область",
  map_filter_area_need_polygon: "Редактируемый полигон не найден",
  map_filter_area_add: "Добавить Область",
  map_filter_area_save_map: "Сохранить Область",
  map_filter_area_color: "Цвет",
  map_filter_area_online_sync_description:
    "Импорт данных области из URL GeoJSON/JSON (например, URL общедоступного облачного хранилища)",
  map_filter_area_import_description:
    "Импорт областей из файла GeoJSON или JSON",
  map_filter_area_import_file: "Импорт из Файла Области",
  map_filter_area_export_all_description:
    "Экспорт всех сохраненных областей в GeoJSON",
  map_filter_area_export_selected: "Экспортировать Выбранные Области",
  map_filter_area_export_selected_description:
    "Экспорт только отмеченных областей в GeoJSON",
  map_filter_area_export_selected_button: "Экспортировать Выбранные Области",
  map_filter_area_no_regions_available: "Нет доступных областей",
  map_filter_area_no_export_regions: "Нет областей для экспорта",
  map_filter_area_no_importable_regions: "Импортируемые области не найдены",
  map_filter_area_sync_replace_confirm:
    "Заменить все сохраненные области данными из URL?\nТекущие области будут перезаписаны.",
  map_filter_map3d_drag_rotate: "Включить Вращение",
  hint_gallery_btn:
    "Вы можете зарегистрировать изображения для рисования отсюда.",
  hint_user_status_container:
    "Нажмите здесь, чтобы настроить сигнал, когда накопится Paint",
  hint_bookmark_btn: "Вы можете добавить это место в закладки",
  hint_timetravel_btn: "Вы можете сохранить искусство рядом с этим местом",
  hint_text_draw_btn: "Вы можете отобразить текст на карте",
  hint_bookmarks_btn: "Ваши сохраненные закладки здесь",
  hint_timetravel_fab_btn: "Список архивированных областей здесь",
  hint_map_filter_trigger: "Здесь вы можете изменить вид карты",
  hint_edit_card: "Здесь вы можете изменить название и добавить теги",
  hint_image_detail_draw_on_map:
    "Нажмите здесь, чтобы разместить изображение в центре текущей карты",
  hint_image_detail_dpad: "Вы можете переместить изображение здесь",
  hint_image_detail_download:
    "Здесь можно скачать как PNG или .wplace. Формат .wplace позволяет делиться изображением вместе с его позицией",
  hint_image_detail_edit_title:
    "Нажмите на название изображения, чтобы изменить его",
  popup_close_button_big: "Большая Кнопка Закрытия",
  map_filter_area_display_settings: "Настройки отображения",
  map_filter_area_opacity: "Прозрачность области",
  map_filter_area_name_display: "Отображение имени области",
  map_filter_area_name_display_on: "Показать",
  map_filter_area_name_display_off: "Скрыть",
  map_filter_area_name_font_size: "Размер шрифта",
  map_filter_area_name_style: "Внешний вид текста",
  map_filter_area_name_style_halo: "Стандарт",
  map_filter_area_name_style_badge: "Круглый бейдж",
  map_filter_area_group_compose: "Объединить области",
  map_filter_area_group_compose_action: "Объединить",
  map_filter_area_group_not_enough: "Недостаточно областей для объединения",
  map_filter_area_group_name_placeholder: "Название группы (необязательно)",
  selected_color_only_mark: "Отмечать только выбранный цвет",
  tmp_tile_board_data_notice:
    "Показывает только уже полученные данные тайлов. Чтобы снизить нагрузку на сервер, новые запросы не отправляются.",
  hint_gallery_backup: "Мы рекомендуем часто делать резервные копии.",
  all_short: "ВСЕ",
  popup_overlay_mode_composite_detail:
    "Меньше функций, высокая производительность",
  popup_overlay_mode_composite_lite_detail:
    "Минимум и самый лёгкий (прозрачный + точка, без сравнения/статистики)",
  popup_overlay_mode_layer_detail: "Расширенные функции, быстрое отображение",
  adjust_tool: "Инструмент настройки",
  adjust_tool_confirm: "Подтвердить",
  adjust_tool_cancel_confirm:
    "Выйти из инструмента настройки? Изменения не будут применены.",
  popup_hide_my_location: "Скрыть кнопку местоположения",
  quantization_oklab:
    "Цветовое пространство OKLab (Медленно, более равномерно)",
  color_flatten: "Сглаживание цветов",
  color_flatten_none: "Flat: Выкл",
  color_flatten_light: "Flat: Слабый",
  color_flatten_medium: "Flat: Средний",
  open_tmp_tile_board: "Скачать окрестности",
  hint_blue_marble_color_palette:
    "Are you using BlueMarble? Running both extensions together may cause feature conflicts",
  hint_overlay_mode_performance:
    "Если рендеринг медленный, попробуйте другой режим",
  hint_overlay_mode_blue_marble:
    'If BlueMarble conflicts with this extension, try setting this mode to "Composite"',
  official_favorites: "Официальное избранное",
  empty_official_favorites: "Нет официальных избранных мест",
  official_favorites_unavailable:
    "Не удалось загрузить официальные избранные места",
  tile_crop_selection_too_large: "Выделенная область слишком велика ({count}px). Прозрачные пиксели уже исключены. Выберите дополнительные цвета для игнорирования и запустите обнаружение снова.",
  tile_crop_max_selected_pixels: "Максимум выбранных пикселей",
  tile_crop_include_diagonals: "Включать диагональных соседей",
  tile_crop_redetect: "Повторить обнаружение",
  hint_tile_crop_save: "Новая функция! Вы можете распознать пиксель-арт и сохранить его.",
  text_draw_line_spacing: "Межстрочный интервал",
  hint_art_cruise_btn: "Прорывайтесь сквозь пиксель-арт в этой мини-игре-шутере!",
  no_snapshots_to_export: "Нет снимков для экспорта",
  quantization_lab_wplace: "Lab CIE94 / Wplace (Медленно, перцептивный)",
  text_draw_direction_horizontal: "Горизонтально",
  text_draw_direction_vertical: "Вертикально",
  draft_mode: "Черновик",
  draft_clear: "Очистить черновик",
};
