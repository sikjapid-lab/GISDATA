import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';
import { initDisasterModule } from './modules/disasters.js';

document.addEventListener('DOMContentLoaded', () => {
    const { map } = initMap();

    // فعال‌سازی گام‌های ۱ تا ۴
    initRoutingModule(map);
    initTrafficModule(map);
    initWeatherModule(map);
    initDisasterModule(map);

    // انیمیشن سایدبار
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    toggleBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => map.invalidateSize(), 300);
    });

    // آکاردئون‌ها
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('active');
        });
    });
});
