/**
 * ماژول ناوبری و مسیریابی (Routing & Geocoding)
 */
export function initRoutingModule(map) {
    let startMarker = null;
    let endMarker = null;
    let routeLayer = null;
    let selectingMode = null; // 'start' or 'end'

    const routeOverlayGroup = L.layerGroup().addTo(map);

    // افزودن چک‌باکس ماژول به لیست Overlayها در Sidebar
    const overlayContainer = document.getElementById('overlay-layers-container');
    const label = document.createElement('label');
    label.className = 'layer-checkbox';
    label.innerHTML = `
        <input type="checkbox" id="chk-routing" checked>
        <span><i class="fa-solid fa-route"></i> سرویس مسیریابی و ناوبری</span>
    `;
    overlayContainer.appendChild(label);

    document.getElementById('chk-routing').addEventListener('change', (e) => {
        if (e.target.checked) {
            map.addLayer(routeOverlayGroup);
            document.getElementById('routing-panel').style.display = 'block';
        } else {
            map.removeLayer(routeOverlayGroup);
            document.getElementById('routing-panel').style.display = 'none';
        }
    });

    // ۱. Geocoding با استفاده از Nominatim (رایگان)
    document.getElementById('geo-search-btn').addEventListener('click', async () => {
        const query = document.getElementById('geo-search-input').value;
        if (!query) return;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const { lat, lon, display_name } = data[0];
                map.flyTo([lat, lon], 13);
                L.popup().setLatLng([lat, lon]).setContent(`<b>${display_name}</b>`).openOn(map);
            } else {
                alert('مکانی یافت نشد!');
            }
        } catch (err) {
            console.error(err);
        }
    });

    // ۲. انتخاب نقاط روی نقشه
    document.getElementById('btn-set-start').addEventListener('click', () => selectingMode = 'start');
    document.getElementById('btn-set-end').addEventListener('click', () => selectingMode = 'end');
    
    document.getElementById('btn-clear-route').addEventListener('click', () => {
        if (startMarker) routeOverlayGroup.removeLayer(startMarker);
        if (endMarker) routeOverlayGroup.removeLayer(endMarker);
        if (routeLayer) routeOverlayGroup.removeLayer(routeLayer);
        startMarker = null; endMarker = null; routeLayer = null;
        document.getElementById('route-info').innerHTML = '';
    });

    map.on('click', (e) => {
        if (!selectingMode) return;

        if (selectingMode === 'start') {
            if (startMarker) routeOverlayGroup.removeLayer(startMarker);
            startMarker = L.marker(e.latlng, { title: 'مبدا' }).addTo(routeOverlayGroup);
            selectingMode = null;
        } else if (selectingMode === 'end') {
            if (endMarker) routeOverlayGroup.removeLayer(endMarker);
            endMarker = L.marker(e.latlng, { title: 'مقصد' }).addTo(routeOverlayGroup);
            selectingMode = null;
        }

        if (startMarker && endMarker) {
            calculateRoute();
        }
    });

    // ۳. محاسبه مسیر با OSRM Public API
    async function calculateRoute() {
        const p1 = startMarker.getLatLng();
        const p2 = endMarker.getLatLng();
        
        const url = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.routes && data.routes.length > 0) {
                if (routeLayer) routeOverlayGroup.removeLayer(routeLayer);

                const route = data.routes[0];
                routeLayer = L.geoJSON(route.geometry, {
                    style: { color: '#3b82f6', weight: 5, opacity: 0.8 }
                }).addTo(routeOverlayGroup);

                const distanceKm = (route.distance / 1000).toFixed(2);
                const durationMin = Math.round(route.duration / 60);

                document.getElementById('route-info').innerHTML = `
                    مسافت: <b>${distanceKm} کیلومتر</b> | زمان تخمینی: <b>${durationMin} دقیقه</b>
                `;
            }
        } catch (err) {
            console.error('خطا در دریافت مسیر:', err);
        }
    }
}
