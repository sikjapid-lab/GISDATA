/**
 * مدیریت هسته نقشه، گوگل مپس و سیستم مختصات
 */
export function initMap() {
    // 1. تعریف بیس‌لایرهای پیشرفته (شامل کامل‌ترین لایه‌های گوگل)
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

    // 2. مقداردهی اوليه
    const map = L.map('map', {
        center: [35.6892, 51.3890],
        zoom: 6,
        zoomControl: false,
        layers: [baseMaps["google-sat"].layer] // پیش‌فرض گوگل سرفیس
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // 3. رندر منوی شناور بیس‌لایر در گوشه بالا سمت چپ
    const dropdown = document.getElementById('base-map-dropdown');
    const toggleBtn = document.getElementById('btn-base-map-toggle');

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

    // 4. نمایش زنده مختصات موس بر حسب WGS84 و UTM
    map.on('mousemove', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // WGS84
        document.getElementById('coord-wgs84').innerText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        // محاسبه ساده UTM Zone & Coordinates
        const utm = convertLatLngToUTM(lat, lng);
        document.getElementById('coord-utm').innerText = `Zone ${utm.zone} ${utm.hemisphere} | E: ${Math.round(utm.easting)} N: ${Math.round(utm.northing)}`;
    });

    return { map };
}

// تابع ریاضی محاسبه مختصات UTM
function convertLatLngToUTM(lat, lng) {
    const zone = Math.floor((lng + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'N' : 'S';
    
    // فرمول تقریبی سریع جهت نمایش لحظه‌ای
    const radLat = lat * Math.PI / 180;
    const easting = 500000 + (lng - (zone * 6 - 183)) * 111320 * Math.cos(radLat);
    const northing = (lat >= 0 ? lat : lat + 90) * 110574;

    return { zone, hemisphere, easting, northing };
}
