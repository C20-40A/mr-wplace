// Vietnamese translation dictionary
export const viTranslations = {
  // Gallery
  gallery: "Thư viện",
  back: "Quay lại",
  close: "Đóng",

  // Buttons
  save: "Lưu",
  delete: "Xóa",
  edit: "Chỉnh sửa",
  update: "Cập nhật",
  updated: "Đã cập nhật",
  add: "Thêm",
  select: "Chọn",
  cancel: "Hủy",
  bookmarks: "bookmarks",
  bookmark: "Đánh dấu",
  save_location: "Lưu Vị trí",
  draw: "Vẽ",
  draw_image: "Hình ảnh",
  text_draw: "Văn bản",
  text_clear: "Xóa Văn bản",
  timetravel: "Lưu trữ",
  export: "Xuất",
  import: "Nhập",

  // Gallery Export/Import
  gallery_data: "Dữ liệu Thư viện",
  import_gallery: "Nhập Thư viện",
  export_gallery: "Xuất Thư viện",
  reset_gallery: "Đặt lại Thư viện",
  exporting: "Đang xuất...",
  importing: "Đang nhập...",
  resetting: "Đang đặt lại...",
  export_success: "Đã xuất {count} hình ảnh",
  export_failed: "Xuất thất bại",
  import_success: "Đã nhập {count} hình ảnh",
  import_failed: "Nhập thất bại",
  reset_failed: "Đặt lại thất bại",
  gallery_reset_success: "Thư viện đã được đặt lại",
  no_images_to_export: "Không có hình ảnh để xuất (cần hình ảnh có tọa độ)",
  no_valid_images_in_zip: "Không tìm thấy hình ảnh hợp lệ trong tệp ZIP",
  confirm_import:
    "Bạn có chắc chắn muốn nhập? Hình ảnh mới sẽ được thêm vào thư viện của bạn.",
  confirm_reset:
    "Bạn có chắc chắn muốn đặt lại tất cả hình ảnh trong thư viện? Hành động này không thể hoàn tác.",

  // Messages
  loading: "Đang tải...",
  no_items: "Không có mục nào",
  delete_confirm: "Bạn có chắc muốn xóa?",
  deleted_message: "Đã xóa",

  // Bookmarks
  no_bookmarks: "Không có đánh dấu",
  add_bookmark_instruction: 'Nhấp vào bản đồ và sử dụng nút "Đánh dấu" để thêm',
  location_unavailable: "Không thể lấy thông tin vị trí.",
  location_unavailable_instruction:
    "Không thể lấy thông tin vị trí. Vui lòng nhấp vào bản đồ rồi lưu.",
  enter_bookmark_name: "Vui lòng nhập tên đánh dấu:",
  location_point: "Điểm",
  bookmark_list: "Danh sách đánh dấu",
  sort_created: "Ngày thêm",
  sort_accessed: "Lần truy cập gần nhất",
  sort_tag: "Theo thẻ",
  sort_distance: "Theo khoảng cách",
  sort_last_updated: "Đã lưu gần đây",
  sort_tile_count: "Theo số lượng ô",
  sort_name: "Theo tên",
  sort_layer: "Thứ tự lớp",

  // Import/Export
  import_export: "Nhập/Xuất",
  import_description: "Nhập đánh dấu từ tệp JSON",
  export_all: "Xuất Tất cả",
  export_all_description: "Xuất tất cả đánh dấu",
  export_by_tag: "Xuất theo Thẻ",
  export_by_tag_description: "Chỉ xuất đánh dấu với thẻ đã chọn",
  export_selected_tags: "Xuất Thẻ Đã chọn",
  no_tags_available: "Không có thẻ",
  no_name: "Không có tên",
  no_export_bookmarks: "Không có mục yêu thích để xuất",
  bookmarks_exported: " mục yêu thích đã xuất",
  file_input_not_found: "Không tìm thấy đầu vào tệp",
  no_file_selected: "Chưa chọn tệp",
  invalid_file_format: "Định dạng tệp không hợp lệ",
  import_confirm:
    "Bạn có chắc muốn nhập mục yêu thích?\nDữ liệu hiện có sẽ được giữ nguyên.",
  import_cancelled: "Đã hủy nhập",
  bookmarks_imported: " mục yêu thích đã nhập",

  // Snapshots
  timetravel_modal_title: "Cỗ máy thời gian",
  timetravel_current_position: "Ảnh chụp vị trí hiện tại",
  timetravel_tile_list: "Danh sách ô",
  timetravel_tile_snapshots: "Ảnh chụp ô",
  save_current_snapshot: "Lưu ảnh chụp hiện tại",
  snapshot_detail: "Chi tiết ảnh chụp",
  snapshot_share: "Chia sẻ ảnh chụp",
  snapshot_timestamp: "Dấu thời gian ảnh chụp",
  snapshot_share_description:
    "Tên tệp này chứa thông tin tọa độ và dấu thời gian. Khi bạn nhập lại từ danh sách ô, nó sẽ được đăng ký làm ảnh chụp tại cùng vị trí và thời gian.",
  return_to_current: "Quay về hiện tại",
  enter_snapshot_name: "Nhập tên ảnh chụp (để trống là thời gian):",
  enter_tile_name: "Nhập tên ô (để trống là tọa độ):",

  // Image Editor
  drag_drop_or_click: "Kéo & thả hoặc nhấp để chọn hình ảnh",
  clear_image: "Xóa hình ảnh",
  original_image: "Hình ảnh gốc",
  click_or_drop_to_change: "Nhấp hoặc thả để thay đổi",
  current_image: "Hình ảnh hiện tại",
  reset_edit: "Đặt lại chỉnh sửa",
  reset_viewport: "Đặt lại chế độ xem",
  size_reduction: "Kích thước",
  brightness: "Độ sáng",
  contrast: "Độ tương phản",
  saturation: "Độ bão hòa",
  sharpness: "Độ sắc nét",
  dithering: "Phối màu",
  quantization_method: "Phương Pháp Lượng Tử Hóa",
  quantization_rgb_euclidean: "Khoảng Cách RGB (Nhanh, Mặc Định)",
  quantization_weighted_rgb: "RGB Có Trọng Số (Trung Bình, Tự Nhiên)",
  quantization_lab: "Không Gian Màu Lab (Chậm, Chất Lượng Cao)",
  include_paid_colors: "Bao gồm màu trả phí",
  transparent_color: "Màu trong suốt",
  add_to_gallery: "Thêm vào thư viện",
  download: "Tải xuống",
  clear_image_confirm: "Xóa hình ảnh và quay về trạng thái ban đầu?",
  saved_to_gallery: "Hình ảnh đã lưu vào thư viện",
  large_image_resize_confirm:
    "Kích thước hình ảnh lớn và có thể gây chậm xử lý.\nBạn có muốn thay đổi kích thước hình ảnh?",
  current_size: "Kích thước hiện tại",
  resize_to: "Thay đổi kích thước thành",
  resize_image: "Thay đổi kích thước",
  edit_image: "Chỉnh sửa",
  edit_image_mode: "Chỉnh sửa hình ảnh",
  add_to_gallery_directly: "Thêm trực tiếp vào thư viện",
  select_image: "Chọn hình ảnh",
  click_image_to_draw: "Nhấp vào hình ảnh bạn muốn vẽ trên bản đồ",
  click_to_draw: "Nhấp để vẽ",
  no_draw_images: "Không có hình ảnh để vẽ.",
  no_saved_images: "Không có hình ảnh đã lưu",
  empty_gallery_message:
    "Để hiển thị hình ảnh trên bản đồ, vui lòng thêm hình ảnh trước",
  add_first_image: "Thêm Hình Ảnh Đầu Tiên",
  unplaced_images: "Hình ảnh Chưa Đặt",
  layers: "Lớp",
  no_layers: "Không có lớp",
  delete_image_confirm: "Bạn có muốn xóa hình ảnh này?",

  // Drawing/Loading
  drawing_image: "Đang vẽ hình ảnh...",
  processing_image: "Đang xử lý hình ảnh...",
  waiting_for_update: "Đang chờ cập nhật...",

  // File related
  upload: "Tải lên",
  file_select: "Chọn tệp",
  image_editor: "Trình chỉnh sửa hình ảnh",
  add_image: "Thêm hình ảnh",
  image_detail: "Chi tiết hình ảnh",
  title: "Tiêu đề",
  edit_image_title: "Chỉnh sửa tiêu đề hình ảnh",
  image_title_placeholder: "Tên hình ảnh (tùy chọn)",
  title_updated: "Đã cập nhật tiêu đề",

  // Drawing
  draw_enabled: "Vẽ BẬT",
  draw_disabled: "Vẽ TẮT",
  draw_state: "Trạng thái vẽ",
  draw_this_tile: "Vẽ tile này",
  enabled: "Đã bật",
  disabled: "Đã tắt",
  invalid_coordinates: "Tọa độ không hợp lệ",
  coordinates_updated: "Đã cập nhật tọa độ",
  goto_map: "Đến bản đồ",
  share: "Tải xuống",
  image_share: "Chia sẻ hình ảnh",
  tile_coordinate: "Tọa độ ô",
  pixel_coordinate: "Tọa độ pixel",
  coordinates: "Tọa độ",
  lat_lng: "Vĩ độ/Kinh độ",
  share_description:
    "Tên tệp hình ảnh này chứa thông tin tọa độ. Khi bạn thêm hình ảnh đã tải vào thư viện lại, nó sẽ tự động được đặt ở cùng vị trí.",
  no_position_data: "Không có dữ liệu vị trí",
  download_success: "Tải xuống thành công",
  error: "Lỗi",
  deleted: "Đã xóa",

  // popup
  buy_me_coffee: "Mời tác giả cà phê",
  popup_language: "Ngôn ngữ",
  popup_navigation: "Điều hướng",
  popup_navigation_map_jump: "Nhảy trên Bản đồ",
  popup_navigation_url_jump: "Nhảy theo URL",
  popup_lock_button: "Nút Khóa Lớn (Di động)",
  popup_close_confirm: "Xác nhận khi Đóng Bảng Vẽ",
  popup_paint_mode_style: "Ẩn FAB khi Chế độ Vẽ",
  popup_close_button_swap: "Đổi Vị trí Nút Đóng",
  popup_bug_report: "Báo Lỗi",
  popup_fab_visibility: "Hiện/Ẩn FAB",
  popup_fab_gallery: "Thư viện",
  popup_fab_bookmark: "Dấu trang",
  popup_fab_time_travel: "Du hành thời gian",
  popup_fab_color_filter: "Bộ lọc màu",
  popup_fab_data_saver: "Tiết kiệm dữ liệu",
  popup_fab_map_filter: "Bộ lọc bản đồ",

  // Color Filter
  color_filter: "Bộ lọc màu",
  enable_all: "Bật tất cả",
  disable_all: "Tắt tất cả",
  free_colors_only: "Chỉ màu miễn phí",
  owned_colors_only: "Chỉ màu sở hữu",
  disable_unused_colors: "Tắt màu không dùng",
  enhanced: "Nâng cao",
  show_selected_color_only: "Chỉ hiển thị màu đã chọn",

  // User Status (Notification Modal)
  user_status_details: "Chi tiết trạng thái người dùng",
  level_progress: "Tiến trình cấp độ",
  current_level: "Cấp độ hiện tại",
  pixels_painted: "Pixel đã vẽ",
  next_level: "Cấp độ tiếp theo",
  charge_status: "Trạng thái sạc",
  time_to_full: "Thời gian đến đầy",
  full_charge_at: "Sạc đầy lúc",
  fully_charged: "⚡ ĐÃ SẠC ĐẦY!",
  alarm_active: "⏰ Báo thức hoạt động",
  scheduled: "Đã lên lịch",
  no_alarm_set: "😴 Chưa đặt báo thức",
  charge_alarm: "🔔 Báo thức sạc",
  alarm_browser_warning: "※ Sẽ không thông báo nếu đóng trình duyệt",
  loading_alarm_settings: "Đang tải cài đặt báo thức...",
  notification_threshold: "Ngưỡng thông báo",
  estimated_time: "Thời gian ước tính",
  already_reached: "Đã đạt được",
  enable_alarm: "Bật báo thức",
  disable_alarm: "Tắt báo thức",
  add_to_calendar_title: "Google Calendar",
  wplace_charged_event: "WPlace đã sạc ⚡",

  // Theme Toggle
  theme_toggle: "Chuyển đổi giao diện",
  theme_light: "Giao diện sáng",
  theme_dark: "Giao diện tối",
  theme_switched: "Đã chuyển giao diện",

  // Enhanced Draw Modes
  enhanced_mode_label: "Chế độ vẽ",
  enhanced_mode_dot: "Chấm",
  enhanced_mode_cross: "Chữ thập",
  enhanced_mode_fill: "Tô đầy",
  enhanced_mode_red_cross: "Chữ thập màu",
  enhanced_mode_border_only: "Chỉ viền",
  enhanced_mode_dark_cross: "Chữ thập tối",
  enhanced_mode_complement_cross: "Chữ thập bổ sung",
  enhanced_mode_red_border: "Viền màu",
  enhanced_mode_huge_red_cross: "Chữ thập màu khổng lồ",
  enhanced_mode_huge_red_cross_bold: "Chữ thập màu khổng lồ (Đậm)",
  enhanced_mode_huge_red_diamond: "Hình thoi màu khổng lồ",
  enhanced_mode_huge_red_ring: "Vòng màu khổng lồ",
  marker_color: "Màu đánh dấu",

  // Auto Spoit
  auto_spoit: "Chọn màu tự động",
  auto_spoit_tooltip: "Chọn màu tự động",
  auto_dotter_warning: `
• Đây là tính năng thử nghiệm "tự động nhấn Space khi rê qua vùng đỏ"
• Đây là tính năng kiểm thử cho nhà phát triển
• Chỉ dùng cho mục đích kiểm thử
• Tô quá nhanh hoặc không tự nhiên có thể bị hiểu nhầm là BOT
• Tự chịu rủi ro khi sử dụng
`,

  // Sort Order
  sort_order_default: "Mặc định",
  sort_order_most_missing: "Thiếu nhiều nhất",
  sort_order_least_remaining: "Gần hoàn thành",

  // Compute Device
  compute_device_label: "Xử lý",

  // Show Unplaced Only
  show_unplaced_only: "Làm mờ màu đã đặt",

  // Tile Merge
  tile_merge: "Hợp nhất ô",
  merge_tiles: "Hợp nhất ô",
  export_png: "Xuất PNG",
  clear_selection: "Xóa lựa chọn",
  selected: "Đã chọn",

  // Tile Statistics
  tile_statistics: "Thống kê ô",
  statistics: "Thống kê",
  calculating: "Đang tính toán",
  total_pixels: "Tổng số pixel",
  color_distribution: "Phân bố màu",

  // Bookmark Tags
  existing_tags: "Thẻ hiện có",
  new_tag: "Tạo thẻ mới",
  remove_tag: "Xóa thẻ",
  bookmark_name: "Tên đánh dấu",
  tag_name: "Tên thẻ",
  tag_color: "Màu thẻ",
  optional: "Tùy chọn",
  required: "Bắt buộc",
  edit_tag: "Chỉnh sửa thẻ",
  tag_edit_title: "Chỉnh sửa thẻ",
  tag_edit_description: "Tất cả đánh dấu sử dụng thẻ này sẽ được cập nhật",
  tag_delete_confirm:
    "Xóa thẻ này? Thẻ sẽ bị xóa khỏi tất cả đánh dấu sử dụng nó.",

  // Coordinate Jumper
  coordinate_jumper: "Nhảy tọa độ",
  geographic_coordinates: "Tọa độ địa lý",
  tile_coordinates: "Tọa độ ô",
  jump_to_coordinates: "Nhảy đến tọa độ",

  // Location Search
  location_search: "Tìm kiếm vị trí",
  search_location: "Tìm kiếm vị trí",
  enter_place_name: "Nhập tên địa điểm",
  searching: "Đang tìm kiếm...",
  no_results_found: "Không tìm thấy kết quả",
  search_results: "Kết quả tìm kiếm",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Nhập tọa độ (Tùy chọn)",
  tile_x: "Ô X",
  tile_y: "Ô Y",
  pixel_x: "Pixel X",
  pixel_y: "Pixel Y",
  coordinate_input_hint:
    "Nếu bạn nhập tọa độ, hình ảnh sẽ tự động được đặt tại vị trí đó khi được thêm vào thư viện",

  // Data Saver
  data_saver: "Tiết kiệm dữ liệu",
  data_saver_on: "Tiết kiệm dữ liệu BẬT",
  data_saver_off: "Tiết kiệm dữ liệu TẮT",
  data_saver_rendering_paused: "Đang tạm dừng kết xuất",
  storage_usage: "Sử dụng lưu trữ",
  cache_usage: "Sử dụng bộ nhớ cache",
  offline_cache_settings: "Cài đặt bộ nhớ cache ngoại tuyến",
  maximum_cache_size: "Kích thước bộ nhớ cache tối đa",
  clear_all_cache: "Xóa tất cả bộ nhớ cache",
  clearing: "Đang xóa...",
  cache_cleared: "Đã xóa bộ nhớ cache!",
  tiles: "ô",

  // Close Confirm
  confirm_close_paint_modal:
    "Bạn có thể mất phần việc đang làm. Bạn có chắc muốn đóng không?",

  // Friends Book
  friends_book: "Danh sách bạn bè",
  add_to_friends: "Thêm vào bạn bè",
  add_friend: "Thêm bạn",
  user_id: "ID người dùng",
  user_id_placeholder: "vd. 12345",
  user_name: "Tên người dùng",
  user_name_placeholder: "vd. TênNgườiChơi",
  please_enter_id_and_name: "Vui lòng nhập ID và tên",
  edit_friend: "Chỉnh sửa bạn",
  description: "Mô tả",
  description_placeholder: "Nhập mô tả...",
  tag: "Thẻ",
  tags: "Các thẻ",
  create_new_tag: "Tạo thẻ mới",
  clear_tag: "Xóa thẻ",
  tag_name_placeholder: "vd: Bạn bè, Đối thủ...",
  select_color: "Chọn màu",
  create: "Tạo",
  no_friends: "Không có bạn bè",
  sort_added: "Ngày thêm",
  sort_id: "ID",
  import_merge_confirm:
    "bạn bè để nhập?\nSẽ hợp nhất với dữ liệu hiện có (ID giống nhau sẽ bị ghi đè).",
  import_merge_description: "Dữ liệu hiện có sẽ được giữ lại.",
  import_friends_description: "Nhập danh sách người chơi từ tệp CSV",
  export_all_friends_description: "Xuất tất cả bạn bè dưới dạng tệp CSV",
  export_friends_by_tag_description:
    "Chỉ xuất bạn bè có thẻ đã chọn dưới dạng CSV",
  online_sync: "Nhập trực tuyến",
  online_sync_description:
    "Nhập danh sách bạn bè từ URL CSV (vd. URL công bố của Google Sheets)",
  sync_merge: "Nhập gộp",
  sync_replace: "Nhập thay thế",
  please_enter_sync_url: "Vui lòng nhập URL nhập",
  sync_failed: "Nhập thất bại",
  sync_replace_confirm:
    "Bạn có chắc muốn thay thế tất cả bạn bè?\nTất cả danh sách hiện có sẽ bị xóa và thay bằng dữ liệu từ URL.",
  open_url: "Mở URL",

  // Tutorial
  tutorial_title: "Hướng dẫn",
  tutorial_how_to_draw_title: "Cách Vẽ Hình Ảnh Trên Bản Đồ",
  tutorial_how_to_draw_step1: "Lưu một hình ảnh vào thư viện",
  tutorial_how_to_draw_step2: "Nhấp vào bản đồ và chọn nút 'Hình ảnh'",
  tutorial_how_to_draw_step3:
    "Nhấp vào hình ảnh bạn muốn đặt, hình ảnh sẽ hiển thị chồng lên ô bản đồ",
  tutorial_how_to_archive_title: "Cách Lưu Trữ Pixel Art Trên Bản Đồ",
  tutorial_how_to_archive_step1: "Nhấp vào bản đồ và chọn 'Lưu trữ'",
  tutorial_how_to_archive_step2: "Nhấp nút 'Lưu ô hiện tại'",
  tutorial_how_to_draw_archive_title: "Cách Vẽ Pixel Art Đã Lưu Trữ",
  tutorial_how_to_draw_archive_step1: "Nhấp vào bản đồ và chọn 'Lưu trữ'",
  tutorial_how_to_draw_archive_step2:
    "Nhấp vào bản lưu trữ bạn muốn hiển thị",
  tutorial_how_to_draw_archive_step3: "Nhấp nút vẽ",
  tutorial_how_to_draw_text_title: "Cách Hiển Thị Văn Bản Trên Bản Đồ",
  tutorial_how_to_draw_text_step1: "Nhấp vào bản đồ và chọn 'Văn bản'",
  tutorial_how_to_draw_text_step2:
    "Nhập văn bản, chọn phông chữ và nhấp nút 'Vẽ'",
  tutorial_how_to_draw_text_step3:
    "Tùy chọn: dùng các nút mũi tên để chỉnh vị trí",
  tutorial_how_to_bookmark_title: "Cách Thêm Và Đi Đến Đánh Dấu",
  tutorial_how_to_bookmark_step1:
    "Nhấp vào bản đồ và chọn biểu tượng ⭐",
  tutorial_how_to_bookmark_step2: "Nhập tên đánh dấu và lưu",
  tutorial_how_to_bookmark_step3:
    "Nhấp nút ⭐ ở góc dưới bên trái và chọn một đánh dấu để đi đến",

  // Empty states
  empty_archive_message:
    "Chưa có ô lưu trữ nào. Nhấp vào bản đồ để bắt đầu lưu trữ!",
  empty_bookmark_message:
    "Chưa có đánh dấu nào. Nhấp vào bản đồ và chọn biểu tượng ⭐ để lưu vị trí yêu thích!",

  // Map Filter Menu
  map_filter_darkTheme: "Giao diện tối",
  map_filter_highContrast: "Tương phản cao",
  map_filter_tileBoundaries: "Ranh giới ô",
  map_filter_gridDisplay: "Lưới pixel",
  map_filter_backgroundColor: "Màu nền",
  map_filter_map3d: "Chế độ 3D",
  map_filter_mapSky: "Bầu trời & Sương",
  draw_on_map: "Vẽ lên bản đồ",
  outline_preserve: "Giữ viền",
  outline_width: "Độ dày viền",
  outline_sensitivity: "Độ nhạy",
  outline_use_fixed_color: "Dùng màu viền cố định",
  outline_color: "Màu viền",
  hint_title: "Gợi ý",
  hint_close: "Đóng gợi ý",
  hint_show_unplaced_only: "Tính năng này làm cho các màu đã đặt bớt nổi bật hơn.",
  hint_color_isolate: "Chỉ hiển thị màu đã chọn sẽ làm nổi bật đúng màu đang chọn để bạn tập trung hơn khi vẽ.",
  hint_data_saver: "Tiết kiệm dữ liệu sẽ tạm dừng các cập nhật tile nặng để giảm tải mạng và kết xuất. Nhấn lại để tiếp tục cập nhật bình thường.",
};
