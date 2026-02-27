# WPlace API Endpoints (Updated from `docs/code.ts`)

`docs/code.ts` を基準に、現在クライアント実装で呼ばれている API を整理。

## Auth / Account
- `GET /me`
- `POST /auth/logout`
- `POST /me/update`
- `DELETE /me`
- `POST /discord/unlink`
- `DELETE /me/sessions`
- `GET /me/last-appeal`
- `GET /me/pixels-painted-today`

## OTP
- `GET /otp/cooldown`
- `POST /otp/send`
- `POST /otp/verify`

## Paint / Tile
- `POST /s{season}/pixel/{tileX}/{tileY}`
- `GET /s{season}/pixel/{tileX}/{tileY}?x={x}&y={y}[&christmasTreeId={id}]`
- `POST /staff/tools/select-area/clear/s{season}/pixel/{tileX}/{tileY}`
- `GET /staff/tools/select-area/s{season}/{tileX}/{tileY}?x0={x0}&y0={y0}&x1={x1}&y1={y1}`
- `GET /s{season}/tile/random`

## Favorite Locations
- `POST /favorite-location`
- `POST /favorite-location/delete`
- `POST /favorite-location/update`

## Leaderboards
- `period`: `today | week | month | all-time`
- `GET /leaderboard/player/{period}`
- `GET /leaderboard/alliance/{period}`
- `GET /leaderboard/region/{period}/{regionId}`
- `GET /leaderboard/region/players/{period}/{regionId}`
- `GET /leaderboard/region/alliances/{period}/{regionId}`
- `GET /leaderboard/country/{period}`

## Alliance (User)
- `GET /alliance`
- `POST /alliance`
- `POST /alliance/leave`
- `POST /alliance/update-description`
- `POST /alliance/update-headquarters`
- `GET /alliance/leaderboard/{period}`
- `GET /alliance/invites`
- `GET /alliance/join/{allianceId}`
- `GET /alliance/members/{allianceId}`
- `GET /alliance/members/banned/{allianceId}`
- `POST /alliance/give-admin`
- `POST /alliance/ban`
- `POST /alliance/unban`

## Shop / Payment / Cosmetics
- `POST /purchase`
- `POST /payment/refresh-session/{sessionId}`
- `POST /payment/abacatepay/create/pix/{productId}`
- `POST /payment/abacatepay/refresh/pix/{paymentId}`
- `GET /payment/abacatepay/status/pix/{paymentId}`
- `POST /flag/equip/{flagId}`
- `GET /me/profile-pictures`
- `POST /me/profile-picture/change`
- `GET /me/frames`
- `POST /me/frames/equip/{frameId}`
- `GET /me/badges`
- `POST /me/badges/equip`
- `POST /me/cosmetic/equip`
- `GET /me/cosmetics/name`
- `GET /store/frames`
- `POST /store/frames/buy/{frameId}`
- `GET /store/name`
- `POST /store/name/buy/{cosmeticId}`

## Reports / Appeals / Notifications
- `POST /report/user/name`
- `POST /report/alliance/name`
- `POST /report/appeal`
- `GET /staff/appeals/get`
- `POST /staff/appeals/{appealId}/handle`
- `POST /staff/appeals/assign`
- `GET /staff/appeals/open_count`
- `GET /staff/appeals/notes?userId={userId}`
- `POST /staff/appeals/notes?userId={userId}`
- `GET /staff/appeals/tickets?{params}`
- `POST /staff/appeals/translate`
- `GET /notification/count`
- `GET /notification/page?cursor={cursor}`
- `POST /notification/mark-read`
- `POST /notification/mark-read/all`

## Staff - Tickets / Users / Dashboard
- `GET /staff/tickets/get`
- `GET /staff/tickets/closed-today`
- `GET /staff/tickets/open_count`
- `POST /staff/tickets/assign`
- `POST /staff/tickets/set-status`
- `POST /staff/tickets/translate`
- `GET /staff/dashboard/summary/counters/tickets`
- `GET /staff/dashboard/summary/counters/reports`
- `GET /staff/dashboard/ban-appeals/see?start={iso}&end={iso}`
- `GET /staff/dashboard/team/closed-tickets?start={iso}&end={iso}`
- `GET /staff/dashboard/team/closed-reports?start={iso}&end={iso}`
- `GET /staff/dashboard/kpi/tickets?{params}`
- `POST /staff/dashboard/summary/users/ban`
- `POST /staff/dashboard/summary/users/timeout`
- `POST /staff/dashboard/summary/users/increment-droplet`
- `POST /staff/dashboard/summary/users/unban`
- `GET /staff/dashboard/users/info?id={userId}`
- `GET /staff/dashboard/users/info-by-email?email={email}`
- `POST /staff/dashboard/users/remove-ban`
- `POST /staff/dashboard/users/remove-timeout`
- `GET /staff/dashboard/users/notes?userId={userId}`
- `POST /staff/dashboard/users/notes?userId={userId}`
- `GET /staff/dashboard/users/purchases?userId={userId}`
- `POST /staff/dashboard/users/set-user-droplets`
- `POST /staff/dashboard/users/rename`
- `GET /staff/dashboard/users/tickets?{params}`
- `GET /staff/dashboard/users/tickets/stats?id={userId}`
- `DELETE /staff/dashboard/users/{userId}/sessions`
- `POST /staff/dashboard/permissions/set`
- `GET /staff/dashboard/permissions/get?userId={userId}`
- `POST /staff/dashboard/users/{action}`
- `POST /staff/tools/select-area/{action}`
- `POST /staff/tools/select-pixel/{action}`
- `POST /staff/tools/select-area/users`

## Staff - Alliances / Audit / Ban Waves
- `GET /staff/dashboard/alliances/{allianceId}`
- `GET /staff/dashboard/alliances/search?q={query}`
- `GET /staff/dashboard/alliances/{allianceId}/full`
- `GET /staff/dashboard/alliances/{allianceId}/members?page={page}&pageSize={size}`
- `POST /staff/dashboard/alliances/{allianceId}/rename`
- `POST /staff/dashboard/alliances/{allianceId}/leader`
- `POST /staff/dashboard/alliances/{allianceId}/ban-all`
- `POST /staff/dashboard/alliances/{allianceId}/members/{userId}/role`
- `POST /staff/dashboard/alliances/{allianceId}/members/{userId}/remove`
- `GET /staff/dashboard/audit-logs/see?{params}`
- `GET /staff/dashboard/ban-waves/see`
- `POST /staff/dashboard/ban-waves/execute`

## Events / Wayback / Tools
- `POST /event/christmas/claim/{christmasTreeId}`
- `GET /event/christmas/presents`
- `POST /event/christmas/open-case`
- `GET /staff/dashboard/summary/events/status`
- `POST /staff/dashboard/summary/events/start`
- `POST /staff/dashboard/summary/events/stop`
- `GET /staff/dashboard/summary/events/anchors?event={eventId}`
- `GET /staff/tools/wayback/s{season}/l{limit}/x{tileX}/y{tileY}/t{timestamp}[?cursorTs={ts}&cursorUserId={id}&cursorAllianceId={id}&cursorPixelsCount={count}]`
- `GET /staff/tools/wayback/s{season}/video?{params}`
- `POST /staff/tools/wayback/s{season}/reconstruct`
- `POST /staff/tools/auto-painter/paint`

## Staff - Store Manager
- `POST /staff/store-manager/frames`
- `POST /staff/store-manager/fonts`
- `POST /staff/store-manager/styles`
- `POST /staff/dashboard/store-manager/badges`
- `GET /staff/store-manager/images?page={page}&pageSize={size}`
- `POST /staff/store-manager/images`
- `DELETE /staff/store-manager/images/{imageId}`

## Other
- `POST /pawtect/load`
- `GET /health`

## Renamed (Old -> New)
- `/moderator/pixel-area/...` -> `/staff/tools/select-area/...`
- `/moderator/tickets*` -> `/staff/tickets*`
- `/moderator/report/appeal*` -> `/staff/appeals*`
- `/admin/alliances*` -> `/staff/dashboard/alliances*`
- `/admin/users*` -> `/staff/dashboard/users*`
- `/admin/count-all-*` -> `/staff/dashboard/summary/counters/*`
- `/admin/closed-*` -> `/staff/dashboard/team/closed-*`
- `/admin/ban-wave*` -> `/staff/dashboard/ban-waves/*`
- `/admin/event/*` -> `/staff/dashboard/summary/events/*`
- `/admin/audit-logs*` -> `/staff/dashboard/audit-logs/see`
- `/notification?page=` -> `/notification/page?cursor=`

## Legacy Constants (Unverified)
- **Tile Size**: 1000px
- **Zoom Level**: 11
- **Region Size**: 4 tiles
- **Refresh Interval**: 6000ms
- **Color Count**: 64 (32 base + 32 extra unlockable)

## Legacy Error Codes (Unverified)
- `401` - Not authenticated
- `403` - Forbidden / challenge required
- `429` - Rate limited
- `451` - Banned/timeout
- `needs_phone_verification` - Phone verification required

## Legacy Products (Unverified)
| ID | Name | Price | Currency |
|----|------|-------|----------|
| 10 | 25,000 Droplets | $5.00 | USD |
| 20 | 78,750 Droplets | $15.00 | USD |
| 30 | 165,000 Droplets | $30.00 | USD |
| 40 | 287,500 Droplets | $50.00 | USD |
| 50 | 450,000 Droplets | $75.00 | USD |
| 60 | 625,000 Droplets | $100.00 | USD |
| 70 | +5 Max Charges | 500 | Droplets |
| 80 | +30 Paint Charges | 500 | Droplets |
| 100 | Unlock Color | 2000 | Droplets |
| 110 | Flag | 20000 | Droplets |
| 120 | Profile Picture | 20000 | Droplets |
