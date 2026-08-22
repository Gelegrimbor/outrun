import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

// Android-only background-session support. Two cooperating pieces:
//
// 1. GPS mode: expo-location's startLocationUpdatesAsync with the
//    `foregroundService` option. Verified directly in expo-location's
//    native source (LocationModule.kt): a "user-initiated foreground
//    service with notification ... does NOT require the background
//    location permission" -- this is Android's documented carve-out where
//    a foreground service with foregroundServiceType="location", started
//    while the app is visible, keeps location flowing on while-in-use
//    permission alone. So ACCESS_BACKGROUND_LOCATION stays OUT of the
//    manifest (isAndroidBackgroundLocationEnabled stays false in
//    app.json); only the FOREGROUND_SERVICE(_LOCATION) permissions are
//    added via isAndroidForegroundServiceEnabled.
//    The service ALSO keeps the whole process alive/unfrozen, which is
//    what keeps JS timers and the pace-provider subscriptions running
//    with the screen off.
//
// 2. Both modes: a sticky (ongoing) stats notification, updated from JS
//    while the process is running. This is deliberately a SEPARATE
//    notification from the foreground service's own one, because the
//    service notification's text cannot be updated while backgrounded --
//    expo-location's native module throws ForegroundServiceStartNotAllowed
//    if startLocationUpdatesAsync is re-called while the app isn't
//    foregrounded (verified in source), so re-calling it to refresh text
//    is a dead end. The service notification stays static; this one
//    carries the live numbers.
//
// Step mode gets ONLY the stats notification, no location service: it has
// no location permission to piggyback on (and asking for location in
// *indoor* mode would be incoherent), and real-world testing plus
// Android's cumulative-since-boot step counter hardware showed screen-off
// step sessions already survive via catch-up delivery. Without the
// service the JS-side notification updates can lag while the CPU naps
// between sensor batches -- each batch delivery wakes JS and flushes an
// update, so it stays roughly current rather than live.
//
// iOS is deliberately not handled here at all -- see SETUP.md.

const LOCATION_TASK = 'outrun-session-location';
const STATS_NOTIFICATION_ID = 'outrun-session-stats';
const STATS_CHANNEL_ID = 'session-stats';
const STATS_UPDATE_MS = 10000;

type LocationConsumer = (locations: Location.LocationObject[]) => void;

let locationConsumer: LocationConsumer | null = null;

/** GpsPaceProvider registers itself here while active so fixes delivered
 * through the background task reach the same distance/speed math as the
 * foreground watch. The provider dedupes by fix timestamp, so both
 * channels delivering the same fused fixes is safe. */
export function setBackgroundLocationConsumer(consumer: LocationConsumer | null): void {
  locationConsumer = consumer;
}

if (Platform.OS === 'android') {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('Background location task error:', error.message);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] })?.locations;
    if (locations && locations.length > 0 && locationConsumer) {
      locationConsumer(locations);
    }
  });
}

export interface SessionBackgroundOptions {
  mode: 'gps' | 'step';
  /** Produces the one-line stats string for the ongoing notification. */
  getStatsLine: () => string;
}

let statsInterval: ReturnType<typeof setInterval> | null = null;
let active = false;

async function updateStatsNotification(getStatsLine: () => string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STATS_NOTIFICATION_ID,
      content: {
        title: 'OUTRUN — session active',
        body: getStatsLine(),
        sticky: true,
        color: '#e2792b',
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Failed to update session notification:', err);
  }
}

export async function startSessionBackgroundSupport(
  options: SessionBackgroundOptions
): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (active) await stopSessionBackgroundSupport();
  active = true;

  try {
    // Android 13+ needs a runtime grant for notifications to be visible.
    // Denial is non-fatal: tracking still works, the shade just stays empty.
    await Notifications.requestPermissionsAsync();
    await Notifications.setNotificationChannelAsync(STATS_CHANNEL_ID, {
      name: 'Session progress',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: [0],
      enableVibrate: false,
      showBadge: false,
    });
  } catch (err) {
    console.warn('Failed to set up session notification channel:', err);
  }

  if (options.mode === 'gps') {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
        // No batching/deferral -- we want fixes as they happen so the
        // session math stays current while backgrounded.
        deferredUpdatesInterval: 0,
        deferredUpdatesDistance: 0,
        foregroundService: {
          notificationTitle: 'OUTRUN session in progress',
          notificationBody: 'Tracking continues with the screen off.',
          notificationColor: '#e2792b',
          // Swiping the app away ends tracking -- no orphaned service.
          killServiceOnDestroy: true,
        },
      });
    } catch (err) {
      // Foreground tracking still works without the service; the session
      // just loses its screen-off guarantee. Don't kill the session.
      console.warn('Failed to start background location service:', err);
    }
  }

  await updateStatsNotification(options.getStatsLine);
  statsInterval = setInterval(() => {
    updateStatsNotification(options.getStatsLine);
  }, STATS_UPDATE_MS);
}

export async function stopSessionBackgroundSupport(): Promise<void> {
  if (Platform.OS !== 'android') return;
  active = false;

  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  try {
    await Notifications.dismissNotificationAsync(STATS_NOTIFICATION_ID);
  } catch {
    // Nothing to dismiss.
  }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (err) {
    console.warn('Failed to stop background location service:', err);
  }
}
