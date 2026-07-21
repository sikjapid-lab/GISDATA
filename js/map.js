/* js/map.js */
let chartInstance = null;
let profileHoverMarker2D = null;
let profileHoverEntity3D = null;

export function initMap() {
    const baseMaps2D = {
        "google-sat": {
            name: "گوگل ارث (Google Earth)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 21 })
        },
        "google-hybrid": {
            name: "گوگل هیبرید (Google Hybrid)",
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 21 })
        },
        "osm": {
            name: "OpenStreetMap",
            layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
        }
    };

    const map2D = L.map('map-2d', {
        center: [35.6892, 51.3890],
        zoom: 6,
        zoomControl: false,
        layers: [baseMaps2D["google-sat"].layer]
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map2D);

    // راه‌اندازی سه‌بعدی Cesium
    let viewer3D = null;
    let isSyncing2D = false, isSyncing3D = false;

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
                infoBox: true, // فعال‌سازی Popup های ۳D
                selectionIndicator: true,
                imageryProvider: new Cesium.UrlTemplateImageryProvider({
                    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                    maximumLevel: 20
                })
            });

            if (Cesium.createWorldTerrain) {
                viewer3D.terrainProvider = Cesium.createWorldTerrain();
            }

            // سینک دوربین ۲D به ۳D
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

            // سینک دوربین ۳D به ۲D
            viewer3D.camera.moveEnd.addEventListener(() => {
                if (isSyncing2D || !viewer3D) return;
                isSyncing3D = true;
                const cartographic = Cesium.Cartographic.fromCartesian(viewer3D.camera.position);
                const lat = Cesium.Math.toDegrees(cartographic.latitude);
                const lng = Cesium.Math.toDegrees(cartographic.longitude);
                let zoom = Math.round(Math.log2(10000000 / cartographic.height)) + 1;
                zoom = Math.min(Math.max(zoom, 2), 19);

                map2D.setView([lat, lng], zoom, { animate: false });
                isSyncing3D = false;
            });

            setupBaseMapDropdown3D(viewer3D);
        } catch (e) {
            console.warn("خطا در بارگذاری Cesium 3D:", e);
        }
    }

    // لایه عوارض ترسیمی
    const drawnItems = new L.FeatureGroup();
    map2D.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polyline: { metric: true },
            polygon: { showArea: true },
            circle: true,
            rectangle: true,
            marker: true,
            circlemarker: false
        },
        edit: { featureGroup: drawnItems }
    });
    map2D.addControl(drawControl);

    // همگام‌سازی کلیه اشکال به ۳D
    map2D.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        syncLayerTo3D(layer, e.layerType, viewer3D);
    });

    // ثبت رویدادهای پروفایل ارتفاعی
    document.getElementById('btn-elevation-profile')?.addEventListener('click', () => {
        let targetLine = null;
        drawnItems.eachLayer((layer) => {
            if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                targetLine = layer;
            }
        });

        if (!targetLine) {
            alert("لطفاً ابتدا یک مسیر (Polyline) با ابزار رسم روی نقشه ترسیم کنید.");
            return;
        }

        generateAdaptiveElevationProfile(targetLine, map2D, viewer3D);
    });

    document.getElementById('btn-close-elevation')?.addEventListener('click', () => {
        document.getElementById('elevation-profile-panel').style.display = 'none';
        if (profileHoverMarker2D) map2D.removeLayer(profileHoverMarker2D);
        if (profileHoverEntity3D && viewer3D) viewer3D.entities.remove(profileHoverEntity3D);
    });

    setupBaseMapDropdown2D(map2D, baseMaps2D);

    // به‌روزرسانی مختصات موش‌واره
    map2D.on('mousemove', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('coord-dd').innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
        const utm = convertLatLngToUTM(lat, lng);
        document.getElementById('coord-utm').innerText = `Z${utm.zone}${utm.hemisphere} | E:${Math.round(utm.easting)} N:${Math.round(utm.northing)}`;
    });

    return { map2D, viewer3D, drawnItems };
}

/**
 * انتقال یک‌به‌یک لایه‌ها و اشکال از ۲D به ۳D
 */
export function syncLayerTo3D(layer, type, viewer3D) {
    if (!viewer3D) return;

    if (type === 'polyline' || layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs();
        const degreesArray = [];
        latlngs.forEach(pt => degreesArray.push(pt.lng, pt.lat));

        viewer3D.entities.add({
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(degreesArray),
                width: 4,
                material: Cesium.Color.CYAN,
                clampToGround: true
            }
        });
    } else if (type === 'polygon' || layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        const degreesArray = [];
        latlngs.forEach(pt => degreesArray.push(pt.lng, pt.lat));

        viewer3D.entities.add({
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArray),
                material: Cesium.Color.RED.withAlpha(0.4),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
    } else if (type === 'marker' || layer instanceof L.Marker) {
        const pt = layer.getLatLng();
        viewer3D.entities.add({
            position: Cesium.Cartesian3.fromDegrees(pt.lng, pt.lat),
            point: { pixelSize: 10, color: Cesium.Color.YELLOW }
        });
    }
}

/**
 * موتور استعلام آنلاین و ترسیم پروفایل ارتفاعی تعاملی
 */
async function generateAdaptiveElevationProfile(polylineLayer, map2D, viewer3D) {
    const latlngs = polylineLayer.getLatLngs();
    const samplesCount = 60;
    const interpolatedPoints = [];

    for (let i = 0; i < latlngs.length - 1; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[i + 1];
        const steps = Math.ceil(samplesCount / (latlngs.length - 1));
        for (let j = 0; j < steps; j++) {
            const t = j / steps;
            const lat = p1.lat + (p2.lat - p1.lat) * t;
            const lng = p1.lng + (p2.lng - p1.lng) * t;
            interpolatedPoints.push({ lat, lng });
        }
    }
    interpolatedPoints.push({ lat: latlngs[latlngs.length - 1].lat, lng: latlngs[latlngs.length - 1].lng });

    const locations = interpolatedPoints.map(p => ({ latitude: p.lat, longitude: p.lng }));

    try {
        const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locations })
        });
        const data = await res.json();
        const results = data.results;

        let totalDist = 0;
        const labels = [];
        const elevationData = [];
        let minElev = Infinity, maxElev = -Infinity, totalGain = 0;

        results.forEach((pt, idx) => {
            if (idx > 0) {
                const prev = results[idx - 1];
                const d = L.latLng(prev.latitude, prev.longitude).distanceTo(L.latLng(pt.latitude, pt.longitude));
                totalDist += d;
                const diff = pt.elevation - prev.elevation;
                if (diff > 0) totalGain += diff;
            }
            labels.push((totalDist / 1000).toFixed(2));
            elevationData.push(pt.elevation);

            if (pt.elevation < minElev) minElev = pt.elevation;
            if (pt.elevation > maxElev) maxElev = pt.elevation;
        });

        document.getElementById('stat-min').innerText = Math.round(minElev);
        document.getElementById('stat-max').innerText = Math.round(maxElev);
        document.getElementById('stat-gain').innerText = Math.round(totalGain);
        document.getElementById('stat-length').innerText = (totalDist / 1000).toFixed(2);
        document.getElementById('elevation-profile-panel').style.display = 'flex';

        const ctx = document.getElementById('elevationChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ارتفاع (متر)',
                    data: elevationData,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.25)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                onHover: (event, activeElements) => {
                    if (activeElements && activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const targetPt = results[index];
                        updateHoverMarkers(targetPt.latitude, targetPt.longitude, targetPt.elevation, map2D, viewer3D);
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'فاصله (کیلومتر)', color: '#94a3b8' }, ticks: { color: '#64748b' } },
                    y: { title: { display: true, text: 'ارتفاع (متر)', color: '#94a3b8' }, ticks: { color: '#64748b' } }
                },
                plugins: { legend: { display: false } }
            }
        });

    } catch (e) {
        console.error("خطا در استعلام ارتفاع:", e);
        alert("خطا در دریافت داده‌های ارتفاعی.");
    }
}

function updateHoverMarkers(lat, lng, elev, map2D, viewer3D) {
    if (!profileHoverMarker2D) {
        profileHoverMarker2D = L.circleMarker([lat, lng], { radius: 7, color: '#ef4444', fillColor: '#fff', fillOpacity: 1 }).addTo(map2D);
    } else {
        profileHoverMarker2D.setLatLng([lat, lng]);
    }

    if (viewer3D) {
        if (!profileHoverEntity3D) {
            profileHoverEntity3D = viewer3D.entities.add({
                position: Cesium.Cartesian3.fromDegrees(lng, lat, elev + 20),
                point: { pixelSize: 12, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 }
            });
        } else {
            profileHoverEntity3D.position = Cesium.Cartesian3.fromDegrees(lng, lat, elev + 20);
        }
    }
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
        "osm": "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
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

function convertLatLngToUTM(lat, lng) {
    const zone = Math.floor((lng + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'N' : 'S';
    const easting = 500000 + (lng - (zone * 6 - 183)) * 111320 * Math.cos(lat * Math.PI / 180);
    const northing = (lat >= 0 ? lat : lat + 90) * 110574;
    return { zone, hemisphere, easting, northing };
}
