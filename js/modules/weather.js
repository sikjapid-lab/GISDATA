/**
 * ماژول کامل هواشناسی (فعال‌سازی هوشمند فقط هنگام تیک زدن)
 */
export function initWeatherModule(map) {
    let rainViewerLayer = null;

    document.getElementById('chk-weather-radar')?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const infoBox = document.getElementById('weather-info-box');
            if (infoBox) infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> در حال دریافت رادار...`;

            try {
                const apiRes = await fetch('https://api.rainviewer.com/public/weather-maps.json');
                const apiData = await apiRes.json();

                if (apiData && apiData.radar && apiData.radar.past && apiData.radar.past.length > 0) {
                    const latestFrame = apiData.radar.past[apiData.radar.past.length - 1];
                    const tileUrl = `${apiData.host || 'https://tilecache.rainviewer.com'}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

                    if (rainViewerLayer) map.removeLayer(rainViewerLayer);
                    rainViewerLayer = L.tileLayer(tileUrl, { opacity: 0.65, maxZoom: 18 });
                    map.addLayer(rainViewerLayer);

                    if (infoBox) infoBox.innerHTML = `✅ رادار بارش زنده بارگذاری شد.`;
                }
            } catch (err) {
                console.error(err);
                e.target.checked = false;
            }
        } else if (rainViewerLayer) {
            map.removeLayer(rainViewerLayer);
        }
    });

    let owmCloudsLayer = null;
    document.getElementById('chk-weather-clouds')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const key = localStorage.getItem('API_OWM') || 'b1b15e88fa797225412429c1c50c122a1';
            owmCloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${key}`, { opacity: 0.6 });
            map.addLayer(owmCloudsLayer);
        } else if (owmCloudsLayer) {
            map.removeLayer(owmCloudsLayer);
        }
    });

    // استعلام روی نقشه فقط در صورت فعال بودن چک‌باکس مربوطه
    map.on('click', async (e) => {
        const isWeatherEnabled = document.getElementById('chk-weather-enable')?.checked;
        if (!isWeatherEnabled) return; // عدم اجرا اگر تیک نخورده باشد

        const { lat, lng } = e.latlng;
        const infoBox = document.getElementById('weather-info-box');
        if (!infoBox) return;

        infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> در حال استعلام اطلاعات...`;

        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const geoData = await geoRes.json();
            const locationName = geoData.display_name ? geoData.display_name.split(',').slice(0, 3).join(',') : 'نقطه انتخابی';

            const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
            const wData = await wRes.json();

            if (wData && wData.current) {
                const c = wData.current;
                const d = wData.daily;

                infoBox.innerHTML = `
                    <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; margin-bottom:6px;">
                        <b>📍 مکان:</b> ${locationName}<br>
                        <b>🌐 مختصات:</b> <span style="font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
                    </div>
                    <b>📊 پارامترها:</b><br>
                    🌡️ دما: <b>${c.temperature_2m} °C</b> (احساس واقعی: ${c.apparent_temperature} °C)<br>
                    📈 بیشینه / کمینه: <b>${d.temperature_2m_max[0]}°C / ${d.temperature_2m_min[0]}°C</b><br>
                    💧 رطوبت: <b>${c.relative_humidity_2m}%</b> | ☁️ ابر: <b>${c.cloud_cover}%</b><br>
                    💨 باد: <b>${c.wind_speed_10m} km/h</b> (${c.wind_direction_10m}°)<br>
                    ⏲️ فشار: <b>${c.surface_pressure} hPa</b>
                `;
            }
        } catch (err) {
            console.error(err);
            infoBox.innerHTML = 'خطا در دریافت اطلاعات هواشناسی.';
        }
    });
}
