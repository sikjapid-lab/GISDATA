/* js/modules/weather.js
 * ماژول هواشناسی کامل:
 *   ۱) کلیک روی هر نقطه از نقشه دو یا سه بعدی → پاپ‌آپ شیشه‌ای وضعیت جوی لحظه‌ای + پیش‌بینی ۷ روزه + وضعیت دریا/امواج
 *   ۲) رادار بارش زنده (RainViewer - بدون نیاز به کلید)
 *   ۳) نقشه‌های ویژه هواشناسی بر اساس پارامترهای جوی (ابر/دما/بارش/باد/فشار) از OpenWeatherMap با کلید کاربر
 * توجه: InfoBox سه‌بعدی Cesium داخل یک iframe مجزا رندر می‌شود و به CSS و فونت‌های صفحه اصلی دسترسی ندارد؛
 * بنابراین برای پنل سه‌بعدی از HTML کاملاً مستقل با استایل درون‌خطی (inline <style>) و ایموجی (بدون نیاز به فونت) استفاده می‌شود.
 */
import { linkMarkerAndEntity, onGlobeClick3D, unlinkEntity } from '../map.js';
import { getApiKey } from './settings.js';

let rainViewerLayer2D = null;
let rainViewerLayer3D = null;

const owmLayers2D = {};
const owmLayers3D = {};

let weatherMarker2D = null;
let weatherEntity3D = null;

const WEATHER_CODES = {
    0: { icon: '☀️', desc: 'صاف' },
    1: { icon: '🌤️', desc: 'عمدتاً صاف' },
    2: { icon: '⛅', desc: 'کمی ابری' },
    3: { icon: '☁️', desc: 'ابری' },
    45: { icon: '🌫️', desc: 'مه' },
    48: { icon: '🌫️', desc: 'مه یخ‌زده' },
    51: { icon: '🌦️', desc: 'نم‌نم باران سبک' },
    53: { icon: '🌦️', desc: 'نم‌نم باران متوسط' },
    55: { icon: '🌧️', desc: 'نم‌نم باران شدید' },
    56: { icon: '🌧️', desc: 'نم‌نم باران یخ‌زده' },
    57: { icon: '🌧️', desc: 'نم‌نم باران یخ‌زده شدید' },
    61: { icon: '🌧️', desc: 'باران سبک' },
    63: { icon: '🌧️', desc: 'باران متوسط' },
    65: { icon: '🌧️', desc: 'باران شدید' },
    66: { icon: '🌧️', desc: 'باران یخ‌زده سبک' },
    67: { icon: '🌧️', desc: 'باران یخ‌زده شدید' },
    71: { icon: '🌨️', desc: 'برف سبک' },
    73: { icon: '🌨️', desc: 'برف متوسط' },
    75: { icon: '❄️', desc: 'برف شدید' },
    77: { icon: '❄️', desc: 'دانه‌های برف' },
    80: { icon: '🌦️', desc: 'رگبار سبک' },
    81: { icon: '🌧️', desc: 'رگبار متوسط' },
    82: { icon: '⛈️', desc: 'رگبار شدید' },
    85: { icon: '🌨️', desc: 'رگبار برف سبک' },
    86: { icon: '❄️', desc: 'رگبار برف شدید' },
    95: { icon: '⛈️', desc: 'رعدوبرق' },
    96: { icon: '⛈️', desc: 'رعدوبرق همراه با تگرگ سبک' },
    99: { icon: '⛈️', desc: 'رعدوبرق همراه با تگرگ شدید' }
};

function wxInfo(code) {
    return WEATHER_CODES[code] || { icon: '❔', desc: 'نامشخص' };
}

export function initWeatherModule(map2D, viewer3D) {
    const chkPinMode = document.getElementById('chk-weather-pin-mode');
    const chkRain = document.getElementById('chk-weather-radar');
    const infoBox = document.getElementById('weather-info-box');

    // ------------------------------------------------------------------
    // ۱) رادار بارش زنده RainViewer (بدون نیاز به کلید)
    // ------------------------------------------------------------------
    chkRain?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            try {
                const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const data = await res.json();
                if (data.radar && data.radar.past && data.radar.past.length > 0) {
                    const latest = data.radar.past[data.radar.past.length - 1].path;
                    const tileUrl = `https://tilecache.rainviewer.com${latest}/256/{z}/{x}/{y}/2/1_1.png`;

                    rainViewerLayer2D = L.tileLayer(tileUrl, { opacity: 0.6 }).addTo(map2D);
                    if (viewer3D) {
                        rainViewerLayer3D = viewer3D.imageryLayers.addImageryProvider(
                            new Cesium.UrlTemplateImageryProvider({ url: tileUrl, maximumLevel: 18 })
                        );
                        rainViewerLayer3D.alpha = 0.6;
                    }
                }
            } catch (err) {
                console.error("خطا در بارگذاری رادار بارش:", err);
            }
        } else {
            if (rainViewerLayer2D) map2D.removeLayer(rainViewerLayer2D);
            rainViewerLayer2D = null;
            if (viewer3D && rainViewerLayer3D) viewer3D.imageryLayers.remove(rainViewerLayer3D);
            rainViewerLayer3D = null;
        }
    });

    // ------------------------------------------------------------------
    // ۲) نقشه‌های ویژه هواشناسی OpenWeatherMap (نیازمند کلید کاربر)
    // ------------------------------------------------------------------
    const owmMapDefs = [
        { chk: 'chk-weather-clouds', layer: 'clouds_new' },
        { chk: 'chk-weather-temp', layer: 'temp_new' },
        { chk: 'chk-weather-precip', layer: 'precipitation_new' },
        { chk: 'chk-weather-wind', layer: 'wind_new' },
        { chk: 'chk-weather-pressure', layer: 'pressure_new' }
    ];

    owmMapDefs.forEach(def => {
        const checkbox = document.getElementById(def.chk);
        checkbox?.addEventListener('change', (e) => toggleOwmLayer(def.layer, e.target.checked, checkbox, map2D, viewer3D, infoBox));
    });

    // ------------------------------------------------------------------
    // ۳) کلیک روی نقشه → استعلام کامل هواشناسی محل کلیک‌شده
    // ------------------------------------------------------------------
    map2D.on('click', (e) => {
        if (chkPinMode?.checked) {
            queryAndShowWeather(e.latlng.lat, e.latlng.lng, map2D, viewer3D, infoBox);
        }
    });

    onGlobeClick3D((lat, lng) => {
        if (chkPinMode?.checked) {
            queryAndShowWeather(lat, lng, map2D, viewer3D, infoBox);
        }
    });

    // ------------------------------------------------------------------
    // ۴) غیرفعال‌سازی کلیک هواشناسی → حذف کامل نشانگر/موجودیت باقی‌مانده از هر دو نقشه
    // ------------------------------------------------------------------
    chkPinMode?.addEventListener('change', (e) => {
        if (!e.target.checked) {
            clearWeatherMarker(map2D, viewer3D);
            if (infoBox) infoBox.innerHTML = 'جهت مشاهده اطلاعات کامل هواشناسی، تیک «فعال‌سازی کلیک هواشناسی» را بزنید و روی نقطه مورد نظر در نقشه کلیک کنید.';
        }
    });
}

function clearWeatherMarker(map2D, viewer3D) {
    if (weatherMarker2D) { map2D.removeLayer(weatherMarker2D); weatherMarker2D = null; }
    if (weatherEntity3D) {
        unlinkEntity(weatherEntity3D);
        if (viewer3D) {
            if (viewer3D.selectedEntity === weatherEntity3D) viewer3D.selectedEntity = undefined;
            viewer3D.entities.remove(weatherEntity3D);
        }
        weatherEntity3D = null;
    }
}

function toggleOwmLayer(layerKey, enabled, checkboxEl, map2D, viewer3D, infoBox) {
    if (enabled) {
        const key = getApiKey('apiOwm');
        if (!key) {
            if (infoBox) infoBox.innerHTML = '⚠️ برای فعال‌سازی نقشه‌های ویژه هواشناسی، ابتدا کلید OpenWeatherMap را در بخش «۸. تنظیمات و کلیدهای API» وارد کنید.';
            checkboxEl.checked = false;
            return;
        }
        const url = `https://tile.openweathermap.org/map/${layerKey}/{z}/{x}/{y}.png?appid=${key}`;
        owmLayers2D[layerKey] = L.tileLayer(url, { opacity: 0.55, maxZoom: 19 }).addTo(map2D);
        if (viewer3D) {
            owmLayers3D[layerKey] = viewer3D.imageryLayers.addImageryProvider(
                new Cesium.UrlTemplateImageryProvider({ url, maximumLevel: 19 })
            );
            owmLayers3D[layerKey].alpha = 0.55;
        }
    } else {
        if (owmLayers2D[layerKey]) { map2D.removeLayer(owmLayers2D[layerKey]); delete owmLayers2D[layerKey]; }
        if (viewer3D && owmLayers3D[layerKey]) { viewer3D.imageryLayers.remove(owmLayers3D[layerKey]); delete owmLayers3D[layerKey]; }
    }
}

async function queryAndShowWeather(lat, lng, map2D, viewer3D, infoBox) {
    if (infoBox) infoBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> در حال دریافت اطلاعات جوی و دریایی نقطه انتخاب‌شده...';

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,surface_pressure` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
        `&daily=wave_height_max,wave_period_max,wind_wave_height_max&timezone=auto&forecast_days=5`;

    let forecastData = null, marineData = null;
    try {
        const res = await fetch(forecastUrl);
        forecastData = await res.json();
    } catch (err) {
        console.error("خطا در دریافت اطلاعات هواشناسی:", err);
    }

    try {
        const res = await fetch(marineUrl);
        const json = await res.json();
        if (json && json.daily && Array.isArray(json.daily.wave_height_max) && json.daily.wave_height_max.some(v => v !== null)) {
            marineData = json;
        }
    } catch (err) {
        marineData = null; // نقطه انتخاب‌شده احتمالاً روی خشکی است
    }

    if (!forecastData || !forecastData.current) {
        if (infoBox) infoBox.innerHTML = 'خطا در دریافت اطلاعات هواشناسی این نقطه.';
        return;
    }

    if (infoBox) {
        infoBox.innerHTML = `آخرین استعلام: <b>${lat.toFixed(3)}, ${lng.toFixed(3)}</b> — <b>${forecastData.current.temperature_2m}°C</b> ${wxInfo(forecastData.current.weather_code).icon} ${wxInfo(forecastData.current.weather_code).desc}`;
    }

    renderWeatherResult(lat, lng, forecastData, marineData, map2D, viewer3D);
}

function buildForecastCardsHtml(daily) {
    let html = '<div class="wx-forecast">';
    for (let i = 0; i < daily.time.length; i++) {
        const info = wxInfo(daily.weather_code[i]);
        const dateLabel = new Date(daily.time[i]).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' });
        html += `<div class="wx-day">
            <div>${dateLabel}</div>
            <div class="wx-day-icon">${info.icon}</div>
            <div>${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</div>
        </div>`;
    }
    html += '</div>';
    return html;
}

function buildMarineHtml(marineData) {
    if (!marineData) {
        return '<div class="wx-marine na">🌊 داده دریایی/امواج برای این نقطه در دسترس نیست (احتمالاً خشکی).</div>';
    }
    const d = marineData.daily;
    let rows = '';
    for (let i = 0; i < Math.min(3, d.time.length); i++) {
        const dateLabel = new Date(d.time[i]).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' });
        rows += `${dateLabel}: ارتفاع موج <b>${d.wave_height_max[i] ?? '—'}m</b>، دوره تناوب <b>${d.wave_period_max[i] ?? '—'}s</b><br>`;
    }
    return `<div class="wx-marine">🌊 <b>پیش‌بینی وضعیت دریا و امواج:</b><br>${rows}</div>`;
}

/** پاپ‌آپ پنل دو بعدی: با کلاس‌های صفحه اصلی (wx-popup) که به‌صورت شیشه‌ای استایل شده‌اند */
function buildWeatherPopupHtml2D(lat, lng, forecastData, marineData) {
    const c = forecastData.current;
    const info = wxInfo(c.weather_code);
    return `
    <div class="wx-popup">
        <div class="wx-loc">📍 ${lat.toFixed(3)}°, ${lng.toFixed(3)}°</div>
        <div class="wx-current">
            <div class="wx-icon-big">${info.icon}</div>
            <div>
                <div class="wx-temp">${Math.round(c.temperature_2m)}°C</div>
                <div class="wx-desc">${info.desc}</div>
            </div>
        </div>
        <div class="wx-meta">
            <span>💧 ${c.relative_humidity_2m}%</span>
            <span>💨 ${c.wind_speed_10m} km/h</span>
            <span>⏲️ ${Math.round(c.surface_pressure)} hPa</span>
        </div>
        ${buildForecastCardsHtml(forecastData.daily)}
        ${buildMarineHtml(marineData)}
    </div>`;
}

/**
 * محتوای مستقل InfoBox سه‌بعدی Cesium (iframe مجزا)؛ چون به CSS صفحه اصلی دسترسی ندارد،
 * استایل کامل کارت شیشه‌ای به‌صورت درون‌خطی همراه خود HTML ارسال می‌شود.
 */
function buildWeatherPopupHtml3D(lat, lng, forecastData, marineData) {
    const c = forecastData.current;
    const info = wxInfo(c.weather_code);
    const forecastCards = forecastData.daily.time.map((t, i) => {
        const d = wxInfo(forecastData.daily.weather_code[i]);
        const label = new Date(t).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' });
        return `<div style="min-width:52px;text-align:center;font-size:11px;background:rgba(255,255,255,0.08);border-radius:10px;padding:6px 3px;color:#e2e8f0;flex:0 0 auto;">
            <div>${label}</div><div style="font-size:20px;margin:4px 0;">${d.icon}</div>
            <div>${Math.round(forecastData.daily.temperature_2m_max[i])}° / ${Math.round(forecastData.daily.temperature_2m_min[i])}°</div>
        </div>`;
    }).join('');

    const marineHtml = marineData
        ? (() => {
            const d = marineData.daily;
            let rows = '';
            for (let i = 0; i < Math.min(3, d.time.length); i++) {
                const label = new Date(d.time[i]).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' });
                rows += `${label}: ارتفاع موج <b>${d.wave_height_max[i] ?? '—'}m</b>، دوره تناوب <b>${d.wave_period_max[i] ?? '—'}s</b><br>`;
            }
            return `<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.12);padding-top:9px;font-size:12px;color:#5eead4;line-height:1.9;">🌊 <b>وضعیت دریا و امواج:</b><br>${rows}</div>`;
        })()
        : `<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.12);padding-top:9px;font-size:12px;color:#64748b;font-style:italic;">🌊 داده دریایی برای این نقطه در دسترس نیست.</div>`;

    return `
    <div style="font-family:Tahoma, Vazirmatn, sans-serif;direction:rtl;text-align:right;min-width:250px;
                background:linear-gradient(155deg, rgba(30,41,59,0.95), rgba(15,23,42,0.97));
                color:#f1f5f9;border-radius:16px;padding:16px 18px;">
        <div style="font-size:11px;color:#93a3b8;margin-bottom:8px;">📍 ${lat.toFixed(3)}°, ${lng.toFixed(3)}°</div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div style="font-size:40px;line-height:1;">${info.icon}</div>
            <div>
                <div style="font-size:26px;font-weight:700;">${Math.round(c.temperature_2m)}°C</div>
                <div style="font-size:12px;color:#cbd5e1;">${info.desc}</div>
            </div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:6px;font-size:11px;color:#cbd5e1;
                    background:rgba(255,255,255,0.08);border-radius:12px;padding:7px 10px;margin-bottom:10px;">
            <span>💧 ${c.relative_humidity_2m}%</span>
            <span>💨 ${c.wind_speed_10m} km/h</span>
            <span>⏲️ ${Math.round(c.surface_pressure)} hPa</span>
        </div>
        <div style="display:flex;overflow-x:auto;gap:6px;padding-bottom:4px;">${forecastCards}</div>
        ${marineHtml}
    </div>`;
}

function renderWeatherResult(lat, lng, forecastData, marineData, map2D, viewer3D) {
    const html2D = buildWeatherPopupHtml2D(lat, lng, forecastData, marineData);
    const html3D = buildWeatherPopupHtml3D(lat, lng, forecastData, marineData);
    const info = wxInfo(forecastData.current.weather_code);

    // --- نشانگر ۲بعدی ---
    if (weatherMarker2D) {
        weatherMarker2D.setLatLng([lat, lng]);
    } else {
        weatherMarker2D = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'wx-marker-icon',
                html: `<div style="font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${info.icon}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(map2D);
    }
    weatherMarker2D.bindPopup(html2D, { maxWidth: 300, className: 'wx-glass-popup' }).openPopup();

    // --- موجودیت ۳بعدی ---
    if (viewer3D) {
        if (weatherEntity3D) { unlinkEntity(weatherEntity3D); viewer3D.entities.remove(weatherEntity3D); }
        weatherEntity3D = viewer3D.entities.add({
            name: 'وضعیت هواشناسی',
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 500),
            point: { pixelSize: 14, color: Cesium.Color.ORANGE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
            description: html3D
        });
        viewer3D.selectedEntity = weatherEntity3D;
        linkMarkerAndEntity(weatherMarker2D, weatherEntity3D, viewer3D);
    }
}
