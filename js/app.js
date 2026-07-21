import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. مقداردهی اولیه نقشه پایه
    const { map } = initMap();

    // ۲. بارگذاری ماژول‌های فعال
    initRoutingModule(map);
    initTrafficModule(map);
    initWeatherModule(map);

    // ۳. راه اندازی منطق اکاردئونی سایدبار
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });

    // ۴. منطق باز و بستن Sidebar
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
});
