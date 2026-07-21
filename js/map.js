/**
 * پیکربندی و مقداردهی نقشه پایه به همراه تنوع کامل Base Layerها
 */
export function initMap() {
    // 1. تعریف بیس‌لایرها (Base Layers)
    const baseMaps = {
        "OpenStreetMap (استاندارد)": L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }),
        "CartoDB Positron (روشن/ساده)": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 20,
            attribution: '&copy; CARTO'
        }),
        "CartoDB Dark Matter (تاریک)": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 20,
            attribution: '&copy; CARTO'
        }),
        "Esri World Imagery (تصویر ماهواره‌ای)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        }),
        "OpenTopoMap (توپوگرافی)": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: 'Map data: &copy; OSM, SRTM'
        }),
        "Stamen Terrain (عوارض زمین)": L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: 'Map tiles by Stamen Design'
        })
    };

    // 2. مقداردهی اولیه نقشه (مختصات پیش‌فرض: ایران - تهران)
    const map = L.map('map', {
        center: [35.6892, 51.3890],
        zoom: 6,
        layers: [baseMaps["OpenStreetMap (استاندارد)"]] // لایه پیش‌فرض
    });

    // 3. شیء نگه‌دارنده اورلایرها (جهت توسعه در گام‌های بعدی)
    const overlayMaps = {};

    // 4. افزودن کنترل‌کننده لایه‌ها به نقشه
    const layerControl = L.control.layers(baseMaps, overlayMaps, {
        collapsed: false,
        position: 'topright'
    }).addTo(map);

    return { map, layerControl, overlayMaps };
}
