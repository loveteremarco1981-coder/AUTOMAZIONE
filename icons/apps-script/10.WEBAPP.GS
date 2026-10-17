// ==========================================
// 10.WEBAPP.GS
// ==========================================
// Modifiche rispetto alla versione precedente (cercale con "NUOVO"):
//   1. ruolo della chiave (admin / ro) con roleOf_ (file chiave.gs)
//   2. chiave di sola lettura: nessun comando consentito
//   3. ?history=1  -> storico per i grafici (11.EXTRA.GS)
//   4. evento set_schedule -> orari tapparelle (11.EXTRA.GS)
//   5. il modello include role e schedule
//   6. alerts.logErrors ora conta davvero gli errori delle ultime 24 ore

function doGet(e) {

  const denied = guardia_(e);
  if (denied) return denied;

  e = e || {};

  var p = e.parameter || {};

  var callback = String(p.callback || '').trim();

  // NUOVO: ruolo di chi chiama ('admin' oppure 'ro')
  var role = roleOf_(p);

  try {

    var ev = String(p.event || '').trim().toLowerCase();

    var name = String(p.name || '').trim().toLowerCase();

    // ======================================
    // NUOVO: SOLA LETTURA, STORICO, ORARI
    // ======================================

    // la chiave di sola lettura non può dare nessun comando
    if (role === 'ro' && ev) {
      return jsonpResponse_(callback, { ok: false, error: 'readonly' });
    }

    if (String(p.history || '') === '1') {
      return jsonpResponse_(callback, storicoJson_(p));
    }

    if (ev === 'set_schedule') {
      return jsonpResponse_(callback, impostaOrari_(p));
    }

    // ======================================
    // LOG
    // ======================================

    if (String(p.logs || '') === '1') {

      return jsonpResponse_(
        callback,
        {
          ok: true,
          logs: getRecentLogs_(100),
          state: getState(),
          generatedAt: new Date().toISOString()
        }
      );
    }

    // ======================================
    // GPS
    // ======================================

    if (ev === 'gps') {

      validateWebPerson_(name);

      if (
        p.lat === undefined ||
        p.lon === undefined ||
        String(p.lat).trim() === '' ||
        String(p.lon).trim() === ''
      ) {
        throw new Error('GPS_COORDINATES_MISSING');
      }

      var lat = parseCoordinate_(p.lat);

      var lon = parseCoordinate_(p.lon);

      validateWebGpsCoordinates_(lat, lon);

      var gpsResult = updateGpsPresence(name, lat, lon);

      return jsonpResponse_(
        callback,
        {
          ok: true,
          source: 'GPS',
          person: gpsResult.person,
          result: gpsResult.result,
          previousState: gpsResult.previousState || '',
          changed: Boolean(gpsResult.changed),
          distance: gpsResult.distance,
          radius: gpsResult.radius,
          lat: lat,
          lon: lon,
          homeLat: gpsResult.homeLat,
          homeLon: gpsResult.homeLon,
          houseState: getState(),
          houseInside: Number(v('Config', 'B5')) === 1
        }
      );
    }

    // ======================================
    // PRESENZA
    // ======================================

    if (ev === 'mark_in' || ev === 'in') {

      validateWebPerson_(name);

      var inResult = markIn(name);

      return jsonpResponse_(
        callback,
        {
          ok: true,
          person: name,
          result: 'IN',
          changed: Boolean(inResult.changed),
          houseInside: true,
          houseState: getState()
        }
      );
    }

    if (ev === 'mark_out' || ev === 'out') {

      validateWebPerson_(name);

      var outResult = markOut(name);

      return jsonpResponse_(
        callback,
        {
          ok: true,
          person: name,
          result: outResult.pending ? 'OUT_PENDING' : 'OUT',
          changed: Boolean(outResult.changed),
          pending: Boolean(outResult.pending),
          houseInside: Number(v('Config', 'B5')) === 1,
          houseState: getState()
        }
      );
    }

    // ======================================
    // FORZA PRESENZA
    // ======================================

    if (ev === 'force_in') {

      validateWebPerson_(name);

      var forceInResult = forcePersonIn(name);

      return jsonpResponse_(
        callback,
        {
          ok: true,
          person: name,
          result: 'FORCE_IN',
          changed: Boolean(forceInResult.changed),
          duplicate: Boolean(forceInResult.duplicate),
          houseInside: true,
          houseState: getState()
        }
      );
    }

    if (ev === 'force_out') {

      validateWebPerson_(name);

      var forceOutResult = forcePersonOut(name);

      return jsonpResponse_(
        callback,
        {
          ok: true,
          person: name,
          result: 'FORCE_OUT',
          changed: Boolean(forceOutResult.changed),
          duplicate: Boolean(forceOutResult.duplicate),
          houseInside: Boolean(forceOutResult.houseInside),
          houseState: getState()
        }
      );
    }

    // ======================================
    // TAPPARELLE MANUALI
    // ======================================

    if (ev === 'alza_tutto') {

      var upResult = sendIFTTT('alza_tutto');

      return jsonpResponse_(
        callback,
        {
          ok: true,
          command: 'alza_tutto',
          result: upResult
        }
      );
    }

    if (ev === 'abbassa_tutto') {

      var downResult = sendIFTTT('abbassa_tutto');

      if (downResult.ok && !downResult.skipped) {
        setShuttersState('DOWN');
      }

      return jsonpResponse_(
        callback,
        {
          ok: true,
          command: 'abbassa_tutto',
          result: downResult,
          shuttersState: getShuttersState()
        }
      );
    }

    if (ev === 'piante') {

      var plantsResult = sendIFTTT('piante');

      if (plantsResult.ok && !plantsResult.skipped) {
        setShuttersState('PIANTE');
      }

      return jsonpResponse_(
        callback,
        {
          ok: true,
          command: 'piante',
          result: plantsResult,
          shuttersState: getShuttersState()
        }
      );
    }

    // ======================================
    // VACANZA
    // ======================================

    if (ev === 'set_vacanza') {

      var vacation = parseWebBoolean_(p.value);

      s('Config', 'B7', vacation);

      logEvent('VACANZA', String(vacation).toUpperCase());

      if (vacation) {
        scheduleVacationPlants_();
      } else {
        deleteVacationPlantsTriggers_();
      }

      var vacationShutters = handleShutters();

      return jsonpResponse_(
        callback,
        {
          ok: true,
          vacanza: vacation,
          shutters: vacationShutters,
          houseState: getState()
        }
      );
    }

    // ======================================
    // SHUTTERS_EXCLUDED
    // ======================================

    if (ev === 'set_shutters_excluded') {

      var excluded = parseWebBoolean_(p.value);

      s('Config', 'B9', excluded);

      logEvent('SHUTTERS_EXCLUDED', String(excluded).toUpperCase());

      return jsonpResponse_(
        callback,
        {
          ok: true,
          shuttersExcluded: excluded
        }
      );
    }

    // ======================================
    // OVERRIDE
    // ======================================

    if (ev === 'set_override') {

      var override = parseWebBoolean_(p.value);

      s('Config', 'B8', override);

      logEvent('OVERRIDE', String(override).toUpperCase());

      if (override) {

        cancelSecuritySeq();

      } else {

        evaluateState();
        handleShutters();
      }

      return jsonpResponse_(
        callback,
        {
          ok: true,
          override: override,
          houseState: getState(),
          shuttersState: getShuttersState()
        }
      );
    }

    // ======================================
    // IFTTT MANUALI
    // ======================================

    var manualEvents = [
      'off_termostato',
      'termostato_auto',
      'spegni_clima',
      'ezviz_interne_on',
      'ezviz_interne_off',
      'ezviz_esterne_on',
      'ezviz_esterne_off'
    ];

    if (manualEvents.indexOf(ev) !== -1) {

      return executeManualIFTTTEvent_(callback, ev);
    }

    // ======================================
    // WIFI
    // ======================================

    if (ev === 'wifi') {

      validateWebPerson_(name);

      var online = parseWebBoolean_(p.online);

      var wifiResult = updateWifiStatus(name, online);

      return jsonpResponse_(
        callback,
        {
          ok: true,
          person: name,
          wifiOnline: online,
          result: wifiResult || null
        }
      );
    }

    // ======================================
    // METEO DA DASHBOARD
    // ======================================

    if (ev === 'update_weather') {

      var updated = [];

      if (p.temp !== undefined && String(p.temp).trim() !== '') {

        s('Config', 'B30', parseWebNumber_(p.temp, 'WEATHER_TEMP'));

        updated.push('temp');
      }

      if (p.hum !== undefined && String(p.hum).trim() !== '') {

        var humidity = parseWebNumber_(p.hum, 'WEATHER_HUMIDITY');

        if (humidity < 0 || humidity > 100) {
          throw new Error('WEATHER_HUMIDITY_INVALID');
        }

        s('Config', 'B31', humidity);

        updated.push('humidity');
      }

      if (p.wind !== undefined && String(p.wind).trim() !== '') {

        var wind = parseWebNumber_(p.wind, 'WEATHER_WIND');

        if (wind < 0) {
          throw new Error('WEATHER_WIND_INVALID');
        }

        s('Config', 'B32', wind);

        updated.push('wind');
      }

      return jsonpResponse_(
        callback,
        {
          ok: true,
          result: 'WEATHER_UPDATED',
          updatedFields: updated
        }
      );
    }

    // ======================================
    // MODELLO (nessun evento)
    // ======================================

    var model = buildModel_();

    // NUOVO: ruolo di chi guarda e orari tapparelle scelti dall'app
    model.role = role;
    model.schedule = leggiOrariTapparelle_();

    return jsonpResponse_(callback, model);

  } catch (error) {

    try {

      logError('WEBAPP', String(error));

      logEvent('WEBAPP_ERROR', String(error));

    } catch (ignore) {}

    return jsonpResponse_(
      callback,
      {
        ok: false,
        error: String(error),
        timestamp: new Date().toISOString()
      }
    );
  }
}


// ==========================================
// MODELLO DASHBOARD
// ==========================================

function buildModel_() {

  var currentState = getState();

  var expectedState = getExpectedState_();

  var weatherData = {};

  try {

    var weatherRaw =
      PropertiesService
        .getScriptProperties()
        .getProperty('W_DATA');

    if (weatherRaw) {
      weatherData = JSON.parse(weatherRaw);
    }

  } catch (ignore) {
    weatherData = {};
  }

  var shuttersContext = null;

  try {
    shuttersContext = getShuttersContext_();
  } catch (error) {
    shuttersContext = { error: String(error) };
  }

  var outPending = null;

  try {
    outPending = getOutPendingStatus();
  } catch (error) {
    outPending = { error: String(error) };
  }

  return {

    ok: true,

    state: currentState,

    stato: currentState,

    expectedState: expectedState,

    stateCoherent: currentState === expectedState,

    inside: Number(v('Config', 'B5')) === 1,

    anyoneInside: isAnyoneInside(),

    peopleInside: countPeopleInside(),

    vacanza: isTrue(v('Config', 'B7')),

    override: isTrue(v('Config', 'B8')),

    shuttersExcluded: isTrue(v('Config', 'B9')),

    notte: currentState.indexOf('_NIGHT') !== -1,

    people: getPeopleStatus_(),

    weather: {

      provider: String(weatherData.provider || v('Config', 'B28') || ''),

      rain: weatherData.rain !== undefined ? Number(weatherData.rain) : null,

      windKmh: weatherData.wind !== undefined ? Number(weatherData.wind) : null,

      sunrise: weatherData.sunrise || '',

      sunset: weatherData.sunset || '',

      observedAt: weatherData.observedAt || '',

      cacheFallback: Boolean(weatherData.cacheFallback),

      cacheAgeMinutes:
        weatherData.cacheAgeMinutes !== undefined
          ? weatherData.cacheAgeMinutes
          : null,

      lastUpdate: String(v('Config', 'B29') || ''),

      tempC: nullableNumber_(v('Config', 'B30')),

      humidity: nullableNumber_(v('Config', 'B31')),

      dashboardWindKmh: nullableNumber_(v('Config', 'B32'))
    },

    shutters: {
      state: getShuttersState(),
      override: isTrue(v('Config', 'B8')),
      context: shuttersContext
    },

    outPending: outPending,

    actions: getExpectedActions_(currentState),

    health: {
      status: String(v('Config', 'B21') || ''),
      score: Number(v('Config', 'B23')) || 0,
      lastHeartbeat: formatModelValue_(v('Config', 'B20')),
      lastError: String(v('Config', 'B22') || '')
    },

    alerts: {
      // NUOVO: errori veri delle ultime 24 ore (prima era sempre 0)
      logErrors: contaErroriRecenti_(),
      stateMismatch: currentState !== expectedState,
      weatherFallback: Boolean(weatherData.cacheFallback)
    },

    next: {
      alba: weatherData.sunrise || '',
      tramonto: weatherData.sunset || '',
      shuttersOpenTime:
        shuttersContext && shuttersContext.openTime
          ? shuttersContext.openTime
          : '',
      shuttersCloseTime:
        shuttersContext && shuttersContext.closeTime
          ? shuttersContext.closeTime
          : ''
    },

    meta: {
      nowIso: new Date().toISOString(),
      nowLocal: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      ),
      timezone: Session.getScriptTimeZone(),
      version: SYSTEM_VERSION
    }
  };
}


function getRecentLogs_(limit) {

  limit = Number(limit) || 100;

  limit = Math.max(1, Math.min(limit, 500));

  var sheet = sh('Log');

  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var rows = Math.min(limit, lastRow - 1);

  var firstRow = lastRow - rows + 1;

  var data = sheet.getRange(firstRow, 1, rows, 3).getValues();

  data.reverse();

  return data.map(
    function(row) {

      var ts = '';

      if (row[0] instanceof Date && !isNaN(row[0].getTime())) {

        ts = row[0].toISOString();

      } else {

        ts = String(row[0] || '');

      }

      return {

        ts: ts,

        code: String(row[1] || ''),

        desc: String(row[2] || '')

      };

    }
  );

}


function executeManualIFTTTEvent_(callback, eventName) {

  var result = sendIFTTT(eventName);

  return jsonpResponse_(
    callback,
    {
      ok: true,
      command: eventName,
      result: result
    }
  );
}


function validateWebPerson_(name) {

  if (!name) {
    throw new Error('NAME_MISSING');
  }

  if (!personExists_(name)) {
    throw new Error('PERSON_NOT_FOUND: ' + name);
  }
}


function parseCoordinate_(value) {

  return Number(String(value).trim().replace(',', '.'));
}


function validateWebGpsCoordinates_(lat, lon) {

  if (
    !isFinite(lat) ||
    !isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new Error(
      'GPS_COORDINATES_INVALID: ' + 'lat=' + lat + ' lon=' + lon
    );
  }
}


function parseWebBoolean_(value) {

  var normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'on'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'off'
  ) {
    return false;
  }

  throw new Error('BOOLEAN_VALUE_INVALID: ' + String(value));
}


function parseWebNumber_(value, fieldName) {

  var number = Number(String(value).trim().replace(',', '.'));

  if (!isFinite(number)) {
    throw new Error(fieldName + '_INVALID: ' + String(value));
  }

  return number;
}


function nullableNumber_(value) {

  if (value === '' || value === null || value === undefined) {
    return null;
  }

  var number = Number(value);

  return isFinite(number) ? number : null;
}


function formatModelValue_(value) {

  if (value === '' || value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );
  }

  return String(value);
}


function jsonpResponse_(callback, object) {

  var json = JSON.stringify(object);

  callback = String(callback || '').trim();

  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {

    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


function testBuildModel() {

  Logger.log(JSON.stringify(buildModel_(), null, 2));
}


function testWebAppLogs() {

  Logger.log(JSON.stringify(getRecentLogs_(10), null, 2));
}
