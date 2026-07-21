/**
 * گام ۴: ماژول زلزله و پایش بلایای طبیعی (USGS Earthquake API)
 */
export function initDisasterModule(map) {
    const eqLayerGroup = L.layerGroup().addTo(map);

    const chkEq = document.getElementById('chk-disaster-earthquakes');
    const selectMag = document.getElementById('select-eq-mag');

    async function loadEarthquakes() {
        eqLayerGroup.clearLayers();
        const magFilter = selectMag ? selectMag.value : 'all';
        
        let url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
        if (magFilter === '2.5') url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
        if (magFilter === '4.5') url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.features) {
                document.getElementById('eq-count').innerText = data.features.length;

                L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => {
                        const mag = feature.properties.mag;
                        
                        // تعیین رنگ و اندازه بر اساس بزرگای زلزله
                        let color = '#10b981'; // سبز برای زلزله‌های کوچک
                        if (mag >= 3.0) color = '#f59e0b'; // نارنجی
                        if (mag >= 5.0) color = '#ef4444'; // قرمز شدید

                        return L.circleMarker(latlng, {
                            radius: Math.max(mag * 2.5, 4),
                            fillColor: color,
                            color: '#fff',
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        });
                    },
                    onEachFeature: (feature, layer) => {
                        const props = feature.properties;
                        const date = new Date(props.time).toLocaleString('fa-IR');
                        layer.bindPopup(`
                            <b>🌋 زلزله: ${props.place}</b><br>
                            📊 بزرگی: <b>${props.mag} ریشتر</b><br>
                            📏 عمق: <b>${feature.geometry.coordinates[2]} کیلومتر</b><br>
                            ⏰ زمان: ${date}
                        `);
                    }
                }).addTo(eqLayerGroup);
            }
        } catch (err) {
            console.error('خطا در دریافت داده‌های زلزله:', err);
        }
    }

    if (chkEq) {
        chkEq.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.addLayer(eqLayerGroup);
                loadEarthquakes();
            } else {
                map.removeLayer(eqLayerGroup);
            }
        });
        
        // بارگذاری اولیه
        loadEarthquakes();
    }

    if (selectMag) {
        selectMag.addEventListener('change', () => {
            if (chkEq && chkEq.checked) loadEarthquakes();
        });
    }
}
