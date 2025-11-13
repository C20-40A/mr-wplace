# WPlace API Endpoints

## Auth & User
- `GET /me` - Get current user
- `POST /auth/logout` - Logout
- `POST /me/update` - Update user (name, discord, etc)
- `DELETE /me` - Delete account (requires confirmText)
- `POST /discord/unlink` - Unlink Discord
- `DELETE /me/sessions` - Delete user sessions

## OTP
- `GET /otp/cooldown` - Get OTP cooldown
- `POST /otp/send` - Send OTP (phone verification)
- `POST /otp/verify` - Verify OTP code

## Paint
- `POST /s{season}/pixel/{tileX}/{tileY}` - Paint pixels
  - Headers: `x-pawtect-token`, `x-pawtect-variant`
  - Body: `{colors: [], coords: [], fp: string}`
- `GET /s{season}/pixel/{tileX}/{tileY}?x={x}&y={y}` - Get pixel info
- `GET /moderator/pixel-area/s{season}/{tileX}/{tileY}?x0={x0}&y0={y0}&x1={x1}&y1={y1}` - Get pixel area info (mod)

## Tiles
- `GET /s{season}/tile/random` - Get random tile

## Favorite Locations
- `POST /favorite-location` - Add favorite (lat, lng)
- `POST /favorite-location/delete` - Delete by id
- `POST /favorite-location/update` - Update name

## Leaderboards
- `GET /leaderboard/player/{season}` - Players
- `GET /leaderboard/alliance/{season}` - Alliances
- `GET /leaderboard/region/{season}/{regionId}` - Regions
- `GET /leaderboard/region/players/{season}/{regionId}` - Region players
- `GET /leaderboard/region/alliances/{season}/{regionId}` - Region alliances
- `GET /leaderboard/country/{season}` - Countries

## Shop & Payment
- `POST /purchase` - Purchase product by id
- `POST /payment/refresh-session/{sessionId}` - Refresh Stripe session
- `GET /me/profile-pictures` - Get owned profile pictures
- `POST /me/profile-picture/change` - Change profile picture
- `POST /flag/equip/{flagId}` - Equip flag

## Alliance
- `GET /alliance` - Get current alliance
- `POST /alliance` - Create alliance
- `POST /alliance/leave` - Leave alliance
- `POST /alliance/update-description` - Update description
- `POST /alliance/update-headquarters` - Update HQ coords
- `GET /alliance/leaderboard/{season}` - Alliance internal leaderboard
- `GET /alliance/invites` - Get invites
- `POST /alliance/join/{allianceId}` - Join alliance
- `GET /alliance/members/{allianceId}` - Get members
- `GET /alliance/members/banned/{allianceId}` - Get banned members
- `POST /alliance/give-admin` - Give admin to user
- `POST /alliance/ban` - Ban user from alliance
- `POST /alliance/unban` - Unban user

## Admin - Alliances
- `GET /admin/alliances/{id}` - Get alliance by ID
- `GET /admin/alliances/search?q={query}` - Search alliances
- `GET /admin/alliances/{id}/full` - Get full alliance data
- `GET /admin/alliances/{id}/members?page={page}` - Get members paginated
- `POST /admin/alliances/{id}/rename` - Rename alliance
- `POST /admin/alliances/{id}/leader` - Change leader
- `POST /admin/alliances/{id}/ban-all` - Ban all members
- `POST /admin/alliances/{id}/members/{userId}/role` - Set member role
- `POST /admin/alliances/{id}/members/{userId}/remove` - Remove member

## Admin - Users
- `GET /admin/users?id={userId}` - Get user full info
- `POST /admin/remove-timeout` - Remove timeout
- `POST /admin/remove-ban` - Remove ban
- `GET /admin/users/purchases?userId={userId}` - Get purchases
- `POST /admin/users/set-user-droplets` - Set droplets
- `DELETE /admin/users/{userId}/sessions` - Delete all user sessions
- `POST /admin/users/ban` - Ban users
- `POST /admin/users/timeout` - Timeout users
- `POST /admin/users/increment-droplet` - Increment droplets
- `POST /admin/users/unban` - Unban users

## Moderator - Users
- `GET /moderator/user-info/{userId}` - Get user info
- `POST /moderator/users` - Get multiple users info
- `GET /moderator/users/notes?userId={userId}` - Get user notes
- `POST /moderator/users/notes` - Add user note
- `GET /moderator/users/tickets?userId={userId}` - Get user tickets
- `POST /moderator/users/suspend` - Suspend users

## Moderator - Tickets
- `GET /moderator/tickets` - Get assigned tickets
- `GET /moderator/count-my-tickets` - Count closed tickets today
- `GET /moderator/open-tickets-count` - Non-paid user open tickets
- `POST /moderator/assign-new-tickets` - Assign tickets to self
- `POST /moderator/set-ticket-status` - Update ticket status
- `POST /moderator/ticket/translate` - Translate ticket text

## Admin - Tickets & Reports
- `GET /admin/count-all-tickets` - Open tickets summary
- `GET /admin/count-all-reports` - Open reports summary
- `GET /admin/closed-tickets?start={date}&end={date}` - Closed tickets by mod
- `GET /admin/closed-reports?start={date}&end={date}` - Closed reports by mod
- `GET /admin/users/tickets?userId={userId}` - Mod ticket stats

## Reports
- `POST /report/user/name` - Report username
- `POST /report/alliance/name` - Report alliance name
- `POST /report/appeal` - Submit ban appeal
- `GET /me/last-appeal` - Get last appeal

## Moderator - Appeals
- `GET /moderator/report/appeal` - Get open appeals
- `POST /moderator/report/appeal/{id}/handle` - Handle appeal
- `POST /moderator/report/appeal/assign` - Assign appeals
- `GET /moderator/report/appeals/count` - Pending appeals count

## Notifications
- `GET /notification/count` - Get unread count
- `GET /notification?page={page}` - Get notifications page
- `POST /notification/mark-read` - Mark notification read
- `POST /notification/mark-read/all` - Mark all read

## Admin - Ban Wave
- `GET /admin/ban-wave` - Get ban wave data
- `POST /admin/ban-wave/execute` - Execute ban wave

## Admin - Events
- `GET /admin/event/status` - Get event status
- `POST /admin/event/start` - Start event
- `POST /admin/event/stop` - Stop event
- `GET /admin/event/anchors?event={id}` - Get event anchors
- `POST /s{season}/event/pixel/claim` - Claim event pixel

## Audit
- `GET /admin/audit-logs?{params}` - Get audit logs

## Pawtect (Anti-bot)
- `POST /pawtect/load` - Load pawtect payload

## Health
- `GET /health` - Health check

## Constants
- **Tile Size**: 1000px
- **Zoom Level**: 11
- **Region Size**: 4 tiles
- **Refresh Interval**: 6000ms
- **Color Count**: 64 (32 base + 32 extra unlockable)

## Error Codes
- `401` - Not authenticated
- `403` - Forbidden / challenge required
- `429` - Rate limited
- `451` - Banned/timeout
- `needs_phone_verification` - Phone verification required

## Products (Shop)
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
