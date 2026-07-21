/**
 * هسته نقشه، ابزارهای رسم، تبدیل سیستم‌های مختصات و بیس‌لایرها
 */
export function initMap() {
    const baseMaps = {
        "google-sat": {
            name: "گوگل ماهواره‌ای (Google Satellite)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 21, attribution: 'Google' })
        },
        "google-hybrid": {
            name: "گوگل هیبرید (Google Hybrid)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 21, attribution: 'Google' })
        },
        "google-streets": {
            name: "گوگل معابر (Google Streets)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 21, attribution: 'Google' })
        },
        "google-terrain": {
            name: "گوگل عوارض زمین (Google Terrain)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: 'Google' })
        },
        "carto-dark": {
            name: "CartoDB Dark Matter (تاریک)",
            layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: 'CARTO' })
        },
        "osm": {
            name: "OpenStreetMap (استاندارد)",
            layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: 'OSM' })
        }
    };

    const map = L.map('map', {
        center: [35.6892, 51.3890],
        zoom: 6,
        zoomControl: false,
        layers: [baseMaps["google-sat"].layer]
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // ۱. ابزارهای اندازه گیری و رسم Leaflet Draw
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polyline: { metric: true, showLength: true },
            polygon: { showArea: true, metric: true },
            circle: { showRadius: true, metric: true },
            rectangle: true,
            marker: true,
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems
        }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        
        if (e.layerType === 'polyline') {
            const latlngs = layer.getLatLngs();
            let totalDist = 0;
            for (let i = 0; i < latlngs.length - 1; i++) {
                totalDist += latlngs[i].distanceTo(latlngs[i + 1]);
            }
            layer.bindPopup(`<b>طول مسیر:</b> ${(totalDist / 1000).toFixed(2)} کیلومتر (${Math.round(totalDist)} متر)`).openPopup();
        }
    });

    // ۲. منوی شناور بیس‌لایر
    const dropdown = document.getElementById('base-map-dropdown');
    const toggleBtn = document.getElementById('btn-base-map-toggle');

    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => dropdown.classList.remove('show'));

        Object.keys(baseMaps).forEach((key, index) => {
            const item = baseMaps[key];
            const div = document.createElement('div');
            div.className = `base-item ${index === 0 ? 'active' : ''}`;
            div.innerHTML = `<i class="fa-solid fa-map"></i> <span>${item.name}</span>`;
            
            div.addEventListener('click', () => {
                Object.keys(baseMaps).forEach(k => map.removeLayer(baseMaps[k].layer));
                map.addLayer(item.layer);
                document.querySelectorAll('.base-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
            });

            dropdown.appendChild(div);
        });
    }

    // ۳. پرینت نقشه
    document.getElementById('btn-print-map')?.addEventListener('click', () => {
        window.print();
    });

    // ۴. پایش زنده مختصات موس (DD, DMS, UTM)
    map.on('mousemove', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // DD
        const ddElem = document.getElementById('coord-dd');
        if (ddElem) ddElem.innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;

        // DMS
        const dmsElem = document.getElementById('coord-dms');
        if (dmsElem) dmsElem.innerText = `${toDMS(lat, 'lat')}, ${toDMS(lng, 'lng')}`;

        // UTM
        const utmElem = document.getElementById('coord-utm');
        if (utmElem) {
            const utm = convertLatLngToUTM(lat, lng);
            utmElem.innerText = `Z${utm.zone}${utm.hemisphere} | E:${Math.round(utm.easting)} N:${Math.round(utm.northing)}`;
        }
    });

    return { map };
}

function toDMS(deg, type) {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    let direction = "";
    if (type === 'lat') direction = deg >= 0 ? "N" : "S";
    if (type === 'lng') direction = deg >= 0 ? "E" : "W";

    return `${degrees}°${minutes}'${seconds}"${direction}`;
}

function convertLatLngToUTM(lat, lng) {
    const zone = Math.floor((lng + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'N' : 'S';
    const radLat = lat * Math.PI / 180;
    const easting = 500000 + (lng - (zone * 6 - 183)) * 111320 * Math.cos(radLat);
    const northing = (lat >= 0 ? lat : lat + 90) * 110574;

    return { zone, hemisphere, easting, northing };
}
