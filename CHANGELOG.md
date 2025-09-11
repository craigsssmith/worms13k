## Day 29 (11th September)

- Added some pre-existing holes when the game starts.
- Added muzzle flashes.
- Added jump animation.
- Prevent scrolling when selecting weapons.
- Added timer, skipping a turn after 30 seconds.
- Sound effects for gunshots and grenade bounces.

> 13239 bytes (99.5%)

## Day 28 (10th September)

- Added title screen.
- Added code-based multiplayer game setup.
- Added game over screen.
- Adjusted nyan cats to be faster and more accurate.
- Randomise wind when the game starts.
- Added 'current player' arrow.
- Crosshairs now match the player colour.
- Improved player collision detection.
- Added bounce-back to jumping.
- Added pause after jumping.

> 12864 bytes (96.6%)

## Day 27 (9th September)

- Camera tracking of players that are impacted by explosions.
- Better camera tracking in multiplayer.
- Fix z-ordering of various elements.
- Hide browser scrollbars.
- Performance improvements.
- Removed reload hack when viewport resizes.

> 12083 bytes (90.8%)

## Day 26 (8th September)

- Viewport agnostic world size.
- Better camera snapping.
- Removed sky element, using fixed gradient instead.
- Refactored panning to use browser scrolling for performance.
- Moved player objects to a separate SVG element.

> 12016 bytes (90.3%)

## Day 25 (7th September)

- Optimised weapon data.
- Optimised styles.
- Optimised weapon assets by reusing and applying CSS filters
- Tweaked vite config.
- Refactored element capture IDs and code.
- Removed socket action code strings.

> 12076 bytes (90.7%)

## Day 24 (6th September)

- Fixed double exploding of grenades.
- Better handling of multiplayer game setup and joining.
- Avoid sending unnecessary messages to the relay server.
- Added missing cricket bat image.
- Added captions for turn changes.
- Added player names and captions for deaths.

> 12355 bytes (92.8%)

## Day 23 (5th September)

- Multiplayer: Joining and syncing.
- Multiplayer: Active team, player, and weapon state.
- Multiplayer: Support for all weapons.
- Multiplayer: Killing players.
- Multiplayer: Switching turns.

> 11960 bytes (89.8%)

## Day 22 (4th September)

- Prototype for multiplayer.

> 11171 bytes (83.9%)

## Day 21 (3rd September)

- New weapon: Homing missiles!
- New weapon: Cluster bomb!
- New weapon: Nyan cats!
- New weapon: Cricket bat!
- Better positioning of crosshairs and power meter.
- Better carving of holes in the background layer.
- Correctly move to the next team at the end of turn.

> 10836 bytes (81.4%)

## Day 20 (2nd September)

- Added custom mouse pointer!
- Added mouse scrolling.
- Added better crosshairs graphics.
- Show target crosshairs for air strikes.
- Check for missile collisions dirctly with players, not just terrain.
- Switched to official js13k vite plugin.
- Enabled roadroller.

> 9998 bytes (75.1%)

## Day 19 (1st September)

- Added player idle assets.
- Added player 'walk' animation.
- Added sound effects for jumping and explosions.
- Fixed player rotation when being blasted through the air.

> 11078 bytes (83.2%)

## Day 18 (31st August)

- Added full title screen.
- Ensure objects appear behind the foreground water layers.
- Little puffs of smoke when a grenade bounces.

> 9918 bytes (74.5%)

## Day 17 (30th August)

- Added prototype title screen.

> 9848 bytes (74.0%)

## Day 16 (29th August)

*Day off!*

## Day 15 (28th August)

- Improved smoke effects.
- Added screen shake.
- Adjustable knockback levels for weapons.
- Rebalanced most of the weapons.
- Added weapons menu.
- Added graphics for uzi and minigun (red uzi).
- Added graphics for shotgun.
- Added graphics for grenade.
- Better water graphics.

> 8985 bytes (67.5%)

## Day 14 (27th August)

- Replaced holy hand grenade with the unholy black cat!
- Improved dynamite graphics.
- Fixed z-ordering of smoke particles, by moving them to the SVG.
- Explode players when their health reaches zero.
- Kill players when they land in the ocean.
- Skip dead players in player selection.
- Improved water layers animations.

> 7904 bytes (59.4%)

## Day 13 (26th August)

- Added animated water layers.
- Better terrain generation (islands).
- Better positioning of players.
- Replaced SVG filters with geometric soil pattern.

> 7386 bytes (55.6%)

## Day 12 (25th August)

- Added player health.
- Added indicators for player health.

> 7385 bytes (55.5%)

## Day 11 (24th August)

- Better graphics for dynamite and missiles.
- Missile smoke trail effect.

> 7211 bytes (54.2%)

## Day 10 (23rd August)

- New weapon: Minigun.
- Added arcade style bitmap font for text.

> 6874 bytes (51.6%)

## Day 9 (22nd August)

- New weapon: Grenades.
- New weapon: Holy hand grenade!!!
- Cut holes in the tunnel background layer for big blasts.

> 6345 bytes (47.7%)

## Day 8 (21st August)

- New weapon: Air strikes.
- New weapon: Dynamite!
- Adjust air strike direction based on the player and target positions.
- Reduce the impact effects on players.

> 5761 bytes (43.3%)

## Day 7 (20th August)

- New weapon: Shotgun.
- New weapon: Uzi.
- Added basic explosion effects.
- Added tracer effects to shotgun and uzi rounds.

> 5399 bytes (40.6%)

## Day 6 (19th August)

- Added wind, randomised for each turn.
- Missiles respond to the current wind conditions.
- Free movement of the camera.
- Better placement of the players, in teams at either edge of the map.
- Collision detection for 'instance' weapons.

> 4840 bytes (36.4%)

## Day 5 (18th August)

- Players get blown around the world when hit with explosives.
- Added camera to track the player.
- Track missiles with the camera during flight.
- Added multiple players, two teams of four.
- Cycle between players on the same team.
- Switch teams at the end of the turn.
- Added clouds to the sky.

> 4058 bytes (30.5%)

## Day 4 (17th August)

- Added player crosshairs (up/down to move).
- Fire explosives based on player position and aim direction.
- Added missile weapon with power meter.

> 3390 bytes  (25.5%)

## Day 3 (16th August)

- Test falling explosives.
- Noise based terrain generation.
- Randomise soil texture.
- Raycasting for betting collision handling.
- Basic player physics and collisions.

> 2973 bytes (22.3%)

## Day 2 (15th August)

- Procedurally generated soil texture.
- Basic collision detection.

> 1606 bytes (12.1%)

## Day 1 (14th August)

- Basic terrain destruction.

> 1218 bytes (9.1%)