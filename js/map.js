export function initMap() {
    // بیس‌لایرهای تضمین‌شده و پایدار
    const baseMaps = {
        "osm": {
            name: "OpenStreetMap (استاندارد)",
            layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: 'OSM' })
        },
        "carto-dark": {
            name: "CartoDB Dark Matter (تاریک)",
            layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: 'CARTO' })
        },
        "carto-light": {
            name: "CartoDB Positron (روشن)",
            layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, attribution: 'CARTO' })
        },
        "esri-sat": {
            name: "Esri World Imagery (ماهواره‌ای)",
            layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' })
        },
        "opentopo": {
            name: "OpenTopoMap (توپوگرافی)",
            layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: 'OTM' })
        }
    };

    const map = L.map('map', {
        center: [35.6892, 51.3890],
        zoom: 6,
        zoomControl: false,
        layers: [baseMaps["carto-dark"].layer] // پیش‌فرض تاریک و مدرن
    });

    // افزودن کنترل زوم به سمت چپ پایین
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // رندر منوی سفارشی در Sidebar
    const container = document.getElementById('base-layers-container');
    Object.keys(baseMaps).forEach((key, index) => {
        const item = baseMaps[key];
        const label = document.createElement('label');
        label.className = 'layer-radio';
        label.innerHTML = `
            <input type="radio" name="base-layer" value="${key}" ${index === 1 ? 'checked' : ''}>
            <span>${item.name}</span>
        `;
        
        label.querySelector('input').addEventListener('change', (e) => {
            Object.keys(baseMaps).forEach(k => map.removeLayer(baseMaps[k].layer));
            map.addLayer(baseMaps[e.target.value].layer);
        });

        container.appendChild(label);
    });

    return { map };
}
