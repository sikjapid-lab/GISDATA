/* js/modules/routing.js */
import { syncLayerTo3D } from '../map.js';

let startMarker = null, endMarker = null, routeLine = null;
let start3DEntity = null, end3DEntity = null, route3DEntity = null;
let isSettingStart = false, isSettingEnd = false;

export function initRoutingModule(map2D, viewer3D) {
    const btnStart = document.getElementById('btn-set-start');
    const btnEnd = document.getElementById('btn-set-end');
    const btnClear = document.getElementById('btn-clear-route');
    const btnSearch = document.getElementById('geo-search-btn');

    btnStart?.addEventListener('click', () => {
        isSettingStart = true;
        isSettingEnd = false;
        alert("روی نقشه کلیک کنید تا نقطه مبدأ تعیین شود.");
    });

    btnEnd?.addEventListener('click', () => {
        isSettingEnd = true;
        isSettingStart = false;
        alert("روی نقشه کلیک کنید تا نقطه مقصد تعیین شود.");
    });

    btnClear?.addEventListener('click', () => clearRoute(map2D, viewer3D));

    map2D.on('click', async (e) => {
        if (isSettingStart) {
            setStartPoint(e.latlng, map2D, viewer3D);
            isSettingStart = false;
        } else if (isSettingEnd) {
            setEndPoint(e.latlng, map2D, viewer3D);
            isSettingEnd = false;
        }

        if (startMarker && endMarker) {
            await calculateOSRMRoute(map2D, viewer3D);
        }
    });

    btnSearch?.addEventListener('click', async () => {
        const query = document.getElementById('geo-search-input').value;
        if (!query) return;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                map2D.setView([lat, lon], 12);
            } else {
                alert("مکان مورد نظر یافت نشد.");
            }
        } catch (e) {
            console.error("خطا در جستجو:", e);
        }
    });
}

function setStartPoint(latlng, map2D, viewer3D) {
    if (startMarker) map2D.removeLayer(startMarker);
    startMarker = L.marker(latlng, { title: "مبدأ" }).addTo(map2D).bindPopup("نقطه مبدأ").openPopup();

    if (viewer3D) {
        if (start3DEntity) viewer3D.entities.remove(start3DEntity);
        start3DEntity = viewer3D.entities.add({
            position: Cesium.Cartesian3.fromDegrees(latlng.lng, latlng.lat),
            point: { pixelSize: 12, color: Cesium.Color.GREEN }
        });
    }
}

function setEndPoint(latlng, map2D, viewer3D) {
    if (endMarker) map2D.removeLayer(endMarker);
    endMarker = L.marker(latlng, { title: "مقصد" }).addTo(map2D).bindPopup("نقطه مقصد").openPopup();

    if (viewer3D) {
        if (end3DEntity) viewer3D.entities.remove(end3DEntity);
        end3DEntity = viewer3D.entities.add({
            position: Cesium.Cartesian3.fromDegrees(latlng.lng, latlng.lat),
            point: { pixelSize: 12, color: Cesium.Color.RED }
        });
    }
}

async function calculateOSRMRoute(map2D, viewer3D) {
    const p1 = startMarker.getLatLng();
    const p2 = endMarker.getLatLng();
    const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

            if (routeLine) map2D.removeLayer(routeLine);
            routeLine = L.polyline(coords, { color: '#0284c7', weight: 5 }).addTo(map2D);

            document.getElementById('route-info').innerHTML = `
                مسافت: <b>${(route.distance / 1000).toFixed(2)} کیلومتر</b><br>
                زمان تقریبی: <b>${Math.round(route.duration / 60)} دقیقه</b>
            `;

            // نگاشت مسیر OSRM به ۳D Cesium
            if (viewer3D) {
                if (route3DEntity) viewer3D.entities.remove(route3DEntity);
                const degreesArr = [];
                route.geometry.coordinates.forEach(c => degreesArr.push(c[0], c[1]));

                route3DEntity = viewer3D.entities.add({
                    polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArray(degreesArr),
                        width: 5,
                        material: Cesium.Color.CYAN,
                        clampToGround: true
                    }
                });
            }
        }
    } catch (e) {
        console.error("خطا در محاسبه مسیر OSRM:", e);
    }
}

function clearRoute(map2D, viewer3D) {
    if (startMarker) map2D.removeLayer(startMarker);
    if (endMarker) map2D.removeLayer(endMarker);
    if (routeLine) map2D.removeLayer(routeLine);
    startMarker = null; endMarker = null; routeLine = null;

    if (viewer3D) {
        if (start3DEntity) viewer3D.entities.remove(start3DEntity);
        if (end3DEntity) viewer3D.entities.remove(end3DEntity);
        if (route3DEntity) viewer3D.entities.remove(route3DEntity);
        start3DEntity = null; end3DEntity = null; route3DEntity = null;
    }

    document.getElementById('route-info').innerHTML = '';
}
