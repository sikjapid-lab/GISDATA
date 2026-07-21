/* js/modules/disasters.js */
let earthquakeLayer2D = null;
let earthquakeEntities3D = [];

export function initDisastersModule(map2D, viewer3D) {
    const chkEarthquakes = document.getElementById('chk-disaster-earthquakes');

    chkEarthquakes?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            await fetchAndRenderEarthquakes(map2D, viewer3D);
        } else {
            clearEarthquakes(map2D, viewer3D);
        }
    });
}

async function fetchAndRenderEarthquakes(map2D, viewer3D) {
    try {
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
        const data = await response.json();

        document.getElementById('eq-count').innerText = data.features.length;

        // ۱. رندر ۲D
        earthquakeLayer2D = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                const mag = feature.properties.mag || 1;
                return L.circleMarker(latlng, {
                    radius: Math.max(4, mag * 3),
                    fillColor: getColorByMag(mag),
                    color: '#ffffff',
                    weight: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const timeStr = new Date(p.time).toLocaleString('fa-IR');
                const popupContent = `
                    <div style="font-family:Vazirmatn, sans-serif; text-align:right;">
                        <h4 style="margin:0 0 5px; color:#ef4444;"><i class="fa-solid fa-volcano"></i> زلزله: ${p.place}</h4>
                        <b>بزرگی:</b> ${p.mag} ریشتر<br>
                        <b>عمق:</b> ${feature.geometry.coordinates[2]} کیلومتر<br>
                        <b>زمان:</b> ${timeStr}
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }).addTo(map2D);

        // ۲. همگام‌سازی و رندر ۳D
        if (viewer3D) {
            data.features.forEach(f => {
                const [lng, lat, depth] = f.geometry.coordinates;
                const p = f.properties;
                const mag = p.mag || 1;

                const entity = viewer3D.entities.add({
                    name: `زلزله: ${p.place}`,
                    position: Cesium.Cartesian3.fromDegrees(lng, lat, 1000),
                    point: {
                        pixelSize: Math.max(8, mag * 4),
                        color: Cesium.Color.fromCssColorString(getColorByMag(mag)),
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 1
                    },
                    description: `
                        <div style="direction:rtl; font-family:Tahoma, sans-serif;">
                            <h3>اطلاعات زمین‌لرزه</h3>
                            <p><b>مکان:</b> ${p.place}</p>
                            <p><b>بزرگی:</b> ${p.mag} ریشتر</p>
                            <p><b>عمق:</b> ${depth} کیلومتر</p>
                            <p><b>زمان:</b> ${new Date(p.time).toLocaleString('fa-IR')}</p>
                        </div>
                    `
                });
                earthquakeEntities3D.push(entity);
            });
        }

    } catch (err) {
        console.error("خطا در دريافت داده‌های زلزله:", err);
    }
}

function clearEarthquakes(map2D, viewer3D) {
    if (earthquakeLayer2D) {
        map2D.removeLayer(earthquakeLayer2D);
        earthquakeLayer2D = null;
    }
    if (viewer3D && earthquakeEntities3D.length > 0) {
        earthquakeEntities3D.forEach(ent => viewer3D.entities.remove(ent));
        earthquakeEntities3D = [];
    }
    document.getElementById('eq-count').innerText = '۰';
}

function getColorByMag(mag) {
    if (mag >= 6) return '#dc2626';
    if (mag >= 4) return '#f97316';
    if (mag >= 2) return '#eab308';
    return '#22c55e';
}
