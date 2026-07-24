/* js/modules/traffic.js */
import { onFreeClick2D, onGlobeClick3D } from '../map.js';
import { getApiKey } from './settings.js';

let googleTrafficLayer2D = null;
let googleTrafficLayer3D = null;
let tomtomFlowLayer2D = null;
let tomtomFlowLayer3D = null;
let tomtomIncidentsLayer2D = null;
let tomtomIncidentsLayer3D = null;

let incidentsActive = false;
let incidentPopup2D = null;

export function initTrafficModule(map2D, viewer3D) {
    const chkGoogle = document.getElementById('chk-traffic-google');
    const chkTomTomFlow = document.getElementById('chk-traffic-tomtom');
    const chkTomTomIncidents = document.getElementById('chk-traffic-tomtom-incidents');
    const infoBox = document.getElementById('traffic-info-box');

    chkGoogle?.addEventListener('change', (e) => {
        const url = 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}';
        if (e.target.checked) {
            googleTrafficLayer2D = L.tileLayer(url, { maxZoom: 21, opacity: 0.7 }).addTo(map2D);
            if (viewer3D) {
                googleTrafficLayer3D = viewer3D.imageryLayers.addImageryProvider(
                    new Cesium.UrlTemplateImageryProvider({ url, maximumLevel: 21 })
                );
                googleTrafficLayer3D.alpha = 0.7;
            }
        } else {
            if (googleTrafficLayer2D) { map2D.removeLayer(googleTrafficLayer2D); googleTrafficLayer2D = null; }
            if (viewer3D && googleTrafficLayer3D) { viewer3D.imageryLayers.remove(googleTrafficLayer3D); googleTrafficLayer3D = null; }
        }
    });

    chkTomTomFlow?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const key = requireTomTomKey(infoBox, e.target);
            if (!key) return;
            const url = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${key}`;
            tomtomFlowLayer2D = L.tileLayer(url, { maxZoom: 22, opacity: 0.8 }).addTo(map2D);
            if (viewer3D) {
                tomtomFlowLayer3D = viewer3D.imageryLayers.addImageryProvider(
                    new Cesium.UrlTemplateImageryProvider({ url, maximumLevel: 22 })
                );
                tomtomFlowLayer3D.alpha = 0.8;
            }
            setInfo(infoBox, '✅ ترافیک زنده TomTom (Flow) روی هر دو نقشه فعال شد.');
        } else {
            if (tomtomFlowLayer2D) { map2D.removeLayer(tomtomFlowLayer2D); tomtomFlowLayer2D = null; }
            if (viewer3D && tomtomFlowLayer3D) { viewer3D.imageryLayers.remove(tomtomFlowLayer3D); tomtomFlowLayer3D = null; }
        }
    });

    chkTomTomIncidents?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const key = requireTomTomKey(infoBox, e.target);
            if (!key) return;
            const url = `https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${key}&tileSize=256`;
            tomtomIncidentsLayer2D = L.tileLayer(url, { maxZoom: 22, opacity: 0.9 }).addTo(map2D);
            if (viewer3D) {
                tomtomIncidentsLayer3D = viewer3D.imageryLayers.addImageryProvider(
                    new Cesium.UrlTemplateImageryProvider({ url, maximumLevel: 22 })
                );
            }
            incidentsActive = true;
            setInfo(infoBox, '✅ حوادث ترافیکی TomTom فعال شد. برای مشاهده جزئیات، روی نقشه کلیک کنید.');
        } else {
            if (tomtomIncidentsLayer2D) { map2D.removeLayer(tomtomIncidentsLayer2D); tomtomIncidentsLayer2D = null; }
            if (viewer3D && tomtomIncidentsLayer3D) { viewer3D.imageryLayers.remove(tomtomIncidentsLayer3D); tomtomIncidentsLayer3D = null; }
            incidentsActive = false;
        }
    });

    // کلیک روی نقشه (۲بعدی یا ۳بعدی) هنگام فعال بودن لایه حوادث → واکشی نزدیک‌ترین حادثه
    onFreeClick2D((lat, lng) => { if (incidentsActive) queryIncidentDetails(lat, lng, map2D, infoBox); });
    onGlobeClick3D((lat, lng) => { if (incidentsActive) queryIncidentDetails(lat, lng, map2D, infoBox); });
}

function requireTomTomKey(infoBox, checkboxEl) {
    const key = getApiKey('apiTomTom');
    if (!key) {
        setInfo(infoBox, '⚠️ برای فعال‌سازی خدمات TomTom ابتدا کلید API را در بخش «۸. تنظیمات و کلیدهای API» وارد کنید (نیازی به زدن دکمه ذخیره نیست، کافی است کلید در فیلد وارد شده باشد).');
        checkboxEl.checked = false;
        return null;
    }
    return key;
}

function setInfo(infoBox, html) {
    if (infoBox) infoBox.innerHTML = html;
}

async function queryIncidentDetails(lat, lng, map2D, infoBox) {
    const key = getApiKey('apiTomTom');
    if (!key) return;

    // کادر کوچک اطراف نقطه کلیک‌شده (~۵ کیلومتر)
    const delta = 0.05;
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,events{description}}}}&language=fa-FA&key=${key}`;

    try {
        setInfo(infoBox, '<i class="fa-solid fa-spinner fa-spin"></i> در حال دریافت جزئیات حادثه...');
        const res = await fetch(url);
        const data = await res.json();

        if (!data.incidents || !data.incidents.length) {
            setInfo(infoBox, 'در این محدوده حادثه ترافیکی ثبت‌شده‌ای یافت نشد.');
            return;
        }

        const nearest = data.incidents[0];
        const desc = nearest.properties?.events?.[0]?.description || 'حادثه ترافیکی';
        const coords = nearest.geometry?.coordinates;
        const point = coords && coords.length === 2 ? [coords[1], coords[0]] : [lat, lng];

        if (incidentPopup2D) map2D.closePopup(incidentPopup2D);
        incidentPopup2D = L.popup({ className: 'wx-glass-popup' })
            .setLatLng(point)
            .setContent(`<div class="wx-popup"><div class="wx-loc">🚧 حادثه ترافیکی</div><div class="wx-desc" style="font-size:0.85rem;">${desc}</div></div>`)
            .openOn(map2D);

        setInfo(infoBox, `آخرین حادثه: <b>${desc}</b>`);
    } catch (err) {
        console.error("خطا در دریافت جزئیات حادثه ترافیکی:", err);
        setInfo(infoBox, 'خطا در دریافت جزئیات حادثه ترافیکی.');
    }
}
