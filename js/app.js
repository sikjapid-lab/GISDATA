import { initMap } from './map.js';
import { initRoutingModule } from './modules/routing.js';
import { initAnalysisModule } from './modules/analysis.js';
import { initTrafficModule } from './modules/traffic.js';
import { initWeatherModule } from './modules/weather.js';
import { initDisasterModule } from './modules/disasters.js';

document.addEventListener('DOMContentLoaded', () => {
    // ۱. راه اندازی هسته دو نقشه ۲D و ۳D
    const { map2D, viewer3D, drawnItems } = initMap();

    // ۲. راه اندازی کلیه ماژول‌ها
    try { initRoutingModule(map2D); } catch(e) { console.error(e); }
    try { initAnalysisModule(map2D, drawnItems); } catch(e) { console.error(e); }
    try { initTrafficModule(map2D); } catch(e) { console.error(e); }
    try { initWeatherModule(map2D); } catch(e) { console.error(e); }
    try { initDisasterModule(map2D); } catch(e) { console.error(e); }

    // ۳. مدیریت تغییر حالت نمایش (۲D / ۳D / Dual)
    const mapContainer = document.getElementById('map-container');
    const btn2D = document.getElementById('btn-mode-2d');
    const btn3D = document.getElementById('btn-mode-3d');
    const btnSplit = document.getElementById('btn-mode-split');

    function setViewMode(mode) {
        mapContainer.className = 'map-viewport-container';
        btn2D.classList.remove('active');
        btn3D.classList.remove('active');
        btnSplit.classList.remove('active');

        if (mode === 'split') {
            mapContainer.classList.add('mode-split');
            btnSplit.classList.add('active');
        } else if (mode === '3d') {
            mapContainer.classList.add('mode-3d');
            btn3D.classList.add('active');
        } else {
            btn2D.classList.add('active');
        }

        setTimeout(() => {
            map2D.invalidateSize();
            if (viewer3D) viewer3D.resize();
        }, 300);
    }

    btn2D?.addEventListener('click', () => setViewMode('2d'));
    btn3D?.addEventListener('click', () => setViewMode('3d'));
    btnSplit?.addEventListener('click', () => setViewMode('split'));

    // ۴. مدیریت سایدبار و آکاردئون‌ها
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    toggleBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        setTimeout(() => {
            map2D.invalidateSize();
            if (viewer3D) viewer3D.resize();
        }, 300);
    });

    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => header.parentElement.classList.toggle('active'));
    });

    // ۵. کلیدهای API
    const owmInput = document.getElementById('api-owm');
    const tomInput = document.getElementById('api-tomtom');

    if (owmInput) owmInput.value = localStorage.getItem('API_OWM') || '';
    if (tomInput) tomInput.value = localStorage.getItem('API_TOMTOM') || '';

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
        if (owmInput) localStorage.setItem('API_OWM', owmInput.value.trim());
        if (tomInput) localStorage.setItem('API_TOMTOM', tomInput.value.trim());
        alert('تنظیمات با موفقیت ذخیره شدند.');
    });
});
