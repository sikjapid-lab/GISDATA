/**
 * ماژول تحلیل‌های جئواینت: پروفایل ارتفاعی و شعاع دیدگاه/حریم عملیاتی
 */
export function initAnalysisModule(map, drawnItems) {
    const btnElevation = document.getElementById('btn-elevation-profile');
    const btnBuffer = document.getElementById('btn-draw-buffer');
    const infoBox = document.getElementById('analysis-info-box');

    let activeMode = null;

    if (btnElevation) {
        btnElevation.addEventListener('click', () => {
            activeMode = 'elevation';
            alert('لطفاً دو یا چند نقطه روی نقشه برای ترسیم مسیر تحلیل ارتفاعی انتخاب کنید.');
        });
    }

    if (btnBuffer) {
        btnBuffer.addEventListener('click', () => {
            activeMode = 'buffer';
            alert('لطفاً مرکز شعاع پوشش/دیدگاه را روی نقشه کلیک کنید.');
        });
    }

    let currentPoints = [];

    map.on('click', async (e) => {
        if (!activeMode) return;

        if (activeMode === 'buffer') {
            const radius = parseFloat(document.getElementById('input-buffer-radius').value) || 5000;
            const circle = L.circle(e.latlng, {
                radius: radius,
                color: '#06b6d4',
                fillColor: '#06b6d4',
                fillOpacity: 0.25,
                weight: 2
            }).addTo(drawnItems);

            circle.bindPopup(`<b>شعاع دیدگاه / پوشش:</b> ${(radius / 1000).toFixed(2)} کیلومتر`).openPopup();
            activeMode = null;
            if (infoBox) infoBox.innerHTML = `✅ دایره پوشش شعاعی به مرکز (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}) رسم شد.`;
        } 
        else if (activeMode === 'elevation') {
            currentPoints.push(e.latlng);
            L.circleMarker(e.latlng, { radius: 5, color: '#ef4444' }).addTo(drawnItems);

            if (currentPoints.length >= 2) {
                const line = L.polyline(currentPoints, { color: '#ef4444', weight: 4 }).addTo(drawnItems);
                calculateElevationProfile(currentPoints, line);
                activeMode = null;
                currentPoints = [];
            }
        }
    });

    async function calculateElevationProfile(points, lineLayer) {
        if (infoBox) infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> در حال استعلام عوارض زمین و محاسبه ارتفاع...`;

        const lats = points.map(p => p.lat).join(',');
        const lngs = points.map(p => p.lng).join(',');

        try {
            const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
            const data = await res.json();

            if (data && data.elevation) {
                const elevations = data.elevation;
                const minElev = Math.min(...elevations);
                const maxElev = Math.max(...elevations);
                const diff = maxElev - minElev;

                infoBox.innerHTML = `
                    <b>⛰️ نتیجه تحلیل ارتفاعی مسیر:</b><br>
                    🔺 حداقل ارتفاع: <b>${minElev} متر</b><br>
                    🔻 حداکثر ارتفاع: <b>${maxElev} متر</b><br>
                    📊 اختلاف ارتفاع کل: <b>${diff} متر</b>
                `;

                lineLayer.bindPopup(`<b>حداکثر ارتفاع:</b> ${maxElev}m | <b>حداقل:</b> ${minElev}m`).openPopup();
            }
        } catch (err) {
            console.error(err);
            if (infoBox) infoBox.innerHTML = 'خطا در محاسبه ارتفاع زمین.';
        }
    }
}
