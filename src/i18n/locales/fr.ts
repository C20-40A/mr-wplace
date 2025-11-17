// Dictionnaire de traduction français
export const frTranslations = {
  // Gallery
  gallery: "Galerie",
  back: "Retour",
  close: "Fermer",

  // Buttons
  save: "Enregistrer",
  delete: "Supprimer",
  edit: "Modifier",
  update: "Mettre à jour",
  updated: "Mis à jour",
  add: "Ajouter",
  select: "Sélectionner",
  cancel: "Annuler",
  bookmarks: "favoris",
  bookmark: "Favori",
  save_location: "Enregistrer l'emplacement",
  draw: "Dessiner",
  draw_image: "Image",
  text_draw: "Texte",
  text_clear: "Effacer le texte",
  timetravel: "Archive",
  export: "Exporter",
  import: "Importer",

  // Gallery Export/Import
  gallery_data: "Données de la galerie",
  import_gallery: "Importer la galerie",
  export_gallery: "Exporter la galerie",
  reset_gallery: "Réinitialiser la galerie",
  exporting: "Exportation...",
  importing: "Importation...",
  resetting: "Réinitialisation...",
  export_success: "{count} images exportées",
  export_failed: "Échec de l'exportation",
  import_success: "{count} images importées",
  import_failed: "Échec de l'importation",
  reset_failed: "Échec de la réinitialisation",
  gallery_reset_success: "La galerie a été réinitialisée",
  no_images_to_export: "Aucune image à exporter (coordonnées requises)",
  no_valid_images_in_zip: "Aucune image valide trouvée dans le fichier ZIP",
  confirm_import:
    "Voulez-vous vraiment importer ? Cela ajoutera de nouvelles images à votre galerie.",
  confirm_reset:
    "Voulez-vous vraiment réinitialiser toutes les images de la galerie ? Cette action est irréversible.",

  // Messages
  loading: "Chargement...",
  no_items: "Aucun élément",
  delete_confirm: "Voulez-vous vraiment supprimer ?",
  saved_message: "enregistré",
  deleted_message: "Supprimé",

  // Bookmarks
  no_bookmarks: "Aucun favori",
  add_bookmark_instruction:
    'Cliquez sur la carte et utilisez le bouton "Favori" pour ajouter',
  location_unavailable: "Impossible de récupérer les informations de localisation.",
  location_unavailable_instruction:
    "Impossible de récupérer les informations de localisation. Veuillez cliquer sur la carte puis enregistrer.",
  enter_bookmark_name: "Veuillez entrer le nom du favori :",
  location_point: "Point",
  bookmark_list: "Liste des favoris",
  sort_created: "Date d'ajout",
  sort_accessed: "Dernier accès",
  sort_tag: "Par étiquette",
  sort_distance: "Par distance",
  sort_last_updated: "Récemment enregistré",
  sort_tile_count: "Par nombre de tuiles",
  sort_name: "Par nom",
  sort_layer: "Ordre des calques",

  // Import/Export関連
  import_export: "Importer/Exporter",
  import_description: "Importer des favoris depuis un fichier JSON",
  export_all: "Tout exporter",
  export_all_description: "Exporter tous les favoris",
  export_by_tag: "Exporter par étiquette",
  export_by_tag_description: "Exporter uniquement les favoris avec les étiquettes sélectionnées",
  export_selected_tags: "Exporter les étiquettes sélectionnées",
  no_tags_available: "Aucune étiquette disponible",
  no_name: "Sans nom",
  no_export_bookmarks: "Aucun favori à exporter",
  bookmarks_exported: " favoris exportés",
  file_input_not_found: "Entrée de fichier introuvable",
  no_file_selected: "Aucun fichier sélectionné",
  invalid_file_format: "Format de fichier invalide",
  import_confirm:
    "Voulez-vous vraiment importer les favoris ?\nLes données existantes seront conservées.",
  import_cancelled: "Importation annulée",
  bookmarks_imported: " favoris importés",

  // Snapshots
  timetravel_modal_title: "Machine à remonter le temps",
  timetravel_current_position: "Instantanés de la position actuelle",
  timetravel_tile_list: "Liste des tuiles",
  timetravel_tile_snapshots: "Instantanés de tuiles",
  save_current_snapshot: "Enregistrer l'instantané actuel",
  snapshot_detail: "Détails de l'instantané",
  snapshot_share: "Partager l'instantané",
  snapshot_timestamp: "Horodatage de l'instantané",
  snapshot_share_description:
    "Ce nom de fichier contient les informations de coordonnées et d'horodatage. Lorsque vous le réimportez depuis la liste des tuiles, il sera enregistré en tant qu'instantané à la même position et au même moment.",
  return_to_current: "Retour à l'actuel",
  enter_snapshot_name: "Entrez le nom de l'instantané (vide pour l'horodatage) :",
  enter_tile_name: "Entrez le nom de la tuile (vide pour les coordonnées) :",

  // Image Editor
  drag_drop_or_click: "Glisser-déposer ou cliquer pour sélectionner une image",
  clear_image: "Effacer l'image",
  original_image: "Image d'origine",
  click_or_drop_to_change: "Cliquer ou déposer pour changer",
  current_image: "Image actuelle",
  reset_edit: "Réinitialiser les modifications",
  reset_viewport: "Réinitialiser la vue",
  size_reduction: "Réduction de taille",
  brightness: "Luminosité",
  contrast: "Contraste",
  saturation: "Saturation",
  sharpness: "Netteté",
  dithering: "Tramage",
  quantization_method: "Méthode de quantification",
  quantization_rgb_euclidean: "Distance RVB (Rapide, par défaut)",
  quantization_weighted_rgb: "RVB pondéré (Moyen, naturel)",
  quantization_lab: "Espace colorimétrique Lab (Lent, haute qualité)",
  include_paid_colors: "Inclure les couleurs payantes",
  add_to_gallery: "Ajouter à la galerie",
  download: "Télécharger",
  clear_image_confirm: "Effacer l'image et revenir à l'état initial ?",
  saved_to_gallery: "Image enregistrée dans la galerie",
  large_image_resize_confirm:
    "La taille de l'image est importante et peut entraîner un traitement lent.\nVoulez-vous redimensionner l'image ?",
  current_size: "Taille actuelle",
  resize_to: "Redimensionner à",
  resize_image: "Redimensionner",
  edit_image: "Modifier",
  add_to_gallery_directly: "Ajouter directement à la galerie",
  select_image: "Sélectionner une image",
  click_image_to_draw: "Cliquez sur l'image que vous souhaitez dessiner sur la carte",
  no_draw_images: "Aucune image pour le dessin.",
  no_saved_images: "Aucune image enregistrée",
  unplaced_images: "Images non placées",
  layers: "Calques",
  no_layers: "Aucun calque",
  delete_image_confirm: "Voulez-vous supprimer cette image ?",

  // Drawing/Loading
  drawing_image: "Dessin de l'image...",
  processing_image: "Traitement de l'image...",
  waiting_for_update: "En attente de mise à jour...",

  // File related
  upload: "Téléverser",
  file_select: "Sélectionner un fichier",
  image_editor: "Éditeur d'images",
  image_detail: "Détails de l'image",
  title: "Titre",
  edit_image_title: "Modifier le titre de l'image",
  image_title_placeholder: "Nom de l'image (facultatif)",
  title_updated: "Titre mis à jour",

  // Drawing
  draw_enabled: "Dessin ACTIVÉ",
  draw_disabled: "Dessin DÉSACTIVÉ",
  draw_state: "État du dessin",
  draw_this_tile: "Dessiner cette tuile",
  enabled: "Activé",
  disabled: "Désactivé",
  invalid_coordinates: "Coordonnées invalides",
  coordinates_updated: "Coordonnées mises à jour",
  goto_map: "Aller à la carte",
  share: "Partager",
  image_share: "Partager l'image",
  tile_coordinate: "Coordonnées de tuile",
  pixel_coordinate: "Coordonnées de pixel",
  lat_lng: "Latitude/Longitude",
  coordinates: "Coordonnées",
  share_description:
    "Ce nom de fichier d'image contient des informations de coordonnées. Lorsque vous ajoutez à nouveau l'image téléchargée à la galerie, elle sera automatiquement placée à la même position.",
  no_position_data: "Aucune donnée de position",
  download_success: "Téléchargement réussi",
  error: "Erreur",
  deleted: "Supprimé",

  // popup専用
  buy_me_coffee: "Offrez-moi un café",

  // Color Filter
  color_filter: "Filtre de couleur",
  enable_all: "Tout activer",
  disable_all: "Tout désactiver",
  free_colors_only: "Couleurs gratuites",
  owned_colors_only: "Couleurs possédées",
  enhanced: "Amélioré",
  show_selected_color_only: "Afficher uniquement la couleur sélectionnée",

  // User Status (Notification Modal)
  user_status_details: "Détails du statut utilisateur",
  level_progress: "Progression du niveau",
  current_level: "Niveau actuel",
  pixels_painted: "Pixels peints",
  next_level: "Niveau suivant",
  charge_status: "État de charge",
  time_to_full: "Temps jusqu'à pleine charge",
  full_charge_at: "Charge complète à",
  fully_charged: "⚡ COMPLÈTEMENT CHARGÉ !",
  alarm_active: "⏰ Alarme active",
  scheduled: "Programmé",
  no_alarm_set: "😴 Aucune alarme définie",
  charge_alarm: "🔔 Alarme de charge",
  loading_alarm_settings: "Chargement des paramètres d'alarme...",
  notification_threshold: "Seuil de notification",
  estimated_time: "Temps estimé",
  already_reached: "Déjà atteint",
  enable_alarm: "Activer l'alarme",
  disable_alarm: "Désactiver l'alarme",
  add_to_calendar_title: "Google Agenda",
  wplace_charged_event: "WPlace chargé ⚡",

  // Theme Toggle
  theme_toggle: "Basculer le thème",
  theme_light: "Thème clair",
  theme_dark: "Thème sombre",
  theme_switched: "Thème changé",

  // Enhanced Draw Modes
  enhanced_mode_label: "Mode de dessin",
  enhanced_mode_dot: "Point",
  enhanced_mode_cross: "Croix",
  enhanced_mode_fill: "Remplir",
  enhanced_mode_red_cross: "Croix rouge",
  enhanced_mode_cyan_cross: "Croix cyan",
  enhanced_mode_dark_cross: "Croix sombre",
  enhanced_mode_complement_cross: "Croix complémentaire",
  enhanced_mode_red_border: "Bordure rouge",

  // Auto Spoit
  auto_spoit: "Pipette automatique",
  auto_spoit_tooltip: "Pipette automatique",

  auto_dotter_warning: `
• Il s'agit d'une fonctionnalité expérimentale qui "appuie automatiquement sur Espace au survol des zones rouges"
• Il s'agit d'une fonctionnalité de vérification pour les développeurs
• À utiliser uniquement à des fins de test
• Une peinture trop rapide ou non naturelle peut être considérée comme un comportement BOT
• Utilisation à vos risques et périls
`,

  // Sort Order
  sort_order_default: "Par défaut",
  sort_order_most_missing: "Plus manquant",
  sort_order_least_remaining: "Presque terminé",

  // Compute Device
  compute_device_label: "Traitement",

  // Show Unplaced Only
  show_unplaced_only: "Non placés uniquement",

  // Tile Merge
  tile_merge: "Fusion de tuiles",
  merge_tiles: "Fusionner les tuiles",
  export_png: "Exporter PNG",
  clear_selection: "Effacer la sélection",
  selected: "Sélectionné",

  // Tile Statistics
  tile_statistics: "Statistiques de tuile",
  statistics: "Statistiques",
  calculating: "Calcul en cours",
  total_pixels: "Total de pixels",
  color_distribution: "Distribution des couleurs",

  // Bookmark Tags
  existing_tags: "Étiquettes existantes",
  remove_tag: "Supprimer l'étiquette",
  bookmark_name: "Nom du favori",
  tag_name: "Nom de l'étiquette",
  tag_color: "Couleur de l'étiquette",
  optional: "Facultatif",
  required: "Requis",
  edit_tag: "Modifier l'étiquette",
  tag_edit_title: "Modifier l'étiquette",
  tag_edit_description: "Tous les favoris utilisant cette étiquette seront mis à jour",
  tag_delete_confirm:
    "Supprimer cette étiquette ? L'étiquette sera retirée de tous les favoris qui l'utilisent.",

  // Coordinate Jumper
  coordinate_jumper: "Saut de coordonnées",
  geographic_coordinates: "Coordonnées géographiques",
  tile_coordinates: "Coordonnées de tuile",
  jump_to_coordinates: "Sauter aux coordonnées",

  // Location Search
  location_search: "Recherche de lieu",
  search_location: "Rechercher un lieu",
  enter_place_name: "Entrez le nom du lieu",
  searching: "Recherche...",
  no_results_found: "Aucun résultat trouvé",
  search_results: "Résultats de recherche",

  // Coordinate Input (Image Editor)
  coordinate_input_optional: "Saisie des coordonnées (facultatif)",
  tile_x: "Tuile X",
  tile_y: "Tuile Y",
  pixel_x: "Pixel X",
  pixel_y: "Pixel Y",
  coordinate_input_hint:
    "Si vous entrez des coordonnées, l'image sera automatiquement placée à cette position lors de l'ajout à la galerie",

  // Data Saver
  data_saver: "Économiseur de données",
  data_saver_on: "Économiseur de données ACTIVÉ",
  data_saver_off: "Économiseur de données DÉSACTIVÉ",
  data_saver_rendering_paused: "Rendu en pause",
  storage_usage: "Utilisation du stockage",
  cache_usage: "Utilisation du cache",
  offline_cache_settings: "Paramètres du cache hors ligne",
  maximum_cache_size: "Taille maximale du cache",
  clear_all_cache: "Effacer tout le cache",
  clearing: "Effacement...",
  cache_cleared: "Cache effacé !",
  tiles: "tuiles",

  // Friends Book
  friends_book: "Amis",
  add_to_friends: "Ajouter aux amis",
  add_friend: "Ajouter un ami",
  edit_friend: "Modifier l'ami",
  description: "Description",
  description_placeholder: "Entrez une description...",
  tag: "Étiquette",
  tags: "Étiquettes",
  new_tag: "Nouvelle étiquette",
  create_new_tag: "Créer une nouvelle étiquette",
  clear_tag: "Effacer l'étiquette",
  tag_name_placeholder: "par ex. Ami, Rival...",
  select_color: "Sélectionner une couleur",
  create: "Créer",
  no_friends: "Aucun ami",
  sort_added: "Date d'ajout",
  import_merge_confirm:
    "amis à importer ?\nSera fusionné avec les données existantes (le même ID sera écrasé).",
  import_merge_description: "Les données existantes seront conservées.",
};
