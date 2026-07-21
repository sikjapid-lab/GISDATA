import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';
import { initDisasterModule } from './modules/disasters.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. مقداردهی اولیه نقشه
    const { map } = initMap();

    // ۲. بارگذاری کلیه ماژول‌ها
    try { initRoutingModule(map); } catch(e) { console.error(e); }
    try { initTrafficModule(map); } catch(e) { console.error(e); }
    try { initWeatherModule(map); } catch(e) { console.error(e); }
    try { initDisasterModule(map); } catch(e) { console.error(e); }

    // ۳. انیمیشن بستن سایدبار و رندر مجدد نقشه
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    toggleBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 300);
    });

    // ۴. مدیریت آکاردئون‌های سایدبار
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('active');
        });
    });

    // ۵. کلیدهای API
    const owmInput = document.getElementById('api-owm');
    const tomInput = document.getElementById('api-tomtom');

    if (owmInput) owmInput.value = localStorage.getItem('API_OWM') || '';
    if (tomInput) tomInput.value = localStorage.getItem('API_TOMTOM') || '';

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
        if (owmInput) localStorage.setItem('API_OWM', owmInput.value.trim());
        if (tomInput) localStorage.setItem('API_TOMTOM', tomInput.value.trim());
        alert('تنظیمات ذخیره شدند.');
    });
});
