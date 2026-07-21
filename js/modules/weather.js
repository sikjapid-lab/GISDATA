/**
 * ماژول پیشرفته هواشناسی و اقلیم
 */
export function initWeatherModule(map) {
    // رادار آنلاین RainViewer (بدون CORB و رایگان)
    const rainViewerLayer = L.tileLayer('https://tilecache.rainviewer.com/v2/radar/nowcast/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.6 });

    document.getElementById('chk-weather-radar')?.addEventListener('change', (e) => {
        e.target.checked ? map.addLayer(rainViewerLayer) : map.removeLayer(rainViewerLayer);
    });

    // لایه ابر OWM با کلید اختیاری
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

    // استعلام وضعیت جامع هواشناسی نقطه به محض کلیک
    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        const infoBox = document.getElementById('weather-info-box');
        if (!infoBox) return;

        infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> در حال استعلام داده‌های جامع اقلیمی...`;

        try {
            // ۱. دریافت نام مکان (Reverse Geocoding)
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const geoData = await geoRes.json();
            const locationName = geoData.display_name ? geoData.display_name.split(',').slice(0, 3).join(',') : 'نقطه انتخابی روی نقشه';

            // ۲. دریافت تمام پارامترهای هواشناسی از Open-Meteo
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
            
            const wRes = await fetch(weatherUrl);
            const wData = await wRes.json();

            if (wData && wData.current) {
                const c = wData.current;
                const d = wData.daily;

                infoBox.innerHTML = `
                    <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; margin-bottom:6px;">
                        <b>📍 مکان:</b> ${locationName}<br>
                        <b>🌐 مختصات:</b> <span style="font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
                    </div>
                    <b>📊 پارامترهای آنلاین:</b><br>
                    🌡️ دما: <b>${c.temperature_2m} °C</b> (احساس واقعی: ${c.apparent_temperature} °C)<br>
                    📈 بیشینه / کمینه امروز: <b>${d.temperature_2m_max[0]}°C / ${d.temperature_2m_min[0]}°C</b><br>
                    💧 رطوبت نسبی: <b>${c.relative_humidity_2m}%</b><br>
                    ☁️ پوشش ابر: <b>${c.cloud_cover}%</b><br>
                    💨 سرعت و جهت باد: <b>${c.wind_speed_10m} km/h</b> (${c.wind_direction_10m}°)<br>
                    ⏲️ فشار سطح: <b>${c.surface_pressure} hPa</b><br>
                    🌧️ بارش فعلی: <b>${c.precipitation} mm</b>
                `;
            }
        } catch (err) {
            console.error(err);
            infoBox.innerHTML = 'خطا در دریافت اطلاعات جامع هواشناسی.';
        }
    });
}
