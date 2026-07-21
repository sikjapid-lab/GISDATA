/**
 * گام ۳: ماژول هواشناسی و اقلیم (Open-Meteo & OpenWeatherMap Tiles)
 */
export function initWeatherModule(map) {
    // لایه‌های رادار ابری و بارش (استفاده از تایلهای رایگان OpenWeatherMap)
    const OWM_KEY = 'b1b15e88fa797225412429c1c50c122a1'; // کلید متداول عمومی رایگان
    
    const cloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, { opacity: 0.6 });
    const precipitationLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`, { opacity: 0.7 });

    document.getElementById('chk-weather-clouds')?.addEventListener('change', (e) => {
        e.target.checked ? map.addLayer(cloudsLayer) : map.removeLayer(cloudsLayer);
    });

    document.getElementById('chk-weather-precipitation')?.addEventListener('change', (e) => {
        e.target.checked ? map.addLayer(precipitationLayer) : map.removeLayer(precipitationLayer);
    });

    // استعلام وضعیت دمایی نقطه با استفاده از API رایگان Open-Meteo (بدون نیاز به کلید)
    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        const infoBox = document.getElementById('weather-info-box');
        if (!infoBox) return;

        try {
            infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> دریافت اطلاعات دریافت هواشناسی...`;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
            const data = await res.json();

            if (data && data.current_weather) {
                const cw = data.current_weather;
                infoBox.innerHTML = `
                    <b>وضعیت آب و هوا:</b><br>
                    🌡️ دما: <b>${cw.temperature} °C</b><br>
                    💨 سرعت باد: <b>${cw.windspeed} km/h</b><br>
                    🧭 جهت باد: <b>${cw.winddirection}°</b>
                `;
            }
        } catch (err) {
            infoBox.innerHTML = 'خطا در دریافت اطلاعات هواشناسی.';
        }
    });
}
