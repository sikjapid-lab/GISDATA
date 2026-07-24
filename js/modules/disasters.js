/* js/modules/disasters.js */
import { linkMarkerAndEntity, unlinkEntity } from '../map.js';

let earthquakeGroup2D = null;
let quakePairs = []; // { feature, marker2D, entity3D }
let lastData = null;

export function initDisastersModule(map2D, viewer3D) {
    const chkEarthquakes = document.getElementById('chk-disaster-earthquakes');
    const selectMag = document.getElementById('select-eq-mag');

    chkEarthquakes?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            await fetchAndRenderEarthquakes(map2D, viewer3D, selectMag?.value || 'all');
        } else {
            clearEarthquakes(map2D, viewer3D);
        }
    });

    selectMag?.addEventListener('change', () => {
        if (chkEarthquakes?.checked && lastData) {
            renderEarthquakes(lastData, map2D, viewer3D, selectMag.value);
        }
    });
}

async function fetchAndRenderEarthquakes(map2D, viewer3D, magFilter) {
    try {
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
        lastData = await response.json();
        renderEarthquakes(lastData, map2D, viewer3D, magFilter);
    } catch (err) {
        console.error("خطا در دريافت داده‌های زلزله:", err);
    }
}

function renderEarthquakes(data, map2D, viewer3D, magFilter) {
    clearEarthquakes(map2D, viewer3D, true);

    const minMag = magFilter === 'all' ? -Infinity : parseFloat(magFilter);
    const features = data.features.filter(f => (f.properties.mag || 0) >= minMag);

    document.getElementById('eq-count').innerText = toFa(features.length);
    earthquakeGroup2D = L.featureGroup().addTo(map2D);

    features.forEach(feature => {
        const [lng, lat, depth] = feature.geometry.coordinates;
        const p = feature.properties;
        const mag = p.mag || 1;
        const color = getColorByMag(mag);
        const timeStr = new Date(p.time).toLocaleString('fa-IR');

        const popupHtml = `
            <div style="font-family:Vazirmatn, sans-serif; text-align:right;">
                <h4 style="margin:0 0 5px; color:#ef4444;"><i class="fa-solid fa-volcano"></i> زلزله: ${p.place}</h4>
                <b>بزرگی:</b> ${p.mag} ریشتر<br>
                <b>عمق:</b> ${depth} کیلومتر<br>
                <b>زمان:</b> ${timeStr}
            </div>`;

        const marker2D = L.circleMarker([lat, lng], {
            radius: Math.max(4, mag * 3),
            fillColor: color,
            color: '#ffffff',
            weight: 1,
            fillOpacity: 0.8
        }).bindPopup(popupHtml).addTo(earthquakeGroup2D);

        let entity3D = null;
        if (viewer3D) {
            entity3D = viewer3D.entities.add({
                name: `زلزله: ${p.place}`,
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 1000),
                point: {
                    pixelSize: Math.max(8, mag * 4),
                    color: Cesium.Color.fromCssColorString(color),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 1
                },
                description: `
                    <div style="direction:rtl; font-family:Tahoma, sans-serif;">
                        <h3>اطلاعات زمین‌لرزه</h3>
                        <p><b>مکان:</b> ${p.place}</p>
                        <p><b>بزرگی:</b> ${p.mag} ریشتر</p>
                        <p><b>عمق:</b> ${depth} کیلومتر</p>
                        <p><b>زمان:</b> ${timeStr}</p>
                    </div>`
            });
            linkMarkerAndEntity(marker2D, entity3D, viewer3D);
        }

        quakePairs.push({ feature, marker2D, entity3D });
    });
}

function clearEarthquakes(map2D, viewer3D, keepCount) {
    if (earthquakeGroup2D) {
        map2D.removeLayer(earthquakeGroup2D);
        earthquakeGroup2D = null;
    }
    quakePairs.forEach(({ entity3D }) => {
        if (entity3D) {
            unlinkEntity(entity3D);
            if (viewer3D) viewer3D.entities.remove(entity3D);
        }
    });
    quakePairs = [];
    if (!keepCount) document.getElementById('eq-count').innerText = '۰';
}

function getColorByMag(mag) {
    if (mag >= 6) return '#dc2626';
    if (mag >= 4) return '#f97316';
    if (mag >= 2) return '#eab308';
    return '#22c55e';
}

function toFa(n) {
    return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
