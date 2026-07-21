/**
 * هسته نقشه‌های ۲D و ۳D، سینک لحظه‌ای و منوهای بیس‌لایر
 */
export function initMap() {
    // ۱. تعریف بیس‌لایرهای استاندارد ۲D و Google Earth
    const baseMaps2D = {
        "google-sat": {
            name: "گوگل ارث / ماهواره‌ای (Google Earth)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 21, attribution: 'Google Earth' })
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

    // ۲. راه اندازی نقشه ۲D Leaflet
    const map2D = L.map('map-2d', {
        center: [35.6892, 51.3890],
        zoom: 6,
        zoomControl: false,
        layers: [baseMaps2D["google-sat"].layer]
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map2D);

    // ۳. راه اندازی ایمن CesiumJS 3D Globe (جلوگیری از قفل شدن اسکریپت در صورت عدم بارگذاری CDN)
    let viewer3D = null;
    let isSyncing2D = false;
    let isSyncing3D = false;

    if (typeof Cesium !== 'undefined') {
        try {
            Cesium.Ion.defaultAccessToken = '';
            viewer3D = new Cesium.Viewer('map-3d', {
                animation: false,
                timeline: false,
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                fullscreenButton: false,
                imageryProvider: new Cesium.UrlTemplateImageryProvider({
                    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                    maximumLevel: 20
                })
            });

            if (Cesium.createWorldTerrain) {
                viewer3D.terrainProvider = Cesium.createWorldTerrain();
            }

            // سینک از ۲D به ۳D
            map2D.on('move', () => {
                if (isSyncing3D || !viewer3D) return;
                isSyncing2D = true;

                const center = map2D.getCenter();
                const zoom = map2D.getZoom();
                const height = Math.max(1000, 10000000 / Math.pow(2, zoom - 1));

                viewer3D.camera.setView({
                    destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, height)
                });

                isSyncing2D = false;
            });

            // سینک از ۳D به ۲D
            viewer3D.camera.moveEnd.addEventListener(() => {
                if (isSyncing2D || !viewer3D) return;
                isSyncing3D = true;

                const cartographic = Cesium.Cartographic.fromCartesian(viewer3D.camera.position);
                const lat = Cesium.Math.toDegrees(cartographic.latitude);
                const lng = Cesium.Math.toDegrees(cartographic.longitude);
                const height = cartographic.height;

                let zoom = Math.round(Math.log2(10000000 / height)) + 1;
                zoom = Math.min(Math.max(zoom, 2), 19);

                map2D.setView([lat, lng], zoom, { animate: false });

                isSyncing3D = false;
            });

            setupBaseMapDropdown3D(viewer3D);
        } catch (err) {
            console.warn("خطا در راه اندازی موتور 3D سزیوم:", err);
        }
    } else {
        console.warn("کتابخانه Cesium یافت نشد. برنامه در حالت 2D اجرا می‌شود.");
    }

    // ۴. ابزار رسم Leaflet Draw
    const drawnItems = new L.FeatureGroup();
    map2D.addLayer(drawnItems);

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
        edit: { featureGroup: drawnItems }
    });
    map2D.addControl(drawControl);

    map2D.on(L.Draw.Event.CREATED, (e) => {
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

    // ۵. مدیریت بیس‌مپ‌های ۲D
    setupBaseMapDropdown2D(map2D, baseMaps2D);

    // پرینت نقشه
    document.getElementById('btn-print-map')?.addEventListener('click', () => window.print());

    // ۶. پایش زنده مختصات
    map2D.on('mousemove', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('coord-dd').innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
        document.getElementById('coord-dms').innerText = `${toDMS(lat, 'lat')}, ${toDMS(lng, 'lng')}`;
        const utm = convertLatLngToUTM(lat, lng);
        document.getElementById('coord-utm').innerText = `Z${utm.zone}${utm.hemisphere} | E:${Math.round(utm.easting)} N:${Math.round(utm.northing)}`;
    });

    return { map2D, viewer3D, drawnItems };
}

function setupBaseMapDropdown2D(map2D, baseMaps) {
    const dropdown = document.getElementById('base-map-dropdown-2d');
    const toggleBtn = document.getElementById('btn-base-map-toggle-2d');

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
                Object.keys(baseMaps).forEach(k => map2D.removeLayer(baseMaps[k].layer));
                map2D.addLayer(item.layer);
                dropdown.querySelectorAll('.base-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
            });

            dropdown.appendChild(div);
        });
    }
}

function setupBaseMapDropdown3D(viewer3D) {
    const dropdown = document.getElementById('base-map-dropdown-3d');
    const toggleBtn = document.getElementById('btn-base-map-toggle-3d');

    const base3DSources = {
        "google-sat": "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        "google-hybrid": "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        "osm": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        "carto-dark": "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
    };

    if (toggleBtn && dropdown && viewer3D) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdown.classList.remove('show'));

        Object.keys(base3DSources).forEach((key, index) => {
            const div = document.createElement('div');
            div.className = `base-item ${index === 0 ? 'active' : ''}`;
            div.innerHTML = `<i class="fa-solid fa-globe"></i> <span>${key.toUpperCase()} (3D)</span>`;
            
            div.addEventListener('click', () => {
                viewer3D.imageryLayers.removeAll();
                viewer3D.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
                    url: base3DSources[key],
                    maximumLevel: 20
                }));
                dropdown.querySelectorAll('.base-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
            });

            dropdown.appendChild(div);
        });
    }
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
